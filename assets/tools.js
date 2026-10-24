/* Single list of tools. To add a tool: create /<id>/index.html (copy the template in README.md) and add ONE entry here.
 * Only list tools that exist - no placeholders. Order here = order in the nav and on the home page. */
window.SW_SITE = {
  title: 'San Diego Storm Water Reviewer Tools',
  disclaimer: 'Not an official City of San Diego product. Preliminary reference tools - verify with source documents.'
};
window.SW_TOOLS = [
  {
    id: 'screening-map',
    path: 'screening-map/',
    title: 'Stormwater Screening Map',
    summary: 'Screen an address, coordinates, or map click against the 85th-percentile 24-hour isopluvials, Appendix O ESA, and ASBS layers, with distance and direction to each nearest feature and source citations.',
    tags: ['Storm depth (Figure B.1-1)', 'ESA', 'ASBS', 'Satellite map']
  },
  {
    id: 'manual-reference',
    path: 'manual-reference/',
    title: 'Manual & Code Reference',
    summary: 'Search and open exact pages of the Municipal Code storm water divisions, the Stormwater Standards (Aug 2024), and the Drainage Design Manual (Jan 2017): sections, tables, figures, worksheets, forms, and full text, with edition and printed-page citations.',
    tags: ['SDMC', 'Storm Water Standards', 'Drainage Design Manual', 'Worksheets & forms']
  },
  {
    id: 'bmp-sizing',
    path: 'bmp-sizing/',
    title: 'BMP Sizing Calculator',
    summary: 'Worksheets B-1, B.2-1, B.5-1 to B.5-7 and I-10.A computed with the cell logic of the City\'s August 2024 Appendix B.5 Excel workbook, with equations shown step by step, YES/NO checks, and copyable plan-check calcs with edition and page citations.',
    tags: ['DCV (B.2-1)', 'Biofiltration (B.5-1)', 'Retention (B.5-2 to B.5-7)', 'Compact biofiltration (I-10.A)']
  }
];
