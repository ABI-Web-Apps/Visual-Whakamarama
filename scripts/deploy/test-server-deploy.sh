#!/usr/bin/env bash
# Tests server-deploy.sh on scratch folders, with docker and curl stubbed.
# Needs bash and git only:
#
#   bash scripts/deploy/test-server-deploy.sh
#
# The script is fed on stdin, as the workflow runs it over SSH.
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
deploy="$here/server-deploy.sh"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

# This machine's git settings (autocrlf, helpers, hooks) stay out of it.
export HOME="$work/home" GIT_CONFIG_NOSYSTEM=1 GIT_TERMINAL_PROMPT=0
mkdir -p "$HOME"
export GIT_AUTHOR_NAME=test GIT_AUTHOR_EMAIL=test@example.invalid
export GIT_COMMITTER_NAME=test GIT_COMMITTER_EMAIL=test@example.invalid

failures=0
check() {
  local name=$1
  shift
  if "$@"; then printf 'ok   %s\n' "$name"; else printf 'FAIL %s\n' "$name"; failures=$((failures + 1)); fi
}
has() { grep -qF -- "$2" "$1"; }
lacks() { ! grep -qF -- "$2" "$1"; }
same() { [ "$(cat "$1")" = "$2" ]; }

# --- The repository: v1, then v2, which edits, drops and adds a file. -------
origin="$work/origin"
git init --quiet "$origin"
(
  cd "$origin"
  mkdir -p resource-backend
  printf 'minio_data/\ncache/\n' >resource-backend/.gitignore
  printf 'services: {}\n' >docker-compose.yml
  echo v1 >app.txt
  echo old >old.txt
  git add -A && git commit --quiet -m v1 && git tag v1
  echo v2 >app.txt
  git rm --quiet old.txt
  echo new >new.txt
  git add -A && git commit --quiet -m v2
  # Annotated, as a release made from the command line may be.
  git tag -a v2 -m v2
)
v1=$(git -C "$origin" rev-parse 'v1^{commit}')
v2=$(git -C "$origin" rev-parse 'v2^{commit}')

# --- Stubs: docker records what it is asked; curl fails CURL_FAILS times. ----
bin="$work/bin"
mkdir -p "$bin"
cat >"$bin/docker" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$*" >>"$DOCKER_LOG"
case "$*" in
  info) printf 'GIT_TOKEN=%s\n' "${GIT_TOKEN:-}" >>"$DOCKER_LOG" ;;
  "compose config") printf 'name: srv\nservices: {}\n' ;;
  "compose port frontend 80") printf '0.0.0.0:8080\n[::]:8080\n' ;;
esac
EOF
cat >"$bin/curl" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$*" >>"$CURL_LOG"
n=$(wc -l <"$CURL_LOG")
[ "$n" -gt "${CURL_FAILS:-0}" ]
EOF
chmod +x "$bin/docker" "$bin/curl"

# deploy <case> <dir> <tag> <commit>: runs it, leaving $work/<case>.{out,docker,curl}.
deploy() {
  local case=$1 dir=$2 tag=$3 commit=$4
  : >"$work/$case.docker"
  : >"$work/$case.curl"
  DOCKER_LOG="$work/$case.docker" CURL_LOG="$work/$case.curl" PATH="$bin:$PATH" \
    DEPLOY_HEALTH_TIMEOUT=${TIMEOUT:-30} DEPLOY_HEALTH_INTERVAL=0.1 \
    bash -s -- "$origin" "$tag" "$commit" "$dir" <"$deploy" >"$work/$case.out" 2>&1
}

# --- 1. A git checkout of v1 holding this server's state. --------------------
server="$work/server"
git clone --quiet "$origin" "$server"
git -C "$server" reset --quiet --hard v1
echo 'FRONTEND_PORT=8080' >"$server/.env"
mkdir -p "$server/resource-backend/minio_data/measurements"
echo dataset >"$server/resource-backend/minio_data/measurements/object"
echo notes >"$server/notes.txt"
printf 'services: {edited: on-server}\n' >"$server/docker-compose.yml"

status=0
CURL_FAILS=2 deploy upgrade "$server" v2 "$v2" || status=$?
check 'upgrade: succeeds' [ "$status" -eq 0 ]
check 'upgrade: the release is checked out' [ "$(git -C "$server" rev-parse HEAD)" = "$v2" ]
check 'upgrade: ...detached, the old branch left as it was' \
  [ -z "$(git -C "$server" symbolic-ref -q HEAD || true)" ]
check 'upgrade: tracked files are the release'"'"'s' same "$server/app.txt" v2
check 'upgrade: a file the release dropped is removed' [ ! -e "$server/old.txt" ]
check 'upgrade: a file the release added is there' same "$server/new.txt" new
check 'upgrade: .env stays' same "$server/.env" 'FRONTEND_PORT=8080'
check 'upgrade: the MinIO data stays' same "$server/resource-backend/minio_data/measurements/object" dataset
check 'upgrade: other untracked files stay' same "$server/notes.txt" notes
check 'upgrade: a server edit to a tracked file is replaced' same "$server/docker-compose.yml" 'services: {}'
backup=$(find "$server/.deploy-backups" -name '*-before-v2.patch' 2>/dev/null | head -n 1)
check 'upgrade: ...after being saved as a patch' has "${backup:-/dev/null}" 'services: {edited: on-server}'
check 'upgrade: ...and named in a warning' has "$work/upgrade.out" '::warning::'
check 'upgrade: rebuilds and restarts the stack' has "$work/upgrade.docker" 'compose up --detach --build --remove-orphans'
check 'upgrade: waits for the API on the published port' has "$work/upgrade.curl" 'http://127.0.0.1:8080/api/health'
check 'upgrade: ...until it answers' [ "$(wc -l <"$work/upgrade.curl")" -ge 3 ]
check 'upgrade: prunes only this stack'"'"'s old images' \
  has "$work/upgrade.docker" 'image prune --force --filter label=com.docker.compose.project=srv'

