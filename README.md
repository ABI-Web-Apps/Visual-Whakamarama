# Visual Whakamārama (Te Uma)

An interactive breast education resource from the Auckland Bioengineering
Institute: anatomy, mammogram and MRI side by side for the four density
grades, benign findings and cancers, with a guided tour. Under YOUR RESULTS,
**My Images** shows a patient's own anatomy, mammogram and MRI in the same
three columns (only the MRI exists in the data so far; the other two hold their
place), and **My Report** shows their scan, one slice at a time or in 3D, with
the marked areas, beside a findings report (PDF) built from a dataset held in
MinIO.

It runs three ways from one source tree:

| Mode | What runs | Entry |
|---|---|---|
| **Plugin** | The clinical dashboard portal mounts the UMD bundle and deploys the backend | `yarn build:plugin`, `config.portal.json` |
| **Standalone** | nginx + the Vue app + the FastAPI backend, via Docker | `docker compose up --build` |
| **GitHub Pages** | The static app with the imaging catalogue copied beside it | `.github/workflows/deploy_on_github_pages.yml` |

```
Visual-Whakamarama/
├── resource-frontend/   Vue 3 + Vite + Tailwind CSS 4 + Pinia (no vue-router)
├── resource-backend/    FastAPI: the imaging catalogue and the patient's scan, mask and report under /api
├── config.portal.json   Portal registration metadata
├── docker-compose.yml   Standalone stack
├── scripts/             Asset pipeline (imaging, PWA icons)
├── assets-src/          Uncompressed source imaging (not committed)
└── plan/reference/      PRD, design system, UX review (not committed)
```

## Development

```bash
# Backend: the imaging catalogue on :8082
cd resource-backend
python -m venv .venv && .venv/Scripts/pip install -r requirements-dev.txt   # bin/ on macOS/Linux
.venv/Scripts/python -m uvicorn app.main:app --port 8082
.venv/Scripts/python -m pytest -q

# Frontend: http://localhost:3158
cd resource-frontend
yarn install
yarn dev
yarn test            # Vitest
yarn type-check      # vue-tsc over src/ and tooling/
yarn test:browser    # Playwright; starts both servers itself
yarn build           # standalone site  -> build/
yarn build:plugin    # portal UMD bundle -> dist/my-app.umd.js
yarn test:artefacts  # rebuilds both, then checks the 3D views paint in each
```

`yarn dev` talks to the backend on `http://localhost:8082` (see
`resource-frontend/.env.example`); the backend allows that origin by default.

### My Images and My Report

The patient pages (`/my-images`, `/my-images/mri`, `/my-report`) read a SPARC
dataset from the `measurements` bucket, so they need a MinIO with the dataset
in it. The education pages do not.

The report for sub-1 is filled from a demo reading, measured from the images and
chosen for the demo, which the backend lays over sub-1's unread record at report
time: nothing to upload. Every report says so under its masthead.
`DEMO_READINGS=0` turns it off; `resource-backend/demo/README.md` says where each
value came from.

MinIO publishes its API on host port 9000 and its console on 9001. When
something else already holds those ports (for example the validator), set
`MINIO_API_PORT` and `MINIO_CONSOLE_PORT` (say 9010 and 9011) for every
`docker compose` command in this repo. The local backend finds MinIO through
`MINIO_ENDPOINT`: `localhost:9000` by default, or `localhost:<MINIO_API_PORT>`
with the overrides.

These commands are for bash (Git Bash on Windows); a PowerShell version
follows.

```bash
# 1. Start MinIO only (prefix the port overrides if you need them).
docker compose up -d minio minio-init

# 2. Upload the dataset folder as measurements/workdir. MSYS_NO_PATHCONV=1 is
#    for Git Bash: without it the -v path is mangled and the mount silently does
#    not take effect. It does nothing elsewhere. The keys are expanded inside
#    the container, from the compose file's MINIO_ROOT_USER/MINIO_ROOT_PASSWORD.
MSYS_NO_PATHCONV=1 docker compose run --rm --no-deps -v "./resource-backend/static/workdir:/w:ro" --entrypoint sh minio-init \
  -c 'mc alias set l http://minio:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD && mc mirror --overwrite /w l/measurements/workdir'

# 3. Run the backend against it (localhost:9010 with the overrides).
cd resource-backend
MINIO_ENDPOINT=localhost:9000 .venv/Scripts/python -m uvicorn app.main:app --port 8082
```

