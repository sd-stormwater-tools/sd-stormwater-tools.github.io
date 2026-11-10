# Stormwater Screening Map (reviewer tool)

Part of San Diego Storm Water Reviewer Tools, served at `/screening-map/` (see `../README.md` for the site structure).

**Preliminary screening - verify with source documents. Not an official City of San Diego product.**

A static, single-page map (no server, no API keys) for screening a project location against:

| Screen | Result | Data (in `data/`) |
|---|---|---|
| 85th-percentile 24-hr storm depth | Nearest isopluvial value, distance and direction (searched across **all** lines, not just the map view). An interpolated value between the two nearest lines of different value is shown only as a labeled *Reviewer note*. | `isopluvials.geojson` - County of San Diego DPW `HYD_85TH_PERCENT_ISOPLUVIALS` FeatureServer/0, retrieved 2026-10-24 (108 polylines, 0.32-1.12 in) |
| ESA (incl. 200 ft buffer) | Inside / outside, honoring polygon holes; distance and direction to nearest ESA edge; points within 100 ft of an edge flagged "verify". | `esa.geojson` - LDM Appendix O `ESA_CSD_200ft` (metadata 2023-01-11, modified 2024-06-28; zip 2024-08-14) |
| ASBS | Inside ASBS boundary vs. inside ASBS drainage area; ASBS number/name; distance and direction to each. ASBS 29 = La Jolla, ASBS 31 = San Diego-Scripps. | `asbs-boundary.geojson`, `asbs-drainage-areas.geojson` - LDM Appendix O `ASBSBound` (2005-09-29) and `asbswatersheds_area` (2006-02-01); zip 2023-10-24 |
| HMP exemption (potential) | Potentially exempt / Verify / Not exempt (screening) / Not mapped as exempt; receiving water, Fig. 1-2 Node, nearest exempt feature with distance and direction, HUC12 subwatershed and downstream path, Node conditions with page cites. See below. | `hmp-exempt-waters.geojson`, `hmp-exempt-conveyance.geojson`, `hmp-subwatersheds.geojson` - Project Clean Water Regional WMAA mapping data (2018-09-06) + USGS WBD HUC12 |

Manual reference for storm depth: City of San Diego Storm Water Standards, Part 1: BMP Design Manual (August 2024 Edition), Appendix B, Section B.1.3 (p. B-8): "The rainfall depth to estimate the DCV shall be determined using Figure B.1-1." Figure B.1-1 is on p. B-9; Worksheet B.2-1 line 1 (p. B-15). The manual does not specify interpolation between isopluvials.

## HMP exemption screen (added Nov 10, 2026 PST)
**This is a potential-exemption screen, not a determination.** City of San Diego Storm Water Standards, Part 1: BMP Design Manual (Aug 2024 Ed.), Sec. 1.6 (pp. 1-17 to 1-20) and Figure 1-2 (p. 1-21): "The City has the discretion to exempt a PDP from hydromodification management requirements" where it discharges by an existing underground storm drain, or a channel whose bed and bank are concrete lined all the way, directly to an exempt water (p. 1-17). Fig. 1-2: "Direct discharge refers to an uninterrupted hardened conveyance system" (p. 1-21). GIS cannot prove that connection, so results are worded as screening only.

Exempt receiving waters kept (only those listed in Sec. 1.6):
- Node 2, Pacific Ocean (pp. 1-17 to 1-18): outfall on the beach, not within/on top of a bluff; energy dissipation; invert at or below mean high tide (between MHT and the 100-yr WSE needs added analysis); no exemption above the 100-year floodplain elevation.
- Node 3, San Diego Bay and Mission Bay (p. 1-18): outfall not within a wildlife refuge or reserve (e.g., Kendall-Frost Mission Bay Marsh Reserve, San Diego Bay NWR, San Diego NWR); energy dissipation; invert at or below MHT; no exemption above the 100-year floodplain elevation.
- Node 4, Lake Hodges, San Vicente, El Capitan, Lower Otay, Upper Otay, Morena, Sutherland, Barrett, Lake Murray, Miramar (list p. 1-18, conditions p. 1-19): energy dissipation per City standards; invert at or below the lowest normal operating WSE unless discharging to quay or non-erodible shore protection; no exemption above the **reservoir spillway elevation**.
- Node 5, WMAA exempt reaches (p. 1-19): San Dieguito River downstream of Lake Hodges; San Diego River downstream of the confluence with San Vicente Creek; Sweetwater River downstream of Sweetwater Reservoir; Otay River downstream of Lower Otay Reservoir Dam. Energy dissipation; invert at or below the 10-year floodplain elevation (City Engineer exceptions never above the 100-year); no exemption above the 100-year floodplain elevation.
- All nodes: existing outfalls insufficient for the added flows may require upgrading and may disqualify the exemption (pp. 1-19 to 1-20).

