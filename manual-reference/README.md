# Manual & Code Reference (reviewer tool)

**Not an official City of San Diego product.** Independent reviewer reference tool. Verify against the current documents on sandiego.gov before citing.

Replaces Juan's ChatGPT-hosted "San Diego Stormwater Manual Navigator" (san-diego-stormwater-manual.villasenorj.chatgpt.site).

## What it does
- Search by reference ID (`B.5-4`, `Table 1-2`, `Figure B.1-1`, `Form I-3B`, `1.7`, `142.0220`, `Appendix G`) or any phrase (all words must appear on the page). Enter on an exact ID opens it.
- Results are ordered by the reference hierarchy: Municipal Code, then Stormwater Standards, then Drainage Design Manual. Checkboxes limit the search to any of the three.
- Opens the exact page of the unaltered City PDF (rendered with PDF.js), with search terms highlighted, the printed page label, the edition (Part 1 Aug 2024, Parts 2 and 3 May 2021), prev/next, zoom, a link to the same page in the City-hosted PDF, and **Copy citation**.
- "Page text" under each page gives the extracted text for copying verbatim excerpts.
- Browse any document by chapters, sections, tables, figures, worksheets, forms, or appendices (reference index with document chips and type tabs; tables, figures, worksheets, and forms show page-thumbnail cards).
- Chapter tabs (Start, Ch. 1-9, Appendices, Part 2, Part 3, DDM, SDMC, Forms) list every indexed item in that part with a "Read chapter here" button.
- Reader: navy title bar with edition, printed page and PDF page, nearby-page filmstrip, Close.
- Visuals are real pages only: thumbnails in `thumbs/*.webp` are pre-rendered from the hosted PDFs (50 pages per WebP sprite, lazy-loaded). Preview crops trim the printed page footer, so the City footer mark is not shown in previews. No City logos or official branding are added.
- Deep links: `#ref/sws/Worksheet%20B.5-4`, `#page/ddm/83`.

## Documents (hosted copies are byte-identical to the City files; MD5 in data/catalog.js)
| id | Document | Edition | Official URL |
|---|---|---|---|
| sdmc-142-2 | SDMC Ch.14 Art.2 Div.2 Storm Water Runoff and Drainage | header (10-2002) | https://docs.sandiego.gov/municode/MuniCodeChapter14/Ch14Art02Division02.pdf |
| sdmc-43-3 | SDMC Ch.4 Art.3 Div.3 Stormwater Management and Discharge Control | header (8-2015) | https://docs.sandiego.gov/municode/MuniCodeChapter04/Ch04Art03Division03.pdf |
| sdmc-142-1 | SDMC Ch.14 Art.2 Div.1 Grading | header (3-2021) | https://docs.sandiego.gov/municode/MuniCodeChapter14/Ch14Art02Division01.pdf |
| sws | Stormwater Standards (Part 1 Aug 2024 Ed., effective Aug 15, 2024; Parts 2-3 May 2021 Ed.) | Aug 2024 file | https://www.sandiego.gov/sites/default/files/2024-08/sws_manual_august_2024_update.pdf |
| appi | Appendix I Forms and Checklists | Aug 2024 Ed. | https://www.sandiego.gov/sites/default/files/2024-08/appendix_i_forms.pdf |
| j1 | Green Street PDP Exemption Forms (Form J-1) | Jan 2018 Ed. | https://www.sandiego.gov/sites/default/files/pdp_exemption_forms.pdf |
| ddm | Drainage Design Manual | Jan 2017 Ed. | https://www.sandiego.gov/sites/default/files/drainage_design_manual_jan2017.pdf |

## Rebuilding the data
`python3 gis/manual-build/build_manual_data.py` (on the box) regenerates `data/` and `docs/` from the reference library; then `python3 gis/manual-build/build_thumbs.py` regenerates `thumbs/*.webp` and `data/thumbs.js` (sprite geometry + landscape page list). The build fails if any catalog entry's printed page does not match the footer on its PDF page. When the City posts a new edition, replace the PDF in the library, update the text file, and rerun.
