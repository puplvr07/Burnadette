import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import MapControlIcon from "./MapControlIcon";
import { measuring, useMapUtilities } from "./MapUtilities";
import type { MeasurementKind } from "../measurements";
import type { Bbox } from "../types";
import { DEFAULT_RADIUS_KM } from "../pointRadius";
import type { RadiusSelection } from "../pointRadius";

interface Props { selectionCleared?: boolean; onClearSelection?: () => void; onOpenSettings?: () => void; bbox: Bbox; radiusSelection: RadiusSelection | null; onRadiusSelect: (point: RadiusSelection) => boolean; onChange: (b: Bbox) => void; onBrowse?: () => void; settingsOpen?: boolean }

type Shape = "rectangle" | "polygon" | "point";
type MapTool = Shape | MeasurementKind;
const SHAPES: [Shape, string][] = [["point", "Point & Radius"], ["rectangle", "Rectangle"], ["polygon", "Polygon"]];
const HINTS: Record<Shape, string> = {
  point: "Click or tap a center, or use the map center. Then adjust the radius in settings.",
  rectangle: "Click and drag on the map.",
  polygon: "Click to add corners. Double-click or press Finish to close the shape.",
};
const STYLE: L.PathOptions = { color: "#ffa63d", weight: 2, fillColor: "#ffa63d", fillOpacity: 0.15 };
const TEMP: L.PathOptions = { ...STYLE, dashArray: "5" };

const toBounds = (b: Bbox) => L.latLngBounds([b[1], b[0]], [b[3], b[2]]);
// The square web-map world (Web Mercator stops at about 85 degrees north and south).
const WORLD = L.latLngBounds([-85.0511, -180], [85.0511, 180]);