Data (`data/`, built by `../../build_hmp_data.py` in the GIS workspace):
| File | Content | Source |
|---|---|---|
| `hmp-exempt-waters.geojson` (13 features, ~199 KB) | Exempt waters above, dissolved by name; `name`, `node`. Pacific Ocean kept only within 1 mile of its shoreline. Mission Bay polygon excludes the Kendall-Frost reserve and the San Diego Bay polygon excludes the salt evaporator (refuge) area, as edited by the WMAA. | WMAA `Exempt_Bodies` (category A) |
| `hmp-exempt-conveyance.geojson` (15 features, ~500 KB) | `kind` = `system` (WMAA exempt stabilized conveyance systems: existing storm drains / hardened channels mapped as draining to an exempt water) or `reach` (exempt river reaches); `rw` (City-listed receiving water), `via` (hardened creek, e.g. Switzer Creek, Las Chollas Creek), `node`. Simplified 3 ft. | WMAA `Exempt_Systems` (categories B and R) |
| `hmp-subwatersheds.geojson` (65 features, ~620 KB) | USGS WBD HUC12 subwatersheds (simplified 40 ft) with `path` (downstream HUC12 chain from ToHUC), `wma` (WMAA watershed), `rw` (principal natural receiving water, curated reviewer description), `rw_exempt`. Context only. | USGS WBD HUC12 + WMAA `Watershed_Boundaries` |

Sources and terms:
- Project Clean Water (San Diego Regional Copermittees), "Comprehensive WMAA Mapping Data" - WMAA Attachment C geodatabase `Regional_WMAA_Data_2018_0906_v10.gdb` (layers dated 2018-09-06; files posted 2024-05-13), https://projectcleanwater.org/document/comprehensive-wmaa-mapping-data/ (Otay River update: https://projectcleanwater.org/otay_river_hmp_exemption/). Publicly posted for download; no license is stated. Retrieved Nov 10, 2026.
- U.S. Geological Survey, Watershed Boundary Dataset, HUC12, https://hydro.nationalmap.gov/arcgis/rest/services/wbd/MapServer/6 - U.S. Government work, public domain. Retrieved Nov 10, 2026.

Omitted on purpose: WMAA-exempt waters not listed by the City (Buena Vista, Agua Hedionda, Batiquitos and San Elijo lagoons; San Luis Rey River; Forester Creek and its tributaries County Ditch / Washington Creek; Lake Poway, Dixon, Wohlford, Jennings, Loveland, Henshaw, Cuyamaca, Ramona, San Marcos, Lindo, Santee Lakes, Chollas Heights, Sweetwater Reservoir and other lakes).

Method (`hmp-core.js`, distances in EPSG:2230 ft like the other screens):
- Distance from the point to every exempt water (0 if inside) and every mapped exempt conveyance system / reach. Nearest <= 300 ft: **Potentially exempt - drains to X; applicant must demonstrate direct discharge per Fig. 1-2 Node N**. 300-1,000 ft: **Verify**. Otherwise **Not exempt (screening)** where the HUC12's receiving water is not an exempt water (e.g., Los Peñasquitos Lagoon), or **Not mapped as exempt** where the subwatershed's system includes an exempt water but no mapped direct-discharge conveyance is near the site.
- The thresholds are reviewer screening distances (not manual values) chosen to approximate a site's connection to an adjacent mapped storm drain.
- Limitations: point screen (not the project boundary); WMAA systems were mapped regionally in 2014-2018 and are not a complete storm drain inventory; it does not check flow direction, the dam location for reservoirs (a site below a dam does not drain to the reservoir), outfall location (beach vs bluff), refuge boundaries, energy dissipation, invert or floodplain elevations; the WMAA layer does not include later system changes.
- The other screens are unchanged (`screen-core.js` untouched; regression in `site-tests/hmp_regression_test.py`).

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
`index.html`, `app.css`, `app.js` (UI, geocoding), `screen-core.js` (geometry), `hmp-core.js` (HMP exemption screen), `data/*.geojson`. Leaflet 1.9.4 (BSD-2-Clause) is shared at `../assets/vendor/leaflet/`.

## Attribution and terms
Imagery and topographic basemaps (c) Esri and its data providers (Esri, Vantor, Earthstar Geographics, HERE, Garmin, USGS, OpenStreetMap contributors and the GIS User Community); street map (c) OpenStreetMap contributors. Geocoding: U.S. Census Bureau; fallback geocoding (c) OpenStreetMap contributors via Nominatim / Photon. Screening data: County of San Diego and City of San Diego (public GIS downloads listed above); HMP exemption data: Project Clean Water Regional WMAA mapping data and USGS Watershed Boundary Dataset. This tool is not affiliated with, produced by, or endorsed by the City of San Diego.
