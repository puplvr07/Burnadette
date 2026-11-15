# Burnadette local API MVP

Run from the repository root in PowerShell (Python 3.12+; verified here on 3.14):

```powershell
python -m venv api/.venv
api/.venv/Scripts/python -m pip install -r api/requirements.txt
api/.venv/Scripts/python -m uvicorn api.main:app --host 127.0.0.1 --port 8000
```

Open http://127.0.0.1:8000/docs for interactive OpenAPI documentation.

```powershell
Invoke-RestMethod http://127.0.0.1:8000/meta
Invoke-RestMethod http://127.0.0.1:8000/regions
Invoke-RestMethod 'http://127.0.0.1:8000/calendar?bbox=102,10,103.5,15&start=2015-01-05&end=2015-01-05&source=harmonized'
api/.venv/Scripts/python -m pytest api/tests -q
```

The default dataset is the bundled, checksum-verified 24-cell Cambodia development
fixture. Loading quarantines two cells, serving only 22 cells during 2015-2018.
The original fixture is never rewritten. It is not full Cambodia or full historical
coverage. Activity is a fraction, not hotspot count. Anomaly remains unavailable.
See ../docs/decisions.md for the provisional contract and outstanding approvals.

Configuration: FRONTEND_ORIGINS is a comma-separated exact-origin allowlist, defaulting
to http://localhost:5173 and http://127.0.0.1:5173. BURN_DATA_PATH and
BURN_MANIFEST_PATH override local artifact paths. BURN_DATA_MODE defaults to
development_sample; production requires both explicit paths and a matching manifest.
No cloud downloads, credentials, or fallback datasets are used.

Frontend integration is intentionally deferred. The frontend's existing count/share
types require coordinated nullable changes; merely configuring its API URL is not
the completed integration. No frontend files have been changed.
