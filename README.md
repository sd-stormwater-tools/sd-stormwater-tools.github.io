# San Diego Storm Water Reviewer Tools

**Not an official City of San Diego product. Preliminary reference tools - verify with source documents.**

A static GitHub Pages site (no server, no build step, no API keys) that collects independent reference tools for San Diego storm water plan review. The home page lists the tools; each tool lives in its own folder and shares one header, nav, footer, and stylesheet.

## Tools
| Path | Tool |
|---|---|
| `/screening-map/` | **Stormwater Screening Map**: screens an address, `lat, lon`, map click, or device location against the County 85th-percentile 24-hr isopluvials, the LDM Appendix O ESA layer (holes honored), and the ASBS boundary and drainage areas. It reports distance and direction to each nearest feature, with source and manual citations. See `screening-map/README.md`. |
| `/manual-reference/` | **Manual & Code Reference**: search by reference ID or full text across SDMC Ch.14 Art.2 Div.2, Ch.4 Art.3 Div.3, Ch.14 Art.2 Div.1, the Stormwater Standards (Aug 2024 file; Parts 2-3 May 2021 Ed.), Appendix I forms, Form J-1, and the Drainage Design Manual (Jan 2017). Opens the exact PDF page (PDF.js) with printed page, edition, and a copy-ready citation. See `manual-reference/README.md`. |

## Structure
```
/
├── index.html              home page: intro, tool cards (generated from assets/tools.js), key references
├── .nojekyll               serve files as-is (no Jekyll processing)
├── README.md
├── assets/
│   ├── tools.js            THE tool list (drives the nav and the home page cards) + site title/disclaimer
│   ├── site.js             injects the shared header/nav (and footer) on every page
│   ├── site.css            shared look: header, nav, footer, page/card styles
│   └── vendor/
│       ├── leaflet/        Leaflet 1.9.4 (shared by map tools)
│       └── pdfjs/          PDF.js 3.11.174 legacy build (Apache-2.0), page viewer
└── screening-map/
    ├── index.html, app.js, app.css, screen-core.js, README.md
│   └── data/*.geojson      isopluvials, ESA, ASBS boundary, ASBS drainage areas
└── manual-reference/
    ├── index.html, app.js, app.css, README.md
    ├── data/catalog.js     generated reference catalog (IDs, titles, PDF pages, printed labels)
    ├── data/text-*.json    page text for full-text search
    └── docs/*.pdf          byte-identical copies of the City PDFs (needed: sandiego.gov sends no CORS headers)
```
`site.js` works out the site root from its own URL, so links work at any folder depth and under a project URL like `https://<user>.github.io/<repo>/`.

## Adding a tool
1. Create a folder, e.g. `dcv-calculator/`, with an `index.html` like this:
   ```html
   <!doctype html>
   <html lang="en">
   <head>
     <meta charset="utf-8">
     <meta name="viewport" content="width=device-width,initial-scale=1">
     <title>DCV Calculator - San Diego Storm Water Reviewer Tools</title>
     <link rel="stylesheet" href="../assets/site.css">
   </head>
   <body>
     <script src="../assets/tools.js"></script>
     <script src="../assets/site.js" data-current="dcv-calculator"></script>
     <main class="page">
       <h1>DCV Calculator</h1>
       <p class="notice"><strong>Preliminary - verify with source documents.</strong></p>
       <!-- tool content; put tool-specific JS/CSS in this folder -->
     </main>
   </body>
   </html>
   ```
   For a full-screen app like the map, add `data-footer="none"` to the `site.js` tag.
2. Add **one** entry to `window.SW_TOOLS` in `assets/tools.js`:
   ```js
   { id: 'dcv-calculator', path: 'dcv-calculator/', title: 'DCV Calculator',
     summary: 'Worksheet B.2-1 design capture volume check.', tags: ['Worksheet B.2-1'] }
   ```
   `id` must match `data-current` so the nav highlights the page.
3. Only add entries for tools that exist and work. No placeholder or "coming soon" entries.

Each tool should cite its public source data and the governing manual or code section, and should show the disclaimer.

## Key references
- City of San Diego Land Development Manual (Storm Water Standards, Drainage Design Manual, Appendix O GIS files): https://www.sandiego.gov/planning/programs/landdevcode/landdevmanual
- San Diego Municipal Code: https://www.sandiego.gov/city-clerk/officialdocs/municipal-code
- County of San Diego 85th Percentile Isopluvials: https://gis-public.sandiegocounty.gov/arcgis/rest/services/sdep_warehouse/HYD_85TH_PERCENT_ISOPLUVIALS/FeatureServer/0

## Local preview and deploy
```
python3 -m http.server 8000     # from the repo root, then open http://localhost:8000/
```
GitHub Pages: push this folder to the repo root, then Settings -> Pages -> Deploy from a branch -> `main` / `(root)`.

## Attribution
Basemaps (c) Esri and its data providers, and (c) OpenStreetMap contributors. Geocoding: U.S. Census Bureau, with OpenStreetMap Nominatim/Photon as fallbacks. Screening data: County of San Diego and City of San Diego public GIS downloads. Not affiliated with, produced by, or endorsed by the City of San Diego.
