import { useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import L from "leaflet";
import MapControlIcon from "./MapControlIcon";
import { areaKm2, distanceKm, formatMeasurement, polygonError, segmentDistances } from "../measurements";
import type { MapPoint, Measurement, MeasurementKind } from "../measurements";

const measuring = (mode: string | null): mode is MeasurementKind => mode === "distance" || mode === "area";
export { measuring };
export function useMapUtilities(map: MutableRefObject<L.Map | undefined>, mode: string | null, setMode: (mode: MeasurementKind | null) => void, onStart: () => void, settingsOpen: boolean) {
  const [draft, setDraft] = useState<Measurement | null>(null);
  const draftRef = useRef(draft); draftRef.current = draft;
  const [saved, setSaved] = useState<Measurement[]>([]);
  const [notice, setNotice] = useState("");
  const [coords, setCoords] = useState({lat: "", lng: ""});
  const [position, setPosition] = useState<{lat:number;lng:number;accuracy:number} | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const locationRequest = useRef(0);
  const layers = useRef<L.Layer[]>([]);
  const updateDraft = (value: Measurement | null) => { draftRef.current=value; setDraft(value); };
  useEffect(() => {
    if (mode) { locationRequest.current++; setLocating(false); setLocationMessage(""); }
    if (!measuring(mode)) updateDraft(null);
    else { updateDraft({kind:mode,points:[]});  setNotice(""); }
  }, [mode]);
  useEffect(() => () => { locationRequest.current++; }, []);
  useEffect(() => {
    layers.current.forEach(layer=>layer.remove()); layers.current=[];
    const m=map.current; if(!m)return;
    const add=(layer:L.Layer)=>{layer.addTo(m);layers.current.push(layer);};
    for(const measurement of [...saved,...(draft?[draft]:[])]) {
      const points=measurement.points.map(p=>[p.lat,p.lng] as L.LatLngTuple);
      if(points.length>=2) {
        const style={color:"#63caff",weight:3,fillOpacity:.12,dashArray:measurement===draft?"6 5":undefined,interactive:false};
        add(measurement.kind==="area"&&points.length>=3?L.polygon(points,style):L.polyline(points,style));
      }
      measurement.points.forEach((p,i)=>{
        const marker=L.circleMarker([p.lat,p.lng],{radius:5,color:"#07173f",weight:2,fillColor:"#fff",fillOpacity:1,interactive:false});
        marker.bindTooltip(`Point ${i+1}`,{direction:"top"});add(marker);
      });
    }
    if(position) {
      add(L.circle([position.lat,position.lng],{radius:position.accuracy,color:"#0960e1",fillColor:"#0960e1",fillOpacity:.12,weight:2,interactive:false}));
      add(L.circleMarker([position.lat,position.lng],{radius:7,color:"#fff",weight:2,fillColor:"#0960e1",fillOpacity:1,interactive:false}));
    }
    return ()=>{layers.current.forEach(layer=>layer.remove());layers.current=[];};
  }, [draft,saved,position]);
  const addPoint=(p:MapPoint)=>{
    const current=draftRef.current;
    if(!current||![p.lat,p.lng].every(Number.isFinite))return;
    if(Math.abs(p.lat)>85.0511||Math.abs(p.lng)>180){setNotice("Point is outside this map's supported extent.");return;}
    if(current.points.length>=100){setNotice("Maximum 100 points per measurement. Finish or start a new measurement.");return;}
    if(current.points.some(previous=>distanceKm(previous,p)<.000001)){setNotice("Choose a different point; this position is already in the measurement.");return;}
    updateDraft({...current,points:[...current.points,p]});setNotice("");
  };
  const finish=()=>{
    const current=draftRef.current;if(!current)return;
    const error=current.kind==="area"?polygonError(current.points):current.points.length<2?"Add at least two points to measure distance.":"";
    if(error){setNotice(error);return;}
    setSaved(values=>[...values,current]);updateDraft(null);setMode(null);setNotice("Measurement finished. It has not changed the analysis region.");
  };
  const cancel=()=>{updateDraft(null);setMode(null);setNotice("Unfinished measurement canceled. Finished measurements are retained.");};
  const start=(kind:MeasurementKind)=>{onStart();setMode(mode===kind?null:kind);setLocationMessage("");};
  const clear=()=>{
    locationRequest.current++;setLocating(false);setPosition(null);setSaved([]);updateDraft(null);setMode(null);setLocationMessage("Map cleared. Choose a region to view data again.");setNotice("");
  };
  const locate=()=>{
    onStart();setMode(null);setLocating(true);setLocationMessage("Requesting your approximate location…");
    const request=++locationRequest.current;
    if(!navigator.geolocation){setLocating(false);setLocationMessage("Location is unavailable in this browser. You can still search or select a region on the map.");return;}
    navigator.geolocation.getCurrentPosition(result=>{
      if(request!==locationRequest.current)return;
      setLocating(false);
      const {latitude:lat,longitude:lng,accuracy}=result.coords;
      if(![lat,lng,accuracy].every(Number.isFinite)||accuracy<0||Math.abs(lat)>85.0511||Math.abs(lng)>180){setLocationMessage("Your returned position cannot be displayed within this map's supported extent.");return;}
      setPosition({lat,lng,accuracy});map.current?.setView([lat,lng],Math.max(10,Math.min(map.current.getZoom()||10,14)));
      setLocationMessage(`Your location: ${lat.toFixed(5)}, ${lng.toFixed(5)}. Reported accuracy: ±${Math.round(accuracy)} m. The circle shows reported accuracy, not an analysis region.`);
    },error=>{
      if(request!==locationRequest.current)return;
      setLocating(false);setLocationMessage(error.code===1?"Location permission was denied. Enable it in browser settings to try again, or select a region manually.":error.code===3?"Location request timed out. Try again or select a region manually.":"Your location is unavailable. Try again or select a region manually.");
    },{enableHighAccuracy:false,timeout:12000,maximumAge:60000});
  };
  const current=draft??saved[saved.length-1];
  const segments=current?segmentDistances(current.points):[];
  const total=segments.reduce((sum,value)=>sum+value,0);
  const areaError=current?.kind==="area"?polygonError(current.points):"";
  const controlsUI=<div className="map-utilities" role="group" aria-label="Map measurement and location tools">
      <button type="button" className="map-icon-button" aria-label="Measure distance" title="Measure distance" aria-pressed={mode==="distance"} aria-controls="map-measurement-panel" onClick={()=>start("distance")}><MapControlIcon name="distance" /></button>
      <button type="button" className="map-icon-button" aria-label="Measure area" title="Measure area" aria-pressed={mode==="area"} aria-controls="map-measurement-panel" onClick={()=>start("area")}><MapControlIcon name="area" /></button>

      <button type="button" className="map-icon-button" aria-label="My location" title="My location — asks for browser permission" aria-busy={locating} disabled={locating} onClick={locate}><MapControlIcon name="location" /></button>

    </div>;
  const resultsUI=<section id="map-measurement-panel" className="map-measurement-panel" aria-label="Measurement settings and results" hidden={!current||settingsOpen} onKeyDown={e=>{if(e.key==="Escape"){e.stopPropagation();if(measuring(mode))cancel();}}}>
      <div className="measurement-panel-header"><h2>{current?.kind==="area"?"Area measurement":"Distance measurement"}</h2></div>
      {current&&<div className="measurement-summary" aria-live="polite"><strong>{current.kind==="area"?areaError?"Area not ready":`${formatMeasurement(areaKm2(current.points))} km²`:`${formatMeasurement(total)} km`}</strong><span>{current.kind==="area"?"Approximate surface area":"Approximate total distance"}</span><span>{current.points.length} points{!draft?" · Finished":" · Draft"}</span></div>}
      {current?.kind==="area"&&areaError&&current.points.length>=3&&<p className="measurement-warning">{areaError}</p>}
      {segments.length>0&&<details className="measurement-segments"><summary>Segments ({segments.length})</summary><ol>{segments.map((value,i)=><li key={i}>Point {i+1} → {i+2}<strong>{formatMeasurement(value)} km</strong></li>)}{current?.kind==="area"&&current.points.length>=3&&<li>Closing edge<strong>{formatMeasurement(distanceKm(current.points[current.points.length-1],current.points[0]))} km</strong></li>}</ol></details>}
      {measuring(mode)&&<>
        <div className="measurement-actions"><button type="button" disabled={!draft||draft.points.length<(mode==="area"?3:2)} onClick={finish}>Finish</button><button type="button" disabled={!draft?.points.length} onClick={()=>{if(draftRef.current)updateDraft({...draftRef.current,points:draftRef.current.points.slice(0,-1)});setNotice("");}}>Undo</button><button type="button" onClick={cancel}>Cancel</button></div>
        <details className="measurement-coordinate-entry"><summary>Add a point with keyboard</summary><p className="small">Pan the focused map with arrow keys, then add its center, or enter coordinates.</p><button type="button" onClick={()=>{const center=map.current?.getCenter();if(center)addPoint(center);}}>Add map center</button><div><label>Latitude<input type="number" min={-85.0511} max={85.0511} step="any" value={coords.lat} onChange={e=>setCoords({...coords,lat:e.target.value})} /></label><label>Longitude<input type="number" min={-180} max={180} step="any" value={coords.lng} onChange={e=>setCoords({...coords,lng:e.target.value})} /></label></div><button type="button" onClick={()=>{if(!coords.lat.trim()||!coords.lng.trim()){setNotice("Enter both latitude and longitude.");return;}addPoint({lat:Number(coords.lat),lng:Number(coords.lng)});}}>Add coordinates</button></details>
      </>}
      {notice&&<p role="status" className="measurement-warning">{notice}</p>}
      <p className="measurement-footnote">Approximate measurements on Earth's surface; elevation and terrain are not included. These overlays do not filter the NASA data or change the analysis region.</p>
    </section>;
  const locationUI=locationMessage&&<div className="map-location-message" role="status"><span>{locationMessage}</span><button type="button" className="map-icon-button" aria-label="Dismiss location message" title="Dismiss location message" onClick={()=>setLocationMessage("")}><span className="close-symbol" aria-hidden="true">×</span></button></div>;
  return {controlsUI,resultsUI,locationUI,addPoint,finish,cancel,clear};
}
