"""CSV adapter. Missing measurements stay None; the original artifact stays intact."""
import csv
import hashlib
import io
import json
import math
from datetime import date
from pathlib import Path

FIELDS = ('cell_id lat lon week_start year week_of_year modis_active viirs_active '
          'modis_n viirs_n modis_frp viirs_frp harmonized_value harmonized_source '
          'anomaly low_sensitivity uncertainty_low uncertainty_high flags').split()
TEXT = {'cell_id', 'week_start', 'harmonized_source', 'flags'}


class Dataset:
    def __init__(self, path: Path, manifest_path: Path):
        self.manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
        data = path.read_bytes()
        if hashlib.sha256(data).hexdigest() != self.manifest['sha256']:
            raise ValueError('Dataset checksum differs from manifest')
        reader = csv.DictReader(io.StringIO(data.decode('utf-8-sig')))
        if reader.fieldnames != FIELDS:
            raise ValueError('Expected the frozen 19-column cell_week schema')
        rows, cells, keys = [], {}, set()
        for raw in reader:
            if None in raw or any(v is None for v in raw.values()):
                raise ValueError('Malformed CSV row')
            r = {k: (v if k in TEXT else float(v) if v.strip() else None)
                 for k, v in raw.items()}
            self.validate(r)
            key = (r['cell_id'], r['week_start'])
            if key in keys:
                raise ValueError('Duplicate cell/week')
            keys.add(key)
            point = (r['lon'], r['lat'])
            if r['cell_id'] in cells and cells[r['cell_id']] != point:
                raise ValueError('Cell coordinates changed')
            cells[r['cell_id']] = point
            rows.append(r)
        if not rows:
            raise ValueError('Empty dataset')
        if len(rows) != self.manifest['raw_rows'] or len(cells) != self.manifest['raw_cells']:
            raise ValueError('Manifest row/cell counts differ')
        excluded = set(self.manifest['excluded_cell_ids'])
        if not excluded <= cells.keys():
            raise ValueError('Quarantine references absent cells')
        self.rows = tuple(r for r in rows if r['cell_id'] not in excluded)
        self.cells = {c: p for c, p in cells.items() if c not in excluded}
        if not self.rows:
            raise ValueError('No cells after quarantine')
        west, south, east, north = self.manifest['declared_bbox']
        if any(not (west <= x < east and south <= y < north) for x, y in self.cells.values()):
            raise ValueError('Unquarantined cell outside declared bounds')
        self.by_key = {(r['cell_id'], r['week_start']): r for r in self.rows}
        self.dates = sorted({r['week_start'] for r in self.rows})

    @staticmethod
    def validate(r):
        d = date.fromisoformat(r['week_start'])
        if d.isoformat() != r['week_start'] or d.weekday() != 0:
            raise ValueError('week_start must be an ISO Monday')
        if r['year'] != d.year or r['week_of_year'] != d.isocalendar().week:
            raise ValueError('Inconsistent calendar keys')
        if not r['cell_id'] or r['lat'] is None or r['lon'] is None:
            raise ValueError('Missing cell identity')
        for k, v in r.items():
            if k not in TEXT and v is not None and not math.isfinite(v):
                raise ValueError('Nonfinite measurement')
        if not (-90 <= r['lat'] <= 90 and -180 <= r['lon'] <= 180):
            raise ValueError('Invalid coordinates')
        for k in ('modis_active', 'viirs_active', 'low_sensitivity'):
            if r[k] not in (None, 0, 1):
                raise ValueError('Invalid binary indicator')
        for s in ('modis', 'viirs'):
            n, active, frp = r[s+'_n'], r[s+'_active'], r[s+'_frp']
            if n is not None and (n < 0 or n != int(n)):
                raise ValueError('Invalid detection count')
            if frp is not None and frp < 0:
                raise ValueError('Negative FRP')
            if n is not None and active is not None and bool(n) != bool(active):
                raise ValueError('Active/count disagreement')
        for k in ('harmonized_value', 'uncertainty_low', 'uncertainty_high', 'anomaly'):
            v = r[k]
            if v is not None and not 0 <= v <= (100 if k == 'anomaly' else 1):
                raise ValueError('Measurement outside range')
        lo, value, hi = (r[k] for k in ('uncertainty_low', 'harmonized_value', 'uncertainty_high'))
        if lo is not None and hi is not None and (lo > hi or value is not None and not lo <= value <= hi):
            raise ValueError('Invalid uncertainty band')
        if value is not None and r['harmonized_source'] not in ('viirs', 'modis_scaled', 'modis_fill'):
            raise ValueError('Unknown harmonized provenance')

    def source_range(self, source):
        field = 'harmonized_value' if source == 'harmonized' else source+'_active'
        dates = [r['week_start'] for r in self.rows if r[field] is not None]
        return {'date_start': min(dates) if dates else None, 'date_end': max(dates) if dates else None}
