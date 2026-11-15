import logging
import math
import os
import threading
import time
from collections import OrderedDict
from contextlib import asynccontextmanager
from datetime import date
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .dataset import Dataset
from .models import CalendarResponse, Meta, Region, Source
from .service import calendar
from .published import PublishedRepository, LIMITS as PUBLISHED_LIMITS, empty_calendar

DATA = Path(__file__).parent / 'data' / 'development'
PUBLISHED_DATA = Path(__file__).parent / 'data' / 'published'
LIMITS = {'max_area_square_degrees': 100, 'max_weeks': 1600, 'max_cells': 400, 'max_cell_weeks': 250000}


def create_app(dataset_path=None, manifest_path=None, *, data_mode=None, published_path=None,
               cache_ttl=60, clock=time.monotonic):
    @asynccontextmanager
    async def lifespan(app):
        mode = os.getenv('BURN_DATA_MODE', data_mode or 'development_sample')
        if mode not in ('development_sample', 'production', 'published_json'):
            raise ValueError('Unknown BURN_DATA_MODE')
        if mode == 'published_json':
            root = Path(published_path or os.getenv('BURN_PUBLISHED_PATH', str(PUBLISHED_DATA)))
            app.state.dataset = PublishedRepository(root)
            yield
            return
        path = dataset_path or os.getenv('BURN_DATA_PATH')
        manifest = manifest_path or os.getenv('BURN_MANIFEST_PATH')
        if mode == 'production' and (not path or not manifest):
            raise ValueError('Production requires explicit data and manifest paths')
        app.state.dataset = Dataset(Path(path) if path else DATA/'cell_week_cambodia_sample.csv',
                                    Path(manifest) if manifest else DATA/'manifest.json')
        if app.state.dataset.manifest['mode'] != mode:
            raise ValueError('Configured mode differs from dataset manifest')
        yield

    app = FastAPI(title='Burnadette local API', version='0.2.0', lifespan=lifespan)
    origins = [x.strip() for x in os.getenv('FRONTEND_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173').split(',') if x.strip()]
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=False,
                       allow_methods=['GET'], allow_headers=['*'])
    cache, lock = OrderedDict(), threading.Lock()
    app.state.cache = cache

    @app.exception_handler(RequestValidationError)
    async def invalid(request, exc):
        return JSONResponse(status_code=422, content={'detail': {'code': 'invalid_query', 'message': 'Check required parameters, ISO dates, and source.'}})

    @app.exception_handler(Exception)
    async def unexpected(request, exc):
        logging.getLogger(__name__).exception('Request failed')
        return JSONResponse(status_code=500, content={'detail': {'code': 'internal_error', 'message': 'Request could not be completed.'}})

    @app.get('/meta', response_model=Meta)
    def meta(request: Request):
        ds = request.app.state.dataset
        if isinstance(ds, PublishedRepository):
            return ds.metadata()
        xs, ys = zip(*ds.cells.values())
        return {'date_start': ds.dates[0], 'date_end': ds.dates[-1],
                'viirs_start': ds.source_range('viirs')['date_start'], 'is_fake': False,
                'contract_version': '0.2-provisional',
                'dataset': {**ds.manifest, 'served_rows': len(ds.rows), 'served_cells': len(ds.cells),
                            'available_bbox': [min(xs)-.25, min(ys)-.25, max(xs)+.25, max(ys)+.25],
                            'spatial_scope': 'sampled_cells', 'cell_size_deg': .5},
                'source_coverage': {s: ds.source_range(s) for s in ('harmonized', 'modis', 'viirs')},
                'metrics': {'activity': {'aggregation': 'mean', 'units': 'active_cell_fraction', 'status': 'provisional'},
                            'anomaly': {'available': False, 'reason': 'Awaiting Hans: bbox aggregation is not approved'},
                            'uncertainty': {'method': 'mean supplied cell bounds', 'status': 'provisional; not a validated regional confidence interval'},
                            'active_cells': {'basis': 'harmonized sum or observed source count'}},
                'limits': LIMITS,
                'gaps': [{'label': 'Terra only (reduced MODIS observations)', 'start': '2000-11-01', 'end': '2002-05-04'},
                         {'label': 'Aqua outage', 'start': '2020-08-16', 'end': '2020-09-02'},
                         {'label': 'S-NPP VIIRS outage', 'start': '2022-07-27', 'end': '2022-08-10'}],
                'notes': ['Satellite-derived development subset, not full Cambodia or 2000-present coverage.',
                          'Envelope contains unsampled cells; grid boundaries remain under review.',
                          'Dates filter Monday week starts inclusively; no partial-week prorating.',
                          'Recorded zero does not establish cloud-free coverage or absence of burning.',
                          'Only 2015-2018 calibration is evidenced; sample has VIIRS provenance and collapsed bounds.',
                          'Known instrument gaps are contextual, outside this sample; no observation mask is inferred.',
                          'Scientific mappings and frontend compatibility await Hans and Sean.']}

    @app.get('/regions', response_model=list[Region])
    def regions(request: Request):
        ds = request.app.state.dataset
        if isinstance(ds, PublishedRepository):
            return ds.region_list()
        xs, ys = zip(*ds.cells.values())
        return [{'id': ds.manifest['id'], 'name': f'Cambodia development subset — {len(ds.cells)} cells',
                 'bbox': [min(xs)-.25, min(ys)-.25, max(xs)+.25, max(ys)+.25]}]

    @app.get('/calendar', response_model=CalendarResponse, response_model_exclude_none=False)
    def get_calendar(request: Request, bbox: str, start: date, end: date, source: Source = 'harmonized', region: str | None = None):
        def error(status, code, message):
            raise HTTPException(status_code=status, detail={'code': code, 'message': message})
        try:
            box = tuple(float(x) for x in bbox.split(','))
            if len(box) != 4 or not all(math.isfinite(x) for x in box):
                raise ValueError()
            w, s, e, n = box
            if not (-180 <= w < e <= 180 and -90 <= s < n <= 90) or start > end:
                raise ValueError()
        except ValueError:
            error(422, 'invalid_query', 'Use west,south,east,north and an ordered date range; antimeridian boxes are unsupported.')
        if request.query_params.get('start') != start.isoformat() or request.query_params.get('end') != end.isoformat():
            error(422, 'invalid_query', 'Dates must use YYYY-MM-DD.')
        weeks = (end-start).days//7+1
        ds = request.app.state.dataset
        published = isinstance(ds, PublishedRepository)
        limits = PUBLISHED_LIMITS if published else LIMITS
        if (e-w)*(n-s) > limits['max_area_square_degrees'] or weeks > limits['max_weeks']:
            error(413, 'query_too_large', 'Reduce area or date range; see /meta limits.')
        product = ds.resolve(box, region) if published else None
        if not published and region is not None and region != ds.manifest['id']:
            error(422, 'invalid_region', 'Choose a region from /regions.')
        count = (len(product.select(box)) if product else 0) if published else sum(w <= x <= e and s <= y <= n for x, y in ds.cells.values())
        if count > limits['max_cells'] or count*weeks > limits['max_cell_weeks']:
            error(413, 'query_too_large', 'Reduce area or date range; see /meta limits.')
        key = (ds.revision if published else ds.manifest['sha256'],
               product.slug if product else region, box, start, end, source)
        with lock:
            now = clock()
            if key in cache and now-cache[key][0] < cache_ttl:
                cache.move_to_end(key)
                return cache[key][1]
        if published:
            result = product.calendar(box, start, end, source) if product else empty_calendar(box, source)
        else:
            result = calendar(ds, box, start, end, source)
        with lock:
            cache[key] = (clock(), result)
            cache.move_to_end(key)
            while len(cache) > 128:
                cache.popitem(last=False)
        return result

    return app


# The normal server uses final data; create_app() keeps the explicit legacy test profile.
app = create_app(data_mode='published_json')
