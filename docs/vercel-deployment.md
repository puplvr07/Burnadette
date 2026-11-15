# Vercel deployment preparation

This change prepares two independent Vercel projects. It does not create/link
projects, configure accounts, deploy, push, or merge anything. Application source,
scientific behavior and the published JSON artifact remain unchanged.

| Setting | Backend project | Frontend project |
| --- | --- | --- |
| Root Directory | Repository root (`.`) | `frontend` |
| Framework preset | FastAPI | Vite |
| Configuration | Root `vercel.json`, `pyproject.toml` | `frontend/vercel.json` |
| Python | 3.12 (`.python-version`, `requires-python`) | Not applicable |
| Entrypoint | Native `api.main:app` | Vite's existing HTML entry |
| Build command | Framework default | `node scripts/build-vercel.mjs` |
| Output directory | Framework default | `dist` |
| Function | Resolved `api/main.py`, Fluid, maximum 60 seconds | Static assets |

The Root Directory is a project setting, not a `vercel.json` property. Do not
configure the backend root as `api`: it needs the repository-level Python project
and importable `api` package. The native ASGI adapter supports the existing
lifespan initialization; no WSGI shim or legacy `builds`/routing configuration is
introduced. The app's routes are `/meta`, `/regions`, `/calendar` and `/docs`.
There is no `/api` prefix.

## Environment settings for a future deployment

Configure these separately for the intended Preview and Production environments
after project/account setup is explicitly authorized:

* Backend `FRONTEND_ORIGINS`: comma-separated exact frontend origins such as
  `https://calendar.example.org`. No paths or trailing slashes. Use the actual
  approved frontend preview origins when testing previews; there is no wildcard
  allowlist. An unlisted origin receives no CORS allow-origin header.
* Frontend `VITE_API_URL`: the backend's HTTPS origin, such as
  `https://calendar-api.example.org`, optionally with one trailing `/`.
  Credentials, paths (including `/api`), query strings and fragments are rejected.
* Frontend `VITE_USE_FAKE`: leave unset or set `0`. Other nonempty values fail the
  deployment build. Vite embeds `VITE_*` values at build time, so changing the API
  origin requires rebuilding the frontend.

The normal backend already selects `published_json`. Leave `BURN_DATA_MODE`,
`BURN_PUBLISHED_PATH`, `BURN_DATA_PATH` and `BURN_MANIFEST_PATH` unset for this
deployment. Those local overrides can select fixtures or other paths and are not
needed for the bundled published data. No runtime data download is required.
No environment settings have been written to any Vercel project.

## Packaging boundaries

The backend function explicitly includes `api/data/published/**`. Its exclusions
remove local virtual environments, tests, test temporary directories, caches,
environment files, Vercel local state, root build outputs, the frontend, ML,
processed inputs, documentation, validation scripts and development data fixtures.
The existing API modules remain bundled because the entrypoint imports them even
when serving published data. The 147 published JSON files and their manifest
remain byte-for-byte pinned to ML revision
`0e6e66965e4782c369210a8d88dc62a538a0fcbf`.

Runtime dependencies are `fastapi==0.121.3` and `uvicorn==0.38.0`, listed in both
root `pyproject.toml` and `api/requirements.txt`; the validator checks parity.
`api/requirements-dev.txt` adds `httpx==0.28.1` and `pytest==9.0.1` for local tests.
Transitive packages retain the existing resolver behavior; this change does not
introduce a Python dependency lockfile.

The deployment-only frontend wrapper reads Vite's effective production dotenv
configuration, validates the API origin/fake setting, invokes the original
`npm run build`, then removes only generated `dist/data` and
`dist/fake_cell_week.csv`. It refuses linked cleanup targets. All source assets
under `public/` remain available for local static development. The original
`package.json` build/dev commands are unchanged. There is no root `.vercelignore`
that would accidentally remove sources from the independent frontend project.

Local `.vercel`, `.env.*`, staging directories and packaging reports are ignored.
Keep environment values in project settings/local ignored files; do not commit
account state or credentials.

## Local checks (PowerShell, from repository root)

Use the existing Python 3.12 virtual environment and installed frontend packages.
Only install packages if the environment is missing them:

```powershell
# Optional first-time setup only; may need network access.
py -3.12 -m venv api/.venv
api/.venv/Scripts/python.exe -m pip install -r api/requirements-dev.txt
Push-Location frontend
npm.cmd ci
Pop-Location
```

All validation commands below work without a Vercel login, CLI, account link or
network dependency installation:

```powershell
api/.venv/Scripts/python.exe -m pytest api/tests -q
api/.venv/Scripts/python.exe -m unittest discover -s scripts -p test_vercel_packaging.py -v
node --test frontend/scripts/build-vercel.test.mjs
api/.venv/Scripts/python.exe scripts/validate_vercel_package.py --report

# HTTPS example is a build-time placeholder, not a deployed backend.
$env:VITE_API_URL = 'https://burnadette-api.example.test'
$env:VITE_USE_FAKE = '0'
node frontend/scripts/build-vercel.mjs
Get-ChildItem frontend/dist -Recurse -File | Select-Object FullName, Length
Test-Path frontend/dist/data                  # False
Test-Path frontend/dist/fake_cell_week.csv    # False
Remove-Item Env:VITE_API_URL
Remove-Item Env:VITE_USE_FAKE

# Original local/static build still copies public data when no API env is set.
Push-Location frontend
npm.cmd run build
Pop-Location
```

