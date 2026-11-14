import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import type { Bbox } from "../types";

interface Props { bbox: Bbox; onChange: (b: Bbox) => void }

type Shape = "rectangle" | "square" | "circle" | "polygon";
const SHAPES: [Shape, string][] = [["rectangle", "Rectangle"], ["square", "Square"], ["circle", "Circle"], ["polygon", "Polygon"]];
const HINTS: Record<Shape, string> = {
  rectangle: "Click and drag on the map.",
  square: "Click and drag on the map.",
  circle: "Click the center and drag outward.",
  polygon: "Click to add corners. Double-click or press Finish to close the shape.",
};
const STYLE: L.PathOptions = { color: "#ffa63d", weight: 2, fillColor: "#ffa63d", fillOpacity: 0.15 };
const TEMP: L.PathOptions = { ...STYLE, dashArray: "5" };

const toBounds = (b: Bbox) => L.latLngBounds([b[1], b[0]], [b[3], b[2]]);

export default function MapPicker({ bbox, onChange }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map>();
  const shapeLayer = useRef<L.Layer>();
  const drawnKey = useRef("");
  const modeRef = useRef<Shape | null>(null);
  const cancel = useRef<() => void>(() => {});
  const finishPoly = useRef<() => void>(() => {});
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [mode, setMode] = useState<Shape | null>(null);
  modeRef.current = mode;

  useEffect(() => {
    const m = L.map(el.current!, { zoomControl: true }).setView([12, 121.5], 7);
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 17,
      attribution: "Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    }).addTo(m);
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 17,
    }).addTo(m);
    map.current = m;

    let start: L.LatLng | null = null;
    let temp: L.Rectangle | L.Circle | null = null;
    let pts: L.LatLng[] = [];
    let line: L.Polyline | null = null;

    const reset = () => {
      temp?.remove(); line?.remove();
      start = null; temp = null; pts = []; line = null;
    };
    cancel.current = reset;

    const squareEnd = (a: L.LatLng, b: L.LatLng) => {
      const pa = m.latLngToContainerPoint(a), pb = m.latLngToContainerPoint(b);
      const s = Math.max(Math.abs(pb.x - pa.x), Math.abs(pb.y - pa.y));
      return m.containerPointToLatLng(L.point(pa.x + (pb.x >= pa.x ? s : -s), pa.y + (pb.y >= pa.y ? s : -s)));
    };

    const commit = (layer: L.Rectangle | L.Circle | L.Polygon) => {
      const b = layer.getBounds();
      if (!(b.getEast() - b.getWest() > 0.05 && b.getNorth() - b.getSouth() > 0.05)) { layer.remove(); return; }
      shapeLayer.current?.remove();
      layer.setStyle({ ...STYLE, dashArray: undefined });
      shapeLayer.current = layer;
      const box = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((n) => Math.round(n * 100) / 100) as Bbox;
      drawnKey.current = box.join(",");
      onChangeRef.current(box);
    };

    m.on("mousedown", (e: L.LeafletMouseEvent) => {
      const md = modeRef.current;
      if (!md || md === "polygon") return;
      start = e.latlng;
      temp = (md === "circle" ? L.circle(start, { radius: 1, ...TEMP }) : L.rectangle(L.latLngBounds(start, start), TEMP)).addTo(m);
    });
    m.on("mousemove", (e: L.LeafletMouseEvent) => {
      const md = modeRef.current;
      if (start && temp) {
        if (md === "circle") (temp as L.Circle).setRadius(m.distance(start, e.latlng));
        else (temp as L.Rectangle).setBounds(L.latLngBounds(start, md === "square" ? squareEnd(start, e.latlng) : e.latlng));
      } else if (md === "polygon" && pts.length) {
        line?.setLatLngs([...pts, e.latlng]);
      }
    });
    m.on("mouseup", () => {
      if (!start || !temp) return;
      const done = temp;
      start = null; temp = null;
      commit(done);
      setMode(null);
    });
    m.on("click", (e: L.LeafletMouseEvent) => {
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
        setMode(null);
      }
    };
    finishPoly.current = finish;
    m.on("dblclick", () => { if (modeRef.current === "polygon") { pts.pop(); finish(); } });

    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMode(null); };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); m.remove(); };
  }, []);

  useEffect(() => {
    const m = map.current!;
    if (mode && mode !== "polygon") m.dragging.disable(); else m.dragging.enable();
    if (mode === "polygon") m.doubleClickZoom.disable(); else m.doubleClickZoom.enable();
    el.current!.classList.toggle("drawing", !!mode);
    return () => cancel.current();
  }, [mode]);

  useEffect(() => {
    const m = map.current!;
    const key = bbox.join(",");
    if (key !== drawnKey.current) {
      shapeLayer.current?.remove();
      shapeLayer.current = L.rectangle(toBounds(bbox), STYLE).addTo(m);
      drawnKey.current = key;
    }
    m.fitBounds(toBounds(bbox).pad(0.4));
  }, [bbox]);

  return (
    <div>
      <div className="shape-bar">
        <span className="small">Select by</span>
        <div className="seg" role="group" aria-label="Selection shape">
          {SHAPES.map(([s, label]) => (
            <button key={s} aria-pressed={mode === s} onClick={() => setMode(mode === s ? null : s)}>{label}</button>
          ))}
        </div>
        {mode === "polygon" && <button className="finish-btn" onClick={() => finishPoly.current()}>Finish</button>}
        <span className="small">{mode ? HINTS[mode] : "Pick a shape, then draw it on the map. Data covers the shape's bounding box."}</span>
      </div>
      <div ref={el} className="map" aria-label="Satellite map for choosing an area" />
    </div>
  );
}