export default function MapPicker({ bbox, radiusSelection, onRadiusSelect, onChange, onBrowse, settingsOpen = false, selectionCleared = false, onClearSelection, onOpenSettings }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map>();
  const shapeLayer = useRef<L.Layer>();
  const radiusCircle = useRef<L.Circle>();
  const centerMarker = useRef<L.Marker>();
  const radiusRef = useRef(radiusSelection);
  radiusRef.current = radiusSelection;
  const onRadiusSelectRef = useRef(onRadiusSelect);
  onRadiusSelectRef.current = onRadiusSelect;
  const ignoreClickUntil = useRef(0);
  const drawnKey = useRef("");
  const bboxRef = useRef(bbox);
  bboxRef.current = bbox;
  const needsFit = useRef(true);
  const modeRef = useRef<MapTool | null>(null);
  const utilitiesRef = useRef<ReturnType<typeof useMapUtilities>>();
  const cancel = useRef<() => void>(() => {});
  const finishPoly = useRef<() => void>(() => {});
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onBrowseRef = useRef(onBrowse);
  onBrowseRef.current = onBrowse;
  const [drawingOpen, setDrawingOpen] = useState(false);
  const [toolGroup, setToolGroup] = useState<"draw" | "measure" | "location">("draw");
  const drawingOpenRef = useRef(false);
  drawingOpenRef.current = drawingOpen;
  const [coordinate, setCoordinate] = useState({lat: 12, lng: 121.5, source: "center" as "center" | "pointer"});
  const [mode, setMode] = useState<MapTool | null>(null);
  modeRef.current = mode;
  useEffect(() => {
    if (settingsOpen) { setDrawingOpen(false); setMode(null); }
  }, [settingsOpen]);

  useEffect(() => {
    const m = L.map(el.current!, {
      zoomControl: true,
      maxBounds: WORLD,
      maxBoundsViscosity: 1, // hard edge: can't drag past the world
      worldCopyJump: false,
      zoomSnap: 0.25,
    }).setView([12, 121.5], 7);
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 17,
      noWrap: true,
      bounds: WORLD,
      attribution: "Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    }).addTo(m);
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 17, noWrap: true, bounds: WORLD,
    }).addTo(m);
    map.current = m;

    // Lowest zoom = the zoom where one world still covers the whole map box,
    // so zooming out never shows repeats or empty space. Recomputed on resize.
    const fitMinZoom = () => {
      if (!el.current?.clientWidth || !el.current.clientHeight) return;
      const z = Math.ceil(m.getBoundsZoom(WORLD, true) * 4) / 4;
      m.setMinZoom(z);
      if (m.getZoom() < z) m.setZoom(z);
    };
    fitMinZoom();
    const ro = new ResizeObserver(() => {
      if (!el.current?.clientWidth || !el.current.clientHeight) return;
      m.invalidateSize({ pan: false });
      fitMinZoom();
      if (needsFit.current) {
        m.fitBounds(toBounds(bboxRef.current).pad(0.4));
        needsFit.current = false;
      }
    });
    ro.observe(el.current!);

    let clickTimer: ReturnType<typeof setTimeout> | undefined;
    const browse = () => { clearTimeout(clickTimer); onBrowseRef.current?.(); };
    m.on("dragstart", browse);
    m.on("zoomstart", () => clearTimeout(clickTimer));
    const afterNavigation = () => { clearTimeout(clickTimer); ignoreClickUntil.current = Date.now() + 300; };
    m.on("dragend", afterNavigation);
    m.on("zoomend", afterNavigation);
    const wheelBrowse = () => browse();
    const zoomButtonBrowse = (event: MouseEvent) => {
      if ((event.target as HTMLElement).closest(".leaflet-control-zoom")) browse();
    };
    const touchBrowse = (event: TouchEvent) => { if (event.touches.length > 1) browse(); };
    const container = el.current!;
    let coordinateSource: "center" | "pointer" = "center";
    let coordinateTimer: ReturnType<typeof setTimeout> | undefined;
    let pendingCoordinate: {lat: number; lng: number; source: "center" | "pointer"} = {lat: m.getCenter().lat, lng: m.getCenter().lng, source: coordinateSource};
    const updateCoordinate = (point: L.LatLng, source: "center" | "pointer") => {
      pendingCoordinate = {lat: point.lat, lng: ((point.lng + 180) % 360 + 360) % 360 - 180, source};
      if (coordinateTimer !== undefined) return;
      coordinateTimer = setTimeout(() => { coordinateTimer = undefined; setCoordinate(pendingCoordinate); }, 60);
    };
    const useCenter = () => { coordinateSource = "center"; updateCoordinate(m.getCenter(), "center"); };
    const pointerSource = (event: PointerEvent) => { if (event.pointerType === "touch") useCenter(); else coordinateSource = "pointer"; };
    const keyboardSource = (event: KeyboardEvent) => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "-", "="].includes(event.key)) useCenter(); };
    container.addEventListener("pointermove", pointerSource, { passive: true });
    container.addEventListener("pointerdown", pointerSource, { passive: true });
    container.addEventListener("pointerleave", useCenter);
    container.addEventListener("keydown", keyboardSource);
    m.on("move", () => { if (coordinateSource === "center") updateCoordinate(m.getCenter(), "center"); });
    m.on("mouseout", useCenter);
    useCenter();
    container.addEventListener("wheel", wheelBrowse, { passive: true });
    container.addEventListener("click", zoomButtonBrowse, true);
    container.addEventListener("touchstart", touchBrowse, { passive: true });
    let start: L.LatLng | null = null;
    let temp: L.Rectangle | null = null;
    let pts: L.LatLng[] = [];
    let line: L.Polyline | null = null;

    const reset = () => {
      clearTimeout(clickTimer);
      temp?.remove(); line?.remove();
      start = null; temp = null; pts = []; line = null;
    };
    cancel.current = reset;

    const commit = (layer: L.Rectangle | L.Circle | L.Polygon) => {
      const b = layer.getBounds();
      if (!(b.getEast() - b.getWest() > 0.05 && b.getNorth() - b.getSouth() > 0.05)) { layer.remove(); return; }
      centerMarker.current?.remove(); centerMarker.current = undefined;
      radiusCircle.current = undefined;
      shapeLayer.current?.remove();
      layer.setStyle({ ...STYLE, dashArray: undefined });
      shapeLayer.current = layer;
      const box = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((n) => Math.round(n * 100) / 100) as Bbox;
      drawnKey.current = box.join(",");
      onChangeRef.current(box);
    };

    m.on("mousedown", (e: L.LeafletMouseEvent) => {
      const md = modeRef.current;
      if (e.originalEvent && "button" in e.originalEvent && e.originalEvent.button !== 0) return;
      if (!drawingOpenRef.current || !md || md === "polygon" || md === "point" || measuring(md)) return;
      start = e.latlng;
      temp = L.rectangle(L.latLngBounds(start, start), TEMP).addTo(m);
    });
    m.on("mousemove", (e: L.LeafletMouseEvent) => {
      if (coordinateSource === "pointer") updateCoordinate(e.latlng, "pointer");
      const md = modeRef.current;
      if (start && temp) {
        temp.setBounds(L.latLngBounds(start, e.latlng));
      } else if (md === "polygon" && pts.length) {
        line?.setLatLngs([...pts, e.latlng]);
      }
    });
    m.on("mouseup", () => {
      if (!start || !temp) return;
      const done = temp;
      start = null; temp = null;
      commit(done);
      ignoreClickUntil.current = Date.now() + 300;
      setMode(null);
    });
    m.on("click", (e: L.LeafletMouseEvent) => {
      if (Date.now() < ignoreClickUntil.current) return;
      if (measuring(modeRef.current)) {
        const active = modeRef.current;
        clearTimeout(clickTimer);
        clickTimer = setTimeout(() => { if (modeRef.current === active) utilitiesRef.current?.addPoint(e.latlng); }, 300);
        return;
      }
      if (!drawingOpenRef.current) return;
      if (modeRef.current === "point") {
        clearTimeout(clickTimer);
        clickTimer = setTimeout(() => {
          if (!drawingOpenRef.current || modeRef.current !== "point") return;
          const accepted = onRadiusSelectRef.current({ lat: e.latlng.lat, lon: e.latlng.lng, radiusKm: radiusRef.current?.radiusKm ?? DEFAULT_RADIUS_KM });
          if (accepted) setMode(null);
        }, 300);
        return;
      }
      if (modeRef.current !== "polygon") return;
      pts.push(e.latlng);
      line ??= L.polyline(pts, TEMP).addTo(m);
      line.setLatLngs([...pts, e.latlng]);
    });
    const finish = () => {
      if (pts.length >= 3) {
        const poly = L.polygon(pts, TEMP).addTo(m);
        reset();
        commit(poly);
        ignoreClickUntil.current = Date.now() + 300;
        setMode(null);
      }
    };
    finishPoly.current = finish;
    m.on("dblclick", (event: L.LeafletMouseEvent) => {
      clearTimeout(clickTimer);
      if (measuring(modeRef.current)) { utilitiesRef.current?.addPoint(event.latlng); utilitiesRef.current?.finish(); }
      else if (drawingOpenRef.current && modeRef.current === "polygon") { pts.pop(); finish(); }
      else browse();
    });

    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { if (measuring(modeRef.current)) utilitiesRef.current?.cancel(); else { modeRef.current = null; cancel.current(); setMode(null); setDrawingOpen(false); } } };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(clickTimer); clearTimeout(coordinateTimer);
      container.removeEventListener("pointermove", pointerSource);
      container.removeEventListener("pointerdown", pointerSource);
      container.removeEventListener("pointerleave", useCenter);
      container.removeEventListener("keydown", keyboardSource);
      container.removeEventListener("wheel", wheelBrowse);
      container.removeEventListener("click", zoomButtonBrowse, true);
      container.removeEventListener("touchstart", touchBrowse);
      ro.disconnect(); document.removeEventListener("keydown", onKey); m.remove();
      shapeLayer.current = undefined; radiusCircle.current = undefined; centerMarker.current = undefined; drawnKey.current = "";
    };
  }, []);

  useEffect(() => {
    const m = map.current!;
    if (mode && mode !== "polygon" && mode !== "point" && !measuring(mode)) m.dragging.disable(); else m.dragging.enable();
    if (mode === "polygon" || measuring(mode)) m.doubleClickZoom.disable(); else m.doubleClickZoom.enable();
    el.current!.classList.toggle("drawing", !!mode);
    if (drawingOpen && mode === "point") centerMarker.current?.dragging?.enable();
    else centerMarker.current?.dragging?.disable();
    return () => cancel.current();
  }, [mode, drawingOpen]);

  useEffect(() => {
    const m = map.current!;
    const key = bbox.join(",");
    if (selectionCleared) {
      shapeLayer.current?.remove(); centerMarker.current?.remove();
      shapeLayer.current = undefined; centerMarker.current = undefined; radiusCircle.current = undefined;
      drawnKey.current = "";
      return;
    }
    if (radiusSelection) {
      const point: L.LatLngExpression = [radiusSelection.lat, radiusSelection.lon];
      if (!radiusCircle.current) {
        shapeLayer.current?.remove();
        radiusCircle.current = L.circle(point, { ...STYLE, radius: radiusSelection.radiusKm * 1000 }).addTo(m);
        shapeLayer.current = radiusCircle.current;
      } else radiusCircle.current.setLatLng(point).setRadius(radiusSelection.radiusKm * 1000);
      if (!centerMarker.current) {
        const marker = L.marker(point, {
          draggable: drawingOpenRef.current && modeRef.current === "point", keyboard: true, title: "Activate Point & Radius to drag the center, or edit coordinates in settings",
          icon: L.divIcon({ className: "radius-center-marker", html: '<span aria-hidden="true"></span>', iconSize: [44, 44], iconAnchor: [22, 22] }),
        }).addTo(m);
        marker.bindTooltip("Activate Point & Radius to drag · or edit coordinates in settings");
        marker.on("dragstart", () => { ignoreClickUntil.current = Date.now() + 1000; });
        marker.on("drag", () => { radiusCircle.current?.setLatLng(marker.getLatLng()); });
        marker.on("dragend", () => {
          if (!drawingOpenRef.current || modeRef.current !== "point") return;
          ignoreClickUntil.current = Date.now() + 400;
          const previous = radiusRef.current;
          if (!previous) return;
          const center = marker.getLatLng();
          const accepted = onRadiusSelectRef.current({ lat: center.lat, lon: center.lng, radiusKm: previous.radiusKm });
          if (!accepted) { marker.setLatLng([previous.lat, previous.lon]); radiusCircle.current?.setLatLng([previous.lat, previous.lon]); }
        });
        centerMarker.current = marker;
      } else centerMarker.current.setLatLng(point);
      drawnKey.current = key;
    } else {
      centerMarker.current?.remove(); centerMarker.current = undefined;
      if (radiusCircle.current || key !== drawnKey.current) {
        shapeLayer.current?.remove();
        radiusCircle.current = undefined;
        shapeLayer.current = L.rectangle(toBounds(bbox), STYLE).addTo(m);
        drawnKey.current = key;
      }
    }
    needsFit.current = true;
    if (el.current?.clientWidth && el.current.clientHeight) {
      m.fitBounds(toBounds(bbox).pad(0.4));
      needsFit.current = false;
    }
  }, [bbox, radiusSelection, selectionCleared]);

  const utilities = useMapUtilities(map, mode, setMode, () => { onBrowseRef.current?.(); }, settingsOpen);
  utilitiesRef.current = utilities;
  return (
    <div className="map-picker">
      <div className={`drawing-dock unified-tools-dock${drawingOpen ? " drawing-open" : ""}`}>
        <button id="map-tools-toggle" className="drawing-toggle map-icon-button" type="button" aria-label={drawingOpen ? "Close map tools" : "Open map tools"} title={drawingOpen ? "Close map tools" : "Map tools"} aria-expanded={drawingOpen} aria-controls="map-drawing-tools"
          onClick={() => { if (!drawingOpen) onBrowseRef.current?.(); modeRef.current = null; cancel.current(); setDrawingOpen((open) => !open); setMode(null); }}>
          {drawingOpen ? <span className="close-symbol" aria-hidden="true">×</span> : <MapControlIcon name="tools" />}
        </button>
      <div className="shape-bar" id="map-drawing-tools" hidden={!drawingOpen}>
        <div className="unified-tools-heading"><h2>Map tools</h2><button type="button" className="map-tool-settings-link" title="Region & dates" aria-label="Open region and date settings" aria-controls="map-settings" onClick={()=>{cancel.current();setMode(null);setDrawingOpen(false);onOpenSettings?.();}}><MapControlIcon name="tools" /><span>Region & dates</span></button></div>
        <div className="map-tool-groups" role="group" aria-label="Map tool categories">
          {([['draw','Draw area'],['measure','Measure'],['location','Location']] as const).map(([group,label])=><button key={group} type="button" aria-pressed={toolGroup===group} onClick={()=>{modeRef.current=null;cancel.current();utilities.cancel();setMode(null);setToolGroup(group);}}>{label}</button>)}
        </div>
        <div className="unified-draw-group" hidden={toolGroup!=="draw"}>
        <p className="small" role={selectionCleared ? "status" : undefined}>{selectionCleared ? "Map cleared. No analysis region selected. " : ""}Select an analysis region. Activate a shape, then draw on the map.</p>
        <div className="seg" role="group" aria-label="Selection shape">
          {SHAPES.map(([s, label]) => (
            <button key={s} aria-pressed={mode === s} onClick={() => { onBrowseRef.current?.(); setMode(mode === s ? null : s); }}>{label}</button>
          ))}
        </div>
        {mode === "point" && <button type="button" className="finish-btn" onClick={() => {
          const center = map.current!.getCenter();
          if (onRadiusSelectRef.current({ lat: center.lat, lon: center.lng, radiusKm: radiusRef.current?.radiusKm ?? DEFAULT_RADIUS_KM })) setMode(null);
        }}>Use map center</button>}
        {mode === "polygon" && <button className="finish-btn" onClick={() => finishPoly.current()}>Finish</button>}
        <span className="small">{mode && !measuring(mode) ? HINTS[mode] : "Browsing only. Activate a tool above to select an analysis region."}</span>
        </div>
        <div className={`unified-utility-group group-${toolGroup}`} hidden={toolGroup==="draw"}>
          <p className="small">{toolGroup==="measure"?"Measure distances or areas without changing the analysis region.":"Center the map on your location. Permission is requested only when you choose My location."}</p>
          {utilities.controlsUI}
          {toolGroup==="measure"&&utilities.resultsUI}
          {toolGroup==="location"&&utilities.locationUI}
        </div>
        <button type="button" className="clear-map-button" aria-label="Clear map" title="Remove all drawn regions, measurements, markers and related results" onClick={()=>{modeRef.current=null;cancel.current();utilities.clear();setMode(null);shapeLayer.current?.remove();centerMarker.current?.remove();shapeLayer.current=undefined;centerMarker.current=undefined;radiusCircle.current=undefined;drawnKey.current="";onClearSelection?.();}}><MapControlIcon name="clear" />Clear map</button>
        <p className="map-clear-explanation">Clears drawn regions, measurements, location markers and analysis results. Dates and source are kept.</p>
      </div>
      </div>
      {coordinate.source === "center" && <span className="map-center-crosshair" aria-hidden="true" />}
      <div className="map-coordinate-readout" role="group" aria-label="Map coordinates in WGS 84" aria-live="off">
        <span className="coordinate-source">{coordinate.source === "center" ? "Map center" : "Pointer"}</span>
        <span>Lat <strong>{Math.abs(coordinate.lat).toFixed(4)}° {coordinate.lat < 0 ? "S" : "N"}</strong></span>
        <span>Lon <strong>{Math.abs(coordinate.lng).toFixed(4)}° {coordinate.lng < 0 ? "W" : "E"}</strong></span>
        <span className="coordinate-system">WGS 84</span>
      </div>
      <div ref={el} className="map" aria-label="Satellite map for choosing an area" />
    </div>
  );
}
