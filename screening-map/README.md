# Stormwater Screening Map (reviewer tool)

Part of San Diego Storm Water Reviewer Tools, served at `/screening-map/` (see `../README.md` for the site structure).

**Preliminary screening - verify with source documents. Not an official City of San Diego product.**

A static, single-page map (no server, no API keys) for screening a project location against:

| Screen | Result | Data (in `data/`) |
|---|---|---|
| 85th-percentile 24-hr storm depth | Nearest isopluvial value, distance and direction (searched across **all** lines, not just the map view). An interpolated value between the two nearest lines of different value is shown only as a labeled *Reviewer note*. | `isopluvials.geojson` - County of San Diego DPW `HYD_85TH_PERCENT_ISOPLUVIALS` FeatureServer/0, retrieved 2026-10-24 (108 polylines, 0.32-1.12 in) |
| ESA (incl. 200 ft buffer) | Inside / outside, honoring polygon holes; distance and direction to nearest ESA edge; points within 100 ft of an edge flagged "verify". | `esa.geojson` - LDM Appendix O `ESA_CSD_200ft` (metadata 2023-01-11, modified 2024-06-28; zip 2024-08-14) |
| ASBS | Inside ASBS boundary vs. inside ASBS drainage area; ASBS number/name; distance and direction to each. ASBS 29 = La Jolla, ASBS 31 = San Diego-Scripps. | `asbs-boundary.geojson`, `asbs-drainage-areas.geojson` - LDM Appendix O `ASBSBound` (2005-09-29) and `asbswatersheds_area` (2006-02-01); zip 2023-10-24 |

Manual reference for storm depth: City of San Diego Storm Water Standards, Part 1: BMP Design Manual (August 2024 Edition), Appendix B, Section B.1.3 (p. B-8): "The rainfall depth to estimate the DCV shall be determined using Figure B.1-1." Figure B.1-1 is on p. B-9; Worksheet B.2-1 line 1 (p. B-15). The manual does not specify interpolation between isopluvials.

## Use
- Type an address (e.g. `202 C St, San Diego, CA`) or coordinates (`32.8570, -117.2555`; lon/lat order is detected), click the map, or press the location button.
- Layout: full-bleed map with a floating search/results panel (stacks map-then-results on phones). Results open with summary tiles: storm depth, In ESA? YES/NO, In ASBS area? YES/NO, followed by the detailed cards (display only; values come from the same `screen-core.js` result).
- Basemaps (floating switcher, top right): Esri World Imagery (default), Esri World Topographic Map, OpenStreetMap; optional Esri reference labels (roads, places) over imagery.
- **Copy** puts a plain-text summary with sources on the clipboard.
- Deep links: `#32.857016,-117.255523` screens a point; `?q=5180%20Tecolote%20Rd` runs an address search.

## How it computes
`screen-core.js` (plain JS, no dependencies) projects all geometry to NAD83 / California Zone VI (EPSG:2230, US survey feet) with a built-in Lambert Conformal Conic implementation (matches pyproj to < 0.01 ft) and does nearest-segment and even-odd point-in-polygon tests in that plane. It reproduces the reference Python screener (`screen.py`, shapely + pyproj): 353 test points, 0 mismatches in values or inside/outside status, distances within 1 ft.

Data coordinates are rounded to 6 decimal places (~0.4 ft); no geometry simplification. Total data ~5.1 MB uncompressed (~1.3 MB gzipped as served by GitHub Pages).

## Geocoding
The U.S. Census Geocoder (`onelineaddress`, benchmark `Public_AR_Current`) does **not** send CORS headers, so it is called via **JSONP** (`format=jsonp&callback=...`), the same way the original site did. If no match, these variants are tried in order: original text (+ ", San Diego, CA" if no "San Diego"), + ", CA", without "San Diego", ZIP-based community (e.g. 92037 -> La Jolla), "<street>, La Jolla, CA", street only. Matches outside the San Diego area (lat 32.4-33.3, lon -117.8 to -116.7) are ignored. Last-resort fallbacks, labeled "fallback, verify location": OpenStreetMap Nominatim, then Photon (komoot). Both are free, keyless and CORS-enabled but rate limited (Nominatim: max 1 request/s) and are only called after the Census variants fail.

## Deploy (GitHub Pages)
Push the whole site (the parent folder) to the root of a repository, then Settings -> Pages -> Deploy from branch -> `main` / `(root)`. `.nojekyll` is included so files are served as-is.

## Files
`index.html`, `app.css`, `app.js` (UI, geocoding), `screen-core.js` (geometry), `data/*.geojson`. Leaflet 1.9.4 (BSD-2-Clause) is shared at `../assets/vendor/leaflet/`.

## Attribution and terms
Imagery and topographic basemaps (c) Esri and its data providers (Esri, Vantor, Earthstar Geographics, HERE, Garmin, USGS, OpenStreetMap contributors and the GIS User Community); street map (c) OpenStreetMap contributors. Geocoding: U.S. Census Bureau; fallback geocoding (c) OpenStreetMap contributors via Nominatim / Photon. Screening data: County of San Diego and City of San Diego (public GIS downloads listed above). This tool is not affiliated with, produced by, or endorsed by the City of San Diego.
