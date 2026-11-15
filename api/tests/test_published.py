"""Integration checks against the actual pinned five-region artifact."""
import copy
import json
from datetime import date

import pytest
from fastapi.testclient import TestClient

from api.main import PUBLISHED_DATA, create_app
from api.published import COUNTS, REVISION, PublishedRepository, PublishedRegion


@pytest.fixture(scope='module')
def client():
    with TestClient(create_app(data_mode='published_json')) as c:
        yield c


def query(client, region='cambodia', source='harmonized', start='2000-10-30', end='2025-12-22', bbox=None):
    product = client.app.state.dataset.regions[region]
    return client.get('/calendar', params={'bbox': ','.join(map(str, bbox or product.bbox)),
                                          'start': start, 'end': end, 'source': source, 'region': region})


@pytest.mark.parametrize('slug', COUNTS)
@pytest.mark.parametrize('source', ['harmonized', 'modis', 'viirs'])
def test_complete_history(client, slug, source):
    product = client.app.state.dataset.regions[slug]
    response = query(client, slug, source)
    assert response.status_code == 200
    body = response.json()
    assert body['cells_in_area'] == COUNTS[slug]
    assert body['coverage']['spatial_status'] == 'available'
    assert body['coverage']['region'] == slug
    assert len(body['weeks']) == 1313
    for i, row in enumerate(body['weeks']):
        flags = product.cal['flags'][i]
        col = 'harmonized_cells' if source == 'harmonized' else source+'_active_cells'
        expected = product.cal[col][i]
        if source == 'viirs' and 'snpp_outage' in flags:
            expected = None
        assert row['active_cells'] == expected
        assert row['value'] == (expected/COUNTS[slug] if expected is not None else None)
        assert row['valid_cells'] == (COUNTS[slug] if expected is not None else 0)
        assert row['anomaly'] is None and row['low_sensitivity_share'] is None
        if source == 'harmonized':
            assert row['uncertainty_low'] == product.cal['harmonized_low'][i]/COUNTS[slug]
            assert row['uncertainty_high'] == product.cal['harmonized_high'][i]/COUNTS[slug]
            assert row['harmonized_source'] == product.cal['source'][i]
        else:
            assert row['uncertainty_low'] is None and row['uncertainty_high'] is None


@pytest.mark.parametrize('slug', COUNTS)
def test_subset_defaults_and_fractional_totals(client, slug):
    product = client.app.state.dataset.regions[slug]
    # Select a narrow column, and compare directly to a dense decode only in this test.
    lat, lon = product.cells[0]
    box = (lon-.01, product.bbox[1], lon+.01, product.bbox[3])
    selected = product.select(box)
    assert 0 < len(selected) < COUNTS[slug]
    body = query(client, slug, start='2001-01-01', end='2001-12-31', bbox=box).json()
    assert any(r['active_cells'] % 1 != 0 for r in body['weeks'])
    for row in body['weeks']:
        entry = product.weeks[row['week_start']]
        exceptions = dict(entry['harmonized'])
        expected = sum(exceptions.get(i, entry['harmonized_default']) for i in selected)
        assert row['active_cells'] == pytest.approx(expected, abs=1e-10)
        assert row['value'] == pytest.approx(expected/len(selected))
        assert row['uncertainty_low'] is None and row['uncertainty_high'] is None
        assert 'uncertainty_unavailable_subarea' in row['flags']
    for source in ('modis', 'viirs'):
        rows = query(client, slug, source, '2015-01-05', '2015-01-05', box).json()['weeks']
        expected = len(selected & set(product.weeks['2015-01-05'][source]))
        assert rows[0]['active_cells'] == expected
        assert rows[0]['value'] == expected/len(selected)


@pytest.mark.parametrize('slug', COUNTS)
def test_outage_and_other_sensor_flags(client, slug):
    for wk in ('2022-07-25', '2022-08-01', '2022-08-08'):
        v = query(client, slug, 'viirs', wk, wk).json()['weeks'][0]
        assert v['value'] is None and v['active_cells'] is None and v['valid_cells'] == 0
        assert 'snpp_outage' in v['flags'] and 'source_unavailable' in v['flags']
        h = query(client, slug, 'harmonized', wk, wk).json()['weeks'][0]
        assert h['value'] is not None and h['harmonized_source'] == 'modis_fill'
        m = query(client, slug, 'modis', wk, wk).json()['weeks'][0]
        assert m['value'] is not None
    for wk, flag in [('2001-01-01', 'terra_only'), ('2020-08-17', 'aqua_outage')]:
        row = query(client, slug, 'modis', wk, wk).json()['weeks'][0]
        assert row['value'] is not None and flag in row['flags']


