# web (front end, role D)

React + TypeScript + Vite + Leaflet. Free OpenStreetMap tiles.

```
cd web
npm install
npm run dev        # generates public/fake_cell_week.csv, then starts Vite
```

Without `VITE_API_URL`, `src/api.ts` builds the `/meta`, `/regions` and `/calendar` responses in the browser from the fake CSV. To use the real API, set `VITE_API_URL=https://...` in `web/.env.local` (not committed). Nothing else changes.

Fake data is random and a banner says so. The banner disappears when `VITE_API_URL` is set.
