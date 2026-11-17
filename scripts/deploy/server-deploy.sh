#!/usr/bin/env bash
# Deploys one release to the standalone Docker stack (docker-compose.yml) on
# the server it runs on.
#
#   server-deploy.sh <repo-url> <tag> <commit> <dir>
#
# .github/workflows/deploy_to_server.yml runs it over SSH with the script on
# stdin; it can also be run by hand on the server to redeploy a tag. With the
# repository private, GIT_TOKEN in the environment is used to fetch it.
#
# What it changes in <dir>:
#   - the files the repository tracks become exactly the release's: a detached
#     `git checkout --force`, which also removes files the release dropped;
#   - nothing else. Untracked and ignored files are where this server's state
#     lives (.env, resource-backend/minio_data -- the dataset, static/workdir),
#     and git never touches them. Edits made on the server to tracked files are
#     saved as a patch in .deploy-backups/ before they are overwritten: put
#     server settings in .env instead (FRONTEND_PORT, MINIO_*, DEMO_READINGS).
#
# Then it rebuilds and restarts the stack, waits until the site and its API
# answer, and removes the images the rebuild left unused.
set -euo pipefail

# How long the stack gets to answer after `up`, and how often it is asked.
HEALTH_TIMEOUT=${DEPLOY_HEALTH_TIMEOUT:-300}
HEALTH_INTERVAL=${DEPLOY_HEALTH_INTERVAL:-5}

log() { printf '==> %s\n' "$*"; }
# Workflow commands: the runner reads them from this script's output over SSH.
die() { printf '::error::%s\n' "$*"; exit 1; }

[ "$#" -eq 4 ] || die "usage: server-deploy.sh <repo-url> <tag> <commit> <dir>"
repo_url=$1 tag=$2 commit=$3 dir=$4

for tool in git docker curl; do
  command -v "$tool" >/dev/null || die "$tool is not installed on this server."
done
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 (docker compose) is not available."
docker info >/dev/null 2>&1 \
  || die "$(id -un) cannot reach the Docker daemon. Add it to the docker group: sudo usermod -aG docker $(id -un)"

mkdir -p "$dir"
cd "$dir"

if [ ! -e .git ]; then
  # A folder copied here by hand: make it a checkout. Its files stay where
  # they are; the release's own files replace theirs below.
  log "$dir is not a git checkout yet; making it one (existing files stay)."
  git init --quiet
fi

# The token, when there is one, reaches git through its environment, never a
# command line, so it does not show in `ps`. The empty helper first drops any
# helper this server has configured for github.com.
# shellcheck disable=SC2016  # expanded by the helper's own shell, not this one
token_helper='!f() { test "$1" = get || exit 0; echo username=x-access-token; echo "password=${GIT_TOKEN}"; }; f'

log "Fetching $tag"
GIT_TERMINAL_PROMPT=0 git -c credential.helper= -c "credential.helper=$token_helper" \
  fetch --quiet --force --no-tags "$repo_url" "+refs/tags/$tag:refs/tags/$tag"
fetched=$(git rev-parse "refs/tags/$tag^{commit}")
[ "$fetched" = "$commit" ] \
  || die "Tag $tag is $fetched, not the release's $commit. Was the tag moved? Nothing was changed."

previous=$(git rev-parse --quiet --verify HEAD || true)
if [ -n "$previous" ] && ! git diff --quiet HEAD; then
  mkdir -p .deploy-backups
  backup=".deploy-backups/$(date -u +%Y%m%dT%H%M%SZ)-before-$(printf '%s' "$tag" | tr '/' '_').patch"
  git diff --binary HEAD >"$backup"
  printf '::warning::This server had edits to tracked files, now replaced by %s. They are saved in %s/%s:\n' \
    "$tag" "$dir" "$backup"
  git diff --name-only HEAD | sed 's/^/    /'
fi

git checkout --quiet --force --detach "$commit"
log "Checked out $tag ($commit)${previous:+, replacing $previous}"

log "Building and starting the stack"
docker compose up --detach --build --remove-orphans

project=$(docker compose config | sed -n 's/^name: *//p' | head -n 1)
port=$(docker compose port frontend 80 | head -n 1 | sed 's/.*://')
[ -n "$port" ] || die "The frontend publishes no port; see docker compose ps."

log "Waiting for http://127.0.0.1:$port/ and its API"
deadline=$((SECONDS + HEALTH_TIMEOUT))
until curl -fsS -o /dev/null "http://127.0.0.1:$port/api/health" \
  && curl -fsS -o /dev/null "http://127.0.0.1:$port/"; do
  if [ "$SECONDS" -ge "$deadline" ]; then
    docker compose ps || true
    docker compose logs --tail 80 backend frontend || true
    die "The stack did not answer within ${HEALTH_TIMEOUT}s. $tag is checked out and its containers are as above."
  fi
  sleep "$HEALTH_INTERVAL"
done

# Each rebuild leaves the previous images untagged, and the backend's carries
# the ~350MB catalogue. Only this stack's: compose labels what it builds.
if [ -n "$project" ]; then
  docker image prune --force --filter "label=com.docker.compose.project=$project" >/dev/null
fi

log "Deployed $tag ($commit)"
docker compose ps