def test_metadata_routing_and_boundaries(client):
    m = client.get('/meta').json()
    assert m['dataset']['git_revision'] == REVISION and m['dataset']['mode'] == 'published_json'
    assert m['date_start'] == '2000-10-30' and m['date_end'] == '2025-12-22'
    assert m['viirs_start'] == '2012-01-16' and not m['is_fake']
    assert not m['metrics']['anomaly']['available']
    assert m['limits']['max_cells'] >= COUNTS['indonesia']
    regions = client.get('/regions').json()
    assert {r['id'] for r in regions} == set(COUNTS)
    assert all(r['calibration']['validated'] for r in regions)
    assert m['dataset']['regions']['belgium']['grid_footprint'][2] == 6.5
    assert next(r for r in regions if r['id'] == 'belgium')['bbox'][2] == 6.4
    for r in regions:
        res = client.get('/calendar', params={'bbox': ','.join(map(str,r['bbox'])), 'start':'2015-01-05','end':'2015-01-05'})
        assert res.status_code == 200 and res.json()['cells_in_area'] == COUNTS[r['id']]
    overlap = '117,5,118,6'
    args = {'bbox': overlap, 'start':'2015-01-05','end':'2015-01-05'}
    r = client.get('/calendar',params=args)
    assert r.status_code == 422 and r.json()['detail']['code'] == 'bbox_ambiguous_region'
    for region in ('philippines','indonesia'):
        r = client.get('/calendar',params={**args,'region':region})
        assert r.status_code == 200 and r.json()['coverage']['region'] == region
    assert client.get('/calendar',params={**args,'region':'unknown'}).status_code == 422
    no_cells = client.get('/calendar',params={**args,'bbox':'0,0,1,1'}).json()
    assert no_cells['weeks'] == [] and no_cells['coverage']['spatial_status'] == 'no_cells'
    clipped = query(client,bbox=(101,9,109,16),start='2015-01-05',end='2015-01-05').json()
    assert clipped['coverage']['clipped_to_region'] and clipped['cells_in_area'] == 120
    # Published scores are retained unmodified, including the smoothed early VIIRS score.
    product = client.app.state.dataset.regions['cambodia']
    assert product.cal['anomaly_viirs_only'][product.index['2012-01-09']] is not None
    row = query(client,source='viirs',start='2012-01-09',end='2012-01-09').json()['weeks'][0]
    assert row['value'] is None and row['anomaly'] is None


@pytest.mark.parametrize('source', ['harmonized','modis','viirs'])
def test_zero_and_unavailable_years(client, source):
    product = client.app.state.dataset.regions['cambodia']
    rows = query(client,source=source,start='2025-12-22',end='2026-01-12').json()['weeks']
    assert rows[0]['value'] is not None
    for row in rows[1:]:
        assert row['value'] is None and row['active_cells'] is None and row['valid_cells'] == 0
        assert row['anomaly'] is None and row['uncertainty_low'] is None
        assert 'outside_date_coverage' in row['flags']
    before = query(client,source=source,start='2000-10-23',end='2000-10-23').json()['weeks'][0]
    assert before['value'] is None and before['valid_cells'] == 0
    lat,lon = product.cells[0]
    row = query(client,source=source,start='2015-01-05',end='2015-01-05',bbox=(lon-.01,lat-.01,lon+.01,lat+.01)).json()['weeks'][0]
    entry = product.weeks['2015-01-05']
    if source != 'harmonized':
        assert row['value'] == int(0 in entry[source])
    assert row['valid_cells'] == 1


def test_limits_and_cache_isolation(client,monkeypatch):
    from api.published import LIMITS
    base = {'bbox':'117,5,118,6','start':'2015-01-05','end':'2015-01-05'}
    for region in ('philippines','indonesia'):
        client.get('/calendar',params={**base,'region':region})
    keys = list(client.app.state.cache)
    assert any(k[1]=='philippines' and k[2]==(117,5,118,6) for k in keys)
    assert any(k[1]=='indonesia' and k[2]==(117,5,118,6) for k in keys)
    for limit,value in [('max_cells',1),('max_cell_weeks',1),('max_weeks',1),('max_area_square_degrees',1)]:
        with monkeypatch.context() as patch:
            patch.setitem(LIMITS,limit,value)
            assert query(client).status_code == 413
    assert query(client,start='2000-01-01',end='2050-01-01').status_code == 413


def test_checksum_and_revision_fail_closed(tmp_path):
    manifest = json.loads((PUBLISHED_DATA/'manifest.json').read_text())
    manifest['git_revision']='wrong'
    (tmp_path/'manifest.json').write_text(json.dumps(manifest))
    with pytest.raises(ValueError,match='pinned'):
        PublishedRepository(tmp_path)
    manifest['git_revision']=REVISION
    first = next(iter(manifest['files']))
    manifest['files'][first]='wrong'
    (tmp_path/'manifest.json').write_text(json.dumps(manifest))
    target = tmp_path/first
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text('{}')
    with pytest.raises(ValueError,match='checksum'):
        PublishedRepository(tmp_path)


@pytest.mark.parametrize('kind',['duplicate_index','missing_week','null_pair','nonfinite','wrong_grid','bad_bounds'])
def test_export_validation(client,kind):
    repo = client.app.state.dataset
    raw = copy.deepcopy({k:v for k,v in repo.raw.items() if k.startswith('belgium/')})
    info = raw['belgium/info.json']
    entry = raw['belgium/2001.json']['weeks']['2001-01-01']
    if kind == 'duplicate_index': entry['modis']=[0,0]
    if kind == 'missing_week': del raw['belgium/2001.json']['weeks']['2001-01-01']
    if kind == 'null_pair': entry['harmonized_default']=None
    if kind == 'nonfinite': entry['harmonized_default']=float('nan')
    if kind == 'wrong_grid': raw['belgium/cells.json']['cells'][0]=[0,0]
    if kind == 'bad_bounds': raw['belgium/calendar.json']['harmonized_low'][0]=100000
    with pytest.raises(ValueError): PublishedRegion(info,raw,'belgium')
