/* San Diego Stormwater Screening Map (reviewer tool). Not an official City of San Diego product.
 * Preliminary screening - verify with source documents. */
(function () {
  'use strict';
  var S = window.StormScreen;
  var SD_VIEW = [32.80, -117.10], SD_ZOOM = 10;
  var BOUNDS = { latMin: 32.4, latMax: 33.3, lonMin: -117.8, lonMax: -116.7 };

  var SOURCES = {
    rain: { name: 'County of San Diego DPW, HYD_85TH_PERCENT_ISOPLUVIALS (85th Percentile Isopluvials)',
      url: 'https://gis-public.sandiegocounty.gov/arcgis/rest/services/sdep_warehouse/HYD_85TH_PERCENT_ISOPLUVIALS/FeatureServer/0',
      edition: 'Live County service retrieved Oct 24, 2026 (no edit date published); 108 polylines, 0.32-1.12 in at 0.02 in steps.' },
    esa: { name: 'City of San Diego Land Development Manual Appendix O, ESA shapefile ESA_CSD_200ft (ESA + 200 ft buffer)',
      url: 'https://webdocs.sandiego.gov/public/esa_shapefile.zip',
      edition: 'Metadata created 2023-01-11, modified 2024-06-28; zip Last-Modified 2024-08-14.' },
    asbs: { name: 'City of San Diego Land Development Manual Appendix O, ASBS shapefiles (ASBSBound + asbswatersheds_area)',
      url: 'https://www.sandiego.gov/sites/default/files/asbs_shapefiles_0.zip',
      edition: 'ASBSBound dated 2005-09-29 (shp 2008-02-28); drainage areas dated 2006-02-01; zip Last-Modified 2023-10-24.' }
  };
  var LDM = 'https://www.sandiego.gov/planning/programs/landdevcode/landdevmanual';
  var MANUAL = {
    rain: [
      'Storm Water Standards, Part 1: BMP Design Manual (Aug 2024 Ed.), App. B, Sec. B.1.3, p. B-8: "The rainfall depth to estimate the DCV shall be determined using Figure B.1-1."',
      'Same manual, Figure B.1-1: 85th Percentile 24-hour Isopluvial Map, p. B-9; Worksheet B.2-1 (DCV) line 1, p. B-15; Sec. 2.2.1(a), p. 2-5.'
    ],
    esa: [
      'Storm Water Standards, Part 1 (Aug 2024 Ed.), Sec. 1.4.1, PDP category (d), p. 1-13: "Discharging directly to" includes flow that is conveyed overland a distance of 200 feet or less from the project to the ESA, or conveyed in a pipe or open channel any distance as an isolated flow.',
      'Appendix K (ESAs identified in the City of San Diego).'
    ],
    asbs: [
      'Storm Water Standards, Part 2: Construction BMP Standards (May 2021 Ed.), Ch. 2, p. 2-2: projects in watersheds draining to an ASBS are prohibited from discharging to an ASBS unless granted an exception by the SWRCB; Appendix A (ASBS Maps: La Jolla and San Diego-Scripps).',
      'Part 1 (Aug 2024 Ed.), Sec. 1.4.1(d) note, p. 1-13: ESAs include areas designated as Areas of Special Biological Significance.'
    ]
  };

  // ---------- map ----------
  var map = L.map('map', { zoomControl: true, preferCanvas: true, worldCopyJump: false }).setView(SD_VIEW, SD_ZOOM);
  L.control.scale({ imperial: true, metric: false }).addTo(map);
  var esriAttr = 'Powered by <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a>';
  var basemaps = {
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxNativeZoom: 19, maxZoom: 21, attribution: esriAttr + ' | Imagery: Esri, Vantor, Earthstar Geographics, and the GIS User Community' }),
    topo: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
      maxNativeZoom: 19, maxZoom: 21, attribution: esriAttr + ' | Sources: Esri, HERE, Garmin, Intermap, USGS, FAO, NPS, NRCAN, (c) OpenStreetMap contributors, and the GIS User Community' }),
    streets: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxNativeZoom: 19, maxZoom: 21, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' })
  };
  map.createPane('labels'); map.getPane('labels').style.zIndex = 445; map.getPane('labels').style.pointerEvents = 'none';
  var labels = L.layerGroup([
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', { pane: 'labels', maxNativeZoom: 19, maxZoom: 21, attribution: 'Labels: Esri, HERE, Garmin, (c) OpenStreetMap contributors' }),
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { pane: 'labels', maxNativeZoom: 19, maxZoom: 21 })
  ]);
  var active = 'satellite'; basemaps.satellite.addTo(map);
  function syncLabels() { var on = $('labelsToggle').checked && active === 'satellite'; if (on) labels.addTo(map); else map.removeLayer(labels); }

  [['esa', 410], ['asbs', 420], ['rain', 430], ['rainLabels', 440], ['site', 650]].forEach(function (p) { map.createPane(p[0]); map.getPane(p[0]).style.zIndex = p[1]; });
  map.getPane('rainLabels').style.pointerEvents = 'none';
  var renderer = { esa: L.canvas({ pane: 'esa' }), asbs: L.canvas({ pane: 'asbs' }), rain: L.canvas({ pane: 'rain', tolerance: 0 }) };

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fmtFt = function (d) { return Math.round(d).toLocaleString('en-US') + ' ft'; };
  var fmtDist = function (d) { return d >= 5280 ? fmtFt(d) + ' (' + (d / 5280).toFixed(2) + ' mi)' : fmtFt(d); };
  var rainColor = function (v) { return v >= 0.8 ? '#dc2626' : v >= 0.65 ? '#f97316' : '#eab308'; };

  var state = { layers: {}, geo: {}, core: null, visible: { rain: true, esa: true, asbs: true }, site: null, last: null };
  function setStatus(n, t, c) { var el = $(n + 'Status'); el.textContent = t; el.className = 'status ' + (c || ''); }
  function getJSON(u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); }); }

  var loads = {
    rain: getJSON('./data/isopluvials.geojson').then(function (g) {
      state.geo.rain = g;
      state.layers.rain = L.geoJSON(g, { renderer: renderer.rain, interactive: false, smoothFactor: 1,
        style: function (f) { return { color: rainColor(Number(f.properties.INCHES)), weight: 2.5, opacity: 0.95 }; } });
      if (state.visible.rain) state.layers.rain.addTo(map);
      setStatus('rain', 'Loaded', 'ready'); updateRainLabels();
    }),
    esa: getJSON('./data/esa.geojson').then(function (g) {
      state.geo.esa = g;
      state.layers.esa = L.geoJSON(g, { renderer: renderer.esa, interactive: false, smoothFactor: 1,
        style: { color: '#15803d', weight: 1.2, fillColor: '#22c55e', fillOpacity: 0.3 } });
      if (state.visible.esa) state.layers.esa.addTo(map);
      setStatus('esa', 'Loaded', 'ready');
    }),
    asbs: Promise.all([getJSON('./data/asbs-boundary.geojson'), getJSON('./data/asbs-drainage-areas.geojson')]).then(function (gs) {
      state.geo.asbsBoundary = gs[0]; state.geo.asbsDrainage = gs[1];
      state.layers.asbs = L.layerGroup([
        L.geoJSON(gs[1], { renderer: renderer.asbs, interactive: false, style: { color: '#2563eb', weight: 1.8, dashArray: '6 5', fillColor: '#60a5fa', fillOpacity: 0.18 } }),
        L.geoJSON(gs[0], { renderer: renderer.asbs, interactive: false, style: { color: '#1e3a8a', weight: 2.5, fillColor: '#2563eb', fillOpacity: 0.45 } })
      ]);
      if (state.visible.asbs) state.layers.asbs.addTo(map);
      setStatus('asbs', 'Loaded', 'ready');
    })
  };
  Object.keys(loads).forEach(function (k) { loads[k].catch(function (e) { setStatus(k, 'Unavailable', 'error'); console.warn(k, e); }); });
  var ready = Promise.all([loads.rain, loads.esa, loads.asbs]).then(function () {
    state.core = new S.Layers(state.geo); document.body.dataset.ready = '1'; return state.core;
  });

  // isopluvial labels: one per visible line, at a vertex inside the view near the centre
  var rainLabels = L.layerGroup().addTo(map);
  function updateRainLabels() {
    rainLabels.clearLayers();
    if (!state.geo.rain || !state.visible.rain || map.getZoom() < 11) return;
    var b = map.getBounds().pad(-0.04), c = map.getCenter(), placed = [];
    state.geo.rain.features.forEach(function (f) {
      var lines = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates;
      lines.forEach(function (line) {
        var best = null, bd = Infinity;
        for (var i = 0; i < line.length; i += 2) {
          var ll = L.latLng(line[i][1], line[i][0]); if (!b.contains(ll)) continue;
          var d = ll.distanceTo(c); if (d < bd) { bd = d; best = ll; }
        }
        if (!best) return;
        var pt = map.latLngToContainerPoint(best);
        if (placed.some(function (q) { return Math.abs(q.x - pt.x) < 60 && Math.abs(q.y - pt.y) < 22; })) return;
        placed.push(pt);
        var v = Number(f.properties.INCHES);
        L.marker(best, { pane: 'rainLabels', interactive: false, keyboard: false,
          icon: L.divIcon({ className: 'iso-label', html: '<span style="border-color:' + rainColor(v) + '">' + v.toFixed(2) + ' in</span>', iconSize: null }) }).addTo(rainLabels);
      });
    });
  }
  map.on('moveend zoomend', updateRainLabels);

  document.querySelectorAll('[data-layer]').forEach(function (inp) {
    inp.addEventListener('change', function (e) {
      var n = e.target.dataset.layer; state.visible[n] = e.target.checked; var l = state.layers[n];
      if (l) { if (e.target.checked) l.addTo(map); else map.removeLayer(l); }
      if (n === 'rain') updateRainLabels();
    });
  });
  document.querySelectorAll('input[name=basemap]').forEach(function (r) {
    r.addEventListener('change', function (e) { map.removeLayer(basemaps[active]); active = e.target.value; basemaps[active].addTo(map); basemaps[active].bringToBack(); syncLabels(); });
  });
  $('labelsToggle').addEventListener('change', syncLabels); syncLabels();
  $('resetBtn').addEventListener('click', function () { map.setView(SD_VIEW, SD_ZOOM); });

  // ---------- screening ----------
  var siteLayer = L.layerGroup().addTo(map);
  function inBounds(lat, lon) { return lat >= BOUNDS.latMin && lat <= BOUNDS.latMax && lon >= BOUNDS.lonMin && lon <= BOUNDS.lonMax; }

  function screenPoint(lat, lon, label, opts) {
    opts = opts || {};
    $('placeName').textContent = label || 'Selected map location';
    $('coordinates').textContent = lat.toFixed(6) + ', ' + lon.toFixed(6) + (opts.via ? '  \u00b7  ' + opts.via : '');
    $('resultBody').innerHTML = '<p class="muted">Screening&hellip;</p>';
    if (opts.zoom) map.setView([lat, lon], opts.zoom);
    try { history.replaceState(null, '', '#' + lat.toFixed(6) + ',' + lon.toFixed(6)); } catch (e) { /* file:// */ }
    return ready.then(function (core) {
      var r = S.screen(core, lat, lon); r.label = label; r.via = opts.via || null; state.last = r;
      drawSite(r); renderResult(r); $('copyBtn').hidden = false;
      document.body.dataset.screened = '1';
      return r;
    }).catch(function (e) { $('resultBody').innerHTML = '<p class="err">Screening layers failed to load: ' + esc(e.message) + '</p>'; });
  }

  function drawSite(r) {
    siteLayer.clearLayers();
    var s = [r.lat, r.lon];
    function leader(ll, color, tip) {
      if (!ll) return;
      L.polyline([s, ll], { pane: 'site', color: color, weight: 2, dashArray: '4 4', interactive: false }).addTo(siteLayer);
      L.circleMarker(ll, { pane: 'site', radius: 4, color: '#fff', weight: 1.5, fillColor: color, fillOpacity: 1 }).bindTooltip(tip).addTo(siteLayer);
    }
    var D = r.depth, E = r.esa, B = r.asbs.boundary, A = r.asbs.drainage;
    leader(D.nearest_ll, rainColor(D.nearest_line_in), 'Nearest isopluvial ' + D.nearest_line_in.toFixed(2) + ' in, ' + fmtFt(D.nearest_line_dist_ft));
    leader(E.edge_ll, '#16a34a', 'Nearest ESA edge, ' + fmtFt(E.dist_to_edge_ft));
    if (!B.inside.length) leader(B.edge_ll, '#1d4ed8', 'Nearest ASBS boundary, ' + fmtFt(B.dist_ft));
    L.circleMarker(s, { pane: 'site', radius: 9, color: '#fff', weight: 3, fillColor: '#ef4444', fillOpacity: 1 })
      .bindPopup('<strong>' + esc(r.label) + '</strong><br>Nearest isopluvial: ' + D.nearest_line_in.toFixed(2) + ' in<br>ESA: ' + (E.inside ? 'inside' : 'outside') +
        '<br>ASBS: ' + (B.inside.length ? 'inside boundary' : A.inside.length ? 'inside drainage area' : 'outside')).addTo(siteLayer);
  }

  function src(k) { var s = SOURCES[k]; return '<p class="src"><b>Source:</b> <a href="' + s.url + '" target="_blank" rel="noopener">' + esc(s.name) + '</a>. ' + esc(s.edition) + '</p>'; }
  function refs(k) { return '<details class="refs"><summary>Manual reference</summary><ul>' + MANUAL[k].map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></details>'; }
  function badge(t, cls) { return '<span class="badge ' + cls + '">' + esc(t) + '</span>'; }

  function renderResult(r) {
    var D = r.depth, E = r.esa, B = r.asbs.boundary, A = r.asbs.drainage, h = '';
    var flags = [];
    // storm depth
    h += '<section class="card"><h3>85th-percentile 24-hr storm depth</h3>' +
      '<div class="big">' + D.nearest_line_in.toFixed(2) + ' in <small>nearest isopluvial</small></div>' +
      '<p>Nearest line: <b>' + D.nearest_line_in.toFixed(2) + ' in</b>, ' + fmtDist(D.nearest_line_dist_ft) + ' ' + D.nearest_dir + ' of site (searched across all isopluvials).</p>';
    if (D.second_line_in != null)
      h += '<p class="note"><b>Reviewer note</b> (not a manual-specified method): linear interpolation between ' + D.nearest_line_in.toFixed(2) + ' in (' + fmtFt(D.nearest_line_dist_ft) + ' ' + D.nearest_dir + ') and ' +
        D.second_line_in.toFixed(2) + ' in (' + fmtFt(D.second_line_dist_ft) + ' ' + D.second_dir + ') gives <b>' + D.interpolated_in.toFixed(3) + ' in</b>. Figure B.1-1 governs.</p>';
    h += src('rain') + refs('rain') + '</section>';
    // ESA
    var esaTxt = E.inside ? 'Inside mapped ESA' : 'Outside mapped ESA';
    if (E.inside) flags.push('ESA');
    h += '<section class="card"><h3>Environmentally Sensitive Area (ESA, incl. 200 ft buffer)</h3>' +
      '<div class="status-line">' + badge(esaTxt, E.inside ? 'flag' : 'ok') + (E.near_edge ? badge('Within 100 ft of edge - verify', 'warn') : '') + '</div>' +
      '<p>' + (E.inside ? 'Distance to ESA edge: ' : 'Distance to nearest ESA: ') + '<b>' + fmtDist(E.dist_to_edge_ft) + '</b> ' + E.dir + '.</p>' +
      (E.feature_note ? '<p class="muted">Feature note: ' + esc(E.feature_note.length > 220 ? E.feature_note.slice(0, 220) + '...' : E.feature_note) + '</p>' : '') +
      (E.in_hole ? '<p class="note">Site falls inside a hole (excluded area) of the ESA polygon, so it is outside the mapped ESA. Tools that test only the outer ring would flag it as ESA.</p>' : '') +
      (E.near_edge ? '<p class="note">The site is within 100 ft of the mapped ESA edge. Confirm against the source shapefile and the project boundary, not a single point.</p>' : '') +
      src('esa') + refs('esa') + '</section>';
    // ASBS
    var asbsTxt = B.inside.length ? 'Inside ASBS boundary' : A.inside.length ? 'Inside ASBS drainage area' : 'Outside ASBS and ASBS drainage areas';
    if (B.inside.length || A.inside.length) flags.push('ASBS');
    h += '<section class="card"><h3>Area of Special Biological Significance (ASBS)</h3>' +
      '<div class="status-line">' + badge(asbsTxt, (B.inside.length || A.inside.length) ? 'flag' : 'ok') + ((B.near_edge || A.near_edge) ? badge('Within 100 ft of an edge - verify', 'warn') : '') + '</div>' +
      '<dl class="kv">' +
      '<dt>Inside ASBS boundary</dt><dd>' + (B.inside.length ? esc(B.inside.join(', ')) : 'No') + '</dd>' +
      '<dt>Inside ASBS drainage area</dt><dd>' + (A.inside.length ? esc(A.inside.join(', ')) : 'No') + '</dd>' +
      '<dt>Nearest ASBS boundary</dt><dd>' + esc(B.nearest) + ', ' + (B.inside.length ? 'inside (edge ' + fmtDist(B.edge_dist_ft) + ' ' + B.dir + ')' : fmtDist(B.dist_ft) + ' ' + B.dir) + '</dd>' +
      '<dt>Nearest ASBS drainage area</dt><dd>' + esc(A.nearest) + ', ' + (A.inside.length ? 'inside (edge ' + fmtDist(A.edge_dist_ft) + ' ' + A.dir + ')' : fmtDist(A.dist_ft) + ' ' + A.dir) + '</dd>' +
      '</dl>' + src('asbs') + refs('asbs') + '</section>';
    h += '<p class="disclaimer-inline">Preliminary screening - verify with source documents. Not an official City of San Diego product. Distances in NAD83 / CA Zone VI (EPSG:2230) US ft; directions are from the site to the nearest point of each feature.</p>';
    $('resultBody').innerHTML = h;
    r.flags = flags;
  }

  function resultText(r) {
    var D = r.depth, E = r.esa, B = r.asbs.boundary, A = r.asbs.drainage;
    return [r.label + ' (' + r.lat.toFixed(6) + ', ' + r.lon.toFixed(6) + ')' + (r.via ? ' [' + r.via + ']' : ''),
      'PRELIMINARY SCREENING - verify with source documents. Not an official City of San Diego product.', '',
      '85th-percentile 24-hr depth: nearest isopluvial ' + D.nearest_line_in.toFixed(2) + ' in, ' + fmtFt(D.nearest_line_dist_ft) + ' ' + D.nearest_dir,
      D.second_line_in != null ? '  Reviewer note (not a manual method): interpolated ' + D.interpolated_in.toFixed(3) + ' in between ' + D.nearest_line_in.toFixed(2) + ' in and ' + D.second_line_in.toFixed(2) + ' in (' + fmtFt(D.second_line_dist_ft) + ' ' + D.second_dir + ')' : '',
      '  Source: ' + SOURCES.rain.name + '. ' + MANUAL.rain[0],
      'ESA: ' + (E.inside ? 'INSIDE' : 'OUTSIDE') + ' mapped ESA (incl. 200 ft buffer); ' + fmtFt(E.dist_to_edge_ft) + ' ' + E.dir + ' to ESA edge' + (E.near_edge ? ' (within 100 ft - verify)' : '') + (E.in_hole ? ' (site is in a hole of the ESA polygon)' : ''),
      '  Source: ' + SOURCES.esa.name + '. ' + SOURCES.esa.edition,
      'ASBS boundary: ' + (B.inside.length ? 'INSIDE ' + B.inside.join(', ') : 'outside; nearest ' + B.nearest + ' ' + fmtDist(B.dist_ft) + ' ' + B.dir),
      'ASBS drainage area: ' + (A.inside.length ? 'INSIDE ' + A.inside.join(', ') : 'outside; nearest ' + A.nearest + ' ' + fmtDist(A.dist_ft) + ' ' + A.dir),
      '  Source: ' + SOURCES.asbs.name + '. ' + SOURCES.asbs.edition].filter(Boolean).join('\n');
  }
  $('copyBtn').addEventListener('click', function () {
    if (!state.last) return; var t = resultText(state.last);
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { $('copyBtn').textContent = 'Copied'; setTimeout(function () { $('copyBtn').textContent = 'Copy'; }, 1500); },
      function () { window.prompt('Copy the screening result:', t); });
  });

  map.on('click', function (e) { screenPoint(e.latlng.lat, e.latlng.lng, 'Selected map location', { via: 'map click' }); });

  // ---------- geocoding ----------
  var ZIP_COMMUNITY = { '92037': 'La Jolla', '92038': 'La Jolla', '92039': 'La Jolla', '92092': 'La Jolla', '92093': 'La Jolla',
    '92173': 'San Ysidro', '92143': 'San Ysidro', '92014': 'Del Mar', '92067': 'Rancho Santa Fe', '92091': 'Rancho Santa Fe',
    '92118': 'Coronado', '91932': 'Imperial Beach', '92075': 'Solana Beach', '91950': 'National City' };
  var COMMUNITIES = ['La Jolla'];

  function parseLatLon(q) {
    var m = q.trim().match(/^\(?\s*(-?\d{1,3}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*\)?$/);
    if (!m) return null;
    var a = parseFloat(m[1]), b = parseFloat(m[2]);
    if (inBounds(a, b)) return [a, b];
    if (inBounds(b, a)) return [b, a]; // lon, lat order
    return { out: true };
  }
  function addressVariants(q) {
    var s = q.trim().replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ');
    var zipM = s.match(/(?:,|\b(?:CA|California)\b|\s)\s*(9\d{4})(?:-\d{4})?\s*$/i), zip = (zipM && s.trim().indexOf(zipM[1]) > 0) ? zipM[1] : '';
    var hasCA = /\b(CA|Calif\.?|California)\b/i.test(s), hasSD = /san diego/i.test(s);
    var street = (zip ? s.replace(new RegExp('\\s*,?\\s*' + zip + '(?:-\\d{4})?\\s*$'), '') : s).replace(/,?\s*\b(CA|Calif\.?|California)\b\.?/ig, '').replace(/,?\s*\bSan Diego\b/ig, '')
      .replace(/,\s*(USA|United States)$/i, '').replace(/[,\s]+$/, '');
    var parts = street.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    var line1 = parts[0] || street, z = zip ? ' ' + zip : '';
    var v = [];
    v.push(hasSD ? s : s + ', San Diego, CA');         // original site behaviour
    if (!hasCA) v.push(s + ', CA');
    v.push(street + ', CA' + z);                        // drop "San Diego"
    if (zip && ZIP_COMMUNITY[zip]) v.push(line1 + ', ' + ZIP_COMMUNITY[zip] + ', CA ' + zip);
    if (!zip) COMMUNITIES.forEach(function (c) { v.push(line1 + ', ' + c + ', CA'); });
    v.push(line1 + (z ? ',' + z : ''));
    var seen = {};
    return v.filter(function (x) { var k = x.toLowerCase(); if (seen[k]) return false; seen[k] = 1; return true; });
  }
  var cbN = 0;
  function censusJSONP(address) {
    return new Promise(function (resolve, reject) {
      var cb = '__census' + Date.now() + '_' + (cbN++), sc = document.createElement('script');
      var done = function () { delete window[cb]; sc.remove(); };
      var timer = setTimeout(function () { done(); reject(new Error('Census geocoder timed out')); }, 12000);
      window[cb] = function (d) { clearTimeout(timer); done(); resolve(d); };
      sc.onerror = function () { clearTimeout(timer); done(); reject(new Error('Census geocoder unavailable')); };
      sc.src = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?benchmark=Public_AR_Current&format=jsonp&callback=' + cb + '&address=' + encodeURIComponent(address);
      document.head.appendChild(sc);
    });
  }
  function nominatim(q) {
    var u = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=us&bounded=1&viewbox=' +
      [BOUNDS.lonMin, BOUNDS.latMax, BOUNDS.lonMax, BOUNDS.latMin].join(',') + '&q=' + encodeURIComponent(q);
    return fetch(u, { headers: { 'Accept': 'application/json' } }).then(function (r) { if (!r.ok) throw new Error('Nominatim ' + r.status); return r.json(); });
  }
  function photon(q) {
    var u = 'https://photon.komoot.io/api/?limit=5&lang=en&bbox=' + [BOUNDS.lonMin, BOUNDS.latMin, BOUNDS.lonMax, BOUNDS.latMax].join(',') + '&q=' + encodeURIComponent(q);
    return fetch(u).then(function (r) { if (!r.ok) throw new Error('Photon ' + r.status); return r.json(); }).then(function (d) {
      return (d.features || []).map(function (f) {
        var p = f.properties || {}, c = f.geometry.coordinates;
        var label = [p.name, [p.housenumber, p.street].filter(Boolean).join(' '), p.district || p.locality, p.city, p.postcode].filter(Boolean).join(', ');
        return { lat: c[1], lon: c[0], label: label || q };
      }).filter(function (m) { return inBounds(m.lat, m.lon); });
    });
  }
  async function geocode(q) {
    var tried = [], lastErr = null;
    for (var i = 0; i < addressVariants(q).length; i++) {
      var a = addressVariants(q)[i]; tried.push(a);
      setMsg('Searching U.S. Census geocoder: "' + a + '"...');
      try {
        var d = await censusJSONP(a);
        var ms = ((d && d.result && d.result.addressMatches) || []).filter(function (m) { return inBounds(m.coordinates.y, m.coordinates.x); });
        if (ms.length) return { matches: ms.map(function (m) { return { lat: m.coordinates.y, lon: m.coordinates.x, label: m.matchedAddress }; }), via: 'U.S. Census Geocoder', query: a, tried: tried };
      } catch (e) { lastErr = e; }
    }
    setMsg('No Census match; trying OpenStreetMap Nominatim...');
    try {
      var n = await nominatim(q);
      n = n.filter(function (m) { return inBounds(+m.lat, +m.lon); });
      if (n.length) return { matches: n.map(function (m) { return { lat: +m.lat, lon: +m.lon, label: m.display_name }; }), via: 'OpenStreetMap Nominatim (fallback, verify location)', query: q, tried: tried };
    } catch (e) { lastErr = e; }
    setMsg('Trying Photon (OpenStreetMap) geocoder...');
    try {
      var ph = await photon(q);
      if (ph.length) return { matches: ph, via: 'Photon / OpenStreetMap (fallback, verify location)', query: q, tried: tried };
    } catch (e) { lastErr = e; }
    var err = new Error('No match in the San Diego area' + (lastErr ? ' (' + lastErr.message + ')' : '')); err.tried = tried; throw err;
  }
  function setMsg(t, cls) { var el = $('searchMsg'); el.textContent = t || ''; el.className = 'search-msg ' + (cls || ''); }

  async function doSearch(q) {
    q = (q || '').trim(); if (!q) return;
    var btn = $('searchBtn'); btn.disabled = true; btn.textContent = '...'; $('altMatches').hidden = true;
    try {
      var ll = parseLatLon(q);
      if (ll && ll.out) throw new Error('Coordinates are outside the San Diego area (lat 32.4-33.3, lon -117.8 to -116.7)');
      if (ll) { setMsg(''); await screenPoint(ll[0], ll[1], 'Entered coordinates', { zoom: 17, via: 'entered coordinates' }); return; }
      var g = await geocode(q), m = g.matches[0];
      setMsg('Matched by ' + g.via + (g.query !== q ? ' using "' + g.query + '"' : '') + '.', 'ok');
      if (g.matches.length > 1) {
        var ul = $('altMatches'); ul.innerHTML = '<li class="muted">Other matches:</li>';
        g.matches.slice(1, 5).forEach(function (x) {
          var li = document.createElement('li'), b = document.createElement('button'); b.type = 'button'; b.textContent = x.label;
          b.onclick = function () { screenPoint(x.lat, x.lon, x.label, { zoom: 17, via: g.via }); }; li.appendChild(b); ul.appendChild(li);
        });
        ul.hidden = false;
      }
      await screenPoint(m.lat, m.lon, m.label, { zoom: 17, via: g.via });
    } catch (e) {
      setMsg(e.message + '. Try adding the ZIP code, entering "lat, lon", or clicking the map.' + (e.tried ? ' Tried: ' + e.tried.join(' | ') : ''), 'err');
    } finally { btn.disabled = false; btn.textContent = 'Search'; }
  }
  $('searchForm').addEventListener('submit', function (e) { e.preventDefault(); doSearch($('address').value); });

  $('locateBtn').addEventListener('click', function () {
    if (!navigator.geolocation) { setMsg('Location is not available in this browser.', 'err'); return; }
    setMsg('Finding your location...');
    navigator.geolocation.getCurrentPosition(function (p) {
      var lat = p.coords.latitude, lon = p.coords.longitude;
      if (!inBounds(lat, lon)) { setMsg('Your location (' + lat.toFixed(4) + ', ' + lon.toFixed(4) + ') is outside the San Diego area.', 'err'); return; }
      setMsg('Using device location (accuracy about ' + Math.round(p.coords.accuracy * 3.28084) + ' ft).', 'ok');
      screenPoint(lat, lon, 'Current location', { zoom: 17, via: 'device location' });
    }, function (err) { setMsg('Location unavailable: ' + err.message, 'err'); }, { enableHighAccuracy: true, timeout: 15000 });
  });

  // ---------- about dialog ----------
  $('sourceList').innerHTML = Object.keys(SOURCES).map(function (k) { var s = SOURCES[k]; return '<li><a href="' + s.url + '" target="_blank" rel="noopener">' + esc(s.name) + '</a>. ' + esc(s.edition) + '</li>'; }).join('') +
    '<li>Appendix O files are published on the City&rsquo;s <a href="' + LDM + '" target="_blank" rel="noopener">Land Development Manual page</a>.</li>';
  $('manualList').innerHTML = ['rain', 'esa', 'asbs'].map(function (k) { return MANUAL[k].map(function (t) { return '<li>' + esc(t) + '</li>'; }).join(''); }).join('');
  var dlg = $('aboutDialog');
  $('aboutBtn').addEventListener('click', function () { dlg.showModal(); });
  $('closeDialog').addEventListener('click', function () { dlg.close(); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });

  // ---------- deep links: #lat,lon or ?q=address ----------
  var hm = location.hash.replace('#', '').match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
  var qp = new URLSearchParams(location.search).get('q');
  if (hm && inBounds(+hm[1], +hm[2])) screenPoint(+hm[1], +hm[2], 'Linked location', { zoom: 17, via: 'link' });
  else if (qp) { $('address').value = qp; doSearch(qp); }

  window.__screening = { screenPoint: screenPoint, doSearch: doSearch, addressVariants: addressVariants, state: state, map: map };
})();
