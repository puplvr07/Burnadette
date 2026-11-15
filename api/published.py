"""Reader for the pinned ML JSON export; no inferred per-cell measurements."""
import hashlib
import json
import math
from datetime import date, timedelta

from fastapi import HTTPException

REVISION = '0e6e66965e4782c369210a8d88dc62a538a0fcbf'
COUNTS = {'belgium': 32, 'cambodia': 120, 'philippines': 714, 'zambia': 525, 'indonesia': 3384}
LIMITS = {'max_area_square_degrees': 1000, 'max_weeks': 1600,
          'max_cells': 5000, 'max_cell_weeks': 8000000}


def fail(message):
    raise ValueError(message)


def number(v, maximum=None):
    if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) or v < 0 or maximum is not None and v > maximum:
        fail('Invalid numeric export value')


class PublishedRepository:
    def __init__(self, root):
        self.root = root
        self.manifest = json.loads((root/'manifest.json').read_text(encoding='utf-8'))
        if self.manifest.get('git_revision') != REVISION or self.manifest.get('mode') != 'published_json':
            fail('Published data must match the approved pinned revision and mode')
        required = {'meta.json', 'regions.json'} | {
            f'{slug}/{name}.json' for slug in COUNTS
            for name in ['info', 'cells', 'calendar', *map(str, range(2000, 2026))]}
        if set(self.manifest['files']) != required:
            fail('Incomplete or unexpected published artifact inventory')
        self.revision = hashlib.sha256(json.dumps(self.manifest, sort_keys=True).encode()).hexdigest()
        self.raw = {}
        for name, checksum in self.manifest['files'].items():
            data = (root/name).read_bytes()
            if hashlib.sha256(data).hexdigest() != checksum:
                fail(f'Published checksum mismatch: {name}')
            self.raw[name] = json.loads(data, parse_constant=lambda s: fail('Nonfinite JSON number'))
        self.regions = {}
        infos = self.raw['regions.json']['regions']
        if len(infos) != 5 or {i['slug'] for i in infos} != set(COUNTS):
            fail('Expected exactly the five approved regional products')
        for info in infos:
            slug = info['slug']
            if info != self.raw[f'{slug}/info.json']:
                fail('Region summaries differ')
            r = PublishedRegion(info, self.raw, slug)
            self.regions[slug] = r
        self.shared = self.raw['meta.json']

    def resolve(self, bbox, region):
        if region is not None:
            if region not in self.regions:
                raise HTTPException(422, detail={'code': 'invalid_region', 'message': 'Choose a pilot region from /regions.'})
            return self.regions[region]
        exact = [r for r in self.regions.values() if r.bbox == bbox]
        if len(exact) == 1:
            return exact[0]
        candidates = [r for r in self.regions.values() if r.select(bbox)]
        if len(candidates) > 1:
            raise HTTPException(422, detail={'code': 'bbox_ambiguous_region', 'message': 'Specify region=<slug>; regional products must not be mixed.'})
        return candidates[0] if candidates else None

    def region_list(self):
        return [{'id': r.slug, 'name': r.info['name'], 'bbox': r.bbox,
                 'calibration': r.info['calibration']} for r in self.regions.values()]

    def metadata(self):
        return {'date_start': '2000-10-30', 'date_end': '2025-12-22', 'viirs_start': '2012-01-16',
                'is_fake': False, 'contract_version': '0.3-json',
                'dataset': {'id': self.manifest['id'], 'mode': 'published_json', 'git_revision': REVISION,
                            'sha256': self.revision, 'source_path': self.manifest['source_path'],
                            'cell_size_deg': .5, 'period': 'weekly; Monday starts',
                            'spatial_scope': 'country-filtered regional grids', 'years': [2000, 2025],
                            'instrument_starts': {'modis': '2000-11-01', 'viirs': '2012-01-20'},
                            'regions': {r.slug: {'cells': len(r.cells), 'declared_bbox': r.bbox,
                                                'grid_footprint': r.footprint} for r in self.regions.values()}},
                'source_coverage': {s: {'date_start': '2012-01-16' if s == 'viirs' else '2000-10-30',
                                      'date_end': '2025-12-22'} for s in ('harmonized', 'modis', 'viirs')},
                'metrics': {'activity': {'aggregation': 'mean', 'units': 'active_cell_fraction'},
                            'active_cells': {'harmonized': 'sum of cell values; expected total when estimated',
                                             'modis': 'observed active-cell count', 'viirs': 'observed active-cell count'},
                            'anomaly': {'available': False, 'published_scope': 'complete regional grid',
                                        'reason': 'Published scores retained; activation awaits Hans and Sean'},
                            'uncertainty': {'available_scope': 'complete regional grid; harmonized only',
                                            'method': 'published summed bounds divided by grid count',
                                            'status': 'not a validated subarea confidence interval'},
                            'low_sensitivity_share': {'available': False, 'reason': 'Derived share awaits approval'}},
                'gaps': [{'label': g['note'], 'start': g['start'], 'end': g['end'],
                          'id': g['id'], 'affects': g['affects']} for g in self.shared['known_gaps']],
                'notes': [*self.shared['caveats'],
                          'Coverage ends at week_start 2025-12-22 (week ends December 28). No 2026 data.',
                          'Subarea harmonized values use three-decimal cell exports; full grids use published totals.',
                          'Fractions include every selected grid cell, including sea/out-of-country cells.',
                          'VIIRS is unavailable for all three flagged 2022 S-NPP outage weeks.',
                          'Calibration validates regional overlap-year totals, not individual subareas.',
                          'Regional products are separately calibrated and cannot be merged.'], 'limits': LIMITS}


