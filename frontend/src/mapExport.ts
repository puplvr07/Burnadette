import L from "leaflet";
import type { Bbox, Source } from "./types";

export interface ExportContext { bbox: Bbox; region: string; start: string; end: string; source: Source; sample: boolean }
const loadSvg = (svg: SVGElement) => new Promise<HTMLImageElement>((resolve,reject)=>{
  const clone=svg.cloneNode(true) as SVGElement;
  clone.setAttribute("xmlns","http://www.w3.org/2000/svg");
  const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)],{type:"image/svg+xml"}));
  const img=new Image(); img.onload=()=>{URL.revokeObjectURL(url);resolve(img);}; img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("Map overlays could not be exported."));}; img.src=url;
});
export async function saveMapImage(map:L.Map, applied:ExportContext|null, sample:boolean) {
  const node=map.getContainer(), rect=node.getBoundingClientRect(), width=Math.round(rect.width), height=Math.round(rect.height);
  if(width<1||height<1) throw new Error("The map is not visible yet.");
  if(map.getContainer().classList.contains('leaflet-zoom-anim')) throw new Error("Wait for the map to finish zooming, then try again.");
  const initialCenter=map.getCenter(), initialZoom=map.getZoom();
  const canvas=document.createElement('canvas'); canvas.width=width; canvas.height=height+300;
  const ctx=canvas.getContext('2d'); if(!ctx) throw new Error('Image export is not available in this browser.');
  ctx.fillStyle='#12100e';ctx.fillRect(0,0,canvas.width,canvas.height);
  const tiles=[...node.querySelectorAll<HTMLImageElement>('.leaflet-tile')].filter(img=>{const r=img.getBoundingClientRect();return r.right>rect.left&&r.left<rect.right&&r.bottom>rect.top&&r.top<rect.bottom;});
  if(!tiles.length||tiles.some(img=>!img.complete||!img.naturalWidth)) throw new Error('Map tiles are still loading or could not be loaded. Wait and try again.');
  for(const img of tiles){const r=img.getBoundingClientRect();ctx.drawImage(img,r.left-rect.left,r.top-rect.top,r.width,r.height);}
  for(const svg of node.querySelectorAll<SVGElement>('.leaflet-overlay-pane svg')) {
    const r=svg.getBoundingClientRect(); if(r.width&&r.height){const image=await loadSvg(svg);ctx.drawImage(image,r.left-rect.left,r.top-rect.top,r.width,r.height);}
  }
  for(const img of node.querySelectorAll<HTMLImageElement>('.leaflet-marker-pane img')) {if(img.complete&&img.naturalWidth){const r=img.getBoundingClientRect();ctx.drawImage(img,r.left-rect.left,r.top-rect.top,r.width,r.height);}}
  ctx.font='12px sans-serif';
  for(const tooltip of node.querySelectorAll<HTMLElement>('.leaflet-tooltip-pane .leaflet-tooltip')) {
    const label=tooltip.textContent?.trim(); if(!label)continue;
    const r=tooltip.getBoundingClientRect(), x=r.left-rect.left, y=r.top-rect.top;
    ctx.fillStyle='#171512e8';ctx.fillRect(x,y,r.width,r.height);ctx.fillStyle='#fff';ctx.fillText(label,x+6,y+Math.min(r.height-4,16),Math.max(0,r.width-12));
  }
  if(map.getZoom()!==initialZoom || !map.getCenter().equals(initialCenter)) throw new Error('The map moved while saving. Keep it still and try again.');
  if(applied){const a=map.latLngToContainerPoint([applied.bbox[3],applied.bbox[0]]),b=map.latLngToContainerPoint([applied.bbox[1],applied.bbox[2]]);ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.setLineDash([8,5]);ctx.strokeRect(a.x,a.y,b.x-a.x,b.y-a.y);ctx.setLineDash([]);}
  ctx.fillStyle='#171512';ctx.fillRect(0,height,width,300);ctx.fillStyle='#fff';ctx.font='14px sans-serif';
  const lines=[applied?`Applied bounding box: ${applied.region}`:'No analysis region applied',applied?`Dates: ${applied.start} to ${applied.end} · Source: ${applied.source.toUpperCase()}`:'No dates or source applied',sample?'SAMPLE DATA · Random values':'', 'Dashed white box: applied area. Other map shapes may be drafts or measurements.',`Captured: ${new Date().toLocaleString()}`,'Tiles © Esri, Maxar, Earthstar Geographics, and the GIS User Community'];
  let y=height+23; for(const line of lines.filter(Boolean)){const words=line.split(' ');let row='';for(const word of words){const next=row?`${row} ${word}`:word;if(ctx.measureText(next).width>width-24&&row){ctx.fillText(row,12,y);y+=19;row=word;}else row=next;}if(row){ctx.fillText(row,12,y);y+=19;}}
  const blob=await new Promise<Blob|null>(resolve=>{try{canvas.toBlob(resolve,'image/png');}catch{resolve(null);}});
  if(!blob) throw new Error('The map provider or browser blocked image export. Please try again later.');
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='burnadette-map.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
