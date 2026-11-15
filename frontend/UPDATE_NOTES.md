# Burnadette frontend update notes

Updated: November 15, 2026 (Asia/Manila)
Branch: `frontend/minazaki-ui`
Comparison baseline: `6626b49` — the checkout before this frontend work.

These notes describe the final accumulated frontend changes. Earlier design experiments that were replaced are called out below. This branch is for team review; publication of this branch does not merge it into another branch.

## Navigation and shared state

- Replaced the combined Calendar entry with Home, Explore, and About navigation.
- Added separate Map, Heatmap, and Calendar views inside Explore.
- Added persistent active-tab fills: orange in dark mode and yellow in light mode.
- Kept the exploration controller mounted across view changes so applied regions, dates, source, metric, and view state persist.
- Added an immersive map workspace, with global navigation revealed by the navigation handle, hover/focus, or scrolling.
- Changed the Home action from “Open the calendar” to “Explore,” opening Map, with a subtle hover/focus treatment.

## Map starting state and intentional selection

- Fresh visits start without a selected analysis region, drawn shapes, measurements, or location markers.
- Metadata provides the initial viewport and filter defaults; analysis is requested only after the user chooses a region and clicks Apply.
- Opening tools does not select or draw anything. Ordinary map clicks remain passive.
- Drawing requires an open tool panel and an explicitly activated drawing tool.
- Closing tools or pressing Escape cancels unfinished drawing while retaining an existing completed selection.
- Added cancellation guards for pending point placement during navigation, tool changes, and panel closure.
- Existing applied selections persist across Map, Heatmap, and Calendar navigation.

## Unified map tools

- Consolidated drawing, measurement, and location controls into one Map tools panel.
- Grouped controls under Draw area, Measure, and Location, with a Region & dates shortcut.
- Final analysis tools are Point & Radius, Rectangle, and Polygon.
- Removed the separate Circle tool because Point & Radius provides a more explicit radius-based selection.
- Removed Square because it overlaps with Rectangle.
- Removed duplicate nested measurement close/results controls; results remain in the Measure section.
- Added icon labels, tooltips, active states, keyboard focus styles, and 44-pixel action targets.

### Point & Radius

- Click/tap a center or use the map center, then adjust radius in kilometers using an input and slider.
- Current frontend guardrails: 1–100 km. Radius and diameter are explicitly distinguished.
- Added editable center coordinates, a circular preview, and center-marker dragging when Point & Radius is explicitly active.
- Used spherical geographic calculations, with validation for unsupported map edges and date-line cases.
- The API still receives a bounding box. Notices explain that results include the corners outside the circle; exact circular filtering is not implemented.

### Measurement and location

- Added distance paths with segment lengths and total distance in kilometers.
- Added polygon area measurement in square kilometers, with invalid/self-crossing polygon checks.
- Added Finish, Undo, Cancel, map-center input, and coordinate entry for measurements.
- Measurements are approximate surface calculations and do not account for terrain or elevation.
- Measurement overlays remain separate from the analysis region and do not alter NASA data requests.
- My Location requests browser permission only when activated, centers the map, and displays coordinates and reported accuracy.
- Added handling for permission denial, timeouts, unsupported locations, and stale location callbacks after clearing.
- My Location does not automatically become the analysis region.

### Clear map

- Clear now removes drawn analysis regions, radius centers, measurement lines/areas, and temporary location markers.
- Clearing also removes the applied region and associated results, and disables Apply until another region is selected.
- Dates, source, and metric settings are retained for the next selection.
- Old request responses are ignored after the region is cleared or replaced.

## Search, settings, and coordinates

- Added a compact search launcher for supplied pilot regions; this is not a worldwide geocoding service.
- Search expands and focuses its input; closing or Escape does not clear the selected region.
- Added collapsible settings with compact close controls and an explicit draft/Apply workflow.
- Added a live WGS 84 readout with labeled latitude/longitude, decimal degrees, and hemisphere indicators.
- Mouse movement reports pointer coordinates. Touch and keyboard navigation report the map center with a crosshair.
- Coordinate updates are throttled and are not repeatedly announced to screen readers.
- Separated coordinates, sample-data notices, caveats, and attribution into map display areas.

## Calendar