Run deployment-output checks before the final local/static build, because the
original Vite build recreates its own `dist` output. Build guard tests cover valid
HTTPS origins, missing/HTTP/malformed origins, credentials, paths, normalization
tricks, query/fragment delimiters, fake mode, and selective output cleanup. The
packaging unit checks cover requirements parity, pinned inventory, source pruning
and retention of runtime modules/data. The existing backend regression suite
retains its development fixtures in the repository.

The packaging validator always creates a fresh unique directory under ignored
`.packaging/`, verifies confinement, and removes only that run's directory when
finished. It does not clear arbitrary existing paths. `--report` additionally
writes ignored `.packaging-report.json`; without the flag it prints the report.
The report includes the complete selected source inventory and exclusion patterns.

The validator copies installed runtime distributions plus their active transitive
dependencies, without pip installation or network access. It excludes test-only
packages. It verifies the pinned manifest SHA-256
`36bef71830c26f50b3dc4689eb022fbbfdb575f553880d85bcdd758814da3af5`
and every JSON checksum before and after staging. A child interpreter uses
isolated mode with staging first on its import path, checks module locations,
starts the app lifespan, checks metadata and regions, tests allowed/unlisted CORS
origins, and serializes full-history Indonesia responses for all three sources.
It measures the actual HTTP response body bytes, including response-model
serialization and null fields, without requiring the development HTTP client.

## Recorded validation and remaining limits

Measurements for this change are recorded below after running the local checks.
The local staging total is compared against 500,000,000 bytes and the largest
Indonesia serialized response against 4,500,000 bytes. These decimal thresholds
are deliberately conservative for the documented 500 MB / 4.5 MB limits.

| Check | Result |
| --- | --- |
| Deployment build guard and selective cleanup tests | 2 passed |
| Packaging boundary tests | 4 passed |
| Existing backend tests | 67 passed; one existing upstream warning |
| Published checksums in source and staging | 147 JSON files verified against the pinned manifest in each location |
| Runtime staging uncompressed size | 24,409,399 bytes; 475,590,601 bytes below the 500 MB threshold |
| Full-history Indonesia serialized response sizes | Harmonized 341,987 bytes; MODIS 293,919 bytes; VIIRS 294,725 bytes |
| Response headroom (largest of those responses) | 4,158,013 bytes below the 4.5 MB threshold |
| Deployment-only frontend build/output inventory | Passed locally using placeholder `https://burnadette-api.example.test`; generated runtime datasets absent |
| Actual deployment-wrapper rejection checks | Empty API URL, HTTP API URL, and fake mode each exited with status 1 before building |

The staging report used Windows Python 3.12.10 and confirmed that neither httpx nor
pytest was in the copied runtime dependency inventory. The staged lifespan and
all endpoint/CORS checks passed. The frontend placeholder above only checks the
build configuration; it does not identify a live backend.

The staging measurement is an **estimate of a bundle**, using the installed host
packages. Windows Python wheels/native files differ from Vercel's Linux Python
3.12 wheels; Vercel also adds builder/runtime support files and may compile
bytecode. This report is **not an actual Vercel artifact** and cannot prove the
final cloud bundle size or platform compatibility. It does prove staged data
integrity, import/lifespan success on the local host and the measured serialized
response sizes. No Linux runtime memory/RSS, cloud cold-start time, public routing,
deployment protection, latency or browser-to-cloud behavior has been measured.

## Future deployment procedure (not executed)

Once deployment/account operations are explicitly authorized, select the intended
Vercel team and create/link the two projects with the roots/settings above.
Select Hobby for both projects, use generated provider domains, and do not start
a Pro trial, buy seats/domains, or add paid integrations. If onboarding requires a
payment authorization, stop instead of upgrading. Free-tier exhaustion can pause
the demo; no paid fallback or automatic upgrade is authorized.
Configure each environment's API origin and exact CORS origins. Build the backend
with the native FastAPI preset and inspect the resulting function inventory:
confirm the resolved `api/main.py` setting, Python 3.12, Fluid, 60-second maximum,
all 147 published files plus manifest, no fixtures/test dependencies/duplicate
frontend data, and the actual uncompressed bundle below 500 MB.

Deploy a backend preview first and verify `/meta`, `/regions`, the complete
Indonesia `/calendar` query for each source, data revision and CORS headers.
Build/deploy the frontend preview against that exact backend origin and check its
output lacks `data/` and the fake CSV. In a browser verify initial loading,
regional/date/source selection, null/outage handling and exports against the
published API. Verify CORS and deployment protection allow the browser's requests;
do not mistake a successful local build for this end-to-end check.

Only after review of those actual artifacts and preview checks should a production
deployment be considered. Rebuild with Production environment values, verify the
reviewed deployment and production origins, and obtain the separately required
authorization for release. No production release or promotion is part of stages
1–2.

References (checked November 15, 2026): [FastAPI native entrypoint and function
configuration](https://vercel.com/docs/frameworks/backend/fastapi), [Python
runtime dependencies and exclusions](https://vercel.com/docs/functions/runtimes/python),
[Python version configuration](https://vercel.com/docs/functions/runtimes/python/python-version),
[Function limitations](https://vercel.com/docs/functions/limitations),
[Vercel project configuration](https://vercel.com/docs/project-configuration).
