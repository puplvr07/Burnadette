# Burnadette five-region JSON API

Run from the repository root in PowerShell using Python 3.12 (the pinned deployment runtime):

```powershell
py -3.12 -m venv api/.venv
api/.venv/Scripts/python -m pip install -r api/requirements-dev.txt
api/.venv/Scripts/python -m uvicorn api.main:app --host 127.0.0.1 --port 8000
```

Open http://127.0.0.1:8000/docs for interactive OpenAPI documentation.

```powershell
Invoke-RestMethod http://127.0.0.1:8000/meta
Invoke-RestMethod http://127.0.0.1:8000/regions
Invoke-RestMethod 'http://127.0.0.1:8000/calendar?bbox=102,10,108,15&start=2000-10-30&end=2025-12-22&source=harmonized&region=cambodia'
api/.venv/Scripts/python -m pytest api/tests -q
```

`api/requirements.txt` contains runtime dependencies only. The development file
adds the HTTP test client and pytest. See [Vercel deployment](../docs/vercel-deployment.md)
for the separate frontend/backend project configuration and offline packaging check.

The normal server uses the final JSON for Belgium, Cambodia, Philippines, Zambia
and Indonesia, pinned to ML commit 0e6e66965e4782c369210a8d88dc62a538a0fcbf.
Coverage is 1,313 Monday weeks, 2000-10-30 through 2025-12-22. There is no 2026 data.
Startup verifies the bundled artifact checksums and structural consistency.

Activity is an active-cell fraction, not hotspot count. Harmonized active_cells is
the sum of cell values and can be fractional during estimated weeks. Sensor views
report observed active-cell counts. Raw VIIRS is unavailable for the three flagged
2022 S-NPP outage weeks; harmonized activity remains MODIS-filled. Anomaly is gated
off. Only whole-grid harmonized bounds are supplied; subarea bounds and sensitivity
shares remain null. Regional calibration metadata is available through /regions.
See ../docs/json-integration.md for exact semantics and approval gates.

Use region=<slug> to resolve overlapping country products. An exact pilot bbox can
be inferred; ambiguous selections return 422 rather than mix products. Bboxes select
cell centers inclusively. Grid cells at sea or outside the source country remain in
the fraction denominator. Full Indonesia history fits the published query limits.

Configuration: FRONTEND_ORIGINS is a comma-separated exact-origin allowlist, defaulting
to http://localhost:5173 and http://127.0.0.1:5173. BURN_PUBLISHED_PATH can select
another local copy of the same pinned JSON artifact (including its manifest).
There are no automatic cloud downloads or silent fallback datasets.

The original 24-cell fixture is preserved for regression testing, with its two-cell
loading quarantine unchanged. To run that legacy profile explicitly:

```powershell
$env:BURN_DATA_MODE = 'development_sample'
api/.venv/Scripts/python -m uvicorn api.main:app --host 127.0.0.1 --port 8000
# Restore the default published profile before the next normal server/test run:
Remove-Item Env:BURN_DATA_MODE
```

The test factory create_app() retains its legacy default so all original cases run
against their original fixture. Published tests explicitly choose published_json.
BURN_DATA_PATH/BURN_MANIFEST_PATH apply to CSV modes only. The existing production
CSV mode still requires explicit paths and a matching manifest; it is not a cloud
deployment configuration. Tests use unique ignored temp directories and disable
pytest's cache plugin to avoid shared Windows temp/cache permissions problems.

Frontend integration is intentionally deferred. The frontend's existing count/share
types require coordinated nullable changes; merely configuring its API URL is not
the completed integration. No frontend files have been changed.
