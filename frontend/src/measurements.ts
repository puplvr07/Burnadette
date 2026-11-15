// Approximate surface measurements on a mean-radius sphere; no terrain/elevation.
export const MEAN_EARTH_RADIUS_KM = 6371.0088;
export interface MapPoint { lat: number; lng: number }
export type MeasurementKind = "distance" | "area";
export interface Measurement { kind: MeasurementKind; points: MapPoint[] }
const rad = Math.PI / 180;
export function distanceKm(a: MapPoint, b: MapPoint): number {
  const h = Math.sin((b.lat-a.lat)*rad/2)**2 + Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin((b.lng-a.lng)*rad/2)**2;
  return 2*MEAN_EARTH_RADIUS_KM*Math.atan2(Math.sqrt(Math.min(1,h)), Math.sqrt(Math.max(0,1-h)));
}
export function segmentDistances(points: MapPoint[]) { return points.slice(1).map((p,i)=>distanceKm(points[i],p)); }
// Spherical excess of geodesic triangles, triangulated from the first vertex.
export function areaKm2(points: MapPoint[]): number {
  if (points.length < 3) return 0;
  const vector = (p: MapPoint) => [Math.cos(p.lat*rad)*Math.cos(p.lng*rad), Math.cos(p.lat*rad)*Math.sin(p.lng*rad), Math.sin(p.lat*rad)];
  const dot = (a: number[], b: number[]) => a.reduce((s,v,i)=>s+v*b[i],0);
  const a = vector(points[0]); let excess = 0;
  for (let i=1;i<points.length-1;i++) {
    const b=vector(points[i]), c=vector(points[i+1]);
    const cross=[b[1]*c[2]-b[2]*c[1], b[2]*c[0]-b[0]*c[2], b[0]*c[1]-b[1]*c[0]];
    excess += 2*Math.atan2(dot(a,cross),1+dot(a,b)+dot(b,c)+dot(c,a));
  }
  const full=4*Math.PI*MEAN_EARTH_RADIUS_KM**2, area=Math.abs(excess)*MEAN_EARTH_RADIUS_KM**2;
  return Math.min(area,full-area);
}
export function polygonError(points: MapPoint[]): string {
  if (points.length < 3) return "Add at least three points to measure an area.";
  if (points.some(p=>!Number.isFinite(p.lat)||!Number.isFinite(p.lng))) return "Enter valid coordinates.";
  // This map does not wrap; reject ambiguous polygons across the date line.
  if (points.some((p,i)=>Math.abs(p.lng-points[(i+1)%points.length].lng)>=180)) return "Use an area that does not cross the international date line.";
  const orient=(a:MapPoint,b:MapPoint,c:MapPoint)=>(b.lng-a.lng)*(c.lat-a.lat)-(b.lat-a.lat)*(c.lng-a.lng);
  const on=(a:MapPoint,b:MapPoint,p:MapPoint)=>Math.abs(orient(a,b,p))<1e-10&&p.lng>=Math.min(a.lng,b.lng)&&p.lng<=Math.max(a.lng,b.lng)&&p.lat>=Math.min(a.lat,b.lat)&&p.lat<=Math.max(a.lat,b.lat);
  const intersects=(a:MapPoint,b:MapPoint,c:MapPoint,d:MapPoint)=>orient(a,b,c)*orient(a,b,d)<0&&orient(c,d,a)*orient(c,d,b)<0||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b);
  for(let i=0;i<points.length;i++) for(let j=i+1;j<points.length;j++) {
    if(j===i+1||i===0&&j===points.length-1) continue;
    if(intersects(points[i],points[(i+1)%points.length],points[j],points[(j+1)%points.length])) return "The polygon crosses itself. Undo a point or draw a simple boundary.";
  }
  return areaKm2(points)<1e-8 ? "The area is too small or its points lie on a line." : "";
}
export const formatMeasurement = (value: number) => value.toLocaleString(undefined,{maximumFractionDigits:3});
