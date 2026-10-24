/* Screening geometry core (no dependencies). Mirrors screen.py:
 *  - distances in NAD83 / California zone 6 (EPSG:2230, US survey feet), Lambert Conformal Conic 2SP on GRS80
 *  - nearest isopluvial over ALL lines; interpolation only as a reviewer note
 *  - ESA point-in-polygon honoring holes; distance to nearest ESA edge
 *  - ASBS boundary vs drainage area, distance + direction to each
 * Works in the browser (window.StormScreen) and in Node (module.exports) for testing.
 * PRELIMINARY SCREENING - verify with source documents. Not an official City of San Diego product. */
(function (root) {
  'use strict';
  // ---------- EPSG:2230 projection ----------
  var a = 6378137, f = 1 / 298.257222101, e = Math.sqrt(2 * f - f * f);
  var D = Math.PI / 180, lat1 = 33.8833333333333 * D, lat2 = 32.7833333333333 * D, lat0 = 32.1666666666667 * D, lon0 = -116.25 * D;
  var X0 = 2000000.0001016, Y0 = 500000.0001016, FT = 1200 / 3937; // metres per US survey foot
  function m(p) { var s = Math.sin(p); return Math.cos(p) / Math.sqrt(1 - e * e * s * s); }
  function t(p) { var s = Math.sin(p); return Math.tan(Math.PI / 4 - p / 2) / Math.pow((1 - e * s) / (1 + e * s), e / 2); }
  var m1 = m(lat1), m2 = m(lat2), t1 = t(lat1), t2 = t(lat2), t0 = t(lat0);
  var n = (Math.log(m1) - Math.log(m2)) / (Math.log(t1) - Math.log(t2));
  var F = m1 / (n * Math.pow(t1, n)), rho0 = a * F * Math.pow(t0, n);
  function toFt(lon, lat) {
    var rho = a * F * Math.pow(t(lat * D), n), th = n * (lon * D - lon0);
    return [(X0 + rho * Math.sin(th)) / FT, (Y0 + rho0 - rho * Math.cos(th)) / FT];
  }

  // ---------- geometry prep ----------
  function prepRing(coords) { // -> {xy: Float64Array, bb:[minx,miny,maxx,maxy], ll: original lon/lat ring}
    var xy = new Float64Array(coords.length * 2), bb = [Infinity, Infinity, -Infinity, -Infinity];
    for (var i = 0; i < coords.length; i++) {
      var p = toFt(coords[i][0], coords[i][1]); xy[2 * i] = p[0]; xy[2 * i + 1] = p[1];
      if (p[0] < bb[0]) bb[0] = p[0]; if (p[1] < bb[1]) bb[1] = p[1]; if (p[0] > bb[2]) bb[2] = p[0]; if (p[1] > bb[3]) bb[3] = p[1];
    }
    return { xy: xy, bb: bb, ll: coords };
  }
  function prepFeature(feat) {
    var g = feat.geometry, out = { props: feat.properties || {}, type: g.type, parts: [] };
    if (g.type === 'LineString') out.parts = [[prepRing(g.coordinates)]];
    else if (g.type === 'MultiLineString') out.parts = g.coordinates.map(function (l) { return [prepRing(l)]; });
    else if (g.type === 'Polygon') out.parts = [g.coordinates.map(prepRing)];
    else if (g.type === 'MultiPolygon') out.parts = g.coordinates.map(function (p) { return p.map(prepRing); });
    return out;
  }
  function bbDist(bb, x, y) {
    var dx = Math.max(bb[0] - x, 0, x - bb[2]), dy = Math.max(bb[1] - y, 0, y - bb[3]);
    return Math.sqrt(dx * dx + dy * dy);
  }
  // nearest point on a ring/line (planar ft). best = {d, x, y}
  function nearestOnRing(r, x, y, best) {
    if (bbDist(r.bb, x, y) >= best.d) return best;
    var xy = r.xy, N = xy.length / 2;
    for (var i = 0; i < N - 1; i++) {
      var ax = xy[2 * i], ay = xy[2 * i + 1], bx = xy[2 * i + 2], by = xy[2 * i + 3];
      var vx = bx - ax, vy = by - ay, L = vx * vx + vy * vy, u = L ? ((x - ax) * vx + (y - ay) * vy) / L : 0;
      if (u < 0) u = 0; else if (u > 1) u = 1;
      var qx = ax + u * vx, qy = ay + u * vy, d = Math.sqrt((x - qx) * (x - qx) + (y - qy) * (y - qy));
      if (d < best.d) { var l0 = r.ll[i], l1 = r.ll[i + 1]; best = { d: d, x: qx, y: qy, ll: [l0[1] + u * (l1[1] - l0[1]), l0[0] + u * (l1[0] - l0[0])] }; }
    }
    return best;
  }
  function nearestOnFeature(fe, x, y) {
    var best = { d: Infinity, x: NaN, y: NaN };
    fe.parts.forEach(function (rings) { rings.forEach(function (r) { best = nearestOnRing(r, x, y, best); }); });
    return best;
  }
  function inRing(r, x, y) {
    var bb = r.bb; if (x < bb[0] || x > bb[2] || y < bb[1] || y > bb[3]) return false;
    var xy = r.xy, N = xy.length / 2, inside = false;
    for (var i = 0, j = N - 1; i < N; j = i++) {
      var xi = xy[2 * i], yi = xy[2 * i + 1], xj = xy[2 * j], yj = xy[2 * j + 1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  // returns {inside, inHole}: inside = in exterior and not in any hole of the same polygon
  function inFeature(fe, x, y) {
    var res = { inside: false, inHole: false };
    fe.parts.forEach(function (rings) {
      if (!rings.length || !inRing(rings[0], x, y)) return;
      var hole = false; for (var k = 1; k < rings.length; k++) if (inRing(rings[k], x, y)) { hole = true; break; }
      if (hole) res.inHole = true; else res.inside = true;
    });
    if (res.inside) res.inHole = false;
    return res;
  }
  function compass(dx, dy) {
    var ang = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
    return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.floor((ang + 22.5) / 45) % 8];
  }

  // ---------- data ----------
  var ASBS_NAMES = { 29: 'ASBS 29 - La Jolla', 31: 'ASBS 31 - San Diego-Scripps (Scripps-San Diego)' };
  function asbsName(p) { var k = p.ASBSNumber || p.GRIDCODE; return ASBS_NAMES[k] || ('ASBS ' + k); }
  function Layers(geo) { // geo: {rain, esa, asbsBoundary, asbsDrainage} FeatureCollections
    this.rain = geo.rain.features.map(prepFeature);
    this.esa = geo.esa.features.map(prepFeature);
    this.asbsB = geo.asbsBoundary.features.map(prepFeature);
    this.asbsD = geo.asbsDrainage.features.map(prepFeature);
  }

  function screen(L, lat, lon) {
    var p = toFt(lon, lat), x = p[0], y = p[1], res = { lat: lat, lon: lon };
    // ----- storm depth: nearest line per value, over ALL lines -----
    var byVal = {};
    L.rain.forEach(function (fe) {
      var v = Math.round(Number(fe.props.INCHES) * 100) / 100, nb = nearestOnFeature(fe, x, y);
      if (!(v in byVal) || nb.d < byVal[v].d) byVal[v] = { v: v, d: nb.d, x: nb.x, y: nb.y, ll: nb.ll, oid: fe.props.OBJECTID };
    });
    var list = Object.keys(byVal).map(function (k) { return byVal[k]; }).sort(function (p1, p2) { return p1.d - p2.d; });
    var n1 = list[0], n2 = null;
    for (var i = 1; i < list.length; i++) if (list[i].v !== n1.v) { n2 = list[i]; break; }
    var interp = (n2 && n1.d + n2.d > 0) ? (n1.v * n2.d + n2.v * n1.d) / (n1.d + n2.d) : n1.v;
    res.depth = {
      nearest_line_in: n1.v, nearest_line_dist_ft: n1.d, nearest_dir: compass(n1.x - x, n1.y - y), nearest_oid: n1.oid, nearest_ll: n1.ll,
      second_line_in: n2 ? n2.v : null, second_line_dist_ft: n2 ? n2.d : null, second_dir: n2 ? compass(n2.x - x, n2.y - y) : null, second_ll: n2 ? n2.ll : null,
      interpolated_in: interp
    };
    // ----- ESA (holes honored) -----
    var inside = null, inHole = false, best = { d: Infinity };
    L.esa.forEach(function (fe) {
      var r = inFeature(fe, x, y); if (r.inside && !inside) inside = fe; if (r.inHole) inHole = true;
      var nb = nearestOnFeature(fe, x, y); if (nb.d < best.d) best = nb;
    });
    res.esa = {
      inside: !!inside, feature_note: inside ? inside.props.Note : null,
      in_hole: !inside && inHole, dist_to_edge_ft: best.d, dir: compass(best.x - x, best.y - y), edge_ll: best.ll,
      near_edge: best.d <= 100
    };
    // ----- ASBS -----
    function asbsSet(feats) {
      var ins = [], nb = { d: Infinity }, nm = null, edge = { d: Infinity };
      feats.forEach(function (fe) {
        var r = inFeature(fe, x, y), q = nearestOnFeature(fe, x, y);
        if (r.inside) ins.push(asbsName(fe.props));
        var d = r.inside ? 0 : q.d;
        if (d < nb.d || (d === nb.d && q.d < nb.edge)) { nb = { d: d, edge: q.d, x: q.x, y: q.y }; nm = asbsName(fe.props); }
        if (q.d < edge.d) edge = q;
      });
      return { inside: ins, nearest: nm, dist_ft: nb.d, edge_dist_ft: edge.d, dir: compass(edge.x - x, edge.y - y), edge_ll: edge.ll, near_edge: edge.d <= 100 };
    }
    res.asbs = { boundary: asbsSet(L.asbsB), drainage: asbsSet(L.asbsD) };
    return res;
  }

  var api = { toFt: toFt, Layers: Layers, screen: screen, compass: compass, ASBS_NAMES: ASBS_NAMES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.StormScreen = api;
})(this);
