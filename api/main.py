import os
from datetime import date
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Burnadette API", version="0.1.0")

frontend_origins = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# Placeholder routes; implement these after the team confirms the data contract.
@app.get("/meta")
def get_meta() -> None:
    raise HTTPException(status_code=501, detail="Metadata endpoint not implemented yet")


@app.get("/regions")
def get_regions() -> None:
    raise HTTPException(status_code=501, detail="Regions endpoint not implemented yet")


@app.get("/calendar")
def get_calendar(
    bbox: str,
    start: date,
    end: date,
    source: Literal["harmonized", "modis", "viirs"] = "harmonized",
) -> None:
    raise HTTPException(status_code=501, detail="Calendar endpoint not implemented yet")
