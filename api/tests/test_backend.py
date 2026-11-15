import copy
import csv
import hashlib
import io
import json
from datetime import date

import pytest
from fastapi.testclient import TestClient

from api.dataset import Dataset, FIELDS
from api.main import DATA, create_app
from api.service import calendar


@pytest.fixture
def ds():
    return Dataset(DATA/'cell_week_cambodia_sample.csv', DATA/'manifest.json')


@pytest.fixture
def client():
    with TestClient(create_app()) as c:
        yield c


def test_fixture_integrity(ds):
    assert len(ds.rows) == 4576
    assert len(ds.cells) == 22
    assert len(ds.dates) == 208
    assert ds.dates[0] == '2015-01-05' and ds.dates[-1] == '2018-12-24'
    assert sum(r['anomaly'] is None for r in ds.rows) == 2496
    assert not {'204_30', '205_30'} & ds.cells.keys()
    assert len(ds.by_key) == len(ds.cells)*len(ds.dates)
    assert all(r['harmonized_value'] == r['viirs_active'] == r['uncertainty_low'] == r['uncertainty_high'] for r in ds.rows)
    with (DATA/'cell_week_cambodia_sample.csv').open() as f:
        raw = list(csv.DictReader(f))
    assert len(raw) == 4992 and len({r['cell_id'] for r in raw}) == 24


@pytest.mark.parametrize('source,count', [('modis', 6), ('viirs', 10), ('harmonized', 10)])
def test_golden(client, source, count):
    res = client.get('/calendar', params={'bbox': '102,10,103.5,15', 'start': '2015-01-05', 'end': '2015-01-05', 'source': source})
    assert res.status_code == 200
    body = res.json()
    assert body['cells_in_area'] == 22 and body['coverage']['spatial_status'] == 'partial'
    row = body['weeks'][0]
    assert row['value'] == pytest.approx(count/22)
    assert row['active_cells'] == count and row['valid_cells'] == 22
    assert row['anomaly'] is None
    assert row['low_sensitivity_share'] == (0 if source == 'harmonized' else None)


def test_meta_regions(client):
    m = client.get('/meta').json()
    assert m['is_fake'] is False
    assert m['dataset']['mode'] == 'development_sample'
    assert m['dataset']['served_cells'] == 22
    assert not m['metrics']['anomaly']['available']
    assert m['viirs_start'] == '2015-01-05'
    assert client.get('/regions').json()[0]['bbox'] == [102, 10, 103.5, 15]
    assert client.get('/openapi.json').status_code == 200


@pytest.mark.parametrize('params,status', [
    ({'bbox':'nan,10,103,15'},422), ({'bbox':'102,10,103'},422),
    ({'bbox':'103,10,102,15'},422), ({'bbox':'170,10,-170,15'},422),
    ({'source':'other'},422), ({'start':'2015-01-06','end':'2015-01-05'},422),
    ({'start':'2015-99-99'},422), ({'start':'20150105'},422),
    ({'bbox':'0,0,100,50'},413), ({'end':'2050-01-01'},413),
])
def test_invalid(client, params, status):
    query = {'bbox':'102,10,103.5,15','start':'2015-01-05','end':'2015-01-05',**params}
    r = client.get('/calendar', params=query)
    assert r.status_code == status and 'code' in r.json()['detail']


def test_zero_empty_and_dates(client):
    params = {'bbox':'102.25,10.25,102.3,10.3','start':'2015-01-05','end':'2015-01-05'}
    body = client.get('/calendar', params=params).json()
    assert body['cells_in_area'] == 1 and body['weeks'][0]['value'] == 0
    missing = client.get('/calendar', params={**params,'start':'2014-12-29','end':'2015-01-05'}).json()['weeks']
    assert missing[0]['value'] is None and missing[0]['active_cells'] is None
    assert 'outside_date_coverage' in missing[0]['flags']
    assert client.get('/calendar', params={**params,'bbox':'0,0,1,1'}).json()['weeks'] == []
    assert client.get('/calendar', params={**params,'start':'2015-01-06','end':'2015-01-11'}).json()['weeks'] == []


def test_missing_partial_and_provenance(ds):
    ds = copy.deepcopy(ds)
    cells = list(ds.cells)[:2]
    ds.cells = {k:ds.cells[k] for k in cells}
    a = ds.by_key[(cells[0], '2015-01-05')]
    b = ds.by_key[(cells[1], '2015-01-05')]
    a.update(harmonized_value=.4, uncertainty_low=.2, uncertainty_high=.6,
             harmonized_source='modis_scaled', modis_active=0, viirs_active=None, low_sensitivity=1)
    b.update(harmonized_value=1, uncertainty_low=1, uncertainty_high=1, harmonized_source='viirs',viirs_active=1)
    def get(source='harmonized'):
        return calendar(ds, (102,10,103.5,15), date(2015,1,5), date(2015,1,5),source)['weeks'][0]
    row = get()
    assert row['value'] == .7 and row['active_cells'] == 1.4
    assert row['harmonized_source'] == 'mixed'
    assert row['uncertainty_low'] == .6 and row['uncertainty_high'] == .8
    assert row['low_sensitivity_share'] == .5
    assert get('viirs')['value'] is None and get('viirs')['valid_cells'] == 1
    a['harmonized_source'] = 'modis_fill'
    assert get()['value'] == .7
    del ds.by_key[(cells[0], '2015-01-05')]
    assert get()['value'] is None and 'missing_cell_week' in get()['flags']