The same in PowerShell. `$env:` settings last for the rest of the session.
Leave out the first line when 9000/9001 are free, and then use
`$env:MINIO_ENDPOINT='localhost:9000'`.

```powershell
$env:MINIO_API_PORT='9010'; $env:MINIO_CONSOLE_PORT='9011'
docker compose up -d minio minio-init
docker compose run --rm --no-deps -v "./resource-backend/static/workdir:/w:ro" --entrypoint sh minio-init -c 'mc alias set l http://minio:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD && mc mirror --overwrite /w l/measurements/workdir'
cd resource-backend
$env:MINIO_ENDPOINT='localhost:9010'; .venv\Scripts\python -m uvicorn app.main:app --port 8082
```

Instead of step 2 you can upload through the MinIO console
(<http://localhost:9001>, or your `MINIO_CONSOLE_PORT`; `minioadmin` /
`minioadmin`): open the `measurements` bucket and upload the contents of
`static/workdir/` into a `workdir/` folder.

Then open <http://localhost:3158/my-report>. The report is a WeasyPrint PDF, which
needs system libraries (Pango, fonts) that only the Docker image installs: on a
local backend the report column shows "Report rendering needs the Docker
backend." and the PDF tests are skipped. Use the full Docker stack to see the
report.

`resource-frontend/test-browser/my-report.spec.ts` covers the page end to end. It
runs only with `MY_MRI_E2E=1` and a dataset in place. Its base URL is the Docker
stack on :3159 by default. The standalone stack publishes on :3158 unless told
otherwise, so bring it up with the port the spec expects (plus the MinIO port
overrides, if you use them):

```bash
FRONTEND_PORT=3159 docker compose up --build -d
cd resource-frontend
MY_MRI_E2E=1 yarn playwright test my-report
```

`playwright.config.ts` always declares `webServer` entries (`yarn dev` on :3158
and uvicorn on :8082, `reuseExistingServer: true`), so running the spec also
starts a local dev server and backend when none is running; against the Docker
stack they are simply unused.

To run it against a local backend instead, the dev server and a backend started
with `MINIO_ENDPOINT` pointing at your MinIO (step 3 above) must already be
running: a uvicorn that Playwright spawns itself does not have that variable.

```bash
MY_MRI_E2E=1 MY_MRI_BASE_URL=http://localhost:3158 MY_MRI_BACKEND=local yarn playwright test my-report
```

### Data

The dataset (`resource-backend/static/workdir/`, a SPARC dataset with the
registered MRI, the researcher's mask and a findings JSON per patient) is
patient data. It lives in the `measurements` bucket under `workdir/`, and is
**never committed or baked into the image**: `static/workdir/` and
`minio_data/` are gitignored, and the image ships only `static/modelView/`. The
backend finds files by their Sample Type in `samples.xlsx`, never by filename,
reads volumes into memory, and writes nothing back to MinIO.

The page reads which patient, dataset and MinIO to use from
`resource-frontend/src/assets/tool_config.json` through `getToolConfig()` in
`src/myMri/config.ts`. That function is the seam the portal will replace to
supply its own config.

## How it fits the portal

- **No vue-router.** The portal owns the address bar. Pages are chosen by a
  small route table (`src/navigation/`): it follows the URL in standalone
  mode and runs in memory as a plugin. Links are `<AppLink>`.
- **Externals.** The plugin build leaves Vue, Pinia, Vuetify and
  vue-toastification to the portal's globals, as the portal's builder requires.
- **CSS isolation.** Every Tailwind utility carries the `tw:` prefix, so the
  portal's Vuetify utility classes of the same names (`text-caption`,
  `bg-surface`, ...) never land on this app's markup. The plugin build also
  scopes every rule under `.vw-root` and flattens Tailwind's cascade layers
  into specificity tiers (`tooling/postcss-scope.ts`), so the portal's
  unlayered resets cannot override the app and the app's CSS cannot reach the
  portal.
