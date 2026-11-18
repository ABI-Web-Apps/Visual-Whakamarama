# Visual Whakamārama (Te Uma)

An interactive breast education resource from the Auckland Bioengineering
Institute: anatomy, mammogram and MRI side by side for the four density
grades, benign findings and cancers, with a guided tour. Under YOUR RESULTS,
**My Images** shows a patient's own anatomy, mammogram and MRI in the same
three columns (only the MRI exists in the data so far; the other two hold their
place), and **My Report** shows their scan, one slice at a time or in 3D, with
the marked areas, beside their report summary (a PDF; read as page images on a
phone or tablet). Readers can send feedback or sign up to **Stay in touch** from
a button on every page, and **Contact us** puts them in touch with the team.

It runs two ways from one source tree:

| Mode | What runs | Entry |
|---|---|---|
| **Plugin** | The clinical dashboard portal mounts the UMD bundle and deploys the backend | `yarn build:plugin`, `config.portal.json` |
| **Standalone** | nginx + the Vue app + the FastAPI backend, via Docker | `docker compose up --build` |

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

The report is, for now, one fixed file: the client's one-page patient summary,
`resource-backend/app/reports/sub-1-patient-summary.pdf`, served for `sub-1` only
(any other patient's report column says "No report is available for this
scan."). `app/reports/summary.py` is the one place that knows this; the PDF will
become an input delivered in the dataset, read from MinIO like `findings_json`.
The backend no longer generates reports.

A browser with a mouse shows the PDF in an iframe. A touch device (phones,
tablets, iPadOS asking for the desktop site), where an iframe shows page 1 as a
still picture (iOS) or nothing (Android), gets the pages as images instead:
`GET /api/patients/<assay>/<cohort>/report/pages` lists them and
`.../report/pages/<n>.png` renders one (pypdfium2, 1600px wide, cached), with
**Open** handing the PDF to the device's own viewer.

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

Then open <http://localhost:3158/my-report>. The report works the same on a local
backend and in Docker.

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
MY_MRI_E2E=1 MY_MRI_BASE_URL=http://localhost:3158 yarn playwright test my-report
```

### Feedback, Stay in touch and the inbox

A button on every page (bottom-right; a round icon on a phone) opens a dialog
with two tabs: **Feedback** (how easy the page was, five faces, and one thing to
change) and **Stay in touch** (first name, optional, and an email address or
mobile number). Contact us has the Stay in touch form too.

| Endpoint | |
|---|---|
| `POST /api/feedback` | `{rating 1-5 or null, comment, page, device, app_version, mode}`; the backend adds a uuid and a UTC time |
| `POST /api/subscribers` | `{first_name, contact}`; a contact already on the list returns its entry (200) |
| `GET /api/feedback`, `GET /api/subscribers` | header `X-Feedback-Password` |
| `DELETE /api/feedback/<id>`, `DELETE /api/subscribers/<id>` | header `X-Feedback-Password` |

Nothing that identifies a browser is stored: no IP address, no user agent. The
client address is used only, in memory, to rate-limit posts.

Both lists are JSON Lines files in `FEEDBACK_DIR` (`feedback.jsonl`,
`subscribers.jsonl`), the named volume `feedback_data` in both compose files, so
rebuilds and redeploys keep them. **The portal's "delete plugin" runs
`docker compose down --volumes`, which deletes them**: export them first.

**The inbox** is `/feedback-review`, linked from nowhere: press **Ctrl + Shift +
F** (Ctrl on a Mac too) anywhere in the app, or tap the version line at the foot
of About five times quickly on a phone. It asks for a password, which only the
backend checks: `FEEDBACK_ADMIN_PASSWORD`, `qwerty` unless set. **Set your own on
any server** (in `.env`). The inbox lists both, newest first, deletes an entry
after a confirm, and exports either list as CSV.

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
backend image copies it.

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
> - `resource-backend/cache/`: report page images and meshes built from it
> - `resource-backend/feedback/`: readers' feedback and Stay in touch sign-ups
>   (names, emails, phone numbers), when the backend ran outside Docker
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
   `FEEDBACK_ADMIN_PASSWORD`).
2. Runs `docker compose up -d --build --remove-orphans` and waits up to five
   minutes for `/` and `/api/health` to answer.
3. Removes this stack's images that the rebuild left unused.

The release's commit must be on `main`: merge first. A release made from another
branch fails before it reaches the server. To put an earlier release back,
re-run its workflow run.

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

3. **The server.** Print the server's host key as the line the workflow pins,
   read from the server's own key file rather than scanned over the network,
   so nothing between you and the server can answer in its place. (Windows'
   `ssh-keyscan` cannot scan recent servers anyway: `choose_kex: unsupported
   KEX method`.) Put the server's address, as in `DEPLOY_HOST`, for `<host>`,
   or `[<host>]:<port>` if SSH is not on 22:

   ```bash
   echo "<host> $(cut -d' ' -f1,2 /etc/ssh/ssh_host_ed25519_key.pub)"
   ```

   It prints one line, `<host> ssh-ed25519 AAAA...`: the `DEPLOY_KNOWN_HOSTS`
   secret.

4. **GitHub, in the browser.** In the repository's Settings > Secrets and
   variables > Actions, add:

   | Kind | Name | Value |
   |---|---|---|
   | Secret | `DEPLOY_SSH_KEY` | the contents of `deploy_key` (the private key) |
   | Secret | `DEPLOY_KNOWN_HOSTS` | the line printed in step 3 |
   | Variable | `DEPLOY_HOST` | the server's address |
   | Variable | `DEPLOY_PATH` | the deploy folder, an absolute path |
   | Variable | `DEPLOY_USER` | only if not `ubuntu` |
   | Variable | `DEPLOY_PORT` | only if SSH is not on 22 |

   Then, on your machine, delete `deploy_key` and `deploy_key.pub`. The job
   runs in the `production` environment, so these can be set there instead
   (Settings > Environments), which can also require an approval per deploy.

5. **The server.** Check the deploy user can use Docker without `sudo`:
   `docker ps` must list containers, not fail with "permission denied". If it
   fails: `sudo usermod -aG docker ubuntu`, then log out and in again.

After a change to `scripts/deploy/` or the workflow, run
`bash scripts/deploy/test-server-deploy.sh`. It needs only bash and git: it runs
the script on scratch folders with docker and curl stubbed.

## Important documentation

- [Vue 3](https://vuejs.org/) and [Vite](https://vite.dev/)
- [Tailwind CSS 4](https://tailwindcss.com/docs)
- [Pinia](https://pinia.vuejs.org/)
- [FastAPI](https://fastapi.tiangolo.com/)
- [Threejs](https://threejs.org/docs/)
- [Copper3d](https://github.com/LinkunGao/copper3d_visualisation)
