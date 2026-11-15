from typing import Literal
from pydantic import BaseModel

Source = Literal['harmonized', 'modis', 'viirs']


class Week(BaseModel):
    week_start: str
    value: float | None
    active_cells: float | None
    valid_cells: int
    anomaly: float | None
    uncertainty_low: float | None
    uncertainty_high: float | None
    low_sensitivity_share: float | None
    flags: list[str]
    harmonized_source: str | None = None


class Coverage(BaseModel):
    spatial_status: Literal['available', 'partial', 'no_cells']
    nominal_cells: int
    available_cells: int
    dataset_mode: str
    region: str | None = None
    clipped_to_region: bool = False


class CalendarResponse(BaseModel):
    bbox: tuple[float, float, float, float]
    source: Source
    cells_in_area: int
    weeks: list[Week]
    coverage: Coverage


class Region(BaseModel):
    id: str
    name: str
    bbox: tuple[float, float, float, float]
    calibration: dict | None = None


class Meta(BaseModel):
    date_start: str
    date_end: str
    viirs_start: str | None
    gaps: list[dict]
    notes: list[str]
    is_fake: bool
    contract_version: str
    dataset: dict
    source_coverage: dict
    metrics: dict
    limits: dict
