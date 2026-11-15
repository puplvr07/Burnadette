import { useEffect, useRef, useState } from "react";
import type { Region } from "../types";
import MapControlIcon from "./MapControlIcon";

interface Props { regions: Region[]; onSelect: (region: Region) => void; onSearchStart?: () => void; dismissSignal?: number }

export default function RegionSearch({ regions, onSelect, onSearchStart, dismissSignal }: Props) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState(false);
  const results = useRef<HTMLUListElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const normalized = query.trim().toLocaleLowerCase();
  const matches = regions.filter((region) => region.name.toLocaleLowerCase().includes(normalized));
  const close = () => { setExpanded(false); setOpen(false); trigger.current?.focus(); };
  const choose = (region: Region) => { setQuery(region.name); setExpanded(false); setOpen(false); onSelect(region); };

  useEffect(() => { if (expanded) input.current?.focus(); }, [expanded]);
  useEffect(() => { setExpanded(false); setOpen(false); }, [dismissSignal]);

  return (
    <div className="region-search-launcher">
      <button ref={trigger} className="map-icon-button search-toggle" type="button" title={expanded ? "Close region search" : "Search pilot regions"}
        aria-label={expanded ? "Close region search" : "Search pilot regions"} aria-expanded={expanded} aria-controls="map-region-search-panel"
        onClick={() => { if (expanded) close(); else { setExpanded(true); setOpen(true); onSearchStart?.(); } }}>
        {expanded ? <span className="close-symbol" aria-hidden="true">×</span> : <MapControlIcon name="search" />}
      </button>
      <form className="region-search" id="map-region-search-panel" role="search" aria-label="Search available regions" hidden={!expanded}
        onSubmit={(event) => {
          event.preventDefault();
          const exact = matches.find((r) => r.name.toLocaleLowerCase() === normalized);
          if (exact || matches.length === 1) choose(exact ?? matches[0]);
          else { setOpen(true); results.current?.querySelector<HTMLButtonElement>("button")?.focus(); }
        }}
        onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}
        onKeyDown={(event) => {
          if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
        }}>
        <div className="search-panel-header">
          <label htmlFor="map-region-search">Search pilot regions</label>
          <button className="map-icon-button" type="button" aria-label="Close search panel" title="Close search" onClick={close}><span className="close-symbol" aria-hidden="true">×</span></button>
        </div>
        <div className="region-search-field">
          <MapControlIcon name="search" />
          <input ref={input} id="map-region-search" type="search" value={query} autoComplete="off"
            placeholder="Search available regions…" aria-controls="region-search-results" aria-describedby="region-search-help"
            onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); requestAnimationFrame(() => results.current?.querySelector<HTMLButtonElement>("button")?.focus()); }
            }} />
          {query && <button className="map-icon-button" type="button" aria-label="Clear region search" title="Clear search text" onClick={() => { setQuery(""); setOpen(true); input.current?.focus(); }}><span className="close-symbol" aria-hidden="true">×</span></button>}
        </div>
        <p className="region-search-help" id="region-search-help">Available pilot regions only. You can also select an area on the map.</p>
        <div className="region-search-results" hidden={!expanded || !open}>
          <p className="region-match-count" role="status">{matches.length} {matches.length === 1 ? "region" : "regions"} found</p>
          <ul ref={results} id="region-search-results" aria-label="Matching pilot regions">
            {matches.map((region) => <li key={region.id}><button type="button" onClick={() => choose(region)}><span>{region.name}</span><span aria-hidden="true">↗</span></button></li>)}
          </ul>
          {!matches.length && <p className="region-search-empty">No matching pilot region. Try another name, or select an area on the map. Availability there is not guaranteed.</p>}
        </div>
      </form>
    </div>
  );
}