@pytest.mark.parametrize('mutation', ['duplicate','nan','bounds','binary','counts','calendar','schema','checksum'])
def test_loader_rejects(tmp_path, mutation):
    raw = (DATA/'cell_week_cambodia_sample.csv').read_bytes()
    rows = list(csv.DictReader(io.StringIO(raw.decode())))
    if mutation == 'duplicate': rows[1] = rows[0].copy()
    if mutation == 'nan': rows[0]['viirs_frp'] = 'NaN'
    if mutation == 'bounds': rows[0]['uncertainty_low'] = '1'
    if mutation == 'binary': rows[0]['modis_active'] = '2'
    if mutation == 'counts': rows[0]['modis_n'] = '1'
    if mutation == 'calendar': rows[0]['week_start'] = '2015-01-06'
    stream = io.StringIO(); writer = csv.DictWriter(stream, fieldnames=FIELDS)
    writer.writeheader(); writer.writerows(rows)
    data = stream.getvalue().encode()
    if mutation == 'schema': data = data.replace(b'cell_id',b'wrong',1)
    manifest = json.loads((DATA/'manifest.json').read_text())
    manifest['sha256'] = hashlib.sha256(data).hexdigest() if mutation != 'checksum' else 'wrong'
    p = tmp_path/'data.csv'; p.write_bytes(data)
    m = tmp_path/'manifest.json'; m.write_text(json.dumps(manifest))
    with pytest.raises(ValueError): Dataset(p,m)


def test_cache_and_cors():
    now = [0]
    app = create_app(clock=lambda:now[0],cache_ttl=60)
    with TestClient(app) as c:
        url = '/calendar?bbox=102,10,103.5,15&start=2015-01-05&end=2015-01-05'
        first = c.get(url).json()
        assert c.get(url).json() == first and len(app.state.cache) == 1
        now[0] = 61
        assert c.get(url).json() == first
        assert next(iter(app.state.cache.values()))[0] == 61
        c.get(url+'&source=modis'); assert len(app.state.cache) == 2
        headers = {'Origin':'http://localhost:5173','Access-Control-Request-Method':'GET'}
        assert c.options('/calendar',headers=headers).headers['access-control-allow-origin'] == headers['Origin']
        assert c.options('/calendar',headers={**headers,'Origin':'https://untrusted.example'}).status_code == 400


def test_fail_closed(monkeypatch, tmp_path):
    with pytest.raises(FileNotFoundError):
        with TestClient(create_app(dataset_path=tmp_path/'missing')): pass
    monkeypatch.setenv('BURN_DATA_MODE','production')
    with pytest.raises(ValueError,match='explicit'):
        with TestClient(create_app()): pass


def test_limits_and_cache_bound(client, monkeypatch):
    from api.main import LIMITS
    params = {'bbox':'102,10,103.5,15','start':'2015-01-05','end':'2015-01-05'}
    monkeypatch.setitem(LIMITS, 'max_cells', 1)
    assert client.get('/calendar',params=params).status_code == 413
    monkeypatch.setitem(LIMITS, 'max_cells', 400)
    monkeypatch.setitem(LIMITS, 'max_cell_weeks', 1)
    assert client.get('/calendar',params=params).status_code == 413
    monkeypatch.setitem(LIMITS, 'max_cell_weeks', 250000)
    for i in range(130):
        assert client.get('/calendar',params={**params,'bbox':f'{102+i/1000},10,103.5,15'}).status_code == 200
    assert len(client.app.state.cache) == 128


def test_missing_sensor_bounds_sensitivity_and_flags(ds):
    ds = copy.deepcopy(ds)
    c = next(iter(ds.cells)); ds.cells = {c:ds.cells[c]}
    row = ds.by_key[(c,'2015-01-05')]
    row.update(viirs_active=None, low_sensitivity=None, uncertainty_low=None, flags='nrt;nrt;custom')
    args = (ds,(102,10,103.5,15),date(2015,1,5),date(2015,1,5))
    h = calendar(*args,'harmonized')['weeks'][0]
    assert h['active_cells'] == 0 and h['value'] == 0
    assert h['uncertainty_low'] is None and h['uncertainty_high'] is None
    assert h['low_sensitivity_share'] is None and h['flags'] == ['custom','nrt']
    v = calendar(*args,'viirs')['weeks'][0]
    assert v['value'] is None and v['active_cells'] is None and v['valid_cells'] == 0


def test_internal_error_is_sanitized():
    with TestClient(create_app(),raise_server_exceptions=False) as c:
        c.app.state.dataset = None
        response = c.get('/meta')
        assert response.status_code == 500
        assert response.json()['detail']['code'] == 'internal_error'
        assert 'traceback' not in response.text.lower()
