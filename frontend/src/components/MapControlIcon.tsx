interface Props { name: "search" | "tools" | "draw" | "distance" | "area" | "clear" | "location" }

export default function MapControlIcon({ name }: Props) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {name === "search" && <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></>}
      {name === "tools" && <><path d="M4 6h7m5 0h4M4 12h2m5 0h9M4 18h10m5 0h1" /><circle cx="13.5" cy="6" r="2.5" /><circle cx="8.5" cy="12" r="2.5" /><circle cx="16.5" cy="18" r="2.5" /></>}
      {name === "distance" && <><path d="m3 15 12-12 6 6L9 21Zm4-4 2 2m1-5 2 2m1-5 2 2m-2 8 2 2m1-5 2 2" /></>}
      {name === "area" && <><path d="M5 5h14v14H5Z" strokeDasharray="3 3" /><circle cx="5" cy="5" r="2" /><circle cx="19" cy="5" r="2" /><circle cx="19" cy="19" r="2" /><circle cx="5" cy="19" r="2" /></>}
      {name === "clear" && <><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6m4-6v6" /></>}
      {name === "location" && <><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3" /></>}
      {name === "draw" && <><path d="m4 16-1 5 5-1L20 8l-4-4L4 16ZM14 6l4 4M4 16l4 4" /></>}
    </svg>
  );
}