- Replaced the less structured presentation with a monthly planner, month/year selectors, and previous/next controls.
- Observations remain weekly: each entry has an explicit seven-day date range. No daily measurements are invented.
- Boundary weeks appear in each month they intersect, with explanatory text.
- Added selected-week details for activity, anomaly, source/provenance, reported active cells, uncertainty, sensitivity, and flags.
- Added keyboard-selectable entries, responsive details, source coverage bounds, and request retry handling.
- Preserved the requested month through loading and distinguished zero, unavailable values, missing records, metadata gaps, loading, and errors.

## Heatmap

- Retained the year-by-week structure while improving hierarchy, controls, and the selected-area summary.
- Made year labels sticky during horizontal scrolling and added full weekly date ranges and keyboard navigation.
- Added a stable details panel beside the grid on desktop and below it on smaller screens.
- Added numeric legend endpoints and explanation of the returned-data 98th-percentile activity color saturation. Exact values remain visible in details.
- Anomaly uses a fixed 0–100 percentile scale; the interface does not call it a prediction probability.
- Preserved distinct zero, unavailable, missing-record, known-gap, loading, and error displays.
- Added full-screen expansion, exit/Escape handling, focus restoration, and a viewport-filling fallback.
- Full screen fits all year rows and weekly columns by default. Larger cells restores scrolling; details and the legend open on demand.

## Source selector and data interpretation

- Final source labels are Harmonized, MODIS, and VIIRS, with explanatory subtitles.
- Added clear selected, hover, and focus states.
- Added a brief MODIS + VIIRS combination illustration when switching to Harmonized, plus a static reduced-motion version.
- The illustration is a source-selection cue, not live processing or a claim of greater accuracy.
- Added metadata-based availability summaries, known-gap information, uncertainty/sensitivity notices, and caveats.
- Removed misleading interpretations that missing values or recorded zeros prove no burning occurred.
- Continued to label random development fixtures as sample data, not verified satellite findings.
- No measurement units are invented where the API contract does not define them.

## Themes and visual refinements

- Retained the navy/orange dark theme and added a light theme based on the supplied NASA Space Apps screenshot: blue navigation/hero, white panels, and yellow action accents.
- Earlier generic NASA blue/red and intermediate light palettes were superseded by this final screenshot-inspired theme.
- Added an icon-only sun/moon toggle, saved preference, startup restoration, a short transition, and reduced-motion handling.
- Removed theme-specific content widths, spacing, font changes, and header thickness that caused layout shifts.
- Kept the Burnadette wordmark colors identical between themes.
- Heatmap observation colors and scientific legend meanings do not change with the theme.

## Data and scope boundaries

- Kept the existing sample-data workflow and API contract.
- No changes to `src/api.ts`, `src/types.ts`, ML, or backend files are included in this update.
- No new frontend dependencies are required.
- Existing imagery, data attribution, sample notices, and caveats remain accessible.
- No temperature/weather feature, new live NASA data integration, forecasting, or exact circular filtering was added.

## Validation and review limits

- Production validation: `cd frontend && npm run build` (TypeScript and Vite).
- Local React/Leaflet-fixture checks cover fresh-start/query gating, shared navigation, drawing cancellation, Point & Radius, geographic measurements, Clear, stale request/location callbacks, calendar states, heatmap states/full screen, and theme persistence.
- Validation scripts and local snapshots are outside the repository and are not part of this commit.
- Leaflet fixture checks are not browser visual verification. Responsive layouts, actual touch interaction, map-tile loading, browser full screen, and location permission dialogs still need team review in a real browser.
- All published application changes and these notes are confined to `frontend/`.

## Follow-up visual and navigation refinements

- Made the Home hero backdrop full width, with the same responsive content geometry in both themes.
- Attached the heading underline directly to “fire” and retained emphasis in light mode.
- Added deep-blue light-mode metric cards with readable neon values; dark-mode values remain orange.
- Matched the dark-mode Explore button to the orange accent, with restrained theme-matched button glows.
- Added the orange dark-header top line to mirror the light-theme accent line.
- Added the six team member names in the requested order and capitalization, retaining the other profile details.
- Added member-card hover/focus lift and theme-appropriate glow, with reduced-motion support.
- Added independent moon rotation and decorative hotspot artwork synchronized with Earth's animation. The globe is decorative and does not represent live detections.
- Included the current smoother map zoom settings and reduced-motion animation handling.
- Removed wheel/scroll-triggered navigation reveal on Map. Hover, keyboard focus, and touch activation remain available.
- Follow-up validation: production build, navigation/theme/calendar checks, and map interaction regression checks. Browser visual verification remains a team-review step.
