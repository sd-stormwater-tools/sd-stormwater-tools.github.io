/* HMP (hydromodification management) exemption SCREEN (no dependencies beyond screen-core.js's toFt).
 * Potential-exemption screen only: GIS cannot prove the "direct discharge" the City requires, so results are
 * "Potentially exempt / Verify / Not exempt (screening)" based on distance to mapped exempt receiving waters and
 * WMAA exempt conveyance systems / river reaches. Criteria: City of San Diego Storm Water Standards, Part 1:
 * BMP Design Manual (Aug 2024 Ed.), Sec. 1.6, pp. 1-17 to 1-20, and Figure 1-2, p. 1-21.
 * Works in the browser (window.HMPScreen) and in Node (module.exports).
 * PRELIMINARY SCREENING - verify with source documents. Not an official City of San Diego product. */
(function (root) {
  'use strict';
  var toFt = (root.StormScreen || (typeof require !== 'undefined' ? require('./screen-core.js') : {})).toFt;
  var NEAR_FT = 300, VERIFY_FT = 1000;

  function prepRing(c) {
    var xy = new Float64Array(c.length * 2), bb = [Infinity, Infinity, -Infinity, -Infinity];
    for (var i = 0; i < c.length; i++) {
      var p = toFt(c[i][0], c[i][1]); xy[2 * i] = p[0]; xy[2 * i + 1] = p[1];
      if (p[0] < bb[0]) bb[0] = p[0]; if (p[1] < bb[1]) bb[1] = p[1]; if (p[0] > bb[2]) bb[2] = p[0]; if (p[1] > bb[3]) bb[3] = p[1];
    }
    return { xy: xy, bb: bb, ll: c };
  }
  function prep(f) {
    var g = f.geometry, o = { props: f.properties || {}, poly: /Polygon/.test(g.type), parts: [] };
    if (g.type === 'LineString') o.parts = [[prepRing(g.coordinates)]];
    else if (g.type === 'MultiLineString') o.parts = g.coordinates.map(function (l) { return [prepRing(l)]; });
    else if (g.type === 'Polygon') o.parts = [g.coordinates.map(prepRing)];
    else if (g.type === 'MultiPolygon') o.parts = g.coordinates.map(function (p) { return p.map(prepRing); });
    return o;
  }
  function bbD(bb, x, y) { var dx = Math.max(bb[0] - x, 0, x - bb[2]), dy = Math.max(bb[1] - y, 0, y - bb[3]); return Math.sqrt(dx * dx + dy * dy); }
  function near(r, x, y, best) {
    if (bbD(r.bb, x, y) >= best.d) return best;
    var xy = r.xy, N = xy.length / 2;
    for (var i = 0; i < N - 1; i++) {
      var ax = xy[2 * i], ay = xy[2 * i + 1], vx = xy[2 * i + 2] - ax, vy = xy[2 * i + 3] - ay, L = vx * vx + vy * vy;
      var u = L ? ((x - ax) * vx + (y - ay) * vy) / L : 0; u = u < 0 ? 0 : u > 1 ? 1 : u;
      var qx = ax + u * vx, qy = ay + u * vy, d = Math.sqrt((x - qx) * (x - qx) + (y - qy) * (y - qy));
      if (d < best.d) { var l0 = r.ll[i], l1 = r.ll[i + 1]; best = { d: d, x: qx, y: qy, ll: [l0[1] + u * (l1[1] - l0[1]), l0[0] + u * (l1[0] - l0[0])] }; }
    }
    return best;
  }
  function inRing(r, x, y) {
    if (x < r.bb[0] || x > r.bb[2] || y < r.bb[1] || y > r.bb[3]) return false;
    var xy = r.xy, N = xy.length / 2, c = false;
    for (var i = 0, j = N - 1; i < N; j = i++) {
      var xi = xy[2 * i], yi = xy[2 * i + 1], xj = xy[2 * j], yj = xy[2 * j + 1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  function inside(fe, x, y) { // even-odd per polygon, honoring holes
    if (!fe.poly) return false;
    return fe.parts.some(function (rings) { var k = 0; rings.forEach(function (r) { if (inRing(r, x, y)) k++; }); return k % 2 === 1; });
  }
  function dist(fe, x, y) { var b = { d: Infinity }; fe.parts.forEach(function (rs) { rs.forEach(function (r) { b = near(r, x, y, b); }); }); return b; }
  function compass(dx, dy) {
    var a = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
    return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(a / 45) % 8];
  }

  function Layers(geo) {
    this.waters = (geo.waters ? geo.waters.features : []).map(prep);
    this.conv = (geo.conveyance ? geo.conveyance.features : []).map(prep);
    this.huc = (geo.subwatersheds ? geo.subwatersheds.features : []).map(prep);
  }

  var SWS = 'Storm Water Standards, Part 1: BMP Design Manual (Aug 2024 Ed.)';
  var COMMON = [
    'Applies to PDPs only; the City "has the discretion to exempt a PDP" (' + SWS + ', Sec. 1.6, p. 1-17; Fig. 1-2 Node 1).',
    'Direct discharge = existing underground storm drain, or a channel "whose bed and bank are concrete lined all the way from the point of discharge" to the exempt water (Sec. 1.6 (i)-(ii), p. 1-17). Fig. 1-2 note: "Direct discharge refers to an uninterrupted hardened conveyance system" (p. 1-21).',
    'Existing outfalls insufficient for the added flows "may require upgrading and may also disqualify the HMP exemption at the discretion of the City Engineer"; new outfalls must meet Drainage Design Manual energy dissipation (pp. 1-19 to 1-20).'
  ];
  var NODE = {
    2: { title: 'Fig. 1-2 Node 2 - Pacific Ocean', cond: [
      '(a) "The outfall must be located on the beach (not within or on top of a bluff)" (p. 1-17).',
      '(b) Properly sized energy dissipation for the ultimate condition peak design flow of the direct discharge (p. 1-17).',
      '(c) Outlet invert "equal to or below the mean high tide water surface elevation"; between mean high tide and the 100-year WSE, additional energy-dissipation analysis is required (pp. 1-17 to 1-18).',
      '"No exemption may be granted for conveyance system outlet invert elevations located above the 100-year floodplain elevation" (p. 1-18).'] },
    3: { title: 'Fig. 1-2 Node 3 - Enclosed embayment (San Diego Bay, Mission Bay)', cond: [
      '(a) "The outfall must not be located within a wildlife refuge or reserve area (e.g., Kendall-Frost Mission Bay Marsh Reserve, San Diego Bay National Wildlife Refuge, San Diego National Wildlife Refuge)" (p. 1-18).',
      '(b) Properly sized energy dissipation for the ultimate condition peak design flow (p. 1-18).',
      '(c) Outlet invert equal to or below the mean high tide WSE; between mean high tide and the 100-year WSE, additional analysis is required (p. 1-18).',
      '"No exemption may be granted for conveyance system outlet invert elevations located above the 100-year floodplain elevation" (p. 1-18).'] },
    4: { title: 'Fig. 1-2 Node 4 - Listed water storage reservoir or lake', cond: [
      'Only the listed reservoirs: Lake Hodges, San Vicente, El Capitan, Lower Otay, Upper Otay, Morena, Sutherland, Barrett, Lake Murray, Miramar (p. 1-18).',
      'The site must be tributary to the reservoir (upstream of the dam); a site below the dam does not drain to it (reviewer note).',
      '(a) Properly sized energy dissipation "in accordance with the City design standards" (p. 1-19).',
      '(b) Outlet invert "equal to or below the lowest normal operating water surface elevation" unless discharging to quay or other non-erodible shore protection; contact the reservoir operator for the elevation; above that but below the spillway, additional analysis is required (p. 1-19).',
      '"No exemption may be granted for conveyance system outlet invert elevations located above the reservoir spillway elevation" (p. 1-19).'] },
    5: { title: 'Fig. 1-2 Node 5 - WMAA exempt river reach', cond: [
      'Only the designated reaches: San Dieguito River downstream of Lake Hodges; San Diego River downstream of the confluence with San Vicente Creek; Sweetwater River downstream of Sweetwater Reservoir; Otay River downstream of Lower Otay Reservoir Dam (p. 1-19). "Refer to the WMAA for any updates to exempt river reaches."',
      '(a) Properly sized energy dissipation for the ultimate condition peak design flow (p. 1-19).',
      '(b) Outlet invert "equal to or below the 10-year floodplain elevation"; exceptions at the City Engineer\'s discretion "but shall never exceed the 100-year floodplain elevation" (p. 1-19).',
      '"No exemption may be granted for conveyance system outlet invert elevations located above the 100-year floodplain elevation" (p. 1-19).'] }
  };

  function screen(L, lat, lon) {
    var p = toFt(lon, lat), x = p[0], y = p[1], cands = [];
    L.waters.forEach(function (fe) {
      var q = dist(fe, x, y), ins = inside(fe, x, y);
      cands.push({ type: 'water', name: fe.props.name, rw: fe.props.name, node: fe.props.node, via: '', inside: ins, dist_ft: ins ? 0 : q.d, edge_ft: q.d, dir: compass(q.x - x, q.y - y), ll: q.ll });
    });
    L.conv.forEach(function (fe) {
      var q = dist(fe, x, y), k = fe.props.kind;
      cands.push({ type: k, name: (k === 'reach' ? 'Exempt river reach: ' : 'WMAA exempt conveyance system to ') + fe.props.rw + (fe.props.via ? ' (via ' + fe.props.via + ')' : ''),
        rw: fe.props.rw, node: fe.props.node, via: fe.props.via || '', inside: false, dist_ft: q.d, edge_ft: q.d, dir: compass(q.x - x, q.y - y), ll: q.ll });
    });
    cands.sort(function (a, b) { return a.dist_ft - b.dist_ft; });
    var n = cands[0] || null, huc = null;
    for (var i = 0; i < L.huc.length; i++) if (inside(L.huc[i], x, y)) { huc = L.huc[i].props; break; }
    var status = !n ? 'unknown' : n.dist_ft <= NEAR_FT ? 'potential' : n.dist_ft <= VERIFY_FT ? 'verify' : 'not';
    var nearby = [], seen = {};
    cands.forEach(function (c) { if (c.dist_ft <= VERIFY_FT && !seen[c.rw]) { seen[c.rw] = 1; nearby.push(c); } });
    var summary;
    if (status === 'potential' || status === 'verify') {
      summary = (status === 'potential' ? 'Potentially exempt' : 'Verify') + ' \u2013 ' + (n.inside ? 'site is within ' + n.rw : n.type === 'water' ? fmt(n.dist_ft) + ' from ' + n.rw : fmt(n.dist_ft) + ' from a mapped ' + (n.type === 'reach' ? 'exempt reach of the ' : 'exempt conveyance system draining to ' + the(n.rw)) + n.rw) +
        '; applicant must demonstrate direct discharge per Fig. 1-2 Node ' + n.node + '.';
    } else if (status === 'not') {
      var ex = !!(huc && huc.rw_exempt);
      if (ex) status = 'notmapped';
      summary = (ex ? 'Not mapped as exempt' : 'Not exempt (screening)') + ' \u2013 no mapped exempt receiving water or WMAA exempt conveyance within ' + fmt(VERIFY_FT) + ' (nearest: ' + n.rw + ', ' + fmt(n.dist_ft) + ' ' + n.dir + '). ' +
        (huc ? 'Site is in USGS HUC12 ' + huc.name + ', which drains to ' + (huc.rw || 'a receiving water not mapped as exempt') +
          (ex ? '. That system includes a Fig. 1-2 exempt water, but no mapped direct-discharge connection is near the site; the applicant would have to demonstrate an existing storm drain or concrete-lined channel all the way to it.' : ' \u2013 not an exempt receiving water under Fig. 1-2.') : '');
    } else summary = 'HMP exemption layers not loaded.';
    var hit = status === 'potential' || status === 'verify';
    return { status: status, nearest: n, nearby: nearby, huc: huc, summary: summary, node: hit ? n.node : null,
      conditions: hit ? NODE[n.node].cond : [], node_title: hit ? NODE[n.node].title : null, common: COMMON, thresholds_ft: [NEAR_FT, VERIFY_FT] };
  }
  function the(rw) { return /^(Pacific|San Diego River|San Dieguito|Sweetwater|Otay River)/.test(rw) ? 'the ' : ''; }
  function fmt(d) { return Math.round(d).toLocaleString('en-US') + ' ft'; }

  var api = { Layers: Layers, screen: screen, NODE: NODE, COMMON: COMMON, NEAR_FT: NEAR_FT, VERIFY_FT: VERIFY_FT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.HMPScreen = api;
})(this);