- **Assets.** Imaging comes from the backend (`<route prefix>/api/modelView/`);
  logos, portraits and the Draco decoder ship inside the build and resolve
  against the bundle's own URL.

## Assets

Imaging assets are produced by a compression pipeline. Put the uncompressed
sources under `assets-src/modelView/`, then:

```bash
node scripts/optimize-assets.mjs   # -> resource-backend/static/modelView/
```

The pipeline re-encodes NRRD volumes as gzip, compresses GLB geometry with
Draco, and skips the 12 files an md5 audit identified as placeholder copies.
The generated `resource-backend/static/modelView/` **is** committed: the
backend image and the GitHub Pages build both copy it.

The four `density*.glb` anatomy models are derived from `density-3` by adding
and removing whole mammary lobes:

```bash
node scripts/build-density-models.mjs [--dry-run]
```

PWA icons are generated from `resource-frontend/public/icon.png`:

```bash
cd resource-frontend && yarn icons
```

The scripts resolve their tools (`@gltf-transform`, `pngjs`) from
`resource-frontend/node_modules`, so run `yarn install` there first.

## Deployment

### Portal plugin

Register the GitHub repository in the portal. The builder reads
`config.portal.json`, runs `yarn build:plugin` in `resource-frontend/`, and
deploys `resource-backend/docker-compose.yml` onto the `digitaltwins-platform`
network. Nginx then routes `/plugin/<expose_name>/` to the backend container on
port 8082.

> [!WARNING]
> **Never upload your working folder to the portal.** The portal's folder/zip
> upload copies the whole project, everything except `.git`, `node_modules`,
> `dist` and `build`, into its **public** `tools` bucket. A development
> checkout holds patient data that would then be public:
>
> - `resource-backend/static/workdir/`: the patient dataset
> - `resource-backend/minio_data/`: the local MinIO's storage, the same data again
> - `resource-backend/cache/`: report PDFs and meshes built from it
>
> To register without GitHub, upload a clean export of the committed tree,
> which holds none of them:
> `git archive --format=zip -o visual-whakamarama.zip HEAD`.

The backend reads the dataset from the **portal's** MinIO: the plugin compose
takes its keys from `MINIO_SERVER_ACCESS_KEY` / `MINIO_SERVER_SECRET_KEY`
(default `minioadmin`) and reaches it as `minio:9000` on that network. Upload
the dataset to that MinIO's `measurements` bucket as `workdir/`.

### Standalone (Docker)

```bash
docker compose up --build   # http://localhost:3158
```

The standalone stack includes its own MinIO (`pgsty/minio`), which `minio-init`
gives a `measurements` bucket. Its API and console are published on 9000/9001;
override with `MINIO_API_PORT`, `MINIO_CONSOLE_PORT` and `FRONTEND_PORT` when
those are taken. Upload the dataset as in the My Images and My Report section above.

### Server (on release)

Publishing a release deploys it to a server running the standalone stack.
`.github/workflows/deploy_to_server.yml` connects over SSH and runs
`scripts/deploy/server-deploy.sh` in the deploy folder, which:

1. Fetches the release's tag and checks it out. Only the files the repository
   tracks change, and files the release dropped are removed. Untracked and
   ignored files stay: `.env`, `resource-backend/minio_data/` (the dataset in
   MinIO), `resource-backend/static/workdir/`. Edits made on the server to
   tracked files are saved to `.deploy-backups/` first and listed as a warning
   in the run, so keep server settings in `.env` (`FRONTEND_PORT`, `MINIO_*`,
   `DEMO_READINGS`).
2. Runs `docker compose up -d --build --remove-orphans` and waits up to five
   minutes for `/` and `/api/health` to answer.
3. Removes this stack's images that the rebuild left unused.

The release's commit must be on `main`: merge first. A release made from another
branch fails before it reaches the server. To put an earlier release back,
re-run its workflow run. A release also runs the GitHub Pages workflow, as
before.

