// Run from any directory: node frontend/scripts/audit-regressions.cjs
const path = require('node:path');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const base = path.resolve(__dirname, '..');
const { build, buildSync } = createRequire(path.join(base, 'package.json'))('esbuild');
function model() {
  const out = buildSync({ entryPoints: [path.join(base, 'src/analytics.ts')], bundle: true, platform: 'node', format: 'cjs', write: false });
  const m = { exports: {} }; new Function('require','module','exports',out.outputFiles[0].text)(require,m,m.exports); return m.exports;
}
function rows(year) {
  const result=[];let day=new Date(Date.UTC(year,0,1));day.setUTCDate(day.getUTCDate()+(8-day.getUTCDay())%7);
  while(day.getUTCFullYear()===year) {result.push({week_start:day.toISOString().slice(0,10),value:0.25,anomaly:50,flags:[],active_cells:1,uncertainty_low:0.2,uncertainty_high:0.3,low_sensitivity_share:0});day=new Date(+day+604800000)}return result;
}
(async()=>{
 const api=model(),full=rows(2024);
 assert.equal(api.yearStats(full)[0].partial,false);
 assert.equal(api.yearStats(full.slice(1))[0].partial,true);
 assert.equal(api.yearStats([...full,full[0]])[0].partial,true);
 assert.equal(api.yearStats(full.map((r,i)=>i? r:{...r,value:NaN}))[0].partial,true);
 assert.equal(api.yearStats(rows(2018))[0].partial,false); // 53 Monday starts
 assert.equal(api.toCsv([['a,b','line\nbreak','quote"']]),'"a,b","line\nbreak","quote"""\n');
 assert.equal(api.toCsv([['carriage\rreturn']]),'"carriage\rreturn"\n');
 const invalid=[{...full[0],value:NaN,anomaly:Infinity},{...full[1],value:Infinity,anomaly:NaN}];
 assert(api.seasonal(invalid,[]).avg.every(v=>v===null));
 assert(api.monthAverages(invalid).every(v=>v===null));
 assert.equal(api.topAnomalies(invalid,[2024]).length,0);
 assert.equal(api.peakWeek(invalid),undefined);
 assert.equal(api.compareToAverage(invalid,api.seasonal(invalid,[])),null);
 console.log('PASS: complete/partial years, invalid numeric summaries, 53-week year, CSV escaping including carriage returns.');
 global.document={documentElement:{dataset:{}},createElement:()=>({getContext:()=>null})};
 global.getComputedStyle=()=>({getPropertyValue:()=>''});global.XMLSerializer=class{serializeToString(){return '<svg/>'}};
 global.Image=class{set src(value){queueMicrotask(()=>this.onload())}};
 const svg={viewBox:{baseVal:{width:100,height:100}},children:[],cloneNode:()=>({children:[],setAttribute(){},removeAttribute(){}})};
 await assert.rejects(api.downloadSvgPng(svg,'test.png',{title:'Test',lines:[],caption:'Test'}),/unavailable/);
 await assert.rejects(api.downloadSvgPng({...svg,viewBox:{baseVal:{width:0,height:0}}},'test.png',{title:'',lines:[],caption:''}),/not visible/);
 console.log('PASS: PNG export rejects unavailable canvas and invisible charts rather than hanging.');
 // Component harness is already installed in the workspace; no dependency changes.
 const harness=createRequire(path.resolve(base,'../../work/frontend-validation/package.json'));
 const React=harness('react'),{create,act}=harness('react-test-renderer');
 global.ResizeObserver=class{observe(){}disconnect(){}};
 const out=await build({entryPoints:[path.join(base,'src/components/Analytics.tsx')],bundle:true,platform:'node',format:'cjs',write:false,external:['react','react/jsx-runtime'],plugins:[{name:'api-boundary',setup(b){b.onResolve({filter:/^\.\.\/api$/},()=>({path:'api',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const usingFakeData=false;'}));}}]});
 const m={exports:{}};new Function('require','module','exports',out.outputFiles[0].text)(harness,m,m.exports);
 const props={weeks:rows(2025),meta:{gaps:[],notes:[]},bbox:[0,0,1,1],start:'2025-01-01',end:'2025-12-31',source:'harmonized'};
 let tree;await act(async()=>{tree=create(React.createElement(m.exports.default,props))});
 await act(async()=>tree.update(React.createElement(m.exports.default,{...props,weeks:rows(2024),start:'2024-01-01',end:'2024-12-31'})));
 assert(JSON.stringify(tree.toJSON()).includes('2024'));
 const bar=tree.root.findAll(n=>n.type==='g'&&n.props.role==='button')[0];
 assert.equal(bar.props.tabIndex,0);let prevented=false;
 await act(async()=>bar.props.onKeyDown({key:'Enter',preventDefault(){prevented=true;}}));assert(prevented);
 await act(async()=>tree.update(React.createElement(m.exports.default,{...props,weeks:[]})));await act(async()=>tree.unmount());
 console.log('PASS: changing to a non-overlapping year range and empty response does not crash Analytics.');
})().catch(error=>{console.error(error);process.exitCode=1});
