# frontend (role D)

React + TypeScript + Vite + Leaflet. Satellite base map from Esri World Imagery.

```
cd frontend
npm install
npm run dev        # generates public/fake_cell_week.csv, then starts Vite
```

Without `VITE_API_URL`, `src/api.ts` builds the `/meta`, `/regions` and `/calendar` responses in the browser from the fake CSV. To use the real API, set `VITE_API_URL=https://...` in `frontend/.env.local` (not committed). Nothing else changes.

Sample data is random and the app labels it as such. The labels disappear when `VITE_API_URL` is set. While sample data is in use, downloaded files start with `SAMPLE_`.

The Map, Heatmap and Calendar views are described in `UPDATE_NOTES.md`.

## Compare and download (Heatmap view)

Below the heatmap: busiest and quietest full year, peak month, a chosen year against the multi-year average (season profile with typical range and uncertainty band), activity by year, the most unusual weeks, and downloads (weekly CSV, yearly CSV, and PNGs of both charts). Everything is computed in the browser from the `/calendar` response (`src/analytics.ts`), so the `/anomalies` endpoint is optional.

## Credits

Leaflet (BSD 2-Clause); Esri World Imagery and World Boundaries and Places; Earth and Moon textures from the three.js example assets; ColorBrewer OrRd ramp (Cynthia Brewer); Google Fonts (SIL OFL); React, TypeScript, Vite. The NASA data products are listed on the About page once the harmonization lead confirms them.

## AI assistance

Parts of this frontend's code, layout and styling were written with help from an AI coding assistant (Kiro), working from the team's plan (the team guide) and design requests. The project idea, data method and plan are the team's own.
