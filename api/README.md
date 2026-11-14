# Burnadette API

FastAPI starter for the Burning Activity Calendar backend.

## Local setup (PowerShell)

```powershell
cd api
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:FRONTEND_ORIGINS = "http://localhost:5173"
fastapi dev main.py
```

Open `http://127.0.0.1:8000/docs` for the interactive API docs. `GET /health` should return `{"status":"ok"}`.

## Current status

- `/meta`, `/regions`, and `/calendar` are placeholders that return HTTP 501 until implemented.
- Use fake `cell_week` data first, matching the team guide and the frontend contracts in `frontend/src/types.ts`.
- Confirm any differences between the team guide's data schema and the current frontend types with the team before implementing the response models.
- `/anomalies` is optional/stretch per the team guide.

Set `FRONTEND_ORIGINS` to a comma-separated list of allowed frontend origins. The default allows the local Vite dev server.

Do not commit secrets. Set deployment configuration through environment variables.

## Deploy

Deployment to Cloud Run should use the team's shared Google Cloud project. Coordinate with the cloud/data engineer before deploying.