A first deploy into a folder set up by hand works. A git clone is updated in
place, and a copied folder becomes a checkout. Compose names the stack after the
folder, so if the old stack was started there, its containers are replaced, not
duplicated.

**One-time setup.** The server needs git, Docker with Compose v2, curl, and a
deploy user in the `docker` group. GitHub's runners connect from the internet,
so the server must accept SSH from outside its own network. If it does not, the
run stops at "Reach the server" with a timeout.

Each step says where it runs. On your machine, use bash (Git Bash on Windows:
Windows PowerShell writes `>` output as UTF-16, which ssh cannot read), in your
home folder, not in this repository, so the private key cannot be committed by
accident.

1. **Your machine.** Make a key for the workflow alone. Press Enter at both
   passphrase prompts: the workflow cannot type one.

   ```bash
   cd ~
   ssh-keygen -t ed25519 -C 'github-actions deploy' -f deploy_key
   ```

2. **Your machine.** Let the key in on the server. This logs in the way you
   do today (password or your own key) and appends the new public key to the
   server's `~/.ssh/authorized_keys`:

   ```bash
   cat deploy_key.pub | ssh ubuntu@<host> 'mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys'
   ```

   If you reach the server some other way, append the single line of
   `deploy_key.pub` to `~/.ssh/authorized_keys` on the server instead.

3. **Your machine.** Record the server's host key, which the workflow pins,
   and print its fingerprints:

   ```bash
   ssh-keyscan -t ed25519,ecdsa,rsa <host> > deploy_known_hosts
   ssh-keygen -lf deploy_known_hosts
   ```

   **The server.** Print its own fingerprints. They must match the ones above;
   if not, something between you and the server answered instead:

   ```bash
   for f in /etc/ssh/ssh_host_*_key.pub; do ssh-keygen -lf "$f"; done
   ```

4. **GitHub, in the browser.** In the repository's Settings > Secrets and
   variables > Actions, add:

   | Kind | Name | Value |
   |---|---|---|
   | Secret | `DEPLOY_SSH_KEY` | the contents of `deploy_key` (the private key) |
   | Secret | `DEPLOY_KNOWN_HOSTS` | the contents of `deploy_known_hosts` |
   | Variable | `DEPLOY_HOST` | the server's address |
   | Variable | `DEPLOY_PATH` | the deploy folder, an absolute path |
   | Variable | `DEPLOY_USER` | only if not `ubuntu` |
   | Variable | `DEPLOY_PORT` | only if SSH is not on 22 |

   Then, on your machine, delete `deploy_key`, `deploy_key.pub` and
   `deploy_known_hosts`. The job runs in the `production` environment, so
   these can be set there instead (Settings > Environments), which can also
   require an approval per deploy.

5. **The server.** Check the deploy user can use Docker without `sudo`:
   `docker ps` must list containers, not fail with "permission denied". If it
   fails: `sudo usermod -aG docker ubuntu`, then log out and in again.

After a change to `scripts/deploy/` or the workflow, run
`bash scripts/deploy/test-server-deploy.sh`. It needs only bash and git: it runs
the script on scratch folders with docker and curl stubbed.

### GitHub Pages

`.github/workflows/deploy_on_github_pages.yml` builds the standalone app under
`/<repo>/`, copies the imaging catalogue beside it (`VITE_ASSET_BASE`), and
publishes to the `gh-pages` branch. It runs on a new release, or on demand
from the Actions tab. Pages has no backend, so that build leaves the patient pages out:
setting `VITE_ASSET_BASE` hides My results and makes `/my-images`,
`/my-images/mri`, `/my-report` (and the old `/my-mri`) 404
(`hasBackend()` in `src/runtime/env.ts`).

## Important documentation

- [Vue 3](https://vuejs.org/) and [Vite](https://vite.dev/)
- [Tailwind CSS 4](https://tailwindcss.com/docs)
- [Pinia](https://pinia.vuejs.org/)
- [FastAPI](https://fastapi.tiangolo.com/)
- [Threejs](https://threejs.org/docs/)
- [Copper3d](https://github.com/LinkunGao/copper3d_visualisation)
