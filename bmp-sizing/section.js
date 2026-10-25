/* BF-1 live biofiltration section for the BMP Sizing Calculator (reviewer tool, not an official City detail).
   Vertical scale is true to the worksheet inputs; horizontal is not to scale.
   Criteria quoted from Stormwater Standards Part 1: BMP Design Manual (August 2024 Edition), Appendix E.18, Fact Sheet BF-1. */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var MAN = 'Stormwater Standards Part 1: BMP Design Manual (August 2024 Edition)';
  var PG = { 'E-81': 408, 'E-83': 410, 'E-84': 411, 'E-85': 412, 'E-86': 413, 'E-82': 409 };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var r2 = function (x) { return Math.round(x * 100) / 100; };
  var fi = function (x) { x = r2(x); return (Math.abs(x - Math.round(x)) < 1e-9 ? String(Math.round(x)) : String(x)) + ' in'; };
  var num = function (v) { var n = parseFloat(v); return isFinite(n) ? n : 0; };
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /* ---------- fact-sheet text (verbatim excerpts) ---------- */
  var SPEC = {
    fb: { name: 'Freeboard', pg: 'E-83', q: 'Freeboard ≥ 2 inches. Freeboard provides room for head over overflow structures and minimizes risk of uncontrolled surface discharge.' },
    pond: { name: 'Surface ponding', pg: 'E-83', q: 'Surface Ponding ≥ 6 and ≤ 12 inches. When the BMP is adjoining walkways the minimum surface ponding depth can be reduced to 4 inches. Surface ponding depth greater than 12 inches … may be allowed at the discretion of the City Engineer if … surface ponding depth drawdown time is less than 24 hours; and 2) safety issues and fencing requirements are considered (typically ponding greater than 18” will require a fence) and 3) potential for elevated clogging risk is evaluated (Worksheet B.5.4).' },
    slope: { name: 'Ponding area side slopes', pg: 'E-83', q: 'Ponding Area Side Slopes: 3H:1V or shallower. Gentler side slopes are safer, less prone to erosion, able to establish vegetation more quickly and easier to maintain.' },
    mulch: { name: 'Mulch', pg: 'E-84', q: 'Mulch ≥ 3 inches (p. E-83). A minimum of 3 inches of well-aged, shredded hardwood mulch that has been stockpiled or stored for at least 12 months is provided.' },
    media: { name: 'Biofiltration media', pg: 'E-83', q: 'Media Layer ≥ 18 inches. Where the minimum depth of 18 inches is used, only shallow-rooted species shall be planted. A minimum 24-inch media layer shall typically be required to support vegetation, with a minimum 36-inch media layer depth required for trees. (Media maintains a minimum filtration rate of 5 in/hr. over lifetime of facility, p. E-84.)' },
    sand: { name: 'Filter course: ASTM C33 sand', pg: 'E-83', q: 'Filter Course 6 inches: … one 3” layer of clean and washed ASTM 33 Fine Aggregate Sand overlying a 3” layer of ASTM No 8 Stone (Appendix F.4). Filter fabric is not used (p. E-85).' },
    no8: { name: 'Filter course: ASTM No. 8 stone', pg: 'E-85', q: 'Each of the two filter course layers (top layer of ASTM C33 Choker Sand and bottom layer of ASTM No. 8) shall be installed to a thickness of 3 inches (75 mm). Both layers shall be spread in single layers.' },
    no57: { name: 'Aggregate storage: ASTM No. 57', pg: 'E-85', q: 'Washed ASTM #57 open graded stone is used for the storage layer and a two layer filter course (detailed above) is used above this layer. Class 2 Permeable per Caltrans specification 68-1.025 may be used … The depth of aggregate provided (12-inch typical) … is adequate for providing conveyance for underdrain flows to the outlet structure (p. E-86).' },
    below: { name: 'Aggregate below underdrain', pg: 'E-86', q: 'Underdrain outlet elevation should be a minimum of 3 inches above the bottom elevation of the aggregate storage layer.' },
    ud: { name: 'Perforated underdrain', pg: 'E-86', q: 'Minimum underdrain diameter is 8 inches. For privately maintained BMPs, a minimum underdrain diameter of 6 inches is allowed. Underdrains are made of slotted, PVC pipe conforming to ASTM D 3034 or equivalent or corrugated, HDPE pipe conforming to AASHTO 252M or equivalent.' },
    co: { name: 'Underdrain cleanout', pg: 'E-86', q: 'An underdrain cleanout with a minimum 8-inch diameter and lockable cap is placed every 50 feet as required based on underdrain length. For privately maintained BMPs, cleanout diameter of 6 inches is allowed.' },
    riser: { name: 'Overflow riser with grate', pg: 'E-86', q: 'Overflow is safely conveyed to a downstream storm drain system or discharge point Size overflow structure to pass 100-year peak flow for on-line infiltration basins and water quality peak flow for off-line basins.' },
    liner: { name: 'Impermeable liner', pg: 'E-81', q: 'An impermeable liner or other hydraulic restriction layer is included if site constraints indicate that infiltration or lateral flows should not be allowed.' },
    native: { name: 'Uncompacted native soil', pg: 'E-81', q: 'Typical components include an impermeable liner or uncompacted native soils at the bottom of the facility (p. E-80). Incidental infiltration, when allowable, can aid in pollutant removal and groundwater recharge.' },
    inlet: { name: 'Inflow: curb cut / sheet flow', pg: 'E-86', q: 'Curb cut inlets are at least 18 inches wide, have a 4-6 inch reveal (drop) and an apron and energy dissipation as needed. Inflow velocities are limited to 3 ft./s or less or use energy dissipation methods (e.g., riprap, level spreader) for concentrated inflows.' },
    plants: { name: 'Vegetation', pg: 'E-84', q: 'Plantings are suitable for the climate and expected ponding depth. A plant list to aid in selection can be found in Appendix E.26.' },
    fp: { name: 'Media surface area (footprint)', pg: 'E-85', q: 'Media surface area is 3% of contributing area times adjusted runoff factor or greater. Unless demonstrated that the BMP surface area can be smaller than 3%. Use Worksheet B.5.4 in Appendix B.5 to estimate the Alternative Minimum Sizing Factor.' }
  };
  function citeTxt(pg) { return 'BF-1, ' + MAN + ', p. ' + pg + ' (PDF p. ' + PG[pg] + ')'; }

  /* ---------- defaults & geometry ---------- */
  var DEF = { inc: true, mulch: 3, fb: 2, edge: 'curb', slope: 3, liner: false, tree: false, dia: 8, co: 8, priv: false, walk: false, storm: 'design' };
  function opt(st) { var o = {}; Object.keys(DEF).forEach(function (k) { o[k] = st && st[k] !== undefined ? st[k] : DEF[k]; }); o.mulch = num(o.mulch); o.fb = num(o.fb); o.slope = num(o.slope); o.dia = num(o.dia); o.co = num(o.co); return o; }

  function geom(d, st) {
    var o = opt(st), P = Math.max(0, num(d.P.v)), M = Math.max(0, num(d.M.v)), A7 = Math.max(0, num(d.A7.v)), A8 = Math.max(0, num(d.A8.v));
    var sand = 3, no8 = 3, mulch = Math.max(0, o.mulch), fb = Math.max(0, o.fb);
    var mediaRaw = o.inc ? M - mulch - sand : M, aboveRaw = o.inc ? A7 - no8 : A7;
    var media = Math.max(0, mediaRaw), above = Math.max(0, aboveRaw), below = A8, no57 = above + below;
    var z = {}; z.rim = P + fb; z.crest = P; z.mulchTop = 0; z.mulchBot = -mulch; z.mediaBot = z.mulchBot - media; z.sandBot = z.mediaBot - sand; z.no8Bot = z.sandBot - no8; z.bottom = z.no8Bot - no57; z.invert = z.bottom + below;
    var total = z.rim - z.bottom;
    return { o: o, P: P, M: M, A7: A7, A8: A8, fb: fb, mulch: mulch, media: media, mediaRaw: mediaRaw, sand: sand, no8: no8, above: above, aboveRaw: aboveRaw, below: below, no57: no57, z: z, total: total, inf: Math.max(0, num(d.INF.v)), fp: num(d.FP.v), req: num(d.REQ.v) };
  }

  /* ---------- checks ---------- */
  function checks(d, st) {
    var G = geom(d, st), o = G.o, c = [];
    var add = function (k, st2, label, val, why, src) { c.push({ k: k, s: st2, label: label, val: val, why: why, src: src || '', pg: SPEC[k].pg }); };
    add('fb', G.fb >= 2 ? 'pass' : 'fail', 'Freeboard', fi(G.fb), G.fb >= 2 ? '≥ 2 in' : 'Less than the 2 in minimum', 'Section input');
    var pmin = o.walk ? 4 : 6;
    if (G.P < pmin) add('pond', 'fail', 'Surface ponding', fi(G.P), 'Below the ' + pmin + ' in minimum' + (o.walk ? ' (adjoining walkway)' : ''), d.P.src);
    else if (G.P > 12) add('pond', 'fail', 'Surface ponding', fi(G.P), 'Exceeds 12 in; only at City Engineer discretion (drawdown < 24 h, safety/fencing' + (G.P > 18 ? ', fence typically required above 18 in' : '') + ', clogging per B.5-4)', d.P.src);
    else add('pond', 'pass', 'Surface ponding', fi(G.P), (o.walk ? '4' : '6') + '-12 in', d.P.src);
    if (o.edge === 'slope') add('slope', o.slope >= 3 ? 'pass' : 'fail', 'Side slopes', o.slope + 'H:1V', o.slope >= 3 ? '3H:1V or shallower' : 'Steeper than 3H:1V', 'Section input');
    add('mulch', G.mulch >= 3 ? 'pass' : 'fail', 'Mulch', fi(G.mulch), G.mulch >= 3 ? '≥ 3 in' : 'Less than the 3 in minimum', 'Section input');
    var msrc = o.inc ? d.M.src + ' − mulch − 3 in sand' : d.M.src, ms, mw;
    if (G.mediaRaw < 0) { ms = 'fail'; mw = 'Line 6 is less than mulch + sand; no media layer left'; }
    else if (G.media < 18) { ms = 'fail'; mw = 'Less than the 18 in minimum'; }
    else if (o.tree && G.media < 36) { ms = 'fail'; mw = 'Trees need a 36 in minimum media layer'; }
    else if (G.media < 24) { ms = 'check'; mw = '≥ 18 in: shallow-rooted species only; 24 in is typically required to support vegetation'; }
    else { ms = 'pass'; mw = G.media >= 36 ? '≥ 36 in (trees allowed)' : '≥ 24 in (no trees; trees need 36 in)'; }
    add('media', ms, 'Media layer', fi(G.media), mw, msrc);
    add('sand', 'pass', 'Filter course', '3 in C33 sand over 3 in No. 8', 'Two-layer filter course, no filter fabric (fixed in the section)', 'Fact sheet default');
    var crown = G.below + G.o.dia;
    if (G.aboveRaw < 0) add('no57', 'fail', 'No. 57 storage above invert', fi(0), 'Line 7 is less than the 3 in No. 8 stone it includes', d.A7.src);
    else if (crown > G.below + G.above + 1e-9) add('no57', 'check', 'No. 57 storage', fi(G.no57), 'Reviewer note: underdrain crown (' + fi(crown) + ' above bottom) extends above the No. 57 layer into the filter course; 12 in aggregate is typical', o.inc ? d.A7.src + ' − 3 in No. 8 + ' + d.A8.src : d.A7.src + ' + ' + d.A8.src);
    else add('no57', 'pass', 'No. 57 storage', fi(G.no57), '12 in typical; washed open-graded stone', o.inc ? d.A7.src + ' − 3 in No. 8 + ' + d.A8.src : d.A7.src + ' + ' + d.A8.src);
    add('below', G.below >= 3 ? 'pass' : 'fail', 'Underdrain above aggregate bottom', fi(G.below), G.below >= 3 ? '≥ 3 in' : 'Less than 3 in (Line 8 = 0 means the underdrain sits on the bottom)', d.A8.src);
    var udMin = o.priv ? 6 : 8;
    add('ud', o.dia >= udMin ? 'pass' : 'fail', 'Underdrain diameter', fi(o.dia), (o.dia >= udMin ? '≥ ' : 'Less than ') + udMin + ' in (' + (o.priv ? 'privately maintained' : 'City maintained') + ')', 'Section input');
    add('co', o.co >= udMin ? 'pass' : 'fail', 'Cleanout diameter', fi(o.co), (o.co >= udMin ? '≥ ' : 'Less than ') + udMin + ' in, lockable cap, every 50 ft of underdrain', 'Section input');
    add('riser', 'info', 'Overflow riser', 'grate at ' + fi(G.P) + ' above mulch', 'Size for the 100-year peak (on-line) or water quality peak (off-line); not checked here', 'Ponding depth');
    if (o.liner) add('liner', 'info', 'Impermeable liner', 'shown', G.inf > 0 ? 'Reviewer note: liner shown but infiltration rate ' + G.inf + ' in/hr is entered; a lined BMP is normally sized with no infiltration' : 'No infiltration to native soil', 'Section input');
    var fpS, fpW;
    if (!(G.fp > 0)) { fpS = 'check'; fpW = 'Enter the provided footprint (B.5-1 Line 23)'; }
    else if (G.req > 0 && G.fp + 1e-9 < G.req) { fpS = 'fail'; fpW = 'Less than ' + Math.round(G.req).toLocaleString('en-US') + ' sq ft required (' + d.REQ.src + ')'; }
    else { fpS = 'pass'; fpW = G.req > 0 ? '≥ ' + Math.round(G.req).toLocaleString('en-US') + ' sq ft required (' + d.REQ.src + ')' : 'Provided'; }
    add('fp', fpS, 'Footprint', Math.round(G.fp).toLocaleString('en-US') + ' sq ft', fpW, d.FP.src);
    return c;
  }

  function text(d, st) {
    var G = geom(d, st), o = G.o, c = checks(d, st), out = [];
    out.push('BF-1 section check (Fact Sheet BF-1, ' + MAN + ', pp. E-80 to E-87, PDF pp. 407-414):');
    out.push('  Section, top down: freeboard ' + fi(G.fb) + ' | ponding ' + fi(G.P) + ' | mulch ' + fi(G.mulch) + ' | media ' + fi(G.media) + ' | C33 sand 3 in | No. 8 stone 3 in | No. 57 ' + fi(G.no57) + ' (underdrain invert ' + fi(G.below) + ' above bottom) | ' + (o.liner ? 'impermeable liner' : 'uncompacted native soil'));
    c.forEach(function (x) { out.push('  ' + (x.s === 'info' ? 'INFO ' : x.s.toUpperCase() + ' ').padEnd(6) + x.label + ' = ' + x.val + ': ' + x.why + ' [' + x.src + '; BF-1 p. ' + x.pg + ', PDF p. ' + PG[x.pg] + ']'); });
    out.push('  Reviewer assumption: ' + (o.inc ? 'Line 6 includes the mulch and 3 in ASTM C33 sand, and Line 7 includes the 3 in ASTM No. 8 stone, as the worksheet line text instructs.' : 'Line 6 is the media layer only and Line 7 is the No. 57 stone above the invert only (mulch, sand and No. 8 stone drawn in addition).') + ' Section options (freeboard, mulch, pipe sizes, edge, liner) are reviewer inputs, not worksheet lines.');
    out.push('  Illustrative section: vertical to scale, horizontal not to scale; not an official City detail.');
    return out.join('\n');
  }

  /* ---------- textures (deterministic SVG patterns) ---------- */
  function wrapDots(sz, items, draw) { /* draw item and its wrapped copies so tiles join seamlessly */
    var h = '';
    items.forEach(function (it) {
      var r = it.r || 8, xs = [0], ys = [0];
      if (it.x < r) xs.push(sz); if (it.x > sz - r) xs.push(-sz);
      if (it.y < r) ys.push(sz); if (it.y > sz - r) ys.push(-sz);
      xs.forEach(function (dx) { ys.forEach(function (dy) { h += draw(it, it.x + dx, it.y + dy); }); });
    });
    return h;
  }
  function pack(R, sz, n, rmin, rmax, gap, tries) {
    var out = [], t = 0;
    while (out.length < n && t++ < tries) {
      var r = rmin + R() * (rmax - rmin), x = R() * sz, y = R() * sz, ok = true;
      for (var i = 0; i < out.length && ok; i++) {
        for (var dx = -1; dx <= 1 && ok; dx++) for (var dy = -1; dy <= 1 && ok; dy++) {
          var ex = out[i].x + dx * sz - x, ey = out[i].y + dy * sz - y;
          if (Math.sqrt(ex * ex + ey * ey) < out[i].r + r + gap) ok = false;
        }
      }
      if (ok) out.push({ x: x, y: y, r: r, a: R() * 180, q: R() });
    }
    return out;
  }
  var DEFS = null;
  function defs() {
    if (DEFS) return DEFS;
    var R = rng(20240801), h = '', pick = function (a) { return a[Math.floor(R() * a.length)]; };
    var pat = function (id, sz, base, inner) { return '<pattern id="' + id + '" width="' + sz + '" height="' + sz + '" patternUnits="userSpaceOnUse"><rect width="' + sz + '" height="' + sz + '" fill="' + base + '"/>' + inner + '</pattern>'; };
    var dots = function (sz, n, rmin, rmax, cols) { var a = []; for (var i = 0; i < n; i++) a.push({ x: R() * sz, y: R() * sz, r: rmin + R() * (rmax - rmin), c: pick(cols) }); return wrapDots(sz, a, function (it, x, y) { return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + it.r.toFixed(2) + '" fill="' + it.c + '"/>'; }); };
    /* mulch: shredded hardwood chips */
    var chips = []; for (var i = 0; i < 22; i++) chips.push({ x: R() * 46, y: R() * 18, r: 6, w: 5 + R() * 7, hh: 1.6 + R() * 2, a: -45 + R() * 90, c: pick(['#8b5a2b', '#a8703c', '#6e4424', '#c08a50', '#5a361d']) });
    h += pat('bf1p-mulch', 46, '#4a2e1a', wrapDots(46, chips, function (it, x, y) { return '<rect x="' + (x - it.w / 2).toFixed(1) + '" y="' + (y - it.hh / 2).toFixed(1) + '" width="' + it.w.toFixed(1) + '" height="' + it.hh.toFixed(1) + '" rx=".8" fill="' + it.c + '" transform="rotate(' + it.a.toFixed(0) + ' ' + x.toFixed(1) + ' ' + y.toFixed(1) + ')"/>'; }));
    /* sandy-loam biofiltration media with organic speckle */
    h += pat('bf1p-media', 64, '#6f5034', dots(64, 46, 0.7, 1.4, ['#c4a274', '#d8bd8c', '#b48f5e']) + dots(64, 30, 0.8, 1.8, ['#2e2016', '#3f2b1b', '#4b3420']) + dots(64, 8, 0.5, 0.8, ['#eadcc0']));
    /* ASTM C33 fine aggregate sand */
    h += pat('bf1p-sand', 34, '#d5bb84', dots(34, 70, 0.45, 0.95, ['#b9995d', '#efe2bf', '#a88a52', '#c9ad73']));
    /* ASTM No. 8 stone */
    var s8 = pack(R, 30, 40, 2.3, 3.4, 0.5, 900);
    h += pat('bf1p-no8', 30, '#40454a', wrapDots(30, s8, function (it, x, y) { var c = ['#9aa1a6', '#b3b9bc', '#80878d', '#a39a8c'][Math.floor(it.q * 4)]; return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + it.r.toFixed(2) + '" fill="' + c + '"/><circle cx="' + (x - it.r * 0.35).toFixed(1) + '" cy="' + (y - it.r * 0.35).toFixed(1) + '" r="' + (it.r * 0.35).toFixed(2) + '" fill="#fff" opacity=".28"/>'; }));
    /* ASTM No. 57 open-graded stone: rounded stones with dark voids */
    var s57 = pack(R, 84, 30, 5.2, 8.6, 1.4, 2500);
    h += '<radialGradient id="bf1g57a" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#e2ddd2"/><stop offset=".6" stop-color="#a9a49a"/><stop offset="1" stop-color="#6f6b64"/></radialGradient>';
    h += '<radialGradient id="bf1g57b" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#d4d8da"/><stop offset=".6" stop-color="#959ca1"/><stop offset="1" stop-color="#5d6368"/></radialGradient>';
    h += '<radialGradient id="bf1g57c" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#e8d9c2"/><stop offset=".6" stop-color="#b39c7e"/><stop offset="1" stop-color="#76654f"/></radialGradient>';
    h += pat('bf1p-no57', 84, '#1f2427', wrapDots(84, s57, function (it, x, y) { var g = ['a', 'b', 'c'][Math.floor(it.q * 3)]; return '<ellipse cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" rx="' + it.r.toFixed(1) + '" ry="' + (it.r * (0.72 + it.q * 0.2)).toFixed(1) + '" transform="rotate(' + it.a.toFixed(0) + ' ' + x.toFixed(1) + ' ' + y.toFixed(1) + ')" fill="url(#bf1g57' + g + ')" stroke="#15191b" stroke-width=".6"/>'; }));
    /* uncompacted native soil */
    var cl = []; for (i = 0; i < 26; i++) cl.push({ x: R() * 90, y: R() * 90, r: 7, rx: 2 + R() * 5, ry: 1.2 + R() * 2.6, c: pick(['#7a5033', '#9b6a45', '#6d462c', '#a77a55']), a: R() * 180 });
    h += pat('bf1p-native', 90, '#875b3a', wrapDots(90, cl, function (it, x, y) { return '<ellipse cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" rx="' + it.rx.toFixed(1) + '" ry="' + it.ry.toFixed(1) + '" fill="' + it.c + '" opacity=".75" transform="rotate(' + it.a.toFixed(0) + ' ' + x.toFixed(1) + ' ' + y.toFixed(1) + ')"/>'; }) + dots(90, 10, 0.9, 1.8, ['#b69c7f', '#cdb592']));
    h += pat('bf1p-conc', 40, '#c9cac5', dots(40, 34, 0.5, 1.4, ['#a9aaa5', '#dcdcd7', '#9a9b96']));
    h += pat('bf1p-asph', 30, '#3b3f43', dots(30, 40, 0.5, 1.2, ['#575c61', '#2b2f32', '#6a6f73']));
    h += '<linearGradient id="bf1sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dbeef3"/><stop offset="1" stop-color="#f5fafb"/></linearGradient>';
    h += '<linearGradient id="bf1gw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd3e6" stop-opacity=".82"/><stop offset="1" stop-color="#2f86ad" stop-opacity=".7"/></linearGradient>';
    h += '<linearGradient id="bf1pipe" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbfcfc"/><stop offset=".55" stop-color="#dfe5e8"/><stop offset="1" stop-color="#aab6bd"/></linearGradient>';
    h += '<linearGradient id="bf1pipeV" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#aab6bd"/><stop offset=".45" stop-color="#fbfcfc"/><stop offset="1" stop-color="#b9c3c9"/></linearGradient>';
    DEFS = h; return h;
  }

  /* ---------- plants (grasses, sedges, small shrubs, tree) ---------- */
  function plant(type, bx, by, R, sc) {
    var h = '', i, n, col;
    var blade = function (len, spread, w, c) { var dx = spread * (R() * 2 - 1), cx = bx + dx * 0.25 + (R() - 0.5) * 4; return '<path d="M' + (bx + (R() - 0.5) * 5).toFixed(1) + ' ' + by.toFixed(1) + 'Q' + cx.toFixed(1) + ' ' + (by - len * 0.65).toFixed(1) + ' ' + (bx + dx).toFixed(1) + ' ' + (by - len).toFixed(1) + '" stroke="' + c + '" stroke-width="' + w.toFixed(2) + '" fill="none" stroke-linecap="round"/>'; };
    if (type === 'grass') { n = 11 + Math.floor(R() * 4); for (i = 0; i < n; i++) h += blade((34 + R() * 26) * sc, 26 * sc, 1.5 + R() * 0.9, ['#6f8f3a', '#86a24a', '#a1b25b', '#5d7d33'][i % 4]); }
    else if (type === 'sedge') { n = 14 + Math.floor(R() * 4); for (i = 0; i < n; i++) h += blade((28 + R() * 18) * sc, 13 * sc, 1.2 + R() * 0.6, ['#3f5f34', '#55753e', '#4a6b39'][i % 3]); for (i = 0; i < 3; i++) { var tx = bx + (R() - 0.5) * 14 * sc, ty = by - (36 + R() * 10) * sc; h += '<path d="M' + tx.toFixed(1) + ' ' + (by).toFixed(1) + 'L' + tx.toFixed(1) + ' ' + ty.toFixed(1) + '" stroke="#5c6b3c" stroke-width="1"/><ellipse cx="' + tx.toFixed(1) + '" cy="' + ty.toFixed(1) + '" rx="1.6" ry="4" fill="#7a5a32"/>'; } }
    else if (type === 'deer') { n = 18; for (i = 0; i < n; i++) h += blade((30 + R() * 22) * sc, 34 * sc, 1.1, ['#8f9a5e', '#a4ab70', '#7f8b52'][i % 3]); for (i = 0; i < 5; i++) h += blade((62 + R() * 14) * sc, 22 * sc, 0.9, '#cbb985'); }
    else if (type === 'shrub') {
      for (i = 0; i < 4; i++) h += '<path d="M' + bx.toFixed(1) + ' ' + by.toFixed(1) + 'Q' + (bx + (i - 1.5) * 4).toFixed(1) + ' ' + (by - 20 * sc).toFixed(1) + ' ' + (bx + (i - 1.5) * 9 * sc).toFixed(1) + ' ' + (by - 30 * sc).toFixed(1) + '" stroke="#5b4630" stroke-width="1.6" fill="none"/>';
      n = 13; for (i = 0; i < n; i++) { var a = Math.PI * (0.05 + 0.9 * R()), rr = (16 + R() * 12) * sc; h += '<circle cx="' + (bx + Math.cos(a) * rr * (R() < 0.5 ? -1 : 1)).toFixed(1) + '" cy="' + (by - 22 * sc - Math.sin(a) * rr * 0.9).toFixed(1) + '" r="' + ((6 + R() * 6) * sc).toFixed(1) + '" fill="' + ['#4f7a3c', '#6b8f45', '#3c6131', '#5d8640'][i % 4] + '"/>'; }
      for (i = 0; i < 5; i++) h += '<circle cx="' + (bx + (R() - 0.5) * 34 * sc).toFixed(1) + '" cy="' + (by - (28 + R() * 22) * sc).toFixed(1) + '" r="1.7" fill="#e8d47a"/>';
    }
    else if (type === 'tree') {
      var top = 34;
      h += '<path d="M' + (bx - 6) + ' ' + by + 'C' + (bx - 4) + ' ' + (by - 60) + ' ' + (bx - 3) + ' ' + (top + 70) + ' ' + (bx - 2) + ' ' + (top + 40) + 'L' + (bx + 3) + ' ' + (top + 40) + 'C' + (bx + 4) + ' ' + (top + 70) + ' ' + (bx + 5) + ' ' + (by - 60) + ' ' + (bx + 7) + ' ' + by + 'Z" fill="#6b4a31"/>';
      h += '<path d="M' + bx + ' ' + (top + 62) + 'Q' + (bx - 26) + ' ' + (top + 44) + ' ' + (bx - 46) + ' ' + (top + 30) + 'M' + bx + ' ' + (top + 56) + 'Q' + (bx + 28) + ' ' + (top + 40) + ' ' + (bx + 50) + ' ' + (top + 28) + '" stroke="#6b4a31" stroke-width="3.2" fill="none" stroke-linecap="round"/>';
      for (i = 0; i < 16; i++) { var aa = R() * Math.PI * 2, rd = R() * 62; h += '<circle cx="' + (bx + Math.cos(aa) * rd).toFixed(1) + '" cy="' + (top + 20 + Math.sin(aa) * rd * 0.42).toFixed(1) + '" r="' + (14 + R() * 13).toFixed(1) + '" fill="' + ['#4b7438', '#5f8a42', '#3d6230', '#6e9a4b'][i % 4] + '" opacity=".95"/>'; }
    }
    return h;
  }
  function roots(type, bx, by, depthPx, R) {
    var h = '', n = type === 'tree' ? 7 : type === 'shrub' ? 5 : 4;
    for (var i = 0; i < n; i++) {
      var d = depthPx * (0.6 + R() * 0.4), x1 = bx + (R() - 0.5) * (type === 'tree' ? 90 : 34), xm = (bx + x1) / 2 + (R() - 0.5) * 14;
      h += '<path d="M' + bx.toFixed(1) + ' ' + (by + 2).toFixed(1) + 'Q' + xm.toFixed(1) + ' ' + (by + d * 0.5).toFixed(1) + ' ' + x1.toFixed(1) + ' ' + (by + d).toFixed(1) + '" stroke="#e2d2ad" stroke-width="' + (type === 'tree' ? 1.6 : 1) + '" fill="none" opacity=".55"/>';
    }
    return h;
  }

  /* ---------- static drawing ---------- */
  var BC = { pass: '#1f8a5b', check: '#c9851a', fail: '#c0392b', info: '#5b7083' }, BG = { pass: '✓', check: '!', fail: '✕', info: 'i' };
  function layout(G, compact) {
    var L = { W: compact ? 480 : 940, H: 640, xL: compact ? 44 : 100, xR: compact ? 374 : 640, wall: 16, yRim: 150, yMax: 540 };
    L.s = Math.min(9, (L.yMax - L.yRim) / Math.max(G.total, 1));
    L.Y = function (e) { return L.yRim + (G.z.rim - e) * L.s; };
    L.run = G.o.edge === 'slope' ? Math.min(compact ? 60 : 95, G.o.slope * (G.P + G.fb) * L.s) : 0;
    L.b0 = L.xL + L.run; L.b1 = L.xR - L.run;
    L.rx1 = L.b1 - (compact ? 24 : 44); L.rx0 = L.rx1 - (compact ? 44 : 62);
    L.dia = G.o.dia * L.s; L.cod = Math.min(G.o.co * L.s, compact ? 30 : 40); /* horizontal not to scale */
    L.cox = L.b0 + (compact ? 14 : 30);
    L.yb = L.Y(G.z.bottom); L.y0 = L.Y(0);
    L.outX = L.xR + L.wall + (compact ? 10 : 50);
    L.dimX = compact ? L.W - 62 : 700; L.labX = 724;
    return L;
  }
  function badgeSvg(x, y, st, r) { r = r || 8; return '<g class="bf1-badge"><circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + BC[st] + '"/><text x="' + x + '" y="' + (y + r * 0.42) + '" text-anchor="middle" font-size="' + (r * 1.25).toFixed(1) + '" font-weight="800" fill="#fff">' + BG[st] + '</text></g>'; }
  function rect(x, y, w, h, fill, extra) { return '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + Math.max(0, w).toFixed(1) + '" height="' + Math.max(0, h).toFixed(1) + '" fill="' + fill + '"' + (extra || '') + '/>'; }

  function build(d, st, compact) {
    var G = geom(d, st), o = G.o, C = checks(d, st), L = layout(G, compact), Y = L.Y, z = G.z, s = L.s, h = '', R = rng(7 + Math.round(G.P * 3 + G.media * 5 + (o.tree ? 1 : 0)));
    var CK = {}; C.forEach(function (c) { CK[c.k] = c; });
    var box = {}, W = L.W, H = L.H;
    var reg = function (k, x, y, w, hh) { (box[k] = box[k] || []).push([x, y, w, hh]); };
    var layer = function (k, top, bot, fill, x0, x1) { var y1 = Y(top), y2 = Y(bot); if (y2 - y1 < 0.01) return ''; reg(k, x0, y1, x1 - x0, y2 - y1); return '<g data-bk="' + k + '">' + rect(x0, y1, x1 - x0, y2 - y1, fill) + '<line x1="' + x0 + '" x2="' + x1 + '" y1="' + y2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="#000" stroke-opacity=".28"/></g>'; };
    h += '<defs>' + defs() + '<clipPath id="bf1cl-lay"><rect x="' + L.b0 + '" y="' + L.y0 + '" width="' + (L.b1 - L.b0) + '" height="' + (L.yb - L.y0) + '"/></clipPath><clipPath id="bf1cl-med"><rect x="' + L.b0 + '" y="' + Y(z.mulchBot) + '" width="' + (L.b1 - L.b0) + '" height="' + (Y(z.mediaBot) - Y(z.mulchBot)) + '"/></clipPath></defs>';
    /* sky + cloud */
    h += rect(0, 0, W, Y(z.rim), 'url(#bf1sky)');
    h += '<g id="bf1cloud" opacity="0"><ellipse cx="' + (compact ? 150 : 230) + '" cy="26" rx="120" ry="22" fill="#9fb4bf"/><ellipse cx="' + (compact ? 230 : 330) + '" cy="20" rx="90" ry="20" fill="#aebfc8"/><ellipse cx="' + (compact ? 330 : 470) + '" cy="28" rx="130" ry="20" fill="#9fb4bf"/></g>';
    /* native soil everywhere below grade */
    h += '<g data-bk="native">' + rect(0, Y(z.rim), W, H - Y(z.rim), 'url(#bf1p-native)') + '</g>';
    reg('native', 0, L.yb, W, H - L.yb);
    /* open air inside the basin above the mulch */
    h += o.edge === 'slope' ? '<path d="M' + L.xL + ' ' + Y(z.rim) + 'L' + L.b0 + ' ' + L.y0 + 'L' + L.b1 + ' ' + L.y0 + 'L' + L.xR + ' ' + Y(z.rim) + 'Z" fill="#f1f8fa"/>' : rect(L.xL, Y(z.rim), L.xR - L.xL, L.y0 - Y(z.rim), '#f1f8fa');
    /* street / gutter on the inflow side */
    var stX1 = o.edge === 'curb' ? L.xL - L.wall : L.xL, ast = Math.max(12, 3 * s);
    h += '<g data-bk="inlet">' + rect(0, Y(z.rim), stX1 - 36, ast, 'url(#bf1p-asph)') + rect(0, Y(z.rim) + ast, stX1 - 36, Math.max(10, 4 * s), '#8e8a80') + rect(stX1 - 36, Y(z.rim), 36, ast + 6, 'url(#bf1p-conc)') + '</g>';
    reg('inlet', 0, Y(z.rim) - 20, stX1 + 50, 40);
    /* right-hand ground / sidewalk */
    h += rect(L.xR + (o.edge === 'curb' ? L.wall : 0), Y(z.rim), W - L.xR, Math.max(10, 4 * s), 'url(#bf1p-conc)');
    /* layers */
    h += layer('mulch', 0, z.mulchBot, 'url(#bf1p-mulch)', L.b0, L.b1);
    h += layer('media', z.mulchBot, z.mediaBot, 'url(#bf1p-media)', L.b0, L.b1);
    h += layer('sand', z.mediaBot, z.sandBot, 'url(#bf1p-sand)', L.b0, L.b1);
    h += layer('no8', z.sandBot, z.no8Bot, 'url(#bf1p-no8)', L.b0, L.b1);
    h += layer('no57', z.no8Bot, z.invert, 'url(#bf1p-no57)', L.b0, L.b1);
    h += layer('below', z.invert, z.bottom, 'url(#bf1p-no57)', L.b0, L.b1);
    /* slopes (3H:1V option) or concrete planter walls */
    if (o.edge === 'slope') {
      h += '<g data-bk="slope"><path d="M' + L.xL + ' ' + Y(z.rim) + 'L' + L.b0 + ' ' + L.y0 + 'L' + L.b0 + ' ' + (L.y0 + 4) + 'L' + L.xL + ' ' + (Y(z.rim) + 4) + 'Z" fill="url(#bf1p-mulch)"/><path d="M' + L.b1 + ' ' + L.y0 + 'L' + L.xR + ' ' + Y(z.rim) + 'L' + L.xR + ' ' + (Y(z.rim) + 4) + 'L' + L.b1 + ' ' + (L.y0 + 4) + 'Z" fill="url(#bf1p-mulch)"/>' +
        '<text x="' + ((L.xR + L.b1) / 2 + 6) + '" y="' + ((Y(z.rim) + L.y0) / 2 - 8) + '" font-size="12" font-weight="700" fill="#2d4250" text-anchor="middle">' + o.slope + 'H:1V</text></g>';
      h += '<text x="' + ((L.xL + L.b0) / 2 - 4) + '" y="' + ((Y(z.rim) + L.y0) / 2 - 8) + '" font-size="12" font-weight="700" fill="#2d4250" text-anchor="middle">' + o.slope + 'H:1V</text>';
      reg('slope', L.xL, Y(z.rim), L.run, L.y0 - Y(z.rim)); reg('slope', L.b1, Y(z.rim), L.run, L.y0 - Y(z.rim));
    } else {
      h += '<g data-bk="inlet">' + rect(L.xL - L.wall, Y(z.rim), L.wall, L.yb - Y(z.rim) + 8, 'url(#bf1p-conc)', ' stroke="#8f908b" stroke-width=".8"') +
        '<rect x="' + (L.xL - L.wall) + '" y="' + (Y(z.rim) - 6 * s) + '" width="' + L.wall + '" height="' + (6 * s) + '" fill="none" stroke="#7e8a90" stroke-dasharray="3 3"/></g>';
      h += rect(L.xR, Y(z.rim), L.wall, L.yb - Y(z.rim) + 8, 'url(#bf1p-conc)', ' stroke="#8f908b" stroke-width=".8"');
      /* energy dissipation cobbles at the curb cut */
      for (var cb = 0; cb < 5; cb++) h += '<ellipse cx="' + (L.xL + 8 + cb * 9 + R() * 3).toFixed(1) + '" cy="' + (L.y0 - 3 - (cb % 2) * 2).toFixed(1) + '" rx="' + (6 + R() * 2).toFixed(1) + '" ry="4.2" fill="url(#bf1g57b)" stroke="#3d4347" stroke-width=".6"/>';
    }
    /* liner */
    if (o.liner) { h += '<g data-bk="liner"><path d="M' + (L.b0 + 1.5) + ' ' + L.y0 + 'V' + (L.yb + 1.5) + 'H' + (L.b1 - 1.5) + 'V' + L.y0 + '" stroke="#18232b" stroke-width="4" fill="none"/></g>'; reg('liner', L.b0, L.yb - 4, L.b1 - L.b0, 8); }
    /* infiltration / seepage particle layers (animated) */
    h += '<g id="bf1perc" clip-path="url(#bf1cl-lay)"></g><g id="bf1seep"></g>';
    /* underdrain + cleanout */
    var py0 = Y(z.invert + o.dia), py1 = Y(z.invert), pmid = (py0 + py1) / 2;
    h += '<g data-bk="ud">' + rect(L.cox, py0, L.rx0 - L.cox, py1 - py0, 'url(#bf1pipe)', ' stroke="#6f7f88" stroke-width="1"');
    for (var px = L.cox + L.cod + 8; px < L.rx0 - 8; px += 13) h += rect(px, pmid + (py1 - py0) * 0.12, 6, Math.max(1.2, (py1 - py0) * 0.08), '#33424b');
    h += '<line id="bf1udflow" x1="' + (L.cox + L.cod) + '" x2="' + L.rx0 + '" y1="' + (pmid + (py1 - py0) * 0.22) + '" y2="' + (pmid + (py1 - py0) * 0.22) + '" stroke="#3aa6d0" stroke-width="' + Math.max(2, (py1 - py0) * 0.18).toFixed(1) + '" stroke-dasharray="9 12" stroke-linecap="round" opacity="0"/></g>';
    reg('ud', L.cox, py0, L.rx0 - L.cox, py1 - py0);
    var capY = Y(2);
    h += '<g data-bk="co">' + rect(L.cox, capY, L.cod, py1 - capY, 'url(#bf1pipeV)', ' stroke="#6f7f88" stroke-width="1"') + rect(L.cox - 3, capY - 7, L.cod + 6, 8, '#56636b', ' rx="2"') + '<circle cx="' + (L.cox + L.cod / 2) + '" cy="' + (capY - 3) + '" r="1.8" fill="#d9b44a"/></g>';
    reg('co', L.cox - 3, capY - 7, L.cod + 6, py1 - capY + 7);
    /* overflow riser with grate, outlet pipe */
    var rt = Y(z.crest), rb = L.yb + 8, ow = 6;
    var oy0 = Y(z.bottom + 1 + o.dia), oy1 = Y(z.bottom + 1);
    h += '<g data-bk="riser">' + rect(L.rx0, rt, L.rx1 - L.rx0, rb - rt, 'url(#bf1p-conc)', ' stroke="#8f908b" stroke-width=".8"') + rect(L.rx0 + ow, rt + 6, L.rx1 - L.rx0 - 2 * ow, rb - rt - 6 - ow, '#2a3338') +
      '<rect id="bf1pool" x="' + (L.rx0 + ow) + '" y="' + (rb - ow - 6) + '" width="' + (L.rx1 - L.rx0 - 2 * ow) + '" height="6" fill="#3a9cc6" opacity=".75"/><g id="bf1fall" opacity="0">';
    for (var fl = 0; fl < 4; fl++) { var fx = L.rx0 + ow + 5 + fl * (L.rx1 - L.rx0 - 2 * ow - 10) / 3; h += '<line x1="' + fx.toFixed(1) + '" x2="' + fx.toFixed(1) + '" y1="' + (rt + 8) + '" y2="' + (rb - ow - 4) + '" stroke="#7fd0ea" stroke-width="2.2" stroke-dasharray="7 9"/>'; }
    h += '</g>' + rect(L.rx0 - 3, rt - 4, L.rx1 - L.rx0 + 6, 6, '#3b464d');
    for (var gx = L.rx0; gx < L.rx1; gx += 6) h += rect(gx, rt - 4, 2, 6, '#7b878e');
    h += '</g>';
    reg('riser', L.rx0 - 3, rt - 4, L.rx1 - L.rx0 + 6, rb - rt + 4);
    h += '<g data-bk="riser">' + rect(L.rx1, oy0, L.outX - L.rx1, oy1 - oy0, 'url(#bf1pipe)', ' stroke="#6f7f88" stroke-width="1"') + '<line id="bf1outflow" x1="' + L.rx1 + '" x2="' + L.outX + '" y1="' + ((oy0 + oy1) / 2 + (oy1 - oy0) * 0.2) + '" y2="' + ((oy0 + oy1) / 2 + (oy1 - oy0) * 0.2) + '" stroke="#3aa6d0" stroke-width="' + Math.max(2, (oy1 - oy0) * 0.2).toFixed(1) + '" stroke-dasharray="9 12" stroke-linecap="round" opacity="0"/>' +
      '<path d="M' + (L.outX + 2) + ' ' + ((oy0 + oy1) / 2) + 'l9 0m-4 -4l4 4-4 4" stroke="#2d4250" stroke-width="1.6" fill="none"/></g>';
    /* water (animated) */
    h += '<path id="bf1water" fill="url(#bf1gw)" d=""/><path id="bf1wave" d="" stroke="#e8f8fd" stroke-width="1.4" fill="none" opacity=".9"/><g id="bf1rip"></g>';
    /* roots + plants */
    var x0 = L.cox + L.cod + (compact ? 16 : 26), x1 = L.rx0 - (compact ? 10 : 18), types = [], medIn = G.media, treeOk = o.tree && medIn >= 36, sc = compact ? 0.85 : 1;
    var nP = Math.max(3, Math.floor((x1 - x0) / (compact ? 52 : 64)));
    for (var i = 0; i < nP; i++) types.push(medIn >= 24 && i % 3 === 1 ? 'shrub' : ['grass', 'sedge', 'deer'][i % 3]);
    var plants = [], ph = '', rh = '';
    var rootIn = { grass: 12, sedge: 12, deer: 18, shrub: 24, tree: 36 };
    types.forEach(function (t, i) { var bx = x0 + (i + 0.5) * (x1 - x0) / nP + (R() - 0.5) * 10; plants.push({ t: t, x: bx }); });
    if (treeOk) plants.splice(Math.floor(plants.length / 2), 1, { t: 'tree', x: (x0 + x1) / 2 });
    plants.forEach(function (p, i) { rh += roots(p.t, p.x, L.y0, Math.min(medIn, rootIn[p.t]) * s, R); ph += '<g class="bf1-plant" data-bk="plants" data-i="' + i + '">' + plant(p.t, p.x, L.y0 + 1, R, sc) + '</g>'; });
    h += '<g clip-path="url(#bf1cl-med)">' + rh + '</g><g id="bf1plants">' + ph + '</g>';
    reg('plants', x0 - 20, L.y0 - 70, x1 - x0 + 40, 70);
    /* inflow + rain (animated) */
    var inPath = o.edge === 'curb' ? 'M0 ' + (Y(z.rim) - 1.5) + 'H' + (L.xL - L.wall + 2) + 'Q' + (L.xL + 6) + ' ' + (Y(z.rim) - 1) + ' ' + (L.xL + 14) + ' ' + (L.y0 - 4) : 'M0 ' + (Y(z.rim) - 1.5) + 'H' + L.xL + 'L' + L.b0 + ' ' + (L.y0 - 2);
    h += '<path id="bf1inflow" d="' + inPath + '" stroke="#55b8dc" stroke-width="3.2" fill="none" stroke-dasharray="10 8" stroke-linecap="round" opacity="0"/>';
    h += '<g id="bf1rain" opacity="0"></g>';
    /* crest / freeboard reference lines */
    h += '<line x1="' + L.b0 + '" x2="' + L.rx0 + '" y1="' + Y(z.crest) + '" y2="' + Y(z.crest) + '" stroke="#0b5c86" stroke-width="1" stroke-dasharray="6 4" opacity=".7"/>';
    h += '<line x1="' + (o.edge === 'curb' ? L.xL : L.xL) + '" x2="' + L.xR + '" y1="' + Y(z.rim) + '" y2="' + Y(z.rim) + '" stroke="#5b7083" stroke-width="1" stroke-dasharray="2 4" opacity=".8"/>';
    reg('fb', L.b0, Y(z.rim), L.xR - L.b0, Math.max(6, Y(z.crest) - Y(z.rim)));
    reg('pond', L.b0, Y(z.crest), L.rx0 - L.b0, Math.max(6, L.y0 - Y(z.crest)));
    /* callouts in the drawing */
    var tag = function (x, y, txt, k, anchor, st2) { var fs = compact ? 13 : 13.5, w = txt.length * fs * 0.56 + (st2 ? 24 : 13), xx = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x; return '<g class="bf1-tag" data-bk="' + k + '"><rect x="' + xx.toFixed(1) + '" y="' + (y - 13) + '" width="' + w.toFixed(1) + '" height="21" rx="10.5" fill="#fff" fill-opacity=".93" stroke="#c9d6dc"/>' + (st2 ? badgeSvg(xx + 11, y - 2.5, st2, 7) : '') + '<text x="' + (xx + (st2 ? 22 : 6.5)).toFixed(1) + '" y="' + (y + 2.5) + '" font-size="' + fs + '" font-weight="700" fill="#173246">' + esc(txt) + '</text></g>'; };
    var leader = function (x1_, y1_, x2_, y2_) { return '<path d="M' + x1_.toFixed(1) + ' ' + y1_.toFixed(1) + 'L' + x2_.toFixed(1) + ' ' + y2_.toFixed(1) + '" stroke="#3b5566" stroke-width="1"/><circle cx="' + x2_.toFixed(1) + '" cy="' + y2_.toFixed(1) + '" r="2.2" fill="#3b5566"/>'; };
    var topY = Math.min(Y(z.rim) - 26, 118);
    var coTxt = 'Cleanout Ø' + fi(o.co), rsTxt = compact ? 'Overflow riser' : 'Overflow riser + grate', tw = function (t) { return t.length * (compact ? 13 : 13.5) * 0.56 + 24; };
    var coY = compact ? topY - 30 : (L.cox - 6 + tw(coTxt) + 8 > (L.rx0 + L.rx1) / 2 + 8 - tw(rsTxt)) ? topY - 26 : topY;
    h += leader(L.cox + L.cod / 2, coY + 6, L.cox + L.cod / 2, capY - 8) + tag(L.cox - 6, coY, coTxt, 'co', 'start', CK.co.s);
    h += leader((L.rx0 + L.rx1) / 2, topY + 6, (L.rx0 + L.rx1) / 2, rt - 6) + tag((L.rx0 + L.rx1) / 2 + 8, topY, rsTxt, 'riser', 'end', CK.riser.s);
    h += tag(8, Y(z.rim) - 12, o.edge === 'curb' ? 'Curb-cut inflow' : 'Sheet flow', 'inlet', 'start');
    var udY = L.yb + 26;
    h += leader(L.cox + L.cod + 40, udY - 8, L.cox + L.cod + 40, py1 - 2) + tag(L.cox + L.cod + 30, udY + 6, 'Ø' + fi(o.dia) + ' perforated underdrain', 'ud', 'start', CK.ud.s);
    /* footprint */
    var fy = Math.min(H - 20, L.yb + 62);
    h += '<g data-bk="fp"><path d="M' + (L.b0 + 6) + ' ' + fy + 'H' + (L.b1 - 6) + 'M' + (L.b0 + 12) + ' ' + (fy - 5) + 'L' + (L.b0 + 6) + ' ' + fy + 'L' + (L.b0 + 12) + ' ' + (fy + 5) + 'M' + (L.b1 - 12) + ' ' + (fy - 5) + 'L' + (L.b1 - 6) + ' ' + fy + 'L' + (L.b1 - 12) + ' ' + (fy + 5) + '" stroke="#fff" stroke-width="1.6" fill="none"/></g>';
    h += tag((L.b0 + L.b1) / 2, fy + 4, 'Footprint ' + CK.fp.val + (compact ? '' : ' (' + d.FP.src + ')'), 'fp', 'middle', CK.fp.s);
    reg('fp', L.b0, fy - 14, L.b1 - L.b0, 24);
    if (o.liner && !compact) h += tag(L.b1 - 4, L.yb + 18, 'Impermeable liner', 'liner', 'end', 'info');
    h += '<text x="' + (compact ? W - 10 : L.labX - 22) + '" y="' + (H - 10) + '" font-size="12" font-weight="600" fill="#f6ead9" text-anchor="end" data-bk="native">' + (o.liner ? 'Native soil (no infiltration: lined)' : 'Uncompacted native soil') + '</text>';
    /* vertical scale bar */
    var sbx = compact ? 16 : 22, sbt = L.yb - 12 * s;
    h += '<g><rect x="' + (sbx - 4) + '" y="' + (sbt - 4) + '" width="' + (compact ? 40 : 46) + '" height="' + (12 * s + 22) + '" rx="4" fill="#fff" fill-opacity=".85"/>' + rect(sbx, sbt, 5, 6 * s, '#173246') + rect(sbx, sbt + 6 * s, 5, 6 * s, '#fff', ' stroke="#173246"') + '<text x="' + (sbx + 9) + '" y="' + (sbt + 10) + '" font-size="10.5" font-weight="700" fill="#173246">12 in</text><text x="' + (sbx - 1) + '" y="' + (L.yb + 13) + '" font-size="9" fill="#173246">vert. scale</text></g>';
    /* dimension chain */
    var segs = [['fb', 'Freeboard', z.rim, z.crest, CK.fb], ['pond', 'Ponding', z.crest, 0, CK.pond], ['mulch', 'Mulch', 0, z.mulchBot, CK.mulch], ['media', 'Media', z.mulchBot, z.mediaBot, CK.media], ['sand', 'C33 sand', z.mediaBot, z.sandBot, CK.sand], ['no8', 'No. 8 stone', z.sandBot, z.no8Bot, CK.sand], ['no57', 'No. 57 above inv.', z.no8Bot, z.invert, CK.no57], ['below', 'No. 57 below inv.', z.invert, z.bottom, CK.below]];
    var crit = { fb: '≥ 2 in', pond: (o.walk ? '4' : '6') + '–12 in', mulch: '≥ 3 in', media: o.tree ? '≥ 36 in (tree)' : '≥ 18 in · 24 typ.', sand: '3 in · no fabric', no8: '3 in', no57: '12 in typ. total', below: '≥ 3 in' };
    var srcS = { fb: 'section input', pond: d.P.src.replace('Line', 'L'), mulch: 'section input', media: (o.inc ? d.M.src.replace('Line', 'L') + ' − 6' : d.M.src.replace('Line', 'L')), sand: 'fixed', no8: o.inc ? 'in ' + d.A7.src.replace('Line', 'L') : 'fixed', no57: o.inc ? d.A7.src.replace('Line', 'L') + ' − 3' : d.A7.src.replace('Line', 'L'), below: d.A8.src.replace('Line', 'L') };
    var dx = L.dimX, ext = L.xR + (o.edge === 'curb' ? L.wall : 0) + 4;
    if (!compact) h += rect(L.labX - 12, 0, W - L.labX + 12, H, '#f7fafb', ' fill-opacity=".93"') + '<line x1="' + (L.labX - 12) + '" x2="' + (L.labX - 12) + '" y1="0" y2="' + H + '" stroke="#d8e1e5"/>';
    h += '<g class="bf1-dims"><line x1="' + dx + '" x2="' + dx + '" y1="' + Y(z.rim) + '" y2="' + L.yb + '" stroke="#173246" stroke-width="1.2"/>';
    var bnds = [z.rim, z.crest, 0, z.mulchBot, z.mediaBot, z.sandBot, z.no8Bot, z.invert, z.bottom];
    bnds.forEach(function (e) { var y = Y(e); h += '<line x1="' + ext + '" x2="' + (dx + 7) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="#173246" stroke-width=".7" stroke-dasharray="' + (compact ? '2 3' : '2 3') + '" opacity=".55"/><path d="M' + (dx - 5) + ' ' + (y + 5).toFixed(1) + 'L' + (dx + 5) + ' ' + (y - 5).toFixed(1) + '" stroke="#173246" stroke-width="1.4"/>'; });
    var gap = compact ? 30 : 40, items = segs.map(function (sg, i) { return { sg: sg, n: i + 1, want: (Y(sg[2]) + Y(sg[3])) / 2 }; });
    var ys = items.map(function (it) { return it.want; }), top0 = compact ? 30 : 40, bot0 = H - 12;
    for (i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i], ys[i - 1] + gap);
    if (ys[ys.length - 1] > bot0) { ys[ys.length - 1] = bot0; for (i = ys.length - 2; i >= 0; i--) ys[i] = Math.min(ys[i], ys[i + 1] - gap); }
    if (ys[0] < top0) { var sh = top0 - ys[0]; ys = ys.map(function (y) { return y + sh; }); }
    items.forEach(function (it, i) {
      var sg = it.sg, ck = sg[4], th = sg[2] - sg[3], ly = ys[i], k = sg[0];
      if (compact) {
        var mx = W - 18;
        h += '<g class="bf1-dl" data-bk="' + k + '"><path d="M' + (dx + 6) + ' ' + it.want.toFixed(1) + 'L' + (mx - 12) + ' ' + ly.toFixed(1) + '" stroke="#3b5566" stroke-width=".9" fill="none"/><circle cx="' + mx + '" cy="' + ly.toFixed(1) + '" r="11" fill="' + BC[ck.s] + '"/><text x="' + mx + '" y="' + (ly + 4).toFixed(1) + '" text-anchor="middle" font-size="11.5" font-weight="800" fill="#fff">' + it.n + '</text><text x="' + (dx - 8) + '" y="' + (it.want + 4).toFixed(1) + '" text-anchor="end" font-size="11" font-weight="800" fill="#fff" stroke="#173246" stroke-width="2.6" paint-order="stroke">' + r2(th) + '″</text></g>';
      } else {
        h += '<g class="bf1-dl" data-bk="' + k + '"><path d="M' + (dx + 7) + ' ' + it.want.toFixed(1) + 'C' + (dx + 18) + ' ' + it.want.toFixed(1) + ' ' + (L.labX - 16) + ' ' + ly.toFixed(1) + ' ' + (L.labX - 4) + ' ' + ly.toFixed(1) + '" stroke="#3b5566" stroke-width=".9" fill="none"/>' + badgeSvg(L.labX + 8, ly - 5, ck.s, 8.5) +
          '<text x="' + (L.labX + 22) + '" y="' + (ly).toFixed(1) + '" font-size="15.5" font-weight="800" fill="#102a43">' + esc(sg[1]) + ' ' + esc(fi(th)) + '</text><text x="' + (L.labX + 22) + '" y="' + (ly + 15).toFixed(1) + '" font-size="12" fill="#3f5868">' + esc(srcS[k] + ' · ' + crit[k]) + '</text></g>';
      }
    });
    h += '</g>';
    h += '<text x="' + (compact ? 8 : 12) + '" y="' + (compact ? 16 : 18) + '" font-size="' + (compact ? 10 : 11) + '" font-weight="800" letter-spacing=".12em" fill="#3b6a7c">' + (compact ? 'BF-1 SECTION (ILLUSTRATIVE)' : 'BF-1 BIOFILTRATION · LONGITUDINAL SECTION (ILLUSTRATIVE)') + '</text>';
    h += '<rect id="bf1hl" x="0" y="0" width="0" height="0" fill="#18a6a5" fill-opacity=".16" stroke="#18a6a5" stroke-width="2" rx="3" pointer-events="none" opacity="0"/>';
    return { svg: h, G: G, L: L, C: C, box: box, plants: plants, segs: segs, crit: crit, srcS: srcS };
  }

  /* ---------- animation ---------- */
  var T = 18, sm = function (a, b, x) { var u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
  var A = { t: 9.2, playing: true, reduce: false, vis: true, last: 0, raf: 0, drops: [], parts: [], seeps: [], rips: [], phase: '' };
  var M = null, node = null, cfg = {}, sig = '', data = null, compact = false, pinned = null;
  function svgEl(tag, attrs, parent) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function staticT() { return opt(cfg.store).storm === 'large' ? 8 : 9.2; }
  function levelAt(t, G) {
    var P = G.P, o = G.o;
    if (o.storm === 'large') { var hd = Math.min(G.fb * 0.6, 1.5); if (t < 1.5) return 0; if (t < 5.5) return P * sm(1.5, 5.5, t); if (t < 11.5) return P + hd * sm(5.5, 6.5, t) * (1 - sm(10.5, 11.5, t)); return P * (1 - sm(11.5, 16, t)); }
    if (t < 1.5) return 0; if (t < 7.5) return P * sm(1.5, 7.5, t); if (t < 11) return P; return P * (1 - sm(11, 16, t));
  }
  function initAnim() {
    var L = M.L, G = M.G, R = rng(99), sv = node.querySelector('svg');
    var rain = sv.querySelector('#bf1rain'), perc = sv.querySelector('#bf1perc'), seep = sv.querySelector('#bf1seep'), rip = sv.querySelector('#bf1rip');
    A.drops = []; var xMax = L.xR + L.wall + (compact ? 20 : 50);
    for (var i = 0; i < (compact ? 26 : 38); i++) { var x = R() * xMax, dr = { x: x, y: R() * L.yRim * 1.6 - 40, v: 360 + R() * 160, n: svgEl('line', { x1: x, x2: x - 2, y1: 0, y2: 11, stroke: '#4d9fc4', 'stroke-width': 1.4, 'stroke-linecap': 'round', opacity: 0.8 }, rain) }; A.drops.push(dr); }
    A.parts = []; var yTop = L.y0 + 2, yEnd = L.Y(G.z.invert + G.o.dia / 2);
    for (i = 0; i < (compact ? 20 : 30); i++) A.parts.push({ x: L.b0 + 6 + R() * (L.b1 - L.b0 - 12), y: yTop + R() * (yEnd - yTop), n: svgEl('circle', { r: 2.1, fill: '#9fe0f5', stroke: '#1d6f93', 'stroke-width': 0.6, opacity: 0 }, perc) });
    A.yTop = yTop; A.yEnd = yEnd; A.ySand = L.Y(G.z.sandBot);
    A.seeps = []; var seepOn = G.inf > 0 && !G.o.liner;
    if (seepOn) for (i = 0; i < 10; i++) A.seeps.push({ x: L.b0 + 10 + R() * (L.b1 - L.b0 - 20), y: L.yb + R() * 60, n: svgEl('circle', { r: 1.9, fill: '#9fe0f5', stroke: '#1d6f93', 'stroke-width': 0.5, opacity: 0 }, seep) });
    A.rips = []; for (i = 0; i < 4; i++) A.rips.push({ life: 0, x: 0, y: 0, n: svgEl('ellipse', { rx: 0, ry: 0, fill: 'none', stroke: '#e8f8fd', 'stroke-width': 1, opacity: 0 }, rip) });
    A.R = R; A.el = { water: sv.querySelector('#bf1water'), wave: sv.querySelector('#bf1wave'), rain: rain, cloud: sv.querySelector('#bf1cloud'), inflow: sv.querySelector('#bf1inflow'), ud: sv.querySelector('#bf1udflow'), out: sv.querySelector('#bf1outflow'), pool: sv.querySelector('#bf1pool'), fall: sv.querySelector('#bf1fall'), plants: [].slice.call(sv.querySelectorAll('.bf1-plant')) };
    A.off = 0;
  }
  function draw(t, dt) {
    if (!M) return;
    var L = M.L, G = M.G, Y = L.Y, o = G.o, el = A.el, R = A.R;
    var rain = sm(0, 1, t) * (1 - sm(9, 10.2, t)), inflow = sm(0.4, 1.4, t) * (1 - sm(9.4, 10.8, t));
    var lev = levelAt(t, G), perc = sm(2, 3.5, t) * (1 - sm(15.5, 17.5, t)), out = sm(2.8, 4.3, t) * (1 - sm(16.3, 18, t));
    var over = o.storm === 'large' ? sm(5.5, 6.5, t) * (1 - sm(10.5, 11.5, t)) : 0, seep = G.inf > 0 && !o.liner ? perc : 0;
    A.off -= dt * 46;
    el.cloud.setAttribute('opacity', (rain * 0.85).toFixed(2));
    el.rain.setAttribute('opacity', rain > 0.02 ? 1 : 0);
    var hasW = lev > 0.05, yl = Y(lev);
    var xl = o.edge === 'slope' ? L.b0 - (L.b0 - L.xL) * Math.min(1, lev / Math.max(0.01, G.P + G.fb)) : L.xL;
    var xr = o.edge === 'slope' ? L.b1 + (L.xR - L.b1) * Math.min(1, lev / Math.max(0.01, G.P + G.fb)) : L.xR;
    /* rain + ripples */
    A.drops.forEach(function (d) {
      if (dt) d.y += d.v * dt;
      var inB = d.x > L.xL && d.x < L.xR, g = inB ? (hasW && d.x > xl && d.x < xr && (d.x < L.rx0 || d.x > L.rx1) ? yl : (d.x > L.rx0 && d.x < L.rx1 ? Y(G.z.crest) - 4 : L.y0)) : Y(G.z.rim);
      if (d.y > g) {
        if (dt && hasW && inB && rain > 0.3 && g === yl && R() < 0.25) { var f = A.rips.filter(function (r) { return r.life <= 0; })[0]; if (f) { f.life = 1; f.x = d.x; f.y = yl; } }
        d.y = dt ? -20 - R() * 140 : d.y; if (!dt) d.y = g - 12 - R() * (g - 30);
      }
      d.n.setAttribute('transform', 'translate(' + (d.x - d.x).toFixed(0) + ' ' + d.y.toFixed(1) + ')');
    });
    A.rips.forEach(function (r) { if (r.life > 0) { if (dt) r.life -= dt * 1.2; var k = 1 - Math.max(0, r.life); r.n.setAttribute('cx', r.x.toFixed(1)); r.n.setAttribute('cy', r.y.toFixed(1)); r.n.setAttribute('rx', (2 + k * 13).toFixed(1)); r.n.setAttribute('ry', (0.6 + k * 2.4).toFixed(1)); r.n.setAttribute('opacity', (Math.max(0, r.life) * 0.8 * (hasW ? 1 : 0)).toFixed(2)); } else r.n.setAttribute('opacity', 0); });
    /* inflow */
    el.inflow.setAttribute('opacity', (inflow * 0.95).toFixed(2)); el.inflow.setAttribute('stroke-dashoffset', A.off.toFixed(1));
    /* ponding water with ripples */
    if (hasW) {
      var amp = 0.8 + rain * 0.9 + over * 0.8, segs = [[xl, L.rx0], [L.rx1, xr]], dW = '', dV = '';
      segs.forEach(function (sg) {
        if (sg[1] - sg[0] < 2) return;
        var pts = [];
        for (var x = sg[0]; x <= sg[1] + 0.1; x += 10) { var xx = Math.min(x, sg[1]); pts.push(xx.toFixed(1) + ' ' + (yl + Math.sin(xx * 0.045 + t * 2.3) * amp + Math.sin(xx * 0.12 - t * 3.4) * amp * 0.45).toFixed(1)); if (xx === sg[1]) break; }
        var bl = o.edge === 'slope' ? (sg[0] === xl ? L.b0 : sg[0]) : sg[0], br = o.edge === 'slope' ? (sg[1] === xr ? L.b1 : sg[1]) : sg[1];
        dV += 'M' + pts.join('L');
        dW += 'M' + pts.join('L') + 'L' + br.toFixed(1) + ' ' + L.y0.toFixed(1) + 'L' + bl.toFixed(1) + ' ' + L.y0.toFixed(1) + 'Z';
      });
      el.water.setAttribute('d', dW); el.wave.setAttribute('d', dV);
    } else { el.water.setAttribute('d', ''); el.wave.setAttribute('d', ''); }
    /* percolation through media and stone */
    A.parts.forEach(function (p) {
      if (dt && perc > 0.02) { p.y += (p.y < A.ySand ? 13 : 30) * (L.s / 8 + 0.4) * dt * (0.7 + perc * 0.6); if (p.y > A.yEnd) { p.y = A.yTop + R() * 4; p.x = L.b0 + 6 + R() * (L.b1 - L.b0 - 12); } }
      p.n.setAttribute('cx', p.x.toFixed(1)); p.n.setAttribute('cy', p.y.toFixed(1)); p.n.setAttribute('opacity', (perc * 0.9).toFixed(2));
    });
    A.seeps.forEach(function (p) {
      if (dt && seep > 0.02) { p.y += (8 + 46 * Math.min(1, G.inf)) * dt; if (p.y > L.yb + 64) p.y = L.yb + 1; }
      var fade = 1 - (p.y - L.yb) / 64;
      p.n.setAttribute('cx', p.x.toFixed(1)); p.n.setAttribute('cy', p.y.toFixed(1)); p.n.setAttribute('opacity', (seep * 0.85 * Math.max(0, fade)).toFixed(2));
    });
    /* underdrain, riser, outlet */
    el.ud.setAttribute('opacity', (out * 0.95).toFixed(2)); el.ud.setAttribute('stroke-dashoffset', (A.off * 0.8).toFixed(1));
    var oo = Math.max(out * 0.9, over); el.out.setAttribute('opacity', oo.toFixed(2)); el.out.setAttribute('stroke-dashoffset', (A.off * (1 + over)).toFixed(1));
    var ph = 4 + 10 * Math.max(out * 0.6, over); el.pool.setAttribute('height', ph.toFixed(1)); el.pool.setAttribute('y', (L.yb + 8 - 6 - ph).toFixed(1));
    el.fall.setAttribute('opacity', over.toFixed(2)); [].forEach.call(el.fall.children, function (c) { c.setAttribute('stroke-dashoffset', (A.off * 2.4).toFixed(1)); });
    /* plants sway (stronger in the storm) */
    el.plants.forEach(function (n, i) { var p = M.plants[i], amp2 = (p.t === 'tree' ? 0.45 : p.t === 'shrub' ? 0.9 : 1.8) * (1 + rain * 0.9); n.setAttribute('transform', 'rotate(' + (Math.sin(t * (1.1 + (i % 3) * 0.23) + i * 1.7) * amp2).toFixed(2) + ' ' + p.x.toFixed(1) + ' ' + L.y0.toFixed(1) + ')'); });
    /* caption */
    var ph2 = over > 0.3 ? 'Overflow: water above the ponding depth spills into the riser grate' : rain > 0.1 && lev < G.P * 0.95 ? 'Rain and inflow: ponding rising toward ' + fi(G.P) : lev >= G.P * 0.95 && t < 11.5 ? 'Ponding at the full ' + fi(G.P) + ' depth; filtering through the media' : lev > 0.05 ? 'Drawdown: water filters through the media to the underdrain' + (seep ? ' and the native soil' : '') : out > 0.1 ? 'Underdrain still draining' : 'Dry weather';
    if (ph2 !== A.phase) { A.phase = ph2; var c = node.querySelector('.bf1-phase'); if (c) c.textContent = ph2; }
  }
  function running() { return A.playing && A.vis && !document.hidden && node && node.isConnected; }
  function loop(ts) {
    A.raf = 0; if (!running()) return;
    if (!A.last) A.last = ts;
    var dt = (ts - A.last) / 1000;
    if (dt >= 0.032) { A.last = ts; dt = Math.min(dt, 0.1); A.t = (A.t + dt) % T; draw(A.t, dt); }
    A.raf = requestAnimationFrame(loop);
  }
  function kick() { if (!A.raf && running()) { A.last = 0; A.raf = requestAnimationFrame(loop); } }
  function setPlay(b) { A.playing = b; var btn = node && node.querySelector('[data-bf="play"]'); if (btn) { btn.setAttribute('aria-pressed', b ? 'true' : 'false'); btn.innerHTML = b ? '<span aria-hidden="true">❚❚</span> Pause' : '<span aria-hidden="true">▶</span> Play animation'; } if (b) kick(); else if (A.raf) { cancelAnimationFrame(A.raf); A.raf = 0; } }

  /* ---------- UI ---------- */
  var TIPMAP = { no8: 'sand', fb: 'fb', pond: 'pond', mulch: 'mulch', media: 'media', sand: 'sand', no57: 'no57', below: 'below', ud: 'ud', co: 'co', riser: 'riser', liner: 'liner', fp: 'fp', slope: 'slope' };
  function drawnOf(k) {
    var G = M.G, o = G.o;
    return { fb: fi(G.fb) + ' from the overflow crest to the rim / curb-cut flow line', pond: fi(G.P) + ' above the mulch (' + data.P.src + ')', mulch: fi(G.mulch), media: fi(G.media) + (o.inc ? ' (' + data.M.src + ' ' + fi(G.M) + ' − ' + fi(G.mulch) + ' mulch − 3 in sand)' : ' (' + data.M.src + ')'), sand: '3 in', no8: '3 in' + (o.inc ? ' (counted in ' + data.A7.src + ')' : ''), no57: fi(G.above) + ' above the invert' + (o.inc ? ' (' + data.A7.src + ' ' + fi(G.A7) + ' − 3 in No. 8)' : ' (' + data.A7.src + ')') + '; ' + fi(G.no57) + ' total', below: fi(G.below) + ' (' + data.A8.src + ')', ud: 'Ø' + fi(o.dia) + ', invert ' + fi(G.below) + ' above the aggregate bottom (' + (o.priv ? 'private' : 'City') + ' maintenance)', co: 'Ø' + fi(o.co) + ' riser to a lockable cap', riser: 'Grate at the ponding elevation, ' + fi(G.P) + ' above the mulch', liner: o.liner ? 'Shown along the sides and bottom' : 'Not shown', native: o.liner ? 'Lined: no seepage drawn' : 'Infiltration rate ' + G.inf + ' in/hr (' + data.INF.src + ')' + (G.inf > 0 ? ': seepage drawn' : ': none drawn'), inlet: o.edge === 'curb' ? 'Curb cut through a concrete planter edge, cobble energy dissipation' : 'Sheet flow over ' + o.slope + 'H:1V side slopes', plants: M.plants.map(function (p) { return { grass: 'grass', sedge: 'sedge', deer: 'bunch grass', shrub: 'small shrub', tree: 'tree' }[p.t]; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', ') + ' (not to scale; roots drawn within the media)', fp: data.FP.src + ' = ' + Math.round(G.fp).toLocaleString('en-US') + ' sq ft (horizontal not to scale)', slope: o.slope + 'H:1V' }[k];
  }
  function tipHtml(k) {
    var sp = SPEC[k], ck = null, ckk = TIPMAP[k]; M.C.forEach(function (c) { if (c.k === ckk) ck = c; });
    if (k === 'plants') M.C.forEach(function (c) { if (c.k === 'media') ck = c; });
    var link = cfg.link ? cfg.link('sws', PG[sp.pg]) : '#', th = cfg.thumb ? cfg.thumb('sws', PG[sp.pg], 52) : '';
    return '<button type="button" class="bf1-tip-x" data-bf="tipx" aria-label="Close">×</button><b>' + esc(sp.name) + '</b><div class="bf1-tip-d">Drawn: ' + esc(drawnOf(k)) + '</div>' +
      (ck ? '<div class="bf1-tip-c ' + ck.s + '"><span>' + BG[ck.s] + '</span>' + esc(ck.why) + '</div>' : '') +
      '<q>' + esc(sp.q) + '</q><a class="bf1-tip-s" href="' + link + '">' + th + '<span>' + esc(citeTxt(sp.pg)) + ' ›</span></a>';
  }
  function bbox(k) { var b = M.box[k]; if (!b) return null; var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; b.forEach(function (r) { x0 = Math.min(x0, r[0]); y0 = Math.min(y0, r[1]); x1 = Math.max(x1, r[0] + r[2]); y1 = Math.max(y1, r[1] + r[3]); }); return [x0, y0, x1 - x0, y1 - y0]; }
  function highlight(k) { var hl = node.querySelector('#bf1hl'), b = k && bbox(k); if (!hl) return; if (!b) { hl.setAttribute('opacity', 0); return; } hl.setAttribute('x', b[0] - 2); hl.setAttribute('y', b[1] - 2); hl.setAttribute('width', b[2] + 4); hl.setAttribute('height', b[3] + 4); hl.setAttribute('opacity', 1); }
  function showTip(k, cx, cy) {
    var tip = node.querySelector('.bf1-tip'), fig = node.querySelector('.bf1-fig');
    if (!k || !SPEC[k]) { tip.hidden = true; highlight(null); return; }
    tip.innerHTML = tipHtml(k); tip.hidden = false; highlight(k);
    var fw = fig.clientWidth, fh = fig.clientHeight, tw = tip.offsetWidth, tht = tip.offsetHeight;
    if (cx == null) { var b = bbox(k), sv = node.querySelector('svg'), sc = fw / M.L.W; cx = (b[0] + b[2] / 2) * sc; cy = (b[1] + b[3] / 2) * sc; }
    var x = cx + 14, y = cy + 14; if (x + tw > fw - 6) x = Math.max(6, cx - tw - 14); if (y + tht > fh - 6) y = Math.max(6, fh - tht - 6);
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function optsHtml(o, G) {
    var sel = function (bf, val, opts) { return '<select data-bf="' + bf + '">' + opts.map(function (x) { return '<option value="' + x[0] + '"' + (String(val) === String(x[0]) ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select>'; };
    var ck = function (bf, val, lbl, dis) { return '<label class="bf1-ck"><input type="checkbox" data-bf="' + bf + '"' + (val ? ' checked' : '') + (dis ? ' disabled' : '') + '> ' + lbl + '</label>'; };
    return '<label class="bf1-ck wide"><input type="checkbox" data-bf="inc"' + (o.inc ? ' checked' : '') + '> Line 6 includes the mulch and 3 in ASTM C33 sand, and Line 7 includes the 3 in ASTM No. 8 stone (as the worksheet line text instructs). <em>Reviewer assumption.</em></label>' +
      '<label>Freeboard (in)<input type="number" step="0.5" min="0" data-bf="fb" value="' + o.fb + '"></label>' +
      '<label>Mulch (in)<input type="number" step="0.5" min="0" data-bf="mulch" value="' + o.mulch + '"></label>' +
      '<label>Edge' + sel('edge', o.edge, [['curb', 'Concrete curb / planter walls'], ['slope', 'Side slopes']]) + '</label>' +
      (o.edge === 'slope' ? '<label>Side slope' + sel('slope', o.slope, [[2, '2H:1V'], [3, '3H:1V'], [4, '4H:1V'], [5, '5H:1V']]) + '</label>' : '') +
      '<label>Underdrain Ø' + sel('dia', o.dia, [[4, '4 in'], [6, '6 in'], [8, '8 in'], [10, '10 in'], [12, '12 in']]) + '</label>' +
      '<label>Cleanout Ø' + sel('co', o.co, [[4, '4 in'], [6, '6 in'], [8, '8 in'], [10, '10 in'], [12, '12 in']]) + '</label>' +
      '<label>Maintenance' + sel('priv', o.priv ? 1 : 0, [[0, 'City (public)'], [1, 'Private']]) + '</label>' +
      ck('liner', o.liner, 'Impermeable liner') + ck('walk', o.walk, 'Adjoining walkway (4 in ponding minimum)') +
      ck('tree', o.tree && G.media >= 36, 'Tree' + (G.media < 36 ? ' <small>(needs ≥ 36 in media; now ' + fi(G.media) + ')</small>' : ''), G.media < 36 && !o.tree);
  }
  function tableHtml() {
    var link = cfg.link || function () { return '#'; };
    return '<table class="bf1-tbl"><thead><tr><th></th><th>Element</th><th>Drawn</th><th>BF-1 criterion / result</th><th>Source</th></tr></thead><tbody>' + M.C.map(function (c, i) {
      return '<tr class="' + c.s + '"><td>' + (compact ? '<span class="bf1-n" style="background:' + BC[c.s] + '">' + BG[c.s] + '</span>' : '<span class="bf1-n" style="background:' + BC[c.s] + '">' + BG[c.s] + '</span>') + '</td><td><button type="button" class="bf1-link" data-bk="' + c.k + '">' + esc(c.label) + '</button></td><td>' + esc(c.val) + '</td><td>' + esc(c.why) + ' <a href="' + link('sws', PG[c.pg]) + '" class="bf1-pg">BF-1 p. ' + c.pg + '</a></td><td>' + esc(c.src) + '</td></tr>';
    }).join('') + '</tbody></table>' + (compact ? '<ol class="bf1-key">' + M.segs.map(function (sg) { return '<li><b>' + esc(sg[1]) + '</b> ' + esc(fi(sg[2] - sg[3])) + ' <small>' + esc(M.srcS[sg[0]] + ' · ' + M.crit[sg[0]]) + '</small></li>'; }).join('') + '</ol>' : '');
  }
  function shell() {
    return '<header class="bf1-head"><div><span class="eyebrow-label">Fact sheet BF-1 · live section</span><h3>Biofiltration section from these inputs</h3><p>Vertical to scale from the worksheet lines; horizontal not to scale. Illustrative reviewer aid, not an official City detail. Hover or tap any layer for its criterion.</p></div>' +
      '<div class="bf1-ctl"><div class="bf1-seg" role="group" aria-label="Storm"><button type="button" data-bf="storm" data-v="design">Design storm</button><button type="button" data-bf="storm" data-v="large">Large storm · overflow</button></div><button type="button" class="bf1-play" data-bf="play" aria-pressed="true"></button><button type="button" class="bf1-dl" data-bf="svg" title="Download the section as an SVG drawing">SVG</button></div></header>' +
      '<div class="bf1-fig"><svg class="bf1-svg" xmlns="' + NS + '" role="img" aria-label="BF-1 biofiltration section drawn from the worksheet inputs" font-family="ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif"></svg><div class="bf1-tip" hidden></div></div>' +
      '<div class="bf1-bar"><span class="bf1-phase" aria-hidden="true"></span><span class="bf1-sum"></span></div>' +
      '<div class="bf1-tblw"></div>' +
      '<details class="bf1-opts"><summary>Section options <small>(reviewer inputs, not worksheet lines)</small></summary><div class="bf1-optg"></div></details>';
  }
  function setOpt(k, v) { var st = cfg.store; st[k] = v; if (cfg.save) cfg.save(); sig = ''; update(data); if (cfg.onChange) cfg.onChange(); }
  function bind() {
    node.addEventListener('click', function (e) {
      var b = e.target.closest('[data-bf]');
      if (b) {
        var k = b.getAttribute('data-bf');
        if (k === 'play') { setPlay(!A.playing); return; }
        if (k === 'storm') { setOpt('storm', b.getAttribute('data-v')); if (!A.playing) { A.t = staticT(); draw(A.t, 0); } return; }
        if (k === 'svg') { download(); return; }
        if (k === 'tipx') { pinned = null; showTip(null); return; }
      }
      var l = e.target.closest('.bf1-link'); if (l) { var kk = l.getAttribute('data-bk'); pinned = kk; showTip(kk); return; }
      if (e.target.closest('.bf1-tip')) return;
      var g = e.target.closest('svg [data-bk]');
      if (g) { var r = node.querySelector('.bf1-fig').getBoundingClientRect(), k2 = g.getAttribute('data-bk'); if (pinned === k2) { pinned = null; showTip(null); } else { pinned = k2; showTip(k2, e.clientX - r.left, e.clientY - r.top); } }
      else if (e.target.closest('.bf1-fig')) { pinned = null; showTip(null); }
    });
    node.addEventListener('pointermove', function (e) {
      if (pinned || e.pointerType === 'touch') return; var g = e.target.closest && e.target.closest('svg [data-bk]'), r = node.querySelector('.bf1-fig').getBoundingClientRect();
      if (g) showTip(g.getAttribute('data-bk'), e.clientX - r.left, e.clientY - r.top); else if (!e.target.closest('.bf1-tip')) showTip(null);
    });
    node.addEventListener('pointerleave', function () { if (!pinned) showTip(null); });
    node.addEventListener('keydown', function (e) { if (e.key === 'Escape') { pinned = null; showTip(null); } });
    node.addEventListener('change', function (e) {
      var el = e.target, k = el.getAttribute && el.getAttribute('data-bf'); if (!k) return;
      var v = el.type === 'checkbox' ? el.checked : el.value;
      if (k === 'fb' || k === 'mulch' || k === 'slope' || k === 'dia' || k === 'co') v = num(v); if (k === 'priv') v = v === '1';
      setOpt(k, v);
    });
  }
  function download() {
    var sv = node.querySelector('svg').cloneNode(true); sv.setAttribute('width', M.L.W); sv.setAttribute('height', M.L.H);
    var hl = sv.querySelector('#bf1hl'); if (hl) hl.remove();
    var txt = '<?xml version="1.0" encoding="UTF-8"?>\n<!-- ' + text(data, cfg.store).replace(/--/g, '-').replace(/\n/g, '\n     ') + ' -->\n' + new XMLSerializer().serializeToString(sv);
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'image/svg+xml' })); a.download = 'bf1-section-' + (data.tab || '') + '.svg'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function update(d) {
    data = d; if (!node) return;
    var w = node.clientWidth || (node.parentNode && node.parentNode.clientWidth) || 800, cp = w < 560;
    var s2 = JSON.stringify([d, opt(cfg.store), cp]); if (s2 === sig) return; sig = s2; compact = cp;
    node.classList.toggle('compact', cp);
    M = build(d, cfg.store, cp);
    var sv = node.querySelector('svg'); sv.setAttribute('viewBox', '0 0 ' + M.L.W + ' ' + M.L.H); sv.innerHTML = M.svg;
    var o = M.G.o, cnt = { pass: 0, check: 0, fail: 0 }; M.C.forEach(function (c) { if (cnt[c.s] != null) cnt[c.s]++; });
    node.querySelector('.bf1-sum').innerHTML = '<span class="pass">' + cnt.pass + ' pass</span><span class="check">' + cnt.check + ' check</span><span class="fail">' + cnt.fail + ' fail</span><span class="scale">1 in = ' + r2(M.L.s) + ' px vertical</span>';
    node.querySelector('.bf1-tblw').innerHTML = tableHtml();
    node.querySelector('.bf1-optg').innerHTML = optsHtml(o, M.G);
    [].forEach.call(node.querySelectorAll('[data-bf="storm"]'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-v') === o.storm ? 'true' : 'false'); });
    initAnim(); A.phase = ''; draw(A.t, 0);
    if (pinned) showTip(pinned); else showTip(null);
  }
  function make() {
    node = document.createElement('section'); node.className = 'bf1'; node.id = 'bf1'; node.innerHTML = shell(); bind();
    var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    A.reduce = !!(mq && mq.matches); A.playing = !A.reduce; if (A.reduce) A.t = 9.2;
    if (mq && mq.addEventListener) mq.addEventListener('change', function (e) { A.reduce = e.matches; if (e.matches) { setPlay(false); A.t = staticT(); draw(A.t, 0); } });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { A.vis = es[0].isIntersecting; if (A.vis) kick(); }).observe(node);
    document.addEventListener('visibilitychange', kick);
    if ('ResizeObserver' in window) new ResizeObserver(function () { if (data && ((node.clientWidth < 560) !== compact)) { sig = ''; update(data); } }).observe(node);
    var was = null;
    window.addEventListener('beforeprint', function () { was = A.playing; setPlay(false); A.t = staticT(); draw(A.t, 0); });
    window.addEventListener('afterprint', function () { if (was) setPlay(true); });
  }
  window.BF1 = {
    attach: function (slot, d, c) { cfg = c || cfg; if (!cfg.store) cfg.store = {}; if (!node) make(); if (slot && slot !== node) slot.replaceWith(node); update(d); setPlay(A.playing); },
    detach: function () { if (node && node.parentNode) node.parentNode.removeChild(node); if (A.raf) { cancelAnimationFrame(A.raf); A.raf = 0; } },
    text: function (d, st) { return text(d, st || cfg.store); }, checks: checks, geom: geom,
    model: function () { return M; }, state: function () { return { t: A.t, playing: A.playing, reduce: A.reduce, compact: compact, raf: !!A.raf, phase: A.phase }; },
    frame: function (t) { A.t = t; draw(t, 0); }, play: function (b) { setPlay(b); }, step: function (dt) { A.t = (A.t + dt) % T; draw(A.t, dt); }
  };
})();