class PublishedRegion:
    def __init__(self, info, raw, slug):
        self.info, self.slug = info, slug
        b = info['bbox']
        self.bbox = tuple(b[k] for k in ('min_lon', 'min_lat', 'max_lon', 'max_lat'))
        self.cells = [tuple(p) for p in raw[f'{slug}/cells.json']['cells']]  # lat, lon
        if len(self.cells) != COUNTS[slug] or len(set(self.cells)) != len(self.cells) or info['n_cells'] != len(self.cells):
            fail('Invalid regional cell inventory')
        w, s, e, n = self.bbox
        expected = {((y+.5)*.5, (x+.5)*.5)
                    for x in range(math.floor(w/.5), math.ceil(e/.5))
                    for y in range(math.floor(s/.5), math.ceil(n/.5))}
        if set(self.cells) != expected:
            fail('Regional centers differ from declared 0.5-degree grid')
        self.footprint = [min(p[1] for p in self.cells)-.25, min(p[0] for p in self.cells)-.25,
                          max(p[1] for p in self.cells)+.25, max(p[0] for p in self.cells)+.25]
        self.cal = raw[f'{slug}/calendar.json']
        self.dates = self.cal['week_start']
        if len(self.dates) != 1313 or self.dates[0] != '2000-10-30' or self.dates[-1] != '2025-12-22':
            fail('Unexpected published date coverage')
        if info['first_week'] != self.dates[0] or info['last_week'] != self.dates[-1] or self.cal['cells_total'] != len(self.cells):
            fail('Calendar summary mismatch')
        for a, b in zip(self.dates, self.dates[1:]):
            if (date.fromisoformat(b)-date.fromisoformat(a)).days != 7:
                fail('Nonconsecutive published weeks')
        if date.fromisoformat(self.dates[0]).weekday() != 0:
            fail('Non-Monday export')
        self.index = {wk: i for i, wk in enumerate(self.dates)}
        self.weeks = {}
        for year in range(2000, 2026):
            doc = raw[f'{slug}/{year}.json']
            if doc['region'] != slug or doc['year'] != year:
                fail('Wrong year/region artifact')
            for wk, entry in doc['weeks'].items():
                if wk in self.weeks or not wk.startswith(str(year)):
                    fail('Duplicate or misplaced weekly entry')
                self.weeks[wk] = entry
        if set(self.index) != set(self.weeks):
            fail('Calendar/yearly week mismatch')
        columns = ('modis_active_cells', 'viirs_active_cells', 'harmonized_cells', 'harmonized_low',
                   'harmonized_high', 'anomaly_region', 'anomaly_modis_only', 'anomaly_viirs_only', 'source', 'flags')
        if any(len(self.cal[c]) != len(self.dates) for c in columns):
            fail('Calendar column length mismatch')
        for wk, entry in self.weeks.items():
            i = self.index[wk]
            for sensor in ('modis', 'viirs'):
                ids = entry[sensor]
                if ids is not None:
                    self.validate_indices(ids)
                if (len(ids) if ids is not None else None) != self.cal[sensor+'_active_cells'][i]:
                    fail('Sensor lists disagree with regional totals')
            default, exceptions = entry['harmonized_default'], entry['harmonized']
            if (default is None) != (exceptions is None):
                fail('Inconsistent harmonized nulls')
            if default is not None:
                number(default, 1)
                self.validate_indices([p[0] for p in exceptions])
                for _, v in exceptions:
                    number(v, 1)
                reconstructed = len(self.cells)*default + math.fsum(v-default for _, v in exceptions)
                published = self.cal['harmonized_cells'][i]
                number(published, len(self.cells))
                if abs(reconstructed-published) > len(self.cells)*.0005+.005001:
                    fail('Harmonized totals exceed rounding tolerance')
            elif self.cal['harmonized_cells'][i] is not None:
                fail('Harmonized availability mismatch')
            if self.cal['source'][i] not in ('viirs', 'modis_scaled', 'modis_fill', None):
                fail('Unknown weekly provenance')
            if not isinstance(self.cal['flags'][i], list) or not all(isinstance(x, str) for x in self.cal['flags'][i]):
                fail('Invalid flags')
            for col in ('harmonized_low', 'harmonized_high', 'anomaly_region', 'anomaly_modis_only', 'anomaly_viirs_only'):
                v = self.cal[col][i]
                if v is not None:
                    number(v, 100 if col.startswith('anomaly') else len(self.cells))
            lo, hi = self.cal['harmonized_low'][i], self.cal['harmonized_high'][i]
            if (lo is None) != (hi is None) or lo is not None and not lo <= self.cal['harmonized_cells'][i] <= hi:
                fail('Invalid regional uncertainty pair')

    def validate_indices(self, ids):
        if len(ids) != len(set(ids)) or any(type(j) is not int or not 0 <= j < len(self.cells) for j in ids):
            fail('Invalid or duplicate cell indices')

    def select(self, bbox):
        w, s, e, n = bbox
        return {i for i, (lat, lon) in enumerate(self.cells) if w <= lon <= e and s <= lat <= n}

    def calendar(self, bbox, start, end, source):
        selected = self.select(bbox)
        count = len(selected)
        w, s, e, n = bbox
        rw, rs, re, rn = self.bbox
        result = empty_calendar(bbox, source, self.slug)
        result['cells_in_area'] = count
        result['coverage'].update(spatial_status='available' if count else 'no_cells',
                                  nominal_cells=count, available_cells=count,
                                  clipped_to_region=not (rw <= w and rs <= s and e <= re and n <= rn))
        if not count:
            return result
        full = count == len(self.cells)
        offset = (-start.weekday()) % 7
        if (end-start).days < offset:
            return result
        monday = start + timedelta(days=offset)
        while monday <= end:
            wk = monday.isoformat()
            i = self.index.get(wk)
            flags = set() if i is None else set(self.cal['flags'][i])
            row = {'week_start': wk, 'value': None, 'active_cells': None, 'valid_cells': 0,
                   'anomaly': None, 'uncertainty_low': None, 'uncertainty_high': None,
                   'low_sensitivity_share': None, 'flags': []}
            if i is None:
                flags.add('outside_date_coverage')
            else:
                entry = self.weeks[wk]
                total = None
                if source == 'harmonized':
                    if entry['harmonized_default'] is not None:
                        total = self.cal['harmonized_cells'][i] if full else count*entry['harmonized_default'] + math.fsum(v-entry['harmonized_default'] for j, v in entry['harmonized'] if j in selected)
                        # Guard harmless floating-point cancellation at 0/1 boundaries.
                        total = min(float(count), max(0.0, total))
                        row['harmonized_source'] = self.cal['source'][i]
                        if full:
                            row['uncertainty_low'] = self.cal['harmonized_low'][i]/count if self.cal['harmonized_low'][i] is not None else None
                            row['uncertainty_high'] = self.cal['harmonized_high'][i]/count if self.cal['harmonized_high'][i] is not None else None
                        else:
                            flags.add('uncertainty_unavailable_subarea')
                elif entry[source] is not None and not (source == 'viirs' and 'snpp_outage' in flags):
                    total = sum(j in selected for j in entry[source])
                if total is not None:
                    row.update(value=total/count, active_cells=total, valid_cells=count)
            if row['value'] is None:
                flags.add('source_unavailable')
            row['flags'] = sorted(flags)
            result['weeks'].append(row)
            if (end-monday).days < 7:
                break
            monday += timedelta(days=7)
        return result


def empty_calendar(bbox, source, region=None):
    return {'bbox': bbox, 'source': source, 'cells_in_area': 0, 'weeks': [],
            'coverage': {'spatial_status': 'no_cells', 'nominal_cells': 0, 'available_cells': 0,
                         'dataset_mode': 'published_json', 'region': region, 'clipped_to_region': False}}