# --- 2. The same release again: nothing to back up. -------------------------
status=0
deploy again "$server" v2 "$v2" || status=$?
check 'redeploy: succeeds' [ "$status" -eq 0 ]
check 'redeploy: no warning without server edits' lacks "$work/again.out" '::warning::'
check 'redeploy: no second backup' [ "$(find "$server/.deploy-backups" -type f | wc -l)" -eq 1 ]

# --- 3. A folder copied by hand, not a checkout. ----------------------------
copied="$work/copied"
mkdir -p "$copied/resource-backend/minio_data"
git -C "$origin" archive v1 | tar -x -C "$copied"
echo 'stale build' >"$copied/app.txt"
echo dataset >"$copied/resource-backend/minio_data/object"
echo 'FRONTEND_PORT=8080' >"$copied/.env"
status=0
deploy copied "$copied" v2 "$v2" || status=$?
check 'copied folder: succeeds' [ "$status" -eq 0 ]
check 'copied folder: becomes a checkout of the release' [ "$(git -C "$copied" rev-parse HEAD)" = "$v2" ]
check 'copied folder: its copy of a tracked file is replaced' same "$copied/app.txt" v2
check 'copied folder: .env stays' same "$copied/.env" 'FRONTEND_PORT=8080'
check 'copied folder: the MinIO data stays' same "$copied/resource-backend/minio_data/object" dataset

# --- 4. A tag that does not match the release: refused, nothing changed. ----
before=$(git -C "$server" rev-parse HEAD)
status=0
deploy moved "$server" v2 "$v1" || status=$?
check 'moved tag: fails' [ "$status" -ne 0 ]
check 'moved tag: says why' has "$work/moved.out" "::error::Tag v2 is $v2, not the release's $v1"
check 'moved tag: the checkout is untouched' [ "$(git -C "$server" rev-parse HEAD)" = "$before" ]
check 'moved tag: the stack is untouched' lacks "$work/moved.docker" 'compose up'

# --- 5. A stack that never answers: fails with its state and logs. ----------
status=0
CURL_FAILS=1000000 TIMEOUT=1 deploy down "$server" v1 "$v1" || status=$?
check 'no answer: fails' [ "$status" -ne 0 ]
check 'no answer: says why' has "$work/down.out" '::error::The stack did not answer within 1s.'
check 'no answer: shows the containers and their logs' \
  has "$work/down.docker" 'compose logs --tail 80 backend frontend'
check 'no answer: keeps the old images for a look' lacks "$work/down.docker" 'image prune'

# --- 6. A private repository: the token reaches git as a password. ----------
helper=$(sed -n "s/^token_helper='\(.*\)'\$/\1/p" "$deploy")
answer=$(printf 'protocol=https\nhost=github.com\n\n' \
  | GIT_TOKEN=s3cret git -c credential.helper= -c "credential.helper=$helper" credential fill 2>/dev/null || true)
check 'token: git is given it as the password' grep -qx 'password=s3cret' <<<"$answer"
check 'token: with the user name GitHub expects' grep -qx 'username=x-access-token' <<<"$answer"

# --- 7. As the workflow sends it: a token line, then the script, to `sh`. ----
workflow="$here/../../.github/workflows/deploy_to_server.yml"
remote='read -r GIT_TOKEN && export GIT_TOKEN && exec bash -s --'
check 'workflow: still sends the script this way' has "$workflow" "remote='$remote'"
: >"$work/ssh.docker"
: >"$work/ssh.curl"
status=0
{ printf '%s\n' tok-123; cat "$deploy"; } \
  | DOCKER_LOG="$work/ssh.docker" CURL_LOG="$work/ssh.curl" PATH="$bin:$PATH" DEPLOY_HEALTH_INTERVAL=0.1 \
    sh -c "$remote \"\$@\"" sh "$origin" v2 "$v2" "$server" >"$work/ssh.out" 2>&1 || status=$?
check 'workflow: the script runs after the token line' [ "$status" -eq 0 ]
check 'workflow: ...with the token in its environment' has "$work/ssh.docker" 'GIT_TOKEN=tok-123'
check 'workflow: ...and the release deployed' [ "$(git -C "$server" rev-parse HEAD)" = "$v2" ]

# --- 8. Its arguments are checked. -------------------------------------------
status=0
bash -s -- only-one <"$deploy" >"$work/usage.out" 2>&1 || status=$?
check 'usage: refused without all four arguments' [ "$status" -ne 0 ]
check 'usage: says how to call it' has "$work/usage.out" 'usage: server-deploy.sh'

if [ "$failures" -ne 0 ]; then
  printf '\n%d failed. Outputs were in %s, now removed: comment out the trap line to keep them.\n' "$failures" "$work"
  exit 1
fi
printf '\nAll passed.\n'
