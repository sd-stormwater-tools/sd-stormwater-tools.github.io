/* BMP Sizing Calculator - reviewer tool. Not an official City of San Diego product.
 * Worksheets B.5-1..B.5-7 are evaluated by engine.js on the formulas of the City's Appendix B.5 Excel workbook
 * (Version 2.0, August 2024; data/b5-workbook.js), so rounding and lookups match the City file cell for cell.
 * Line wording on screen is the workbook's own text (WBD.sheets[..].text); reviewer notes are labelled.
 * Where the workbook and the manual PDF differ, the workbook governs and the manual page is cited in a flag.
 * B-1, Table B.1-1/B.2-1, B.2-1 and I-10.A are computed here from the manual / Form I-10 text.
 * Departures from the workbook are listed in FIXES and labelled on screen. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var E = window.B5Engine, WBD = window.B5_WORKBOOK, T = window.MR_THUMBS, ROOT = window.SW_ROOT || '../';
  var MAN = 'Stormwater Standards, Part 1 BMP Design Manual (August 2024 Edition)';
  var XLS = 'City Appendix B.5 Excel worksheets, Version 2.0 (August 2024)';
  var SWS_URL = 'https://www.sandiego.gov/sites/default/files/2024-08/stormwater-standards-manual-2024.pdf';
  var KEY = 'sw-bmp-sizing-v1';

  /* ---------------- number formatting ---------------- */
  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  function fmt(x, d) {
    if (E.isErr(x)) return x.err;
    if (typeof x === 'string') return x;
    if (!isNum(x)) return '-';
    if (d == null) d = Math.abs(x) >= 100 ? 2 : Math.abs(x) >= 1 ? 3 : 4;
    return x.toLocaleString('en-US', { maximumFractionDigits: d });
  }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }

  /* ---------------- state ---------------- */
  function defaults() {
    return {
      project: '', bmp: 'BMP-1', tab: 'B-1',
      dmas: [{ id: 'DMA-1', area: 1, imp: 0.85, hsg: 'D', c: 0.9, bmp: 'BMP-1', type: 'Biofiltration', poc: 'POC-1' }],
      d: 0.5, tcv: 0, rcv: 0,
      rc: { unit: 'sf', rows: [{ s: 'Roofs', a: 37026 }, { s: 'Amended, Mulched Soils or Landscape', a: 6534 }], disp: { on: false, imp: 1, perv: 0.4, hsg: 'B' } },
      conv: { sf: 43560 },
      w: {}, i10: { cap: '', outlet: 'N/A', storage: false }
    };
  }
  var S;
  try { S = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { S = null; }
  if (!S || !S.dmas) S = defaults();
  var D0 = defaults(); Object.keys(D0).forEach(function (k) { if (S[k] === undefined) S[k] = D0[k]; });
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode */ } }

  /* ---------------- B-1 / B.2-1 derived values ---------------- */
  function bmpIds() { var a = []; S.dmas.forEach(function (r) { var b = (r.bmp || '').trim(); if (b && a.indexOf(b) < 0) a.push(b); }); return a; }
  function trib() {
    var rows = S.dmas.filter(function (r) { return (r.bmp || '').trim() === S.bmp; });
    var A = rows.reduce(function (s, r) { return s + num(r.area); }, 0), AC = rows.reduce(function (s, r) { return s + num(r.area) * num(r.c); }, 0);
    return { rows: rows, ac: A, sf: A * 43560, c: A ? AC / A : 0, imp: rows.reduce(function (s, r) { return s + num(r.imp); }, 0) };
  }
  function dcvB21() { var t = trib(); return 3630 * t.c * S.d * t.ac - num(S.tcv) - num(S.rcv); }

  /* ---------------- workbook evaluation ---------------- */
  var cache = {};
  function wsInputs(id) { return S.w[id] || (S.w[id] = {}); }
  function evalSheet(id) {
    if (cache[id]) return cache[id];
    var spec = SPECS[id], sh = new E.Workbook(WBD).sheet(spec.sheet), w = wsInputs(id);
    spec.lines.forEach(function (L) { if (L.t === 'in') sh.set(L.cell, inVal(id, L)); });
    (spec.extraIn || []).forEach(function (c) { sh.set(c.cell, w[c.cell] !== undefined && w[c.cell] !== '' ? num(w[c.cell]) : c.def); });
    return (cache[id] = sh);
  }
  function inVal(id, L) {
    var w = wsInputs(id);
    if (w[L.cell] !== undefined && w[L.cell] !== '') return num(w[L.cell]);
    if (L.link) return L.link.get();
    return L.def;
  }
  function g(id, cell) { return evalSheet(id).get(cell); }
  function lineVal(id, n) { var L = SPECS[id].lines.filter(function (x) { return x.n === n; })[0]; return L.t === 'in' ? inVal(id, L) : g(id, L.cell); }
  /* verbatim worksheet wording for a line: text cells left of the value cell on the same row, plus L.wbx continuation cells */
  function coln(a) { var m = /^([A-Z]+)(\d+)$/.exec(a), n = 0; for (var i = 0; i < m[1].length; i++) n = n * 26 + m[1].charCodeAt(i) - 64; return [n, +m[2]]; }
  function wbCell(id, a) { var sh = WBD.sheets[SPECS[id].sheet]; return sh && sh.text ? sh.text[a] : undefined; }
  function wbText(id, L) {
    var sh = SPECS[id] && WBD.sheets[SPECS[id].sheet], tx = sh && sh.text; if (!tx || !L.cell) return null;
    var vc = coln(L.cell), out = [];
    Object.keys(tx).forEach(function (a) { var q = coln(a); if (q[1] === vc[1] && q[0] >= 2 && q[0] < vc[0]) out.push([q[0], tx[a]]); });
    out.sort(function (x, y) { return x[0] - y[0]; });
    var t = out.map(function (x) { return x[1]; }).concat((L.wbx || []).map(function (a) { return tx[a]; })).filter(Boolean).join('\n');
    t = t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    return t || null;
  }
  function wbSpan(id, cells, fallback) {
    var t = cells.map(function (a) { return wbCell(id, a); }).filter(Boolean).join('\n').replace(/[ \t]+\n/g, '\n').trim();
    return t ? '<span class="wbt" title="Worksheet wording, City workbook ' + esc(SPECS[id].sheet) + ' ' + cells.join(', ') + '">' + esc(t) + '</span>' : esc(fallback);
  }
  /* B.5-4 Line 9 as the City workbook computes it (cell J31): Line 8 / (Line 2[b] x Line 1/12) */
  function b54wb() { var v = g('B.5-4', 'J31'); return isNum(v) ? v : NaN; }
  function b54manual() { /* Line 9 as printed in the manual PDF (p. B-60): Line 8 / (Line 2[b] / (Line 1/12)) - shown for comparison only */
    var l8 = g('B.5-4', 'J30'), b = g('B.5-4', 'H22'), p = inVal('B.5-4', SPECS['B.5-4'].lines[0]);
    if (!isNum(l8) || !isNum(b) || !b || !p) return NaN;
    return l8 / (b / (p / 12));
  }
  var DEPTH_FIG = { 3: ['Figure B.5-6', 245, 'B-79'], 6: ['Figure B.5-7', 246, 'B-80'], 9: ['Figure B.5-8', 247, 'B-81'], 12: ['Figure B.5-9', 248, 'B-82'], 15: ['Figure B.5-10', 249, 'B-83'], 18: ['Figure B.5-11', 250, 'B-84'] };
  var TB55 = [[12, 0.85], [24, 1.25], [36, 1.5], [48, 1.8], [72, 2.2], [96, 2.6], [120, 2.8]];
  function tb55(h) { for (var i = 0; i < TB55.length; i++) if (h <= TB55[i][0]) return TB55[i]; return null; }

  /* links used for carried values */
  var LK = {
    A: { name: 'Worksheet B-1 (DMAs draining to the active BMP)', short: 'B-1', get: function () { return trib().sf; } },
    C: { name: 'Worksheet B-1 area-weighted runoff factor', short: 'B-1', get: function () { return +trib().c.toFixed(4); } },
    P: { name: 'Worksheet B.2-1 Line 1', short: 'B.2-1', get: function () { return num(S.d); } },
    INF: { name: 'Worksheet B.5-2 Line 5', short: 'B.5-2', get: function () { return lineVal('B.5-2', 5); } },
    TGT: { name: 'Worksheet B.5-2 Line 10', short: 'B.5-2', get: function () { var v = g('B.5-2', 'F17'); return isNum(v) ? v : 0; } },
    DCV: { name: 'Worksheet B.2-1 Line 6 (DCV)', short: 'B.2-1', get: function () { return +dcvB21().toFixed(1); } },
    SF54: { name: 'Worksheet B.5-4 Line 9 (City workbook cell J31)', short: 'B.5-4', get: function () { var v = b54wb(); return isNum(v) ? +v.toFixed(4) : 0; } },
    DINF: { name: 'Worksheet B.5-2 Line 5 / 2, converted to ft/hr', short: 'B.5-2', get: function () { return +(lineVal('B.5-2', 5) / 2 / 12).toFixed(5); } },
    B55: { name: 'Table B.5-5 for the Line 9 drawdown', short: 'Table B.5-5', get: function () { var r = tb55(lineVal('B.5-5', 9)); return r ? r[1] : 0; } },
    FP: { name: 'Worksheet B.5-1 Line 23 (provided footprint)', short: 'B.5-1', get: function () { return lineVal('B.5-1', 23); } }
  };

  /* ---------------- worksheet specs (B.5 series, workbook cells) ---------------- */
  function CARRY(cells) {
    return [
      { n: 1, t: 'in', cell: cells[0], label: 'Area draining to the BMP', unit: 'sq. ft.', link: LK.A, d: 0 },
      { n: 2, t: 'in', cell: cells[1], label: 'Adjusted runoff factor for drainage area (Refer to Appendix B.1 and B.2)', unit: '', link: LK.C, d: 4 },
      { n: 3, t: 'in', cell: cells[2], label: '85th percentile 24-hour rainfall depth', unit: 'inches', link: LK.P, d: 2 },
      { n: 4, t: 'calc', cell: cells[3], label: 'Design capture volume', eq: 'L1 × L2 × (L3 / 12)', unit: 'cu. ft.', d: 1 }
    ];
  }
  var POLY = function (x) { return '0.0000013 × ' + x + '³ − 0.000057 × ' + x + '² + 0.0086 × ' + x + ' − 0.014'; };
  var SPECS = {
    'B.5-1': {
      sheet: 'Worksheet B.5-1', title: 'Sizing Method for Pollutant Removal Criteria',
      lines: CARRY(['F5', 'F6', 'F7', 'F8']).concat([
        { sec: 'BMP Parameters' },
        { n: 5, t: 'in', cell: 'F10', label: 'Surface ponding [6 inch minimum, 12 inch maximum]', unit: 'inches', def: 6, warn: function (v) { return v < 6 || v > 12 ? 'Outside the 6-12 inch range stated on Line 5.' : ''; } },
        { n: 6, t: 'in', cell: 'F11', label: 'Media thickness [18 inches minimum], also add mulch layer and washed ASTM 33 fine aggregate sand thickness to this line for sizing calculations', unit: 'inches', def: 18, warn: function (v) { return v < 18 ? 'Less than the 18 inch minimum on Line 6.' : ''; } },
        { n: 7, t: 'in', cell: 'F12', label: 'Aggregate storage (also add ASTM No 8 stone) above underdrain invert (12 inches typical) - use 0 inches if the aggregate is not over the entire bottom', unit: 'inches', def: 12 },
        { n: 8, t: 'in', cell: 'F13', label: 'Aggregate storage below underdrain invert (3 inches minimum) - use 0 inches if the aggregate is not over the entire bottom surface area', unit: 'inches', def: 3, warn: function (v) { return v > 0 && v < 3 ? 'Less than the 3 inch minimum on Line 8 (use 0 only if the aggregate is not over the entire bottom).' : ''; } },
        { n: 9, t: 'const', cell: 'F14', label: 'Freely drained pore storage of the media', unit: 'in/in' },
        { n: 10, t: 'const', cell: 'F15', label: 'Porosity of aggregate storage', unit: 'in/in' },
        { n: 11, t: 'in', cell: 'F16', label: 'Media filtration rate to be used for sizing (maximum 5 in/hr. with no outlet control; if the filtration rate is controlled by the outlet use the outlet controlled rate, which will be less than 5 in/hr.)', unit: 'in/hr.', def: 5, warn: function (v) { return v > 5 ? 'Exceeds the 5 in/hr maximum on Line 11.' : ''; } },
        { sec: 'Baseline Calculations' },
        { n: 12, t: 'const', cell: 'F18', label: 'Allowable routing time for sizing', unit: 'hours' },
        { n: 13, t: 'calc', cell: 'F19', label: 'Depth filtered during storm', eq: 'L11 × L12', unit: 'inches', d: 2 },
        { n: 14, t: 'calc', cell: 'F20', label: 'Depth of detention storage', wbx: ['C21'], eq: 'L5 + (L6 × L9) + (L7 × L10) + (L8 × L10)', unit: 'inches', d: 2 },
        { n: 15, t: 'calc', cell: 'F22', label: 'Total depth treated', eq: 'L13 + L14', unit: 'inches', d: 2 },
        { sec: 'Option 1 - Biofilter 1.5 times the DCV' },
        { n: 16, t: 'calc', cell: 'F24', label: 'Required biofiltered volume', eq: '1.5 × L4', unit: 'cu. ft.', d: 2 },
        { n: 17, t: 'calc', cell: 'F25', label: 'Required footprint', eq: '(L16 / L15) × 12', unit: 'sq. ft.', d: 2 },
        { sec: 'Option 2 - Store 0.75 of remaining DCV in pores and ponding' },
        { n: 18, t: 'calc', cell: 'F27', label: 'Required storage (surface + pores) volume', eq: '0.75 × L4', unit: 'cu. ft.', d: 2 },
        { n: 19, t: 'calc', cell: 'F28', label: 'Required footprint', eq: '(L18 / L14) × 12', unit: 'sq. ft.', d: 2 },
        { sec: 'Footprint of the BMP' },
        { n: 20, t: 'in', cell: 'F30', label: 'BMP footprint sizing factor (default 0.03, or an alternative minimum footprint sizing factor from Worksheet B.5-4)', unit: '', def: 0.03, alt: LK.SF54, d: 4, note: 'Reviewer note: the August 2024 Worksheet B.5-4 has no Line 11; its minimum footprint sizing factor for clogging is Line 9 (cell J31). The \"Line 11\" reference is carried over from the pre-2024 worksheet; the manual PDF prints the same wording (p. B-52).' },
        { n: 21, t: 'calc', cell: 'F31', label: 'Minimum BMP footprint', eq: 'L1 × L2 × L20', unit: 'sq. ft.', d: 2 },
        { n: 22, t: 'calc', cell: 'F32', label: 'Footprint of the BMP', eq: 'MAX(MIN(L17, L19), L21)', unit: 'sq. ft.', d: 2 },
        { n: 23, t: 'in', cell: 'F33', label: 'Provided BMP footprint', unit: 'sq. ft.', def: 0 },
        { n: 24, t: 'status', cell: 'D34', label: 'Is Line 23 ≥ Line 22?', pass: function (v) { return /^Yes/.test(v); } }
      ]),
      result: function () { return { main: [['Required footprint (Line 22)', g('B.5-1', 'F32'), 'sq. ft.', 2], ['Provided (Line 23)', lineVal('B.5-1', 23), 'sq. ft.', 2]], ok: /^Yes/.test(g('B.5-1', 'D34')), okText: 'Line 24: ' + g('B.5-1', 'D34') }; }
    },
    'B.5-2': {
      sheet: 'Worksheet B.5-2', title: 'Sizing Method for Volume Retention Criteria',
      lines: CARRY(['F5', 'F6', 'F7', 'F8']).concat([
        { sec: 'Volume Retention Requirement' },
        { n: 5, t: 'in', cell: 'F10', label: 'Measured infiltration rate in the DMA. Mapped soils: enter 0.10 for NRCS Type D and 0.30 for Type C (include a soils map in the SWQMP). No infiltration condition with unknown measured rate: 0.0 if geotechnical and/or groundwater hazards are documented, otherwise 0.05.', unit: 'in/hr.', def: 0, d: 3 },
        { n: 6, t: 'const', cell: 'F11', label: 'Factor of safety', unit: '' },
        { n: 7, t: 'calc', cell: 'F12', label: 'Reliable infiltration rate, for biofiltration BMP sizing', eq: 'L5 / L6', unit: 'in/hr.', d: 4 },
        { n: 8, t: 'calc', cell: 'F13', label: 'Average annual volume reduction target (Figure B.5-2)', wbx: ['C14'], eq: function (v) { return v[7] > 0.01 ? 'MIN(40, 166.9 × L7 + 6.62)' : '3.5 (Line 7 ≤ 0.01 in/hr.)'; }, unit: '%', d: 3 },
        { n: 9, t: 'calc', cell: 'F15', label: 'Fraction of DCV to be retained (Figure B.5-3)', wbx: ['C16'], eq: function (v) { return v[8] > 8 ? 'ROUND(' + POLY('L8') + ', 3)' : '0.023 (Line 8 ≤ 8%)'; }, unit: '', d: 3 },
        { n: 10, t: 'calc', cell: 'F17', label: 'Target volume retention', eq: 'L9 × L4', unit: 'cu. ft.', d: 2 }
      ]),
      result: function () { return { main: [['Target volume retention (Line 10)', g('B.5-2', 'F17'), 'cu. ft.', 2], ['Reliable infiltration (Line 7)', g('B.5-2', 'F12'), 'in/hr.', 4]], info: 'Carried to B.5-3 (comparison), B.5-5 Line 18 and B.5-6 Line 14.' }; }
    },
    'B.5-3': {
      sheet: 'Worksheet B.5-3', title: 'Volume Retention from Biofiltration with Partial Retention BMPs',
      lines: CARRY(['F5', 'F6', 'F7', 'F8']).concat([
        { sec: 'BMP Parameters' },
        { n: 5, t: 'in', cell: 'F10', label: 'Footprint of the BMP', unit: 'sq. ft.', def: 0, alt: LK.FP },
        { n: 6, t: 'in', cell: 'F11', label: 'Media thickness [18 inches minimum], also add mulch layer and washed ASTM 33 fine aggregate sand thickness to this line for sizing calculations', unit: 'inches', def: 18, warn: function (v) { return v < 18 ? 'Less than the 18 inch minimum on Line 6.' : ''; } },
        { n: 7, t: 'const', cell: 'F12', label: 'Media retained pore space [50% of (Field Capacity - Wilting Point)]', unit: 'in/in' },
        { n: 8, t: 'in', cell: 'F13', label: 'Aggregate storage below underdrain invert (3 inches minimum) - use 0 inches if the aggregate is not over the entire bottom surface area', unit: 'inches', def: 3 },
        { n: 9, t: 'const', cell: 'F14', label: 'Porosity of aggregate storage', unit: 'in/in' },
        { n: 10, t: 'in', cell: 'F15', label: 'Measured infiltration rate in the DMA (mapped soils: 0.10 for NRCS Type D, 0.30 for Type C)', unit: 'in/hr.', link: LK.INF, d: 3 },
        { n: 11, t: 'const', cell: 'F16', label: 'Factor of safety', unit: '' },
        { n: 12, t: 'calc', cell: 'F17', label: 'Reliable infiltration rate, for biofiltration BMP sizing', eq: 'L10 / L11', unit: 'in/hr.', d: 4 },
        { sec: 'Evapotranspiration: Average Annual Volume Retention' },
        { n: 13, t: 'calc', cell: 'F20', label: 'Effective evapotranspiration depth', eq: 'L6 × L7', unit: 'inches', d: 3 },
        { n: 14, t: 'calc', cell: 'F21', label: 'Retained pore volume', eq: '(L13 × L5) / 12', unit: 'cu. ft.', d: 2 },
        { n: 15, t: 'calc', cell: 'F22', label: 'Fraction of DCV retained in pore spaces', eq: 'ROUND(L14 / L4, 2)', unit: '', d: 2 },
        { n: 16, t: 'calc', cell: 'F23', label: 'Evapotranspiration average annual capture [ET nomographs in Figure B.5-5]', eq: function (v) { return v[13] < 0.15 ? '0 (Line 13 below the 0.15 inch nomograph minimum)' : 'Figure B.5-5 nomograph at fraction L15 (limited to 0.01-3) and ET depth L13, City workbook table, bilinear interpolation'; }, unit: '%', d: 2 },
        { sec: 'Infiltration: Average Annual Volume Retention' },
        { n: 17, t: 'calc', cell: 'F25', label: 'Drawdown for infiltration storage', eq: function (v) { return v[12] ? 'ROUND((L8 × L9) / L12, 0)' : '0 (Line 12 = 0, no infiltration drawdown; workbook IFERROR)'; }, unit: 'hours', d: 0 },
        { n: 18, t: 'calc', cell: 'F26', label: 'Equivalent DCV fraction from evapotranspiration (use Line 16 and Line 17 in Figure B.4-1)', eq: 'Figure B.4-1: DCV fraction giving L16 % capture at drawdown L17 h (limited to 6-120 h), City workbook table, inverse interpolation', unit: '', d: 4 },
        { n: 19, t: 'calc', cell: 'F27', label: 'Infiltration volume storage', eq: '(L5 × L8 × L9) / 12', unit: 'cu. ft.', d: 2 },
        { n: 20, t: 'calc', cell: 'F28', label: 'Infiltration storage fraction of DCV', eq: 'ROUND(L19 / L4, 2)', unit: '', d: 2 },
        { n: 21, t: 'calc', cell: 'F29', label: 'Total equivalent fraction of DCV', eq: 'L18 + L20', unit: '', d: 4 },
        { n: 22, t: 'calc', cell: 'F30', label: 'Biofiltration BMP average annual capture [use Line 21 and Line 17 in Figure B.4-1]', eq: function (v) { return v[17] ? 'Figure B.4-1 capture at fraction L21 and drawdown L17 h, City workbook table, interpolation' : 'L16 (Line 17 = 0: no infiltration storage, so capture = ET capture only, as in the City workbook)'; }, unit: '%', d: 2 },
        { n: 23, t: 'calc', cell: 'F31', label: 'Fraction of DCV retained (Figure B.5-3)', wbx: ['C32'], eq: 'MAX(0, ROUND(' + POLY('L22') + ', 3))', unit: '', d: 3 },
        { n: 24, t: 'calc', cell: 'F33', label: 'Volume retention achieved by biofiltration BMP', eq: 'ROUND(L23 × L4, 0)', unit: 'cu. ft.', d: 0 }
      ]),
      result: function () {
        var dd = g('B.5-3', 'F25'), v = g('B.5-3', 'F33'), t = g('B.5-2', 'F17');
        if (dd > 120) return { main: [['Drawdown (Line 17)', dd, 'hours', 0]], ok: false, okText: 'Results are not valid when drawdown for infiltration storage is greater than 120 hours' };
        return { main: [['Volume retained (Line 24)', v, 'cu. ft.', 0], ['Target, B.5-2 Line 10', t, 'cu. ft.', 2]], ok: isNum(v) && isNum(t) && v >= t, okText: (v >= t ? 'Line 24 ≥ B.5-2 Line 10 target' : 'Line 24 < B.5-2 Line 10 target'), assume: 'Comparing Line 24 with the B.5-2 Line 10 target is a reviewer check; Worksheet B.5-3 itself ends at Line 24.' };
      }
    },
    'B.5-4': {
      sheet: 'Worksheet B.5-4', title: 'Alternative Minimum Footprint Sizing Factor for Non-Standard Biofiltration', custom: 'b54',
      lines: [
        { n: 1, t: 'in', cell: 'J7', label: 'Average annual precipitation (attach documentation for the value entered; typical data source is SanGIS)', unit: 'inches', def: 0, d: 2 },
        { n: 0, t: 'in', cell: 'J6', label: 'Total area of the DMA(s) draining to the BMP [from Worksheet B-1]', unit: 'sq. ft.', link: LK.A, d: 0 },
        { n: 4, t: 'in', cell: 'J25', label: 'Load to clog, Lc (default 2.0 when using Appendix E fact sheets; attach documentation if using a different value)', unit: 'lb/sq. ft.', def: 2 },
        { n: 5, t: 'in', cell: 'J26', label: 'Allowable period to accumulate clogging load, TL (default 10; attach documentation if using a different value)', unit: 'yr', def: 10 },
        { n: 6, t: 'in', cell: 'J27', label: 'Adjustment for pretreatment measures: 0 if no pretreatment; 0.5 if the pretreatment has an active Washington State TAPE approval rating for "pre-treatment"; 0.25 when pretreatment without TAPE certification is included (attach pretreatment calculations when > 0)', unit: '', def: 0, opts: [0, 0.25, 0.5] }
      ],
      extraIn: ['D12', 'D13', 'D14', 'D15', 'D16', 'D17', 'D18', 'D19', 'D20', 'D21', 'F21', 'J21'].map(function (c) { return { cell: c, def: 0 }; }),
      result: function () { var m = b54wb(); return { main: [['Min. footprint sizing factor (Line 9)', m, '', 4], ['BMP footprint needed (Line 8)', g('B.5-4', 'J30'), 'sq. ft.', 1]], ok: /^Yes/.test(g('B.5-4', 'J23')), okText: 'Line 3: ' + g('B.5-4', 'J23') }; }
    },
    'B.5-5': {
      sheet: 'Worksheet B.5-5', title: 'Optimized Biofiltration BMP Footprint when Downstream of a Storage Unit',
      lines: [
        { n: 1, t: 'in', cell: 'F5', label: 'Area draining to the storage unit and biofiltration BMP', unit: 'sq. ft.', link: LK.A, d: 0 },
        { n: 2, t: 'in', cell: 'F6', label: 'Adjusted runoff factor for drainage area (Refer to Appendix B.1 and B.2)', unit: '', link: LK.C, d: 4 },
        { n: 3, t: 'calc', cell: 'F7', label: 'Effective impervious area draining to the storage unit and biofiltration BMP', eq: 'L1 × L2', unit: 'sq. ft.', d: 1 },
        { n: 4, t: 'in', cell: 'F8', label: 'Remaining DCV after implementing retention BMPs', unit: 'cu. ft.', link: LK.DCV, d: 1 },
        { n: 5, t: 'in', cell: 'F9', label: 'Design infiltration rate (measured infiltration rate / 2)', unit: 'ft./hr.', link: LK.DINF, d: 5 },
        { n: 6, t: 'in', cell: 'F10', label: 'Media thickness [1.5 feet minimum], also add mulch layer and washed ASTM 33 fine aggregate sand thickness to this line for sizing calculations', unit: 'ft.', def: 1.5, warn: function (v) { return v < 1.5 ? 'Less than the 1.5 foot minimum on Line 6.' : ''; } },
        { n: 7, t: 'in', cell: 'F11', label: 'Media filtration rate to be used for sizing (0.42 ft/hr. with no outlet control; if the filtration rate is controlled by the outlet use the outlet controlled rate)', unit: 'ft./hr.', def: 0.42 },
        { n: 8, t: 'const', cell: 'F12', label: 'Media retained pore space', unit: 'in/in' },
        { sec: 'Storage Unit Requirement' },
        { n: 9, t: 'in', cell: 'F14', label: 'Drawdown time of the storage unit, minimum (from the elevation that bypasses the biofiltration BMP, overflow elevation)', unit: 'hours', def: 24, warn: function (v) { return v < 12 || v > 120 ? 'Outside Table B.5-5 (12-120 h): the storage unit should be designed to discharge greater than 92% average annual capture to the downstream biofiltration BMP (p. B-63).' : ''; } },
        { n: 10, t: 'in', cell: 'F15', label: 'Storage required to achieve greater than 92 percent capture (see Table B.5-5)', unit: 'fraction', link: LK.B55, d: 2 },
        { n: 11, t: 'calc', cell: 'F16', label: 'Storage required in cubic feet', eq: 'L4 × L10', unit: 'cu. ft.', d: 1 },
        { n: 12, t: 'in', cell: 'F17', label: 'Storage provided in the design, minimum (from the elevation that bypasses the biofiltration BMP, overflow elevation)', unit: 'cu. ft.', def: 0 },
        { n: 13, t: 'status', cell: 'D18', label: 'Is Line 12 ≥ Line 11? If no, increase storage provided until this criterion is met', note: 'Manual p. B-64 adds: \u201cIf no increase storage provided until this criteria is met\u201d.', pass: function (v) { return /Met/.test(v); } },
        { sec: 'Criteria 1: BMP Footprint Biofiltration Capacity' },
        { n: 14, t: 'in', cell: 'F20', label: 'Peak flow from the storage unit to the biofiltration BMP (using the elevation used to evaluate the percent capture)', unit: 'cfs', def: 0, d: 3 },
        { n: 15, t: 'calc', cell: 'F21', label: 'Required biofiltration footprint', eq: 'ROUND((3,600 × L14) / L7, 0)', unit: 'sq. ft.', d: 0 },
        { sec: 'Criteria 2: Alternative Minimum Sizing Factor (Clogging)' },
        { n: 16, t: 'in', cell: 'F23', label: 'Alternative minimum footprint sizing factor [Line 9 of the 2024 Worksheet B.5-4; the worksheet text still cites "Line 11", the pre-2024 line number]', unit: 'fraction', link: LK.SF54, d: 4, note: 'Reviewer note: the August 2024 Worksheet B.5-4 has no Line 11; its minimum footprint sizing factor for clogging is Line 9 (cell J31). The \"Line 11\" reference is carried over from the pre-2024 worksheet; the manual PDF prints the same wording (p. B-64).' },
        { n: 17, t: 'calc', cell: 'F24', label: 'Required biofiltration footprint', eq: 'ROUND(L3 × L16, 0)', unit: 'sq. ft.', d: 0 },
        { sec: 'Criteria 3: Retention requirement [Not applicable for No Infiltration Condition]' },
        { n: 18, t: 'in', cell: 'F26', label: 'Retention target (Line 10 in Worksheet B.5-2)', unit: 'cu. ft.', link: LK.TGT, d: 2 },
        { n: 19, t: 'in', cell: 'F27', label: 'Average discharge rate from the storage unit to the biofiltration BMP', unit: 'cfs', def: 0, d: 4 },
        { n: 20, t: 'calc', cell: 'F28', label: 'Depth retained in the optimized biofiltration BMP', eq: '(L6 × L8) + [L4 / (2400 × L19)] × L5', unit: 'ft', d: 4 },
        { n: 21, t: 'calc', cell: 'F29', label: 'Required optimized biofiltration footprint', eq: 'ROUND(L18 / L20, 0)', unit: 'sq. ft.', d: 0 },
        { sec: 'Optimized Biofiltration Footprint' },
        { n: 22, t: 'calc', cell: 'F31', label: 'Optimized biofiltration footprint', eq: 'ROUND(MAX(L15, L17, L21), 0)', unit: 'sq. ft.', d: 0 }
      ],
      result: function () { return { main: [['Optimized footprint (Line 22)', g('B.5-5', 'F31'), 'sq. ft.', 0], ['Storage required (Line 11)', g('B.5-5', 'F16'), 'cu. ft.', 1]], ok: /Met/.test(g('B.5-5', 'D18')), okText: 'Line 13: ' + g('B.5-5', 'D18') }; }
    },
    'B.5-6': {
      sheet: 'Worksheet B.5-6', title: 'Volume Retention for No Infiltration Condition',
      lines: [
        { n: 1, t: 'in', cell: 'J5', label: 'Area draining to the biofiltration BMP', unit: 'sq. ft.', link: LK.A, d: 0 },
        { n: 2, t: 'in', cell: 'J6', label: 'Adjusted runoff factor for drainage area (Refer to Appendix B.1 and B.2)', unit: '', link: LK.C, d: 4 },
        { n: 3, t: 'calc', cell: 'J7', label: 'Effective impervious area draining to the BMP', eq: 'L1 × L2', unit: 'sq. ft.', d: 1 },
        { n: 4, t: 'calc', cell: 'J8', label: 'Required area for evapotranspiration', eq: 'L3 × 0.03', unit: 'sq. ft.', d: 2 },
        { n: 5, t: 'in', cell: 'J9', label: 'Biofiltration BMP footprint', unit: 'sq. ft.', def: 0, alt: LK.FP },
        { tbl: 'land' },
        { n: 10, t: 'calc', cell: 'I18', label: 'Sum of landscape area [sum of Line 9, IDs 1 to 5]', eq: 'Σ Line 9 (IDs 1-5)', unit: 'sq. ft.', d: 0 },
        { n: 11, t: 'calc', cell: 'I19', label: 'Provided footprint for evapotranspiration', eq: 'L5 + L10', unit: 'sq. ft.', d: 0 },
        { sec: 'Volume Retention Performance Standard' },
        { n: 12, t: 'status', cell: 'E21', label: 'Is Line 11 ≥ Line 4?', pass: function (v) { return /Met/.test(v); } },
        { n: 13, t: 'calc', cell: 'I22', label: 'Fraction of the performance standard met through the BMP footprint and/or landscaping', eq: 'ROUND(L11 / L4, 2)', unit: '', d: 2, after12: true },
        { n: 14, t: 'in', cell: 'I23', label: 'Target volume retention [Line 10 from Worksheet B.5-2]', unit: 'cu. ft.', link: LK.TGT, d: 2, after12: true },
        { n: 15, t: 'calc', cell: 'I24', label: 'Volume retention required from other site design BMPs', eq: '(1 − L13) × L14', unit: 'cu. ft.', d: 2, after12: true },
        { tbl: 'sd' },
        { n: 17, t: 'status', cell: 'E33', label: 'Is Line 16 ≥ Line 15?', pass: function (v) { return /Met/.test(v); }, after12: true }
      ],
      extraIn: ['E12', 'F12', 'H12', 'K12', 'L12', 'E13', 'F13', 'H13', 'K13', 'L13', 'I27', 'I28', 'I29', 'I30', 'I31'].map(function (c) { return { cell: c, def: 0 }; }),
      result: function () {
        var met12 = /Met/.test(g('B.5-6', 'E21'));
        if (met12) return { main: [['Provided ET footprint (Line 11)', g('B.5-6', 'I19'), 'sq. ft.', 0], ['Required (Line 4)', g('B.5-6', 'J8'), 'sq. ft.', 2]], ok: true, okText: 'Line 12: Volume Retention Performance Standard is Met' };
        var ok = /Met/.test(g('B.5-6', 'E33'));
        return { main: [['Other site design BMPs (Line 16)', g('B.5-6', 'I32'), 'cu. ft.', 2], ['Required (Line 15)', g('B.5-6', 'I24'), 'cu. ft.', 2]], ok: ok, okText: 'Line 17: ' + g('B.5-6', 'E33') };
      }
    },
    'B.5-7': {
      sheet: 'Worksheet B.5-7', title: 'Volume Retention from Amended Soils',
      lines: [
        { n: 1, t: 'in', cell: 'F5', label: 'Impervious area draining to the pervious area', unit: 'sq. ft.', def: 0 },
        { n: 2, t: 'in', cell: 'F6', label: 'Pervious area (must meet the requirements in SD-B and SD-F Fact Sheets)', unit: 'sq. ft.', def: 0 },
        { n: 3, t: 'calc', cell: 'F7', label: 'Dispersion ratio. This worksheet is not applicable when Line 3 > 50 or Line 3 < 0.25', eq: 'ROUND(L1 / L2, 2)', unit: '', d: 2 },
        { n: 4, t: 'calc', cell: 'F8', label: 'Adjusted runoff factor', eq: 'ROUND((L1 × 0.9 + L2 × 0.1) / (L1 + L2), 2)', unit: '', d: 2 },
        { n: 5, t: 'in', cell: 'F9', label: '85th percentile 24-hour rainfall depth', unit: 'inches', link: LK.P, d: 2 },
        { n: 6, t: 'calc', cell: 'F10', label: 'Design capture volume', eq: 'ROUND((L1 + L2) × L4 × (L5 / 12), 0)', unit: 'cu. ft.', d: 0 },
        { n: 7, t: 'in', cell: 'F11', label: 'Amendment depth (choose from 3, 6, 9, 12, 15 and 18 inches)', unit: 'inches', def: 6, opts: [3, 6, 9, 12, 15, 18] },
        { n: 8, t: 'const', cell: 'F12', label: 'Storage [(porosity - field capacity) + 0.5 × (field capacity - wilting point)]', unit: 'in./in.' },
        { n: 9, t: 'calc', cell: 'F13', label: 'Pervious storage', eq: 'ROUND(L2 × (L7 / 12) × L8, 0)', unit: 'cu. ft.', d: 0 },
        { n: 10, t: 'calc', cell: 'F14', label: 'Fraction of DCV', eq: 'ROUND(L9 / L6, 2)', unit: '', d: 2 },
        { n: 11, t: 'in', cell: 'F15', label: 'Measured infiltration rate (mapped soils: 0.10 for NRCS Type D, 0.30 for Type C; no infiltration condition with unknown rate: 0.0 with hazards identified in Appendix C, otherwise 0.05)', unit: 'in/hr.', link: LK.INF, d: 3 },
        { n: 12, t: 'const', cell: 'F16', label: 'Factor of safety', unit: '' },
        { n: 13, t: 'calc', cell: 'F17', label: 'Reliable infiltration rate', eq: 'L11 / L12', unit: 'in/hr.', d: 4 },
        { n: 14, t: 'calc', cell: 'F18', label: 'Dispersion credit (based on Figures B.5-6 to B.5-11; Line 10 and Line 13)', eq: function (v) { var f = DEPTH_FIG[v[7]] || ['Figures B.5-6 to B.5-11']; return 'ROUND(' + f[0] + ' (' + v[7] + '-inch amendment) at fraction L10 (capped at the nomograph maximum) and reliable rate L13, City workbook table, 3)'; }, unit: '', d: 3 },
        { n: 15, t: 'calc', cell: 'F19', label: 'Volume retention due to amendment', eq: 'ROUND(L1 × (L5 / 12) × L14, 0)', unit: 'cu. ft.', d: 0 }
      ],
      result: function () {
        var r = g('B.5-7', 'F7'), ok = isNum(r) && r >= 0.25 && r <= 50;
        return { main: [['Volume retention (Line 15)', g('B.5-7', 'F19'), 'cu. ft.', 0], ['Dispersion credit (Line 14)', g('B.5-7', 'F18'), '', 3]], ok: ok, okText: ok ? 'Line 3 within 0.25-50: worksheet applicable' : 'Line 3 outside 0.25-50: worksheet not applicable' };
      }
    }
  };

  /* ---------------- calculator list ---------------- */
  var TABS = [
    { id: 'B-1', code: 'Worksheet B-1', title: 'Tabular Summary of DMAs', doc: 'sws', page: 169, printed: 'B-3', ico: 'grid' },
    { id: 'RC', code: 'Table B.1-1', title: 'Runoff factor (Eq. B.1-2, Table B.2-1)', doc: 'sws', page: 172, printed: 'B-6', ico: 'drop' },
    { id: 'CONV', code: 'Convert', title: 'Square feet ↔ acres', doc: null, ico: 'swap' },
    { id: 'B.2-1', code: 'Worksheet B.2-1', title: 'Design Capture Volume', doc: 'sws', page: 181, printed: 'B-15', ico: 'cube' },
    { id: 'B.5-1', code: 'Worksheet B.5-1', title: SPECS['B.5-1'].title, doc: 'sws', page: 218, printed: 'B-52', ico: 'layers' },
    { id: 'B.5-2', code: 'Worksheet B.5-2', title: SPECS['B.5-2'].title, doc: 'sws', page: 220, printed: 'B-54', ico: 'down' },
    { id: 'B.5-3', code: 'Worksheet B.5-3', title: SPECS['B.5-3'].title, doc: 'sws', page: 222, printed: 'B-56', ico: 'sun' },
    { id: 'B.5-4', code: 'Worksheet B.5-4', title: SPECS['B.5-4'].title, doc: 'sws', page: 226, printed: 'B-60', ico: 'filter' },
    { id: 'B.5-5', code: 'Worksheet B.5-5', title: SPECS['B.5-5'].title, doc: 'sws', page: 230, printed: 'B-64', ico: 'tank' },
    { id: 'B.5-6', code: 'Worksheet B.5-6', title: SPECS['B.5-6'].title, doc: 'sws', page: 232, printed: 'B-66', ico: 'leaf' },
    { id: 'B.5-7', code: 'Worksheet B.5-7', title: SPECS['B.5-7'].title, doc: 'sws', page: 234, printed: 'B-68', ico: 'sprout' },
    { id: 'I-10.A', code: 'Worksheet I-10.A', title: 'Flow-Based Sizing for Compact Biofiltration', doc: 'appi', page: 52, printed: 'Form I-10', ico: 'flow' }
  ];
  var TAB = {}; TABS.forEach(function (t) { TAB[t.id] = t; });
  var ICO = {
    grid: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14h18M9 4v16"/>',
    drop: '<path d="M12 3c-3.5 5-6 8-6 11a6 6 0 0012 0c0-3-2.5-6-6-11z"/>',
    swap: '<path d="M4 8h14l-3-3M20 16H6l3 3"/>',
    cube: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
    layers: '<path d="M12 4l9 4-9 4-9-4z"/><path d="M3 12l9 4 9-4M3 16l9 4 9-4"/>',
    down: '<path d="M12 3v14M6 11l6 6 6-6M4 21h16"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
    filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
    tank: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 12h16M9 19v2M15 19v2"/>',
    leaf: '<path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15"/><path d="M5 19l7-7"/>',
    sprout: '<path d="M12 21v-9M12 12c0-4-3-6-7-6 0 4 3 6 7 6zM12 12c0-4 3-7 7-7 0 4-3 7-7 7z"/>',
    flow: '<path d="M3 8c3 0 3 3 6 3s3-3 6-3 3 3 6 3M3 15c3 0 3 3 6 3s3-3 6-3 3 3 6 3"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
    ok: '<path d="M5 12l5 5 9-10"/>', no: '<path d="M6 6l12 12M18 6L6 18"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'
  };
  function ico(k) { return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + ICO[k] + '</svg>'; }

  /* page thumbnails from the Manual & Code Reference sprites (real pages; printed footer trimmed) */
  function thumb(doc, p, dw) {
    if (!T || !T.files[doc]) return '';
    var k = p - 1, file = T.files[doc][Math.floor(k / T.per)]; if (!file) return '';
    k = k % T.per;
    var land = T.land && T.land[doc] && T.land[doc].indexOf(p) >= 0, ph = land ? Math.round(T.w * 8.5 / 11) : T.h, top = land ? Math.floor((T.h - ph) / 2) : 0;
    var s = dw / T.w, h = Math.round(ph * s * 0.89);
    return '<span class="thumb" role="img" aria-label="Page ' + p + ' preview" style="width:' + dw + 'px;height:' + h + 'px;background-image:url(' + ROOT + 'manual-reference/' + file + ');background-size:' + (T.cols * T.w * s).toFixed(1) + 'px auto;background-position:-' + ((k % T.cols) * T.w * s).toFixed(1) + 'px -' + ((Math.floor(k / T.cols) * T.h + top) * s).toFixed(1) + 'px"></span>';
  }
  function pageLink(doc, p) { return ROOT + 'manual-reference/#page/' + doc + '/' + p; }
  function cite(t) {
    if (!t.doc) return '';
    if (t.doc === 'appi') return 'Stormwater Standards Appendix I, Form I-10 (August 2024 Edition), Appendix I forms PDF p. ' + t.page;
    return MAN + ', Appendix B, PDF p. ' + t.page + ' (printed ' + t.printed + ')';
  }

  /* ---------------- status per tab (for picker badges) ---------------- */
  function status(id) {
    try {
      if (SPECS[id]) { var r = SPECS[id].result(); return r.ok === undefined ? null : r.ok; }
      if (id === 'I-10.A') return i10().ok;
    } catch (e) { return null; }
    return null;
  }

  /* ---------------- render: picker + carried ---------------- */
  function renderPicker() {
    $('picker').innerHTML = TABS.map(function (t) {
      var touched = S.tab === t.id || (S.w[t.id] && Object.keys(S.w[t.id]).length) || (t.id === 'I-10.A' && num(S.i10.cap));
      var st = touched ? status(t.id) : null, b = st === null ? '' : '<span class="bs-badge ' + (st ? 'yes' : 'no') + '">' + (st ? 'YES' : 'NO') + '</span>';
      return '<button type="button" role="tab" class="bs-tab" data-tab="' + t.id + '" aria-selected="' + (S.tab === t.id) + '">' +
        '<span class="bs-tab-ico">' + ico(t.ico) + '</span><span class="bs-tab-txt"><b>' + esc(t.code) + '</b><small>' + esc(t.title) + '</small></span>' + b + '</button>';
    }).join('');
  }
  function renderCarried() {
    var ids = bmpIds();
    if (ids.indexOf(S.bmp) < 0 && ids.length) S.bmp = ids[0];
    var t = trib();
    $('bmpSel').innerHTML = ids.map(function (b) { return '<option' + (b === S.bmp ? ' selected' : '') + '>' + esc(b) + '</option>'; }).join('') || '<option>(assign a BMP ID in B-1)</option>';
    $('carried').innerHTML = [['Tributary area', fmt(t.sf, 0) + ' sq. ft.', fmt(t.ac, 4) + ' ac'], ['Runoff factor C', fmt(t.c, 4), 'area-weighted'], ['85th pct. depth', fmt(num(S.d), 2) + ' in', 'B.2-1 Line 1'], ['DCV (B.2-1)', fmt(dcvB21(), 1) + ' cu. ft.', t.rows.length + ' DMA' + (t.rows.length === 1 ? '' : 's')]]
      .map(function (x) { return '<div><small>' + x[0] + '</small><b>' + x[1] + '</b><i>' + x[2] + '</i></div>'; }).join('');
    if (document.activeElement !== $('projName')) $('projName').value = S.project || '';
  }

  /* ---------------- generic worksheet rendering ---------------- */
  function vals(id) { var v = {}; SPECS[id].lines.forEach(function (L) { if (L.n != null && L.t) v[L.n] = L.t === 'in' ? inVal(id, L) : g(id, L.cell); }); return v; }
  function eqText(L, v) { return typeof L.eq === 'function' ? L.eq(v) : L.eq; }
  function subst(s, v, spec) {
    return s.replace(/L(\d+)/g, function (m, n) {
      var L = spec.lines.filter(function (x) { return x.n === +n; })[0], x = v[n];
      return fmt(x, L && L.d != null ? Math.max(L.d, 2) : null);
    });
  }
  function linked(id, L) { var w = wsInputs(id); return L.link && (w[L.cell] === undefined || w[L.cell] === ''); }
  function rowHtml(id, L, v, spec) {
    if (L.sec) return '<div class="bs-sec">' + esc(L.sec) + '</div>';
    var w = wsInputs(id), val, field, extra = '';
    if (L.t === 'in') {
      val = inVal(id, L);
      var lk = linked(id, L);
      if (L.opts) field = '<select data-cell="' + L.cell + '">' + L.opts.map(function (o) { return '<option' + (+val === o ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select>';
      else field = '<input type="number" step="any" inputmode="decimal" data-cell="' + L.cell + '" value="' + esc(lk ? (isNum(val) ? +val.toFixed(L.d != null ? L.d + 2 : 6) : '') : (w[L.cell] !== undefined ? w[L.cell] : val)) + '"' + (lk ? ' class="is-linked"' : '') + '>';
      if (L.link) extra = lk ? '<span class="bs-chip link" title="' + esc(L.link.name) + '">from ' + esc(L.link.short) + '</span>' : '<button type="button" class="bs-chip relink" data-relink="' + L.cell + '" title="Use ' + esc(L.link.name) + '">↺ use ' + esc(L.link.short) + ' (' + fmt(L.link.get(), L.d != null ? L.d : null) + ')</button>';
      if (L.alt) extra += '<button type="button" class="bs-chip relink" data-alt="' + L.cell + '" title="Use ' + esc(L.alt.name) + '">use ' + esc(L.alt.short) + ' (' + fmt(L.alt.get(), L.d != null ? L.d : null) + ')</button>';
      var wm = L.warn && L.warn(num(val)); if (wm) extra += '<span class="bs-warn">' + esc(wm) + '</span>';
    } else if (L.t === 'const') {
      field = '<strong class="const">' + fmt(g(id, L.cell)) + '</strong>'; extra = '<span class="bs-chip fixed">fixed on worksheet</span>';
    } else if (L.t === 'status') {
      var sv = g(id, L.cell), ok = L.pass(String(sv));
      field = '<span class="bs-badge big ' + (ok ? 'yes' : 'no') + '">' + ico(ok ? 'ok' : 'no') + (ok ? 'YES' : 'NO') + '</span>';
      extra = '<span class="bs-stat-txt">' + esc(sv) + '</span>';
    } else {
      field = '<strong>' + fmt(g(id, L.cell), L.d) + '</strong>';
      var e = eqText(L, v);
      extra = '<code class="bs-eq">= ' + esc(e) + (/L\d/.test(e) ? '<br>= ' + esc(subst(e, v, spec)) : '') + '</code>';
    }
    var dim = L.after12 && /Met/.test(g('B.5-6', 'E21'));
    return '<div class="bs-row t-' + L.t + (dim ? ' dim' : '') + '" data-line="' + L.n + '"><span class="bs-ln">' + (L.n || '-') + '</span><div class="bs-lbl">' + lblHtml(id, L) + extra + '</div><div class="bs-val">' + field + '</div><span class="bs-unit">' + esc(L.unit || '') + '</span></div>';
  }
  function lblHtml(id, L) {
    var wt = wbText(id, L);
    return (wt ? '<span class="wbt" title="Worksheet wording, City workbook ' + esc(SPECS[id].sheet) + ' row ' + coln(L.cell)[1] + '">' + esc(wt) + '</span>' : '<span>' + esc(L.label) + '</span>') +
      (L.note ? '<span class="bs-rnote">' + esc(L.note) + '</span>' : '');
  }
  function sheetHead(t, sub) {
    return '<header class="bs-sheet-head"><div><span class="eyebrow-label">' + esc(t.code) + '</span><h2>' + esc(t.title) + '</h2>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' +
      (t.doc ? '<a class="bs-src" href="' + pageLink(t.doc, t.page) + '" title="Open the original page in the Manual &amp; Code Reference">' + thumb(t.doc, t.page, 64) + '<span>Original page<br><b>' + (t.doc === 'appi' ? 'App. I p. ' + t.page : 'p. ' + t.printed) + '</b></span></a>' : '') + '</header>';
  }
  /* ---------- BF-1 live section (section.js) on B.5-1, B.5-2 and B.5-3 ---------- */
  var BF1_AT = { 'B.5-1': 'Baseline Calculations', 'B.5-2': 'end', 'B.5-3': 'Evapotranspiration: Average Annual Volume Retention' };
  function bf1Data(id) {
    var b1 = function (n) { return lineVal('B.5-1', n); }, req = g('B.5-1', 'F32');
    var d = { tab: id, P: { v: b1(5), src: 'B.5-1 Line 5' }, A7: { v: b1(7), src: 'B.5-1 Line 7' }, REQ: { v: isNum(req) ? req : 0, src: 'B.5-1 Line 22' } };
    if (id === 'B.5-3') { d.M = { v: lineVal('B.5-3', 6), src: 'B.5-3 Line 6' }; d.A8 = { v: lineVal('B.5-3', 8), src: 'B.5-3 Line 8' }; d.FP = { v: lineVal('B.5-3', 5), src: 'B.5-3 Line 5' }; d.INF = { v: lineVal('B.5-3', 10), src: 'B.5-3 Line 10' }; }
    else { d.M = { v: b1(6), src: 'B.5-1 Line 6' }; d.A8 = { v: b1(8), src: 'B.5-1 Line 8' }; d.FP = { v: b1(23), src: 'B.5-1 Line 23' }; d.INF = { v: lineVal('B.5-2', 5), src: 'B.5-2 Line 5' }; }
    return d;
  }
  function bf1Mount(id) {
    if (!window.BF1) return;
    var slot = BF1_AT[id] && $('bf1slot');
    if (!slot) { window.BF1.detach(); return; }
    if (!S.bf1) S.bf1 = {};
    window.BF1.attach(slot, bf1Data(id), { store: S.bf1, save: save, link: pageLink, thumb: thumb, onChange: function () { var ta = $('calcText'); if (ta) ta.value = calcText(S.tab); } });
  }
  function renderSpec(id) {
    var spec = SPECS[id], v = vals(id), t = TAB[id], h = '';
    h += sheetHead(t, 'Outlined fields are inputs; values tagged <i>from …</i> are carried from another worksheet (type over them to override). Line wording and calculations follow the ' + esc(XLS) + ' (hover a line for its workbook row); reviewer notes are labelled.');
    h += '<div class="bs-rows">';
    if (spec.custom === 'b54') h += b54Body();
    else spec.lines.forEach(function (L) {
      if (L.tbl === 'land') h += b56Land();
      else if (L.tbl === 'sd') h += b56SD();
      else { if (L.sec && BF1_AT[id] === L.sec) h += '<div id="bf1slot"></div>'; h += rowHtml(id, L, v, spec); }
    });
    if (BF1_AT[id] === 'end') h += '<div id="bf1slot"></div>';
    h += '</div>';
    if (id === 'B.5-5') h += tb55Html();
    if (id === 'B.5-5' && !num(lineVal('B.5-5', 5))) h += '<div class="bs-flag"><b>No infiltration condition.</b> The manual marks Criteria 3 (Lines 18-21) "Not applicable for No Infiltration Condition"; the City workbook still computes Line 21 when Line 5 = 0, and Line 22 is shown as the workbook computes it. Line 21 = ' + fmt(g('B.5-5', 'F29'), 0) + ' sq. ft.</div>';
    return h;
  }
  /* B.5-4 custom body */
  var LU = ['Single Family Residential', 'Commercial', 'Industrial', 'Education (Municipal)', 'Transportation', 'Multi-family Residential', 'Roof Areas', 'Low Traffic Areas', 'Open Space'];
  function pct(x) { return isNum(x) ? (x * 100).toLocaleString('en-US', { maximumFractionDigits: 1 }) + '%' : (E.isErr(x) ? x.err : '-'); }
  function b54Body() {
    var id = 'B.5-4', spec = SPECS[id], w = wsInputs(id), L = spec.lines, v = vals(id), h = '';
    h += rowHtml(id, L[1], v, spec);
    h += rowHtml(id, L[0], v, spec);
    h += '<div class="bs-sec">Volume Weighted EMC Calculation</div><div class="bs-tbl-wrap"><table class="bs-tbl b54"><thead><tr><th>Land use</th><th>A<small>Area draining to BMP (sq. ft.)</small></th><th>B<small>Runoff factor</small></th><th>C<small>Annual runoff (cu. ft.) A × B × Line 1 / 12</small></th><th>D<small>% of annual runoff C / Line 2[b]</small></th><th>E<small>TSS EMC (mg/L)</small></th><th>F<small>Volume weighted EMC D × E</small></th></tr></thead><tbody>';
    var inp = function (c) { return '<input type="number" step="any" data-cell="' + c + '" value="' + esc(w[c] !== undefined ? w[c] : '') + '" placeholder="0">'; };
    for (var r = 12; r <= 21; r++) {
      var other = r === 21, nm = other ? '<input type="text" class="txt" data-text="B21" placeholder="Other, specify" value="' + esc(w.B21 || '') + '">' : LU[r - 12];
      h += '<tr><th>' + nm + '</th><td>' + inp('D' + r) + '</td><td>' + (other ? inp('F21') : fmt(g(id, 'F' + r), 2)) + '</td><td>' + fmt(g(id, 'G' + r), 1) + '</td><td>' + pct(g(id, 'I' + r)) + '</td><td>' + (other ? inp('J21') : fmt(g(id, 'J' + r), 0)) + '</td><td>' + fmt(g(id, 'K' + r), 2) + '</td></tr>';
    }
    h += '<tr class="tot"><th>Line 2 - Drainage area totals</th><td>[a] ' + fmt(g(id, 'E22'), 0) + '</td><td>N/A</td><td>[b] ' + fmt(g(id, 'H22'), 1) + '</td><td>100%</td><td>N/A</td><td>[c] ' + fmt(g(id, 'L22'), 2) + '</td></tr></tbody></table></div>';
    var ok3 = /^Yes/.test(String(g(id, 'J23')));
    h += '<div class="bs-row t-status"><span class="bs-ln">3</span><div class="bs-lbl">' + wbSpan(id, ['C23'], 'Does Line 2[a] equal the area of the DMA(s) draining to the BMP in Worksheet B-1?') + '<span class="bs-stat-txt">Line 2[a] = ' + fmt(g(id, 'E22'), 0) + ' sq. ft.; B-1 total = ' + fmt(inVal(id, L[1]), 0) + ' sq. ft.</span></div><div class="bs-val"><span class="bs-badge big ' + (ok3 ? 'yes' : 'no') + '">' + ico(ok3 ? 'ok' : 'no') + (ok3 ? 'YES' : 'NO') + '</span></div><span class="bs-unit"></span></div>';
    h += '<div class="bs-sec">' + esc(wbCell(id, 'B24') || 'Sizing Factor for Clogging') + '</div>';
    h += rowHtml(id, L[2], v, spec) + rowHtml(id, L[3], v, spec) + rowHtml(id, L[4], v, spec);
    var c = function (n, lbl, val, e, sub, unit, d) { return '<div class="bs-row t-calc" data-line="' + n + '"><span class="bs-ln">' + n + '</span><div class="bs-lbl">' + lbl + '<code class="bs-eq">= ' + e + '<br>= ' + sub + '</code></div><div class="bs-val"><strong>' + fmt(val, d) + '</strong></div><span class="bs-unit">' + unit + '</span></div>'; };
    var b = g(id, 'H22'), cc = g(id, 'L22'), l6 = inVal(id, L[4]), l7 = g(id, 'J28'), l8 = g(id, 'J30'), p = inVal(id, L[0]);
    h += c(7, wbSpan(id, ['C28', 'C29'], 'Calculate the average annual TSS load'), l7, '(L2[b] × 62.4 × L2[c] × (1 − L6)) / 10⁶', '(' + fmt(b, 1) + ' × 62.4 × ' + fmt(cc, 2) + ' × (1 − ' + l6 + ')) / 1,000,000', 'lb/yr', 3);
    h += c(8, wbSpan(id, ['C30'], 'Calculate the BMP footprint needed'), l8, '(L7 × L5) / L4', '(' + fmt(l7, 3) + ' × ' + fmt(inVal(id, L[3])) + ') / ' + fmt(inVal(id, L[2])), 'sq. ft.', 2);
    h += c(9, wbSpan(id, ['C31', 'C32'], 'Calculate the minimum footprint sizing factor for clogging'), b54wb(), 'L8 / (L2[b] × L1 / 12)', fmt(l8, 2) + ' / (' + fmt(b, 1) + ' × ' + fmt(p, 2) + ' / 12)', '', 4);
    h += '<div class="bs-flag" id="b54flag"><b>Line 9: City workbook vs. manual PDF.</b> This tool follows the City workbook (cell J31 and its printed line text): Line 9 = Line 8 / (Line 2[b] × Line 1/12). The manual PDF (Worksheet B.5-4, p. B-60) prints Line 9 = Line 8 / (Line 2[b] / (Line 1/12)), i.e. footprint ÷ Σ(area × runoff factor); the two agree only when Line 1 = 12 in. Manual-equation value for these inputs: <b>' + fmt(b54manual(), 4) + '</b>. Confirm with the City which form governs before relying on Line 9 where Line 1 ≠ 12 in.</div>';
    return h;
  }
  /* B.5-6 tables */
  var B56C = ['E', 'F', 'H', 'K', 'L'];
  function b56Land() {
    var w = wsInputs('B.5-6'), inp = function (c) { return '<input type="number" step="any" data-cell="' + c + '" value="' + esc(w[c] !== undefined ? w[c] : '') + '" placeholder="0">'; };
    var h = '<div class="bs-sec">Landscape Area (must be identified on DS-3247)</div><div class="bs-tbl-wrap"><table class="bs-tbl"><thead><tr><th>Line</th><th>Identification</th>' + B56C.map(function (c, i) { return '<th>' + (i + 1) + '</th>'; }).join('') + '</tr></thead><tbody>';
    h += '<tr><td>6</td><th>' + wbSpan('B.5-6', ['C12'], 'Landscape area that meets the requirements in SD-B and SD-F (sq. ft.)') + '</th>' + B56C.map(function (c) { return '<td>' + inp(c + '12') + '</td>'; }).join('') + '</tr>';
    h += '<tr><td>7</td><th>' + wbSpan('B.5-6', ['C13'], 'Impervious area draining to the landscape area (sq. ft.)') + '</th>' + B56C.map(function (c) { return '<td>' + inp(c + '13') + '</td>'; }).join('') + '</tr>';
    h += '<tr><td>8</td><th>' + wbSpan('B.5-6', ['C14', 'C15'], 'Impervious to pervious area ratio [Line 7 / Line 6]') + '</th>' + B56C.map(function (c) { return '<td>' + fmt(g('B.5-6', c + '14'), 2) + '</td>'; }).join('') + '</tr>';
    h += '<tr><td>9</td><th>' + wbSpan('B.5-6', ['C16', 'C17'], 'Effective credit area [if Line 8 > 1.5, Line 6; otherwise Line 7 / 1.5]') + '</th>' + B56C.map(function (c) { return '<td><b>' + fmt(g('B.5-6', c + '16'), 0) + '</b></td>'; }).join('') + '</tr></tbody></table></div>';
    return h;
  }
  function b56SD() {
    var w = wsInputs('B.5-6'), dim = /Met/.test(g('B.5-6', 'E21')) ? ' dim' : '';
    var h = '<div class="bs-sec' + dim + '">Line 16: Site design BMPs (document how each credit is calculated in the PDP SWQMP)</div><div class="bs-tbl-wrap' + dim + '"><table class="bs-tbl"><thead><tr><th>ID</th><th>Site design type</th><th>Credit (cu. ft.)</th></tr></thead><tbody>';
    for (var r = 27; r <= 31; r++) h += '<tr><td>' + (r - 26) + '</td><td><input type="text" class="txt" data-text="D' + r + '" value="' + esc(w['D' + r] || '') + '" placeholder="e.g. trees, rain barrels"></td><td><input type="number" step="any" data-cell="I' + r + '" value="' + esc(w['I' + r] !== undefined ? w['I' + r] : '') + '" placeholder="0"></td></tr>';
    h += '<tr class="tot"><td>16</td><th>' + wbSpan('B.5-6', ['C32'], 'Sum of volume retention benefits from other site design BMPs') + '</th><td>' + fmt(g('B.5-6', 'I32'), 2) + '</td></tr></tbody></table></div>';
    if (dim) h += '<p class="assume">Lines 13-17 apply only when Line 12 is "No"; they are greyed out because Line 11 ≥ Line 4.</p>';
    return h;
  }
  function tb55Html() {
    var dd = lineVal('B.5-5', 9), r = tb55(dd);
    return '<div class="bs-note"><b>Table B.5-5: Storage required for different drawdown times</b> (manual p. B-63)<div class="bs-tbl-wrap"><table class="bs-mini"><tr><th>Drawdown (h)</th>' + TB55.map(function (x) { return '<td' + (r && r[0] === x[0] ? ' class="on"' : '') + '>' + x[0] + '</td>'; }).join('') + '</tr><tr><th>Storage</th>' + TB55.map(function (x) { return '<td' + (r && r[0] === x[0] ? ' class="on"' : '') + '>' + x[1].toFixed(2) + ' DCV</td>'; }).join('') + '</tr></table></div>' +
      '<p class="assume">Reviewer assumption: when Line 9 falls between tabulated drawdowns, Line 10 defaults to the value for the next longer tabulated drawdown (conservative; the manual does not say to interpolate). Type over Line 10 to use another value.</p></div>';
  }

  /* ---------------- B-1, runoff C, convert, B.2-1, I-10.A ---------------- */
  var TYPES = ['Biofiltration', 'Biofiltration with Partial Retention', 'Biofiltration downstream of a storage unit', 'Compact (proprietary) biofiltration', 'Retention (infiltration / harvest and use)', 'Flow-thru treatment control', 'Self-retaining', 'Self-mitigating', 'De minimis', 'Other'];
  function renderB1() {
    var t = TAB['B-1'], h = sheetHead(t, 'One row per drainage management area. The worksheets carry the tributary area and area-weighted runoff factor of the DMAs assigned to the active BMP (selector at the top).');
    h += '<div class="bs-tbl-wrap"><table class="bs-tbl b1"><thead><tr><th>DMA ID</th><th>Area (acres)</th><th>Impervious area (acres)</th><th>% Imp</th><th>HSG</th><th>Area-weighted runoff coefficient</th><th>DCV (cu. ft.)</th><th>Treated by (BMP ID)</th><th>Pollutant control type</th><th>Drains to (POC ID)</th><th></th></tr></thead><tbody>';
    S.dmas.forEach(function (r, i) {
      var pi = num(r.area) ? num(r.imp) / num(r.area) : 0, dcv = 3630 * num(r.c) * num(S.d) * num(r.area);
      var f = function (k, ty) { return '<input data-dma="' + i + '" data-k="' + k + '" type="' + ty + '"' + (ty === 'number' ? ' step="any"' : '') + ' value="' + esc(r[k]) + '">'; };
      h += '<tr><td>' + f('id', 'text') + '</td><td>' + f('area', 'number') + '</td><td>' + f('imp', 'number') + '</td><td>' + (pi * 100).toFixed(1) + '%</td><td><select data-dma="' + i + '" data-k="hsg">' + ['', 'A', 'B', 'C', 'D'].map(function (x) { return '<option' + (r.hsg === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></td><td>' + f('c', 'number') + '</td><td>' + fmt(dcv, 1) + '</td><td>' + f('bmp', 'text') + '</td><td><select data-dma="' + i + '" data-k="type">' + TYPES.map(function (x) { return '<option' + (r.type === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></td><td>' + f('poc', 'text') + '</td><td><button type="button" class="bs-x" data-del="' + i + '" aria-label="Remove ' + esc(r.id) + '">&times;</button></td></tr>';
    });
    h += '</tbody></table></div><button type="button" class="bs-add" id="addDma">+ Add DMA</button>';
    var A = 0, I = 0, AC = 0, DCV = 0, treated = 0, pocs = {};
    S.dmas.forEach(function (r) { A += num(r.area); I += num(r.imp); AC += num(r.area) * num(r.c); DCV += 3630 * num(r.c) * num(S.d) * num(r.area); if ((r.bmp || '').trim()) treated += num(r.area); if ((r.poc || '').trim()) pocs[r.poc.trim()] = 1; });
    h += '<div class="bs-sum" id="b1sum">' + [['No. of DMAs', S.dmas.length], ['Total DMA area', fmt(A, 4) + ' ac'], ['Total impervious area', fmt(I, 4) + ' ac'], ['% Imp', (A ? I / A * 100 : 0).toFixed(1) + '%'], ['Area-weighted runoff coefficient', fmt(A ? AC / A : 0, 4)], ['Total DCV', fmt(DCV, 1) + ' cu. ft.'], ['Total area treated', fmt(treated, 4) + ' ac'], ['No. of POCs', Object.keys(pocs).length]]
      .map(function (x) { return '<div><small>' + x[0] + '</small><b>' + x[1] + '</b></div>'; }).join('') + '</div>';
    h += '<p class="assume">DCV per DMA = 3630 × C × d × A with d from Worksheet B.2-1 Line 1 (' + fmt(num(S.d), 2) + ' in), before tree and rain-barrel credits. Summary rows follow the Worksheet B-1 summary block (manual p. B-3).</p>';
    return h;
  }
  var SURF = [['Roofs', 0.9], ['Concrete or Asphalt', 0.9], ['Unit Pavers (grouted)', 0.9], ['Decomposed Granite', 0.3], ['Cobbles or Crushed Aggregate', 0.3], ['Amended, Mulched Soils or Landscape', 0.1], ['Compacted Soil (e.g., unpaved parking)', 0.3], ['Natural (A Soil)', 0.1], ['Natural (B Soil)', 0.14], ['Natural (C Soil)', 0.23], ['Natural (D Soil)', 0.3]];
  var SC = {}; SURF.forEach(function (s) { SC[s[0]] = s[1]; });
  var TB21 = { A: [0, 0, 0.23, 0.36], B: [0, 0.27, 0.42, 0.53], C: [0.34, 0.56, 0.67, 0.74], D: [0.86, 0.93, 0.97, 1] };
  function adjFactor(ratio, hsg) {
    if (!(ratio > 0) || !TB21[hsg] || ratio > 4) return NaN;
    var r = Math.max(1, ratio), i = Math.min(2, Math.floor(r) - 1), lo = TB21[hsg][i], hi = TB21[hsg][i + 1];
    return lo + (hi - lo) * (r - (i + 1));
  }
  function rcCalc() {
    var sa = 0, sca = 0;
    S.rc.rows.forEach(function (r) { sa += num(r.a); sca += num(r.a) * (SC[r.s] || 0); });
    var dsp = S.rc.disp, out = { c: sa ? sca / sa : 0, sa: sa, sca: sca };
    if (dsp.on) {
      var ai = num(dsp.imp), ap = num(dsp.perv), pc = SC['Natural (' + dsp.hsg + ' Soil)'], ratio = ap ? ai / ap : 0, f = adjFactor(ratio, dsp.hsg);
      out.ratio = ratio; out.f = f; out.pc = pc; out.base = (ai * 0.9 + ap * pc) / (ai + ap); out.adj = isNum(f) ? (ai * 0.9 * f + ap * pc) / (ai + ap) : NaN;
    }
    return out;
  }
  function renderRC() {
    var r = rcCalc(), u = S.rc.unit, h = sheetHead(TAB.RC, 'Equation B.1-2: C = Σ(C<sub>x</sub> A<sub>x</sub>) / Σ A<sub>x</sub>, with runoff factors from Table B.1-1. Optional impervious-area dispersion adjustment per Section B.2.1.1 and Table B.2-1.');
    h += '<div class="bs-units">Area units: <label><input type="radio" name="rcu" value="sf"' + (u === 'sf' ? ' checked' : '') + '> sq. ft.</label> <label><input type="radio" name="rcu" value="ac"' + (u === 'ac' ? ' checked' : '') + '> acres</label></div>';
    h += '<div class="bs-tbl-wrap"><table class="bs-tbl"><thead><tr><th>Surface (Table B.1-1)</th><th>Area (' + (u === 'sf' ? 'sq. ft.' : 'acres') + ')</th><th>Runoff factor C<sub>x</sub></th><th>C<sub>x</sub> × A<sub>x</sub></th><th></th></tr></thead><tbody>';
    S.rc.rows.forEach(function (x, i) {
      h += '<tr><td><select data-rc="' + i + '" data-k="s">' + SURF.map(function (s) { return '<option' + (x.s === s[0] ? ' selected' : '') + '>' + s[0] + '</option>'; }).join('') + '</select></td><td><input type="number" step="any" data-rc="' + i + '" data-k="a" value="' + esc(x.a) + '"></td><td>' + SC[x.s].toFixed(2) + '</td><td>' + fmt(num(x.a) * SC[x.s], 3) + '</td><td><button type="button" class="bs-x" data-rcdel="' + i + '" aria-label="Remove row">&times;</button></td></tr>';
    });
    h += '<tr class="tot"><th>Totals</th><td>' + fmt(r.sa, 3) + '</td><td></td><td>' + fmt(r.sca, 3) + '</td><td></td></tr></tbody></table></div><button type="button" class="bs-add" id="addRc">+ Add surface</button>';
    h += '<div class="bs-row t-calc"><span class="bs-ln">C</span><div class="bs-lbl"><span>Area-weighted runoff factor (Equation B.1-2)</span><code class="bs-eq">= Σ(Cx × Ax) / Σ Ax<br>= ' + fmt(r.sca, 3) + ' / ' + fmt(r.sa, 3) + '</code></div><div class="bs-val"><strong id="rcC">' + fmt(r.c, 4) + '</strong></div><span class="bs-unit"></span></div>';
    h += '<div class="bs-apply">Apply C = <b>' + fmt(r.c, 4) + '</b> to <select id="rcDma">' + S.dmas.map(function (d, i) { return '<option value="' + i + '">' + esc(d.id) + '</option>'; }).join('') + '</select> <button type="button" id="rcApply">Apply C to B-1</button>' + (u === 'sf' ? ' <button type="button" id="rcApplyA">Apply C and area</button>' : '') + '</div>';
    var d = S.rc.disp;
    h += '<div class="bs-sec"><label><input type="checkbox" id="dispOn"' + (d.on ? ' checked' : '') + '> Impervious area dispersion (SD-B): Table B.2-1 adjustment</label></div>';
    if (d.on) {
      h += '<div class="bs-grid3"><label>Impervious area (acres)<input type="number" step="any" data-disp="imp" value="' + esc(d.imp) + '"></label><label>Pervious area (acres)<input type="number" step="any" data-disp="perv" value="' + esc(d.perv) + '"></label><label>Pervious area HSG<select data-disp="hsg">' + ['A', 'B', 'C', 'D'].map(function (x) { return '<option' + (d.hsg === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></label></div>';
      h += '<div class="bs-row t-calc"><span class="bs-ln">1</span><div class="bs-lbl"><span>Impervious to pervious ratio</span><code class="bs-eq">= ' + fmt(num(d.imp), 3) + ' / ' + fmt(num(d.perv), 3) + '</code></div><div class="bs-val"><strong>' + fmt(r.ratio, 3) + '</strong></div><span class="bs-unit"></span></div>';
      h += '<div class="bs-row t-calc"><span class="bs-ln">2</span><div class="bs-lbl"><span>Adjustment factor, Table B.2-1 (linear interpolation; a ratio below 1 uses the ratio-1 column)</span>' + (r.ratio > 4 ? '<span class="bs-warn">Ratio greater than 4: the Table B.2-1 adjustment is not allowed (Appendix B.5 covers higher ratios).</span>' : '') + '</div><div class="bs-val"><strong>' + fmt(r.f, 3) + '</strong></div><span class="bs-unit"></span></div>';
      h += '<div class="bs-row t-calc"><span class="bs-ln">3</span><div class="bs-lbl"><span>Adjusted runoff factor (only the impervious 0.9 factor is adjusted)</span><code class="bs-eq">= (Aimp × 0.9 × factor + Aperv × Cperv) / (Aimp + Aperv)<br>= (' + fmt(num(d.imp), 3) + ' × 0.9 × ' + fmt(r.f, 3) + ' + ' + fmt(num(d.perv), 3) + ' × ' + r.pc + ') / ' + fmt(num(d.imp) + num(d.perv), 3) + '</code></div><div class="bs-val"><strong id="rcAdj">' + fmt(r.adj, 3) + '</strong></div><span class="bs-unit"></span></div>';
      h += '<p class="assume">Check: Example B.2-1 (manual p. B-11): 1 ac impervious draining to 0.4 ac HSG B gives ratio 2.5, factor 0.345 and adjusted C = 0.26. Unadjusted C here = ' + fmt(r.base, 3) + '.</p>';
    }
    return h;
  }
  function renderConv() {
    var sf = num(S.conv.sf), h = sheetHead(TAB.CONV, '1 acre = 43,560 sq. ft.');
    h += '<div class="bs-conv"><label>Square feet<input type="number" step="any" id="cvSf" value="' + +sf.toFixed(4) + '"></label><span class="bs-swap">' + ico('swap') + '</span><label>Acres<input type="number" step="any" id="cvAc" value="' + +(sf / 43560).toFixed(6) + '"></label></div>';
    h += '<code class="bs-eq big">' + fmt(sf, 2) + ' sq. ft. / 43,560 = ' + fmt(sf / 43560, 6) + ' ac</code>';
    return h;
  }
  function renderB21() {
    var t = trib(), dcv = dcvB21(), h = sheetHead(TAB['B.2-1'], 'A and C are the totals of the DMAs assigned to the active BMP in Worksheet B-1.');
    var row = function (n, lbl, field, unit, eq, cls) { return '<div class="bs-row ' + (cls || (eq ? 't-calc' : 't-in')) + '" data-line="' + n + '"><span class="bs-ln">' + n + '</span><div class="bs-lbl"><span>' + lbl + '</span>' + (eq || '') + '</div><div class="bs-val">' + field + '</div><span class="bs-unit">' + unit + '</span></div>'; };
    h += '<div class="bs-rows">' + row(1, '85th percentile 24-hr storm depth from Figure B.1-1 (d)', '<input type="number" step="any" id="b21d" value="' + esc(S.d) + '">', 'inches', '', 't-in') +
      row(2, 'Area tributary to BMP(s) (A)', '<strong>' + fmt(t.ac, 4) + '</strong>', 'acres', '<span class="bs-chip link">from B-1</span>', 't-in') +
      row(3, 'Area weighted runoff factor (estimate using Appendix B.1.1 and B.2.1) (C)', '<strong>' + fmt(t.c, 4) + '</strong>', 'unitless', '<span class="bs-chip link">from B-1</span>', 't-in') +
      row(4, 'Trees credit volume (TCV). In the SWQMP list the number of trees, size of each tree, soil volume installed for each tree, contributing area to each tree and the inlet opening dimension for each tree.', '<input type="number" step="any" id="b21t" value="' + esc(S.tcv) + '">', 'cubic-feet', '', 't-in') +
      row(5, 'Rain barrels credit volume (RCV). In the SWQMP list the number of rain barrels, size of each rain barrel and the use of the captured stormwater runoff.', '<input type="number" step="any" id="b21r" value="' + esc(S.rcv) + '">', 'cubic-feet', '', 't-in') +
      row(6, 'Calculate DCV', '<strong id="b21dcv">' + fmt(dcv, 1) + '</strong>', 'cubic-feet', '<code class="bs-eq">= (3630 × C × d × A) − TCV − RCV<br>= (3630 × ' + fmt(t.c, 4) + ' × ' + fmt(num(S.d), 2) + ' × ' + fmt(t.ac, 4) + ') − ' + fmt(num(S.tcv)) + ' − ' + fmt(num(S.rcv)) + '</code>' + (dcv < 0 ? '<span class="bs-warn">Credits exceed the volume: DCV is negative as computed (the worksheet does not floor it at zero).</span>' : '')) + '</div>';
    h += '<p class="assume"><a href="' + ROOT + 'screening-map/">Open the Stormwater Screening Map</a> to read the Figure B.1-1 isopluvial depth for a site.</p>';
    return h;
  }
  function i10() {
    var t = trib(), A = t.sf, C = t.c, l3 = 0.2, l4 = S.i10.storage ? num(lineVal('B.5-5', 14)) : 1.5 * (A / 43560) * C * l3;
    var l5 = num(S.i10.cap), o = String(S.i10.outlet).trim(), l6 = /^n\/?a$/i.test(o) || o === '' ? null : num(o), l7 = l6 === null ? l5 : Math.min(l5, l6);
    return { A: A, C: C, l3: l3, l4: l4, l5: l5, l6: l6, l7: l7, ok: l4 > 0 && l7 >= l4 };
  }
  function renderI10() {
    var r = i10(), h = sheetHead(TAB['I-10.A'], 'Complete one separate worksheet for each compact biofiltration BMP (Form I-10, August 2024 Edition).');
    var row = function (n, lbl, field, unit, eq, cls) { return '<div class="bs-row ' + (cls || 't-calc') + '" data-line="' + n + '"><span class="bs-ln">' + n + '</span><div class="bs-lbl"><span>' + lbl + '</span>' + (eq || '') + '</div><div class="bs-val">' + field + '</div><span class="bs-unit">' + unit + '</span></div>'; };
    h += '<div class="bs-rows">' + row(1, 'Area draining to the BMP', '<strong>' + fmt(r.A, 0) + '</strong>', 'square ft.', '<span class="bs-chip link">from B-1</span>', 't-in') +
      row(2, 'Adjusted runoff factor for drainage area (Refer to Appendix B.1 and B.2). Attach supporting calculations.', '<strong>' + fmt(r.C, 4) + '</strong>', '(unitless)', '<span class="bs-chip link">from B-1</span>', 't-in') +
      row(3, 'Design rainfall intensity', '<strong class="const">0.20</strong>', 'in/hr', '<span class="bs-chip fixed">fixed on worksheet</span>', 't-const') +
      row(4, 'Design flow rate for biofiltration <label class="bs-inline"><input type="checkbox" id="i10s"' + (S.i10.storage ? ' checked' : '') + '> storage unit upstream (footnote 1: use Line 14 of Worksheet B.5-5 instead)</label>', '<strong id="i10l4">' + fmt(r.l4, 4) + '</strong>', 'cfs', S.i10.storage ? '<code class="bs-eq">= B.5-5 Line 14 = ' + fmt(r.l4, 4) + '</code>' : '<code class="bs-eq">= 1.5 × (L1 / 43,560) × L2 × L3<br>= 1.5 × (' + fmt(r.A, 0) + ' / 43,560) × ' + fmt(r.C, 4) + ' × 0.20</code>') +
      row(5, 'Proprietary biofiltration flow rate treatment capacity (provided by manufacturer; attach supporting documentation)', '<input type="number" step="any" id="i10c" value="' + esc(S.i10.cap) + '" placeholder="0">', 'cfs', '', 't-in') +
      row(6, 'Outlet outflow rate, if the biofiltration unit is outlet controlled (e.g., there is orifice cap that controls the outflow flow rate). Enter N/A if not outlet controlled.', '<input type="text" id="i10o" value="' + esc(S.i10.outlet) + '">', 'cfs', '', 't-in') +
      row(7, 'Treatment flow rate: the smaller of Line 5 and Line 6; if Line 6 is N/A, Line 5', '<strong>' + fmt(r.l7, 4) + '</strong>', 'cfs', '<code class="bs-eq">= ' + (r.l6 === null ? 'L5 = ' + fmt(r.l5, 4) : 'MIN(' + fmt(r.l5, 4) + ', ' + fmt(r.l6, 4) + ')') + '</code>') +
      row(8, 'Is Line 7 ≥ Line 4? If No: revise the design, or show 80% of average annual runoff is treated by continuous simulation (Appendix F.2 / G), or propose a different treatment method.', '<span class="bs-badge big ' + (r.ok ? 'yes' : 'no') + '">' + ico(r.ok ? 'ok' : 'no') + (r.ok ? 'YES' : 'NO') + '</span>', '', '<span class="bs-stat-txt">' + (r.ok ? 'Yes - sizing requirements met.' : 'No - see the options on Form I-10 Line 8.') + '</span>', 't-status') + '</div>';
    h += '<p class="assume">Values are compared at full precision (Form I-10 states no rounding rule).</p>';
    return h;
  }

  /* ---------------- side panel: result, citations, copy text ---------------- */
  function resultOf(id) {
    if (SPECS[id]) return SPECS[id].result();
    var t = trib();
    if (id === 'B-1') return { main: [['Tributary to ' + S.bmp, t.ac, 'acres', 4], ['Area-weighted C', t.c, '', 4]] };
    if (id === 'RC') { var r = rcCalc(); return { main: [['Area-weighted C', r.c, '', 4]].concat(S.rc.disp.on ? [['Adjusted C (dispersion)', r.adj, '', 3]] : []) }; }
    if (id === 'CONV') return { main: [['Acres', num(S.conv.sf) / 43560, 'ac', 6]] };
    if (id === 'B.2-1') return { main: [['DCV (Line 6)', dcvB21(), 'cu. ft.', 1]] };
    var q = i10();
    return { main: [['Treatment flow (Line 7)', q.l7, 'cfs', 4], ['Design flow (Line 4)', q.l4, 'cfs', 4]], ok: q.ok, okText: q.ok ? 'Line 8: Yes - sizing requirements met' : 'Line 8: No' };
  }
  var FIXES = {
    'B.5-2': ['Factor of safety fixed at 2 as printed on the worksheet.', 'Line 4 is Line 1 × Line 2 × (Line 3/12) as printed (tree and rain-barrel credits are not deducted here).'],
    'B.5-3': ['When the reliable infiltration rate (Line 12) is 0, Line 22 equals the ET capture (Line 16), as in the City workbook.', 'Line 15 and Line 20 rounded to 2 decimals and Line 17 to whole hours, as in the workbook; lookups valid at the 120-hour and fraction-3 table edges.', 'Porosity (Line 9) and factor of safety (Line 11) fixed at 0.4 and 2 as printed.'],
    'B.5-4': ['2024 worksheet structure (land-use table, Lines 1-9) instead of the pre-2024 Lines 1-11.', 'Line 9 as the City workbook computes it (cell J31); the manual PDF equation (p. B-60) is shown in a flag for comparison.'],
    'B.5-5': ['Line 4 (remaining DCV after retention BMPs) is an input, defaulting to the B.2-1 DCV.', 'Line 6 minimum is 1.5 feet, as printed.'],
    'B.5-7': ['Dispersion credit (Line 14) from the workbook tables: fraction capped at the nomograph maximum, rounded to 3 decimals.', 'Line 6, Line 13 and Line 15 equations as printed on the 2024 worksheet.']
  };
  function shortLabel(s) { return s.replace(/\s*\(.*$/, '').replace(/\s*\[.*$/, '').replace(/\..*$/, ''); }
  function calcText(id) {
    var t = TAB[id], out = [], r = resultOf(id), w = wsInputs(id);
    out.push(t.code + ' - ' + t.title);
    if (S.project) out.push('Project: ' + S.project);
    out.push('BMP: ' + S.bmp + '   DMA(s): ' + (trib().rows.map(function (x) { return x.id; }).join(', ') || '-'));
    out.push('');
    if (SPECS[id] && id !== 'B.5-4') {
      var v = vals(id), spec = SPECS[id], skip = id === 'B.5-6' && /Met/.test(g('B.5-6', 'E21'));
      spec.lines.forEach(function (L) {
        if (L.tbl === 'land') { out.push('Lines 6-9  Landscape areas (IDs 1-5): Line 6 = ' + B56C.map(function (c) { return fmt(g(id, c + '12'), 0); }).join(', ') + ' sq. ft.; Line 7 = ' + B56C.map(function (c) { return fmt(g(id, c + '13'), 0); }).join(', ') + ' sq. ft.; Line 9 credit = ' + B56C.map(function (c) { return fmt(g(id, c + '16'), 0); }).join(', ') + ' sq. ft.'); return; }
        if (L.tbl === 'sd') { if (!skip) out.push('Line 16  Site design BMP credits = ' + [27, 28, 29, 30, 31].map(function (k) { return (w['D' + k] ? w['D' + k] + ' ' : '') + fmt(g(id, 'I' + k), 2); }).join(', ') + '; sum = ' + fmt(g(id, 'I32'), 2) + ' cu. ft.'); return; }
        if (L.sec || (L.after12 && skip)) return;
        var lab = 'Line ' + L.n + '  ' + shortLabel(L.label);
        if (L.t === 'status') out.push(lab + ': ' + g(id, L.cell));
        else if (L.t === 'calc') { var e = eqText(L, v); out.push(lab + ' = ' + e + (/L\d/.test(e) ? ' = ' + subst(e, v, spec) : '') + ' = ' + fmt(g(id, L.cell), L.d) + (L.unit ? ' ' + L.unit : '')); }
        else if (L.t === 'const') out.push(lab + ' = ' + fmt(g(id, L.cell)) + (L.unit ? ' ' + L.unit : '') + ' (fixed on worksheet)');
        else out.push(lab + ' = ' + fmt(inVal(id, L), L.d) + (L.unit ? ' ' + L.unit : '') + (linked(id, L) ? ' (from ' + L.link.short + ')' : ''));
      });
    } else if (id === 'B.5-4') {
      var b = g(id, 'H22'), L5 = SPECS[id].lines;
      out.push('Line 1  Average annual precipitation = ' + fmt(inVal(id, L5[0]), 2) + ' in');
      for (var k = 12; k <= 21; k++) { var a = g(id, 'D' + k); if (num(a)) out.push('  ' + (k === 21 ? (w.B21 || 'Other') : LU[k - 12]) + ': A = ' + fmt(a, 0) + ' sq. ft., B = ' + fmt(g(id, 'F' + k), 2) + ', C = ' + fmt(g(id, 'G' + k), 1) + ' cu. ft., D = ' + pct(g(id, 'I' + k)) + ', E = ' + fmt(g(id, 'J' + k), 0) + ' mg/L, F = ' + fmt(g(id, 'K' + k), 2) + ' mg/L'); }
      out.push('Line 2  [a] = ' + fmt(g(id, 'E22'), 0) + ' sq. ft.; [b] = ' + fmt(b, 1) + ' cu. ft.; [c] = ' + fmt(g(id, 'L22'), 2) + ' mg/L');
      out.push('Line 3  Does Line 2[a] equal the B-1 area (' + fmt(inVal(id, L5[1]), 0) + ' sq. ft.)? ' + g(id, 'J23'));
      out.push('Line 4  Lc = ' + fmt(inVal(id, L5[2])) + ' lb/sq. ft.;  Line 5  TL = ' + fmt(inVal(id, L5[3])) + ' yr;  Line 6  pretreatment = ' + inVal(id, L5[4]));
      out.push('Line 7  TSS load = (L2[b] × 62.4 × L2[c] × (1 − L6)) / 10^6 = ' + fmt(g(id, 'J28'), 3) + ' lb/yr');
      out.push('Line 8  Footprint needed = (L7 × L5) / L4 = ' + fmt(g(id, 'J30'), 2) + ' sq. ft.');
      out.push('Line 9  Min. footprint sizing factor = L8 / (L2[b] x L1/12) = ' + fmt(b54wb(), 4) + '   [City workbook J31; manual PDF p. B-60 equation L8 / (L2[b] / (L1/12)) = ' + fmt(b54manual(), 4) + ']');
    } else if (id === 'B-1') {
      S.dmas.forEach(function (d) { out.push(d.id + ': A = ' + fmt(num(d.area), 4) + ' ac, impervious ' + fmt(num(d.imp), 4) + ' ac, HSG ' + (d.hsg || '-') + ', C = ' + fmt(num(d.c), 4) + ', DCV = ' + fmt(3630 * num(d.c) * num(S.d) * num(d.area), 1) + ' cu. ft., treated by ' + (d.bmp || '-') + ' (' + d.type + '), drains to ' + (d.poc || '-')); });
      out.push('Tributary to ' + S.bmp + ': ' + fmt(trib().ac, 4) + ' ac (' + fmt(trib().sf, 0) + ' sq. ft.), C = ' + fmt(trib().c, 4));
    } else if (id === 'RC') {
      var rc = rcCalc();
      S.rc.rows.forEach(function (x) { out.push(x.s + ': A = ' + fmt(num(x.a), 3) + ' ' + (S.rc.unit === 'sf' ? 'sq. ft.' : 'ac') + ' × C ' + SC[x.s].toFixed(2)); });
      out.push('C = Σ(Cx Ax) / Σ Ax = ' + fmt(rc.sca, 3) + ' / ' + fmt(rc.sa, 3) + ' = ' + fmt(rc.c, 4) + ' (Equation B.1-2, Table B.1-1)');
      if (S.rc.disp.on) out.push('Dispersion (Section B.2.1.1, Table B.2-1): ratio = ' + fmt(rc.ratio, 3) + ', HSG ' + S.rc.disp.hsg + ', factor = ' + fmt(rc.f, 3) + ', adjusted C = ' + fmt(rc.adj, 3));
    } else if (id === 'B.2-1') {
      var tt = trib();
      out.push('Line 1  d = ' + fmt(num(S.d), 2) + ' in;  Line 2  A = ' + fmt(tt.ac, 4) + ' ac;  Line 3  C = ' + fmt(tt.c, 4) + ';  Line 4  TCV = ' + fmt(num(S.tcv)) + ' cu. ft.;  Line 5  RCV = ' + fmt(num(S.rcv)) + ' cu. ft.');
      out.push('Line 6  DCV = (3630 × C × d × A) − TCV − RCV = (3630 × ' + fmt(tt.c, 4) + ' × ' + fmt(num(S.d), 2) + ' × ' + fmt(tt.ac, 4) + ') − ' + fmt(num(S.tcv)) + ' − ' + fmt(num(S.rcv)) + ' = ' + fmt(dcvB21(), 1) + ' cu. ft.');
    } else if (id === 'I-10.A') {
      var q = i10();
      out.push('Line 1  A = ' + fmt(q.A, 0) + ' sq. ft.;  Line 2  C = ' + fmt(q.C, 4) + ';  Line 3  i = 0.20 in/hr');
      out.push('Line 4  Design flow = ' + (S.i10.storage ? 'B.5-5 Line 14 (storage unit upstream)' : '1.5 × (L1 / 43,560) × L2 × L3 = 1.5 × (' + fmt(q.A, 0) + ' / 43,560) × ' + fmt(q.C, 4) + ' × 0.20') + ' = ' + fmt(q.l4, 4) + ' cfs');
      out.push('Line 5  = ' + fmt(q.l5, 4) + ' cfs;  Line 6  = ' + (q.l6 === null ? 'N/A' : fmt(q.l6, 4) + ' cfs') + ';  Line 7  = ' + fmt(q.l7, 4) + ' cfs');
      out.push('Line 8  Is Line 7 ≥ Line 4? ' + (q.ok ? 'Yes' : 'No'));
    } else { r.main.forEach(function (m) { out.push(m[0] + ' = ' + fmt(m[1], m[3]) + ' ' + m[2]); }); }
    out.push('');
    if (r.okText) out.push('Result: ' + (r.ok ? 'YES / PASS - ' : 'NO / FAIL - ') + r.okText.replace(/^Line \d+: /, ''));
    else if (r.main && r.main[0]) out.push('Result: ' + r.main[0][0] + ' = ' + fmt(r.main[0][1], r.main[0][3]) + ' ' + r.main[0][2]);
    if (r.assume) out.push('Reviewer assumption: ' + r.assume);
    if (id === 'B.5-5' && !linkedNo(id, 'F15')) out.push('Reviewer assumption: Line 10 taken from Table B.5-5 at the next longer tabulated drawdown when Line 9 falls between table values.');
    out.push('');
    if (t.doc) out.push('Reference: ' + cite(t) + '.');
    if (SPECS[id]) out.push('Calculation logic: ' + XLS + ', tab "' + SPECS[id].sheet + '"' + (id === 'B.5-4' ? ' (Line 9 = cell J31; manual PDF equation shown for comparison)' : '') + '.');
    if (BF1_AT[id] && window.BF1) { if (!S.bf1) S.bf1 = {}; out.push(''); out.push(window.BF1.text(bf1Data(id), S.bf1)); }
    out.push('Prepared with an independent reviewer tool; not an official City of San Diego product. Verify against the source documents.');
    return out.join('\n');
  }
  function linkedNo(id, cell) { var w = wsInputs(id); return w[cell] !== undefined && w[cell] !== ''; }
  function renderSide(id) {
    var t = TAB[id], r = resultOf(id), h = '<div class="bs-result"><span class="eyebrow-label">Result</span>';
    (r.main || []).forEach(function (m, i) { h += '<div class="bs-big' + (i ? ' sub' : '') + '"><small>' + esc(m[0]) + '</small><b>' + fmt(m[1], m[3]) + '</b> <i>' + esc(m[2]) + '</i></div>'; });
    if (r.okText) h += '<div class="bs-verdict ' + (r.ok ? 'yes' : 'no') + '" id="verdict">' + ico(r.ok ? 'ok' : 'no') + '<span><b>' + (r.ok ? 'YES · PASS' : 'NO · FAIL') + '</b>' + esc(r.okText) + '</span></div>';
    if (r.info) h += '<p class="bs-info">' + ico('info') + esc(r.info) + '</p>';
    if (r.assume) h += '<p class="assume">Reviewer assumption: ' + esc(r.assume) + '</p>';
    h += '</div>';
    if (t.doc) h += '<a class="bs-cite" href="' + pageLink(t.doc, t.page) + '">' + thumb(t.doc, t.page, 86) + '<span><b>' + esc(t.code) + '</b>' + esc(cite(t)) + '<em>Open page in Manual &amp; Code Reference ›</em></span></a>';
    if (FIXES[id]) h += '<div class="bs-fixes"><b>Checked against the manual and City workbook</b><ul>' + FIXES[id].map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>';
    h += '<div class="bs-copy"><div class="bs-copy-head"><b>Plan-check calc</b><button type="button" id="copyBtn">' + ico('copy') + '<span>Copy as plan-check calc</span></button></div><textarea id="calcText" readonly rows="9" aria-label="Plan-check calculation text">' + esc(calcText(id)) + '</textarea></div>';
    $('side').innerHTML = h;
  }

  /* ---------------- main render ---------------- */
  function selKey(el) {
    if (!el || !el.closest || !el.closest('#sheet')) return null;
    if (el.id) return '#' + el.id;
    var a = ['data-cell', 'data-text', 'data-dma', 'data-rc', 'data-disp', 'data-k'].filter(function (x) { return el.hasAttribute(x); });
    if (!a.length) return null;
    return el.tagName.toLowerCase() + a.map(function (x) { return '[' + x + '="' + el.getAttribute(x) + '"]'; }).join('');
  }
  function render() {
    cache = {};
    var active = document.activeElement, key = selKey(active), pos = null;
    try { if (key && active.selectionStart != null) pos = active.selectionStart; } catch (e) { pos = null; }
    if (!TAB[S.tab]) S.tab = 'B-1';
    renderCarried(); renderPicker();
    var id = S.tab, h;
    if (SPECS[id]) h = renderSpec(id);
    else if (id === 'B-1') h = renderB1();
    else if (id === 'RC') h = renderRC();
    else if (id === 'CONV') h = renderConv();
    else if (id === 'B.2-1') h = renderB21();
    else h = renderI10();
    $('sheet').innerHTML = h;
    bf1Mount(id);
    renderSide(id);
    if (key) { var el = $('sheet').querySelector(key); if (el) { el.focus(); try { if (pos != null) el.setSelectionRange(pos, pos); } catch (e) { /* number inputs have no selection */ } } }
    save();
  }

  /* ---------------- events ---------------- */
  var timer;
  function onEdit(e) {
    var el = e.target, id = S.tab, imm = el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'radio';
    if (e.type === 'change' && !imm) return;
    if (el.hasAttribute('data-cell')) wsInputs(id)[el.getAttribute('data-cell')] = el.value;
    else if (el.hasAttribute('data-text')) wsInputs(id)[el.getAttribute('data-text')] = el.value;
    else if (el.hasAttribute('data-dma')) S.dmas[+el.getAttribute('data-dma')][el.getAttribute('data-k')] = el.value;
    else if (el.hasAttribute('data-rc')) S.rc.rows[+el.getAttribute('data-rc')][el.getAttribute('data-k')] = el.value;
    else if (el.hasAttribute('data-disp')) S.rc.disp[el.getAttribute('data-disp')] = el.value;
    else if (el.id === 'b21d') S.d = el.value; else if (el.id === 'b21t') S.tcv = el.value; else if (el.id === 'b21r') S.rcv = el.value;
    else if (el.id === 'i10c') S.i10.cap = el.value; else if (el.id === 'i10o') S.i10.outlet = el.value;
    else if (el.id === 'cvSf') S.conv.sf = el.value; else if (el.id === 'cvAc') S.conv.sf = num(el.value) * 43560;
    else if (el.name === 'rcu') S.rc.unit = el.value;
    else if (el.id === 'dispOn') S.rc.disp.on = el.checked; else if (el.id === 'i10s') S.i10.storage = el.checked;
    else return;
    clearTimeout(timer);
    if (imm) render(); else timer = setTimeout(render, 150);
  }
  $('sheet').addEventListener('input', onEdit);
  $('sheet').addEventListener('change', onEdit);
  $('sheet').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var id = S.tab, w = wsInputs(id);
    if (b.hasAttribute('data-relink')) { delete w[b.getAttribute('data-relink')]; render(); }
    else if (b.hasAttribute('data-alt')) { var L = SPECS[id].lines.filter(function (x) { return x.cell === b.getAttribute('data-alt'); })[0]; w[L.cell] = String(L.alt.get()); render(); }
    else if (b.id === 'addDma') { S.dmas.push({ id: 'DMA-' + (S.dmas.length + 1), area: 0, imp: 0, hsg: '', c: 0.9, bmp: S.bmp, type: 'Biofiltration', poc: 'POC-1' }); render(); }
    else if (b.hasAttribute('data-del')) { if (S.dmas.length > 1) { S.dmas.splice(+b.getAttribute('data-del'), 1); render(); } }
    else if (b.id === 'addRc') { S.rc.rows.push({ s: 'Concrete or Asphalt', a: 0 }); render(); }
    else if (b.hasAttribute('data-rcdel')) { if (S.rc.rows.length > 1) { S.rc.rows.splice(+b.getAttribute('data-rcdel'), 1); render(); } }
    else if (b.id === 'rcApply' || b.id === 'rcApplyA') {
      var r = rcCalc(), d = S.dmas[+$('rcDma').value];
      d.c = +r.c.toFixed(4); if (b.id === 'rcApplyA') d.area = +(r.sa / 43560).toFixed(6);
      flash(b, 'Applied'); setTimeout(render, 450);
    }
  });
  function go(tab) { S.tab = tab; if (location.hash !== '#' + tab) history.replaceState(null, '', '#' + tab); render(); }
  $('picker').addEventListener('click', function (e) { var b = e.target.closest('[data-tab]'); if (b) go(b.getAttribute('data-tab')); });
  $('side').addEventListener('click', function (e) {
    var b = e.target.closest('#copyBtn'); if (!b) return;
    var ta = $('calcText'), txt = ta.value, done = function () { flash(b, 'Copied'); };
    var fallback = function () { ta.focus(); ta.select(); try { document.execCommand('copy'); } catch (x) { /* ignore */ } done(); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(done, fallback); else fallback();
  });
  function flash(b, t) { var o = b.innerHTML; b.textContent = t + ' ✓'; b.classList.add('done'); setTimeout(function () { b.innerHTML = o; b.classList.remove('done'); }, 1200); }
  $('projName').addEventListener('input', function () { S.project = this.value; save(); var ta = $('calcText'); if (ta) ta.value = calcText(S.tab); });
  $('bmpSel').addEventListener('change', function () { S.bmp = this.value; render(); });
  $('printBtn').addEventListener('click', function () { window.print(); });
  $('resetBtn').addEventListener('click', function () { if (confirm('Clear all inputs and start over?')) { S = defaults(); render(); } });
  $('saveBtn').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify({ tool: 'bmp-sizing', version: 1, saved: new Date().toISOString(), state: S }, null, 1)], { type: 'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (S.project || 'bmp-sizing').replace(/[^\w.-]+/g, '_') + '.json';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    $('savedNote').textContent = 'Saved ' + a.download + ' to your downloads.';
  });
  $('openFile').addEventListener('change', function () {
    var f = this.files[0], inp = this; if (!f) return;
    f.text().then(function (t) {
      var o = JSON.parse(t); if (!o.state || !o.state.dmas) throw new Error('bad file');
      S = o.state; var d = defaults(); Object.keys(d).forEach(function (k) { if (S[k] === undefined) S[k] = d[k]; });
      render(); $('savedNote').textContent = 'Opened ' + f.name + '.';
    }).catch(function () { alert('That file is not a saved BMP sizing project.'); });
    inp.value = '';
  });
  window.addEventListener('hashchange', function () { var h = decodeURIComponent(location.hash.slice(1)); if (TAB[h] && h !== S.tab) { S.tab = h; render(); } });

  /* ---------------- about ---------------- */
  $('aboutBtn').addEventListener('click', function () {
    $('aboutBody').innerHTML = '<h2>About, sources &amp; differences</h2>' +
      '<p><strong>Not an official City of San Diego product.</strong> Independent reviewer aid; no City logos or forms are reproduced. Confirm the current edition on sandiego.gov before relying on a result.</p>' +
      '<h3>Sources</h3><ul><li>' + MAN + ', Appendix B (Worksheets B-1, B.2-1, B.5-1 to B.5-7; Tables B.1-1, B.2-1, B.5-5; Figures B.4-1, B.5-2, B.5-3, B.5-5 to B.5-11), <a href="' + SWS_URL + '" target="_blank" rel="noopener">City PDF</a>.</li>' +
      '<li>Stormwater Standards Appendix I, Form I-10 / Worksheet I-10.A (August 2024 Edition).</li>' +
      '<li>' + XLS + ', <a href="' + esc(WBD.source) + '" target="_blank" rel="noopener">City file</a> (MD5 ' + esc(WBD.md5) + '). This is the calculator\'s reference: its formulas, constants, nomograph lookup tables and line wording are used directly by this page (verified identical to the copy supplied for review on 24 Oct 2026, and to the file on sandiego.gov). Where the workbook and the manual PDF differ, the workbook governs and a flag cites the manual page. The test suite recalculates the same workbook in LibreOffice and checks that every formula cell matches.</li></ul>' +
      '<h3>Where the manual and the City workbook differ</h3><ul><li><b>B.5-4 Line 9.</b> Manual: Line 8 / (Line 2[b] / (Line 1/12)). Workbook J31 (and its printed line text): Line 8 / (Line 2[b] × Line 1/12). The tool follows the workbook and shows the manual-equation value in a flag; they agree only when Line 1 = 12 in.</li>' +
      '<li><b>Line references.</b> Worksheets B.5-1 (Line 20) and B.5-5 (Line 16) still cite "Line 11 of Worksheet B.5-4", the pre-2024 line number; the 2024 B.5-4 result is Line 9.</li>' +
      '<li><b>B.5-5 Criteria 3</b> is "not applicable for No Infiltration Condition" in the manual, but the workbook still computes Line 21 when Line 5 = 0; Line 22 is shown as the workbook computes it, with a flag.</li></ul>' +
      '<h3>Reviewer assumptions (labelled where used)</h3><ul><li>Table B.5-5: drawdowns between tabulated values use the next longer tabulated drawdown.</li><li>B.5-3: Line 24 is compared with the B.5-2 Line 10 target.</li><li>The January 2018 sizing/feasibility worksheets PDF is not used; it predates the August 2024 changes to Worksheets B.5-2 and B.5-4.</li></ul>';
    $('about').showModal();
  });

  var h0 = decodeURIComponent(location.hash.slice(1)); if (TAB[h0]) S.tab = h0;
  render();
  window.BMPSizing = { state: function () { return S; }, set: function (s) { S = s; render(); }, defaults: defaults, render: render, go: go, calcText: calcText, g: function (id, c) { cache = {}; return g(id, c); }, b54manual: function () { cache = {}; return b54manual(); }, b54wb: function () { cache = {}; return b54wb(); }, wbText: function (id, n) { var L = SPECS[id].lines.filter(function (x) { return x.n === n; })[0]; return L ? wbText(id, L) : null; }, rcCalc: rcCalc, i10: i10, trib: trib, dcv: dcvB21,
    /* test hook: the input cells this page feeds the City workbook formulas, and every formula result */
    dump: function (id) { cache = {}; var sh = evalSheet(id), cells = WBD.sheets[SPECS[id].sheet].cells, out = {}; Object.keys(cells).forEach(function (a) { if (cells[a].f) { var v = sh.get(a); out[a] = E.isErr(v) ? v.err : v; } }); return { sheet: SPECS[id].sheet, inputs: sh.inputs, out: out }; } };
})();
