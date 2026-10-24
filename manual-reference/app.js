/* Manual & Code Reference - static, no server. Data: ./data/catalog.js (MR_DOCS, MR_REFS) + ./data/text-<doc>.json.
 * Pages render with PDF.js from unaltered copies of the City PDFs in ./docs/ (see data/catalog.js for MD5s). */
(function () {
  'use strict';
  var DOCS = window.MR_DOCS, REFS = window.MR_REFS, byId = {};
  DOCS.forEach(function (d, i) { d.order = i; byId[d.id] = d; });
  var B5_XLSX = 'https://www.sandiego.gov/sites/default/files/2024-08/appendix_b.5_worksheets_v2-copy.xlsx';
  var LDM = 'https://www.sandiego.gov/planning/programs/landdevcode/landdevmanual';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var reEsc = function (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };

  if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../assets/vendor/pdfjs/pdf.worker.min.js', location.href).href;

  /* ---------- state ---------- */
  var S = { doc: null, page: 1, ref: null, zoom: 'fit', terms: [], pdfs: {}, texts: {}, textReq: {}, renderTask: null, renderSeq: 0 };

  /* ---------- helpers ---------- */
  function partOf(d, p) { return (d.parts || []).filter(function (x) { return p >= x.from_ && p <= x.to; })[0] || null; }
  /* printed page label from the page footer; the two form files restart numbering per form, so only PDF pages are used there */
  function printed(d, p) { return d.id === 'appi' || d.id === 'j1' ? null : (d.labels[p - 1] || null); }
  function editionOf(d, p) { var pt = partOf(d, p); return pt ? pt.edition : d.edition; }
  function groupsOn() { return [].slice.call(document.querySelectorAll('input[name=grp]:checked')).map(function (x) { return x.value; }); }
  function docLabel(d, p) {
    var pt = partOf(d, p);
    if (d.id === 'sws') return 'City of San Diego Stormwater Standards, ' + pt.name.replace(' - ', ': ') + ' (' + pt.edition + ')';
    if (d.id === 'appi') return 'City of San Diego Stormwater Standards, Appendix I Forms and Checklists (August 2024 Edition)';
    if (d.id === 'j1') return 'City of San Diego Green Street PDP Exemption Forms (January 2018 Edition)';
    if (d.id === 'ddm') return 'City of San Diego Drainage Design Manual (January 2017 Edition)';
    var m = d.short.match(/Ch\.(\d+) Art\.(\d+) Div\.(\d+)/);
    return 'San Diego Municipal Code, Chapter ' + m[1] + ', Article ' + m[2] + ', Division ' + m[3];
  }
  function refLabel(r) {
    var id = r.id.replace(/^Part \d /, '');
    if (r.type === 'Section') return /^(§|Ch\.|App\.)/.test(id) ? id + ' ' + r.title : (id === 'Start' ? r.title : 'Section ' + id + ' ' + r.title);
    if (r.type === 'Chapter') return id.indexOf('Ch.') === 0 ? 'Chapter ' + id.slice(4) + ' ' + r.title : 'Chapter ' + id + ' ' + r.title;
    if (r.type === 'Appendix') return 'Appendix ' + id.replace('App. ', '') + ' ' + r.title;
    return id + ', ' + r.title;
  }
  function pageCite(d, p) {
    if (d.id.indexOf('sdmc') === 0) return 'p. ' + p;
    var pr = printed(d, p);
    return pr ? 'p. ' + pr + ' (PDF p. ' + p + ')' : 'PDF p. ' + p;
  }
  function citation() {
    var d = S.doc, p = S.page, parts = [docLabel(d, p)];
    if (S.ref && S.ref.page === p) parts.push(refLabel(S.ref));
    parts.push(pageCite(d, p));
    return parts.join(', ') + '.';
  }
  function nearestHeading(d, p) {
    var best = null;
    REFS.forEach(function (r) {
      if (r.doc === d.id && /Section|Chapter|Appendix/.test(r.type) && r.page <= p && (!best || r.page >= best.page)) best = r;
    });
    var pt = partOf(d, p);
    if (best && pt && (best.page < pt.from_)) return null;
    return best;
  }
  function toast(msg) {
    var t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2200);
  }
  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).then(function () { toast('Citation copied'); }, fallback);
    fallback();
    function fallback() { var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('Citation copied'); } catch (e) { prompt('Copy citation:', text); } ta.remove(); }
  }

  /* ---------- text data ---------- */
  function loadText(id) {
    if (S.texts[id]) return Promise.resolve(S.texts[id]);
    if (!S.textReq[id]) S.textReq[id] = fetch('./data/text-' + id + '.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) { S.texts[id] = { raw: j.pages, low: j.pages.map(function (t) { return t.toLowerCase().replace(/\s+/g, ' '); }) }; return S.texts[id]; });
    return S.textReq[id];
  }

  /* ---------- search ---------- */
  var TYPE_WORDS = /^(worksheet|table|figure|form|section|sec\.?|appendix|app\.?|chapter|ch\.?|§)\s*/;
  function norm(s) { return String(s).toLowerCase().replace(/^appendix\s*/, 'app.').replace(/[§\s]/g, ''); }
  function stripId(id) { return norm(id.replace(/^Part \d /, '').replace(TYPE_WORDS, '').replace(/^(Worksheet|Table|Figure|Form|App\.|Ch\.)\s*/i, '')); }
  REFS.forEach(function (r) { r._n = norm(r.id); r._s = stripId(r.id); r._t = (r.id + ' ' + r.title + ' ' + r.keys + ' ' + byId[r.doc].short).toLowerCase(); });

  function searchRefs(q, groups, exactOnly) {
    var ql = q.trim().toLowerCase(), qn = norm(ql), typed = TYPE_WORDS.test(ql), qs = norm(ql.replace(TYPE_WORDS, ''));
    var words = ql.split(/\s+/).filter(function (w) { return w.length > 1; });
    var out = [];
    REFS.forEach(function (r) {
      if (groups.indexOf(byId[r.doc].group) < 0) return;
      var score = -1;
      var tw = typed ? ql.match(TYPE_WORDS)[1] : '';
      var typeOk = !typed || (/^(section|sec|§)/.test(tw) && r.type === 'Section') || (/^(chapter|ch)/.test(tw) && r.type === 'Chapter');
      if (r._n === qn || (r._s === qs && typeOk && (!typed || tw !== '' ))) score = 0;
      else if (qs.length >= 2 && /[\d]/.test(qs) && (r._s.indexOf(qs) === 0 || r._n.indexOf(qn) === 0)) score = 1;
      else if (words.length && words.every(function (w) { return r._t.indexOf(w) >= 0; })) score = 2;
      if (score >= 0) out.push({ r: r, s: score });
    });
    if (exactOnly) out = out.filter(function (x) { return x.s === 0; });
    out.sort(function (a, b) { return a.s - b.s || byId[a.r.doc].order - byId[b.r.doc].order || a.r.page - b.r.page; });
    return out.map(function (x) { return x.r; });
  }

  function searchText(q, groups) {
    var ql = q.trim().toLowerCase().replace(/\s+/g, ' ');
    var words = ql.split(' ').filter(function (w) { return w.length > 1; });
    if (!words.length) return Promise.resolve([]);
    var docs = DOCS.filter(function (d) { return groups.indexOf(d.group) >= 0; });
    return Promise.all(docs.map(function (d) { return loadText(d.id).then(function (t) { return { d: d, t: t }; }, function () { return { d: d, t: null, err: true }; }); }))
      .then(function (arr) {
        return arr.map(function (x) {
          if (!x.t) return { d: x.d, hits: [], err: true };
          var hits = [];
          x.t.low.forEach(function (txt, i) {
            if (!words.every(function (w) { return txt.indexOf(w) >= 0; })) return;
            /* relevance: exact phrase hits weigh most; table-of-contents / list pages (dot leaders) rank last */
            var score = count(txt, ql) * 5 + words.reduce(function (n, w) { return n + count(txt, w); }, 0);
            if ((txt.match(/\.{6,}/g) || []).length > 3) score /= 10;
            hits.push({ page: i + 1, phrase: txt.indexOf(ql) >= 0, score: score });
          });
          hits.sort(function (a, b) { return (b.phrase - a.phrase) || b.score - a.score || a.page - b.page; });
          return { d: x.d, hits: hits };
        });
      });
  }
  function count(txt, w) { var n = 0, i = txt.indexOf(w); while (i >= 0 && n < 50) { n++; i = txt.indexOf(w, i + w.length); } return n; }
  function snippet(d, p, terms) {
    var raw = S.texts[d.id].raw[p - 1].replace(/\s+/g, ' '), low = raw.toLowerCase();
    var phrase = terms.join(' '), at = low.indexOf(phrase);
    if (at < 0) at = low.indexOf(terms[0]);
    var a = Math.max(0, at - 80), b = Math.min(raw.length, at + 170);
    var s = (a > 0 ? '…' : '') + raw.slice(a, b) + (b < raw.length ? '…' : '');
    var html = esc(s);
    terms.forEach(function (w) { if (w.length > 1) html = html.replace(new RegExp('(' + reEsc(esc(w)) + ')', 'gi'), '<mark>$1</mark>'); });
    return html;
  }


  /* ---------- visuals: icons, badges, page thumbnails (pre-rendered sprites from the hosted PDFs) ---------- */
  var ICON = {
    Section: '<path d="M9 5c-2 0-3 1-3 2.5S7.5 10 9.5 10.5 13 12 13 13.5 12 16 10 16M11 3v2M8 16v2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    Chapter: '<path d="M3 4h5a3 3 0 013 3v10a2 2 0 00-2-2H3zM19 4h-5a3 3 0 00-3 3v10a2 2 0 012-2h6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    Table: '<rect x="3" y="4" width="16" height="13" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3 8.5h16M3 12.8h16M9 4v13" stroke="currentColor" stroke-width="1.6"/>',
    Figure: '<rect x="3" y="4" width="16" height="13" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5 15l4-5 3 3 2-2 3 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="14.5" cy="7.8" r="1.4" fill="currentColor"/>',
    Worksheet: '<rect x="4" y="3" width="14" height="16" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7 8h8M7 11.5h8M7 15h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    Form: '<rect x="4" y="3" width="14" height="16" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7 8l1.4 1.4L11 7M7 13.5l1.4 1.4L11 12.5M13 8.5h2.5M13 14h2.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
    Appendix: '<path d="M5 3h8l4 4v12H5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M13 3v4h4" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    Page: '<path d="M5 3h8l4 4v12H5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    Excel: '<rect x="3" y="4" width="16" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7 8l4 6M11 8l-4 6M13 9h3M13 13h3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
    Link: '<path d="M9 5H5v12h12v-4M12 4h6v6M18 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    Code: '<path d="M6 4h10M6 18h10M8 4v14M14 4v14" stroke="currentColor" stroke-width="1.8"/>',
    Read: '<path d="M2 11s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="11" cy="11" r="2.6" fill="currentColor"/>'
  };
  function icon(k) { return '<svg viewBox="0 0 22 22" aria-hidden="true">' + (ICON[k] || ICON.Page) + '</svg>'; }
  function badge(type) { return '<span class="badge b-' + type + '">' + icon(type) + type + '</span>'; }
  function docColor(d) { return d.id.indexOf('sdmc') === 0 ? 'd-sdmc' : d.id === 'ddm' ? 'd-ddm' : (d.id === 'appi' || d.id === 'j1') ? 'd-forms' : 'd-sws'; }
  var T = window.MR_THUMBS, CROP = 0.89;
  /* thumb(doc, page, width[, crop]) -> span with a background slice of the sprite; crop<1 trims the page footer */
  function thumb(docId, p, dw, crop) {
    if (!T || !T.files[docId]) return '';
    var k = p - 1, file = T.files[docId][Math.floor(k / T.per)]; if (!file) return '';
    k = k % T.per;
    /* crop (fraction of page height kept) trims the printed page footer so the City footer mark is not shown in previews */
    var land = T.land && T.land[docId] && T.land[docId].indexOf(p) >= 0, ph = land ? Math.round(T.w * 8.5 / 11) : T.h, top = land ? Math.floor((T.h - ph) / 2) : 0;
    var s = dw / T.w, h = Math.round(ph * s * (crop || 1));
    return '<span class="thumb" data-bg="' + file + '" role="img" aria-label="Page ' + p + ' preview" style="width:' + dw + 'px;height:' + h + 'px;background-size:' + (T.cols * T.w * s).toFixed(1) + 'px auto;background-position:-' + ((k % T.cols) * T.w * s).toFixed(1) + 'px -' + ((Math.floor(k / T.cols) * T.h + top) * s).toFixed(1) + 'px"></span>';
  }
  /* lazy-load sprite sheets only when a thumbnail scrolls into view */
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } });
  }, { rootMargin: '300px' }) : null;
  function show(el) { var f = el.getAttribute('data-bg'); if (f) { el.style.backgroundImage = 'url("' + f + '")'; el.removeAttribute('data-bg'); } }
  function lazy(root) { [].forEach.call((root || document).querySelectorAll('.thumb[data-bg]'), function (el) { if (io) io.observe(el); else show(el); }); }

  /* ---------- search UI (dropdown under the search box) ---------- */
  var searchSeq = 0, debounce = null;
  function openResults(on) { $('results').hidden = !on; }
  function runSearch() {
    var q = $('q').value.trim(), box = $('results'), seq = ++searchSeq, groups = groupsOn();
    if (q.length < 2) { box.innerHTML = ''; openResults(false); return; }
    openResults(true);
    var refs = searchRefs(q, groups), html = '';
    var exact = searchRefs(q, groups, true);
    if (refs.length) {
      html += '<div class="mr-group"><span>' + (exact.length ? 'Exact reference' : 'References') + '</span><span>' + refs.length + '</span></div>';
      html += refs.slice(0, 12).map(function (r) { return refHit(r, exact.indexOf(r) >= 0); }).join('');
      if (refs.length > 12) html += '<button type="button" class="mr-more" data-more-refs>Show all ' + refs.length + ' references</button>';
    }
    box.innerHTML = html + '<p class="mr-msg">Searching the full text…</p>';
    box._refs = refs;
    var terms = q.toLowerCase().split(/\s+/).filter(function (w) { return w.length > 1; });
    searchText(q, groups).then(function (res) {
      if (seq !== searchSeq) return;
      var th = '', total = 0;
      res.forEach(function (g) {
        if (g.err) { th += '<p class="mr-msg">Could not load the text of ' + esc(g.d.short) + '.</p>'; return; }
        if (!g.hits.length) return;
        total += g.hits.length;
        th += '<div class="mr-group"><span><span class="dot ' + docColor(g.d) + '"></span>Full text · ' + esc(g.d.short) + '</span><span>' + g.hits.length + ' page' + (g.hits.length > 1 ? 's' : '') + '</span></div>';
        th += '<div data-doc="' + g.d.id + '">' + g.hits.slice(0, 5).map(function (h) { return textHit(g.d, h.page, terms); }).join('') + '</div>';
        if (g.hits.length > 5) th += '<button type="button" class="mr-more" data-more-doc="' + g.d.id + '">Show all ' + g.hits.length + ' pages in ' + esc(g.d.short) + '</button>';
      });
      box._text = res; box._terms = terms;
      box.innerHTML = html + (total ? th : '<p class="mr-msg">' + (refs.length ? 'No full-text matches for all words.' : 'No matches. Try fewer or shorter words.') + '</p>');
      lazy(box);
    });
    lazy(box);
  }
  function where(d, p) { var pr = printed(d, p); return esc(d.short) + (partOf(d, p) ? ' · ' + esc(partOf(d, p).short) : '') + ' · ' + (pr && d.id.indexOf('sdmc') ? 'p. ' + esc(pr) + ' · ' : '') + 'PDF p. ' + p; }
  function refHit(r, ex) {
    var d = byId[r.doc];
    return '<button type="button" class="mr-hit' + (ex ? ' exact' : '') + '" data-ref="' + REFS.indexOf(r) + '">' + thumb(r.doc, r.page, 40, CROP) + '<span class="hb">' + badge(r.type) +
      '<span class="t"><b>' + esc(r.id.replace(/^(Worksheet|Table|Figure|Form) /, '$1 ')) + '</b> ' + esc(r.title) + '</span><small><span class="dot ' + docColor(d) + '"></span>' + where(d, r.page) + '</small></span></button>';
  }
  function textHit(d, p, terms) {
    return '<button type="button" class="mr-hit" data-doc="' + d.id + '" data-page="' + p + '">' + thumb(d.id, p, 40, CROP) + '<span class="hb"><span class="t"><b>' + (d.id.indexOf('sdmc') ? 'Page' : 'Div. page') + '</b> ' + where(d, p) + '</span><small>' + snippet(d, p, terms) + '</small></span></button>';
  }
  $('results').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var box = $('results');
    if (b.hasAttribute('data-more-refs')) { var div = document.createElement('div'); div.innerHTML = box._refs.slice(12, 300).map(function (r) { return refHit(r); }).join(''); b.replaceWith(div); lazy(div); return; }
    if (b.hasAttribute('data-more-doc')) {
      var id = b.getAttribute('data-more-doc'), g = box._text.filter(function (x) { return x.d.id === id; })[0];
      var list = box.querySelector('div[data-doc="' + id + '"]'); list.innerHTML = g.hits.slice(0, 300).map(function (h) { return textHit(g.d, h.page, box._terms); }).join(''); b.remove(); lazy(list); return;
    }
    if (b.hasAttribute('data-ref')) { var r = REFS[+b.getAttribute('data-ref')]; openResults(false); openRef(r, termsFor(r)); }
    else if (b.hasAttribute('data-page')) { openResults(false); openPage(byId[b.getAttribute('data-doc')], +b.getAttribute('data-page'), null, box._terms); }
  });
  /* highlight the bare reference number (e.g. "B.5-4", "142.0220"); multi-word captions are split across PDF text items */
  function termsFor(r) { var id = r.id.replace(/^Part \d /, '').replace(/^(Worksheet|Table|Figure|Form|App\.|Ch\.|§)\s*/, ''); return id.length > 1 ? [id.toLowerCase()] : []; }
  $('q').addEventListener('input', function () { clearTimeout(debounce); debounce = setTimeout(runSearch, 220); });
  $('q').addEventListener('focus', function () { if ($('results').innerHTML) openResults(true); });
  $('searchForm').addEventListener('submit', function (e) {
    e.preventDefault(); clearTimeout(debounce); runSearch();
    var top = searchRefs($('q').value, groupsOn(), true)[0];
    if (top) { openResults(false); openRef(top, termsFor(top)); }  /* Enter on an exact reference ID opens it */
  });
  $('clearBtn').addEventListener('click', function () { $('q').value = ''; $('results').innerHTML = ''; openResults(false); $('q').focus(); });
  [].forEach.call(document.querySelectorAll('input[name=grp]'), function (c) { c.addEventListener('change', runSearch); });
  document.addEventListener('click', function (e) { if (!e.target.closest('.mr-hero-search')) openResults(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('results').hidden) { openResults(false); $('q').focus(); } });

  function findRef(doc, id) { return REFS.filter(function (x) { return x.doc === doc && x.id === id; })[0]; }
  function onRefClick(root) {
    root.addEventListener('click', function (e) { var b = e.target.closest('[data-ref]'); if (b) { var r = REFS[+b.getAttribute('data-ref')]; openRef(r, termsFor(r)); } });
  }

  /* ---------- quick picks + featured cards ---------- */
  var QUICK = [['sws', 'Worksheet B.5-4'], ['sws', 'Worksheet B.5-5'], ['sws', 'Worksheet B.5-6'], ['sws', 'Table 5-1'], ['sws', '1.7', '50% Rule · 1.7'],
    ['sws', 'Figure B.1-1', 'Isopluvials · Fig. B.1-1'], ['sws', 'Worksheet B.2-1', 'DCV · B.2-1'], ['appi', 'Form I-1'], ['sdmc-142-2', '§142.0220']];
  $('pills').innerHTML = '<small>FREQUENTLY USED</small>' + QUICK.map(function (q) {
    var r = findRef(q[0], q[1]);
    return r ? '<button type="button" data-ref="' + REFS.indexOf(r) + '">' + esc(q[2] || q[1].replace('Worksheet ', '')) + '</button>' : '';
  }).join('');
  onRefClick($('pills'));
  var FEATURED = [['sws', 'Worksheet B.5-4', 'Biofiltration sizing'], ['sws', 'Table 5-1', 'Pollutant control BMPs'], ['sws', 'Worksheet B.2-1', 'Design capture volume'],
    ['sws', '1.7', '50% Rule'], ['appi', 'Form I-1', 'Permanent BMP applicability'], ['ddm', 'Table 7-1', 'Max. channel velocities']];
  $('featured').innerHTML = FEATURED.map(function (f) {
    var r = findRef(f[0], f[1]); if (!r) return '';
    var d = byId[r.doc];
    return '<button type="button" class="mr-fcard" data-ref="' + REFS.indexOf(r) + '" title="' + esc(r.title) + '">' + thumb(r.doc, r.page, 110, CROP) + badge(r.type) +
      '<b>' + esc(r.type === 'Section' ? 'Section ' + r.id : r.id) + '</b><small>' + esc(f[2]) + '<br><span class="dot ' + docColor(d) + '"></span>' + esc(d.short) + ' · ' + pageCite(d, r.page) + '</small></button>';
  }).join('');
  onRefClick($('featured'));
  var totalPages = DOCS.reduce(function (n, d) { return n + d.pages; }, 0);
  $('stats').innerHTML = '<span><b>' + DOCS.length + '</b>City PDFs</span><span><b>' + totalPages.toLocaleString() + '</b>searchable pages</span><span><b>' + REFS.length + '</b>indexed references</span><span><b>1</b>click to the page</span>';

  /* ---------- reference index: doc chips + type tabs + grid ---------- */
  var TYPES = ['Section', 'Chapter', 'Table', 'Figure', 'Worksheet', 'Form', 'Appendix'];
  var DOCSETS = [
    { key: 'sws', label: 'Storm Water Standards', cls: 'd-sws', docs: ['sws'] },
    { key: 'forms', label: 'Forms (App. I, J-1)', cls: 'd-forms', docs: ['appi', 'j1'] },
    { key: 'ddm', label: 'Drainage Design Manual', cls: 'd-ddm', docs: ['ddm'] },
    { key: 'sdmc', label: 'Municipal Code', cls: 'd-sdmc', docs: ['sdmc-142-2', 'sdmc-43-3', 'sdmc-142-1'] }];
  var IDX = { set: DOCSETS[0], type: 'Worksheet' };
  $('docChips').innerHTML = DOCSETS.map(function (s, i) { return '<button type="button" role="tab" data-set="' + i + '" aria-selected="' + (i === 0) + '"><span class="dot ' + s.cls + '"></span>' + esc(s.label) + '</button>'; }).join('');
  $('docChips').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-set]'); if (!b) return;
    IDX.set = DOCSETS[+b.getAttribute('data-set')];
    [].forEach.call($('docChips').children, function (x) { x.setAttribute('aria-selected', x === b); });
    fillTabs();
  });
  function inSet(r) { return IDX.set.docs.indexOf(r.doc) >= 0; }
  function fillTabs() {
    var have = TYPES.filter(function (t) { return REFS.some(function (r) { return inSet(r) && r.type === t; }); });
    if (have.indexOf(IDX.type) < 0) IDX.type = have.indexOf('Worksheet') >= 0 ? 'Worksheet' : have.indexOf('Table') >= 0 ? 'Table' : have[0];
    $('typeTabs').innerHTML = have.map(function (t) {
      var n = REFS.filter(function (r) { return inSet(r) && r.type === t; }).length;
      return '<button type="button" role="tab" data-type="' + t + '" aria-selected="' + (t === IDX.type) + '">' + icon(t) + t + (t === 'Appendix' ? 'es' : 's') + '<small>' + n + '</small></button>';
    }).join('');
    fillGrid();
  }
  $('typeTabs').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-type]'); if (!b) return;
    IDX.type = b.getAttribute('data-type');
    [].forEach.call($('typeTabs').children, function (x) { x.setAttribute('aria-selected', x === b); });
    fillGrid();
  });
  var VISUAL = { Table: 1, Figure: 1, Worksheet: 1, Form: 1 };
  function fillGrid() {
    var list = REFS.filter(function (r) { return inSet(r) && r.type === IDX.type; }).slice().sort(function (a, b) { return byId[a.doc].order - byId[b.doc].order || a.page - b.page; });
    var g = $('refGrid'), vis = !!VISUAL[IDX.type];
    g.className = 'mr-refgrid' + (vis ? ' visual' : '');
    g.innerHTML = list.map(function (r) {
      var d = byId[r.doc], i = REFS.indexOf(r);
      if (vis) return '<button type="button" class="mr-vcard" data-ref="' + i + '">' + thumb(r.doc, r.page, 120, CROP) + '<b>' + esc(r.id) + '</b><span>' + esc(r.title) + '</span><i>' + pageCite(d, r.page) + '</i></button>';
      return '<button type="button" class="mr-ref" data-ref="' + i + '"><b>' + esc(r.type === 'Section' && !/^§/.test(r.id) ? r.id.replace(/^Part (\d) /, 'P$1 ') : r.id) + '</b><span>' + esc(r.title) + '</span><i>' + (d.id.indexOf('sdmc') === 0 ? 'p. ' + r.page : (printed(d, r.page) || 'p.' + r.page)) + '</i></button>';
    }).join('');
    g.scrollTop = 0; lazy(g);
  }
  onRefClick($('refGrid'));
  fillTabs();

  /* ---------- working files & official references ---------- */
  var RES = [
    { ico: 'Excel', color: '#15803d', title: 'Appendix B.5 Excel worksheets', sub: 'City working file, Aug 2024 v2 (B.5-1 to B.5-7)', href: B5_XLSX },
    { ico: 'Form', color: '#b45309', title: 'Appendix I forms & checklists', sub: 'Forms I-1 to I-10, open here', open: ['appi', 1] },
    { ico: 'Form', color: '#7c5b12', title: 'Form J-1 Green Street', sub: 'PDP exemption form, open here', open: ['j1', 1] },
    { ico: 'Link', color: '#0867a8', title: 'Land Development Manual', sub: 'Storm water standards & DDM on sandiego.gov', href: LDM },
    { ico: 'Code', color: '#9f1239', title: 'Municipal Code', sub: 'Official code chapters on sandiego.gov', href: 'https://www.sandiego.gov/city-clerk/officialdocs/municipal-code' }];
  $('resCards').innerHTML = RES.slice(0, 4).concat(RES.slice(4)).map(function (r, i) {
    var inner = '<span class="ico" style="background:' + r.color + '">' + icon(r.ico) + '</span><span><b>' + esc(r.title) + '</b><small>' + esc(r.sub) + '</small></span><em>' + (r.href ? '&#8599;' : '&rsaquo;') + '</em>';
    return r.href ? '<a class="mr-res" href="' + esc(r.href) + '" target="_blank" rel="noopener">' + inner + '</a>' : '<button type="button" class="mr-res" data-res="' + i + '">' + inner + '</button>';
  }).join('');
  $('resCards').addEventListener('click', function (e) { var b = e.target.closest('button[data-res]'); if (b) { var o = RES[+b.getAttribute('data-res')].open; openPage(byId[o[0]], o[1], null, []); } });

  /* ---------- chapter tabs ---------- */
  function chap(n) { return findRef('sws', String(n)); }
  var CHAPS = [
    { tab: 'Start', sub: 'Front matter', doc: 'sws', from: 1, to: 24, label: 'Storm Water Standards · Part 1', title: 'Start here: <em>chapters, appendices & parts</em>', toc: 1, sum: 'The Storm Water Standards file bundles Part 1 BMP Design Manual (August 2024 Edition) with Part 2 Construction BMP Standards and Part 3 Offsite Alternative Compliance (both May 2021 Edition). Every chapter and appendix is listed at right; the reader starts at the front matter and table of contents.' }
  ];
  for (var c = 1; c <= 9; c++) (function (r) {
    var next = c < 9 ? chap(c + 1).page - 1 : 156;
    CHAPS.push({ tab: 'Ch. ' + c, sub: r.title.split(' ').slice(0, 2).join(' '), doc: 'sws', from: r.page, to: next, ref: r, label: 'Storm Water Standards · Part 1 · Chapter ' + c, title: 'Chapter ' + c + ' <em>' + esc(r.title) + '</em>' });
  })(chap(c));
  CHAPS.push({ tab: 'Apps', sub: 'Appendices A–L', doc: 'sws', from: 157, to: 652, label: 'Storm Water Standards · Part 1', title: 'Appendices <em>A through L</em>', sum: 'Submittal templates, sizing worksheets and calculations (Appendix B), infiltration, fact sheets, biofiltration, hydromodification, coarse sediment, forms, exemptions, ESA maps, and glossary.' });
  CHAPS.push({ tab: 'Part 2', sub: 'Construction BMPs', doc: 'sws', from: 653, to: 734, label: 'Storm Water Standards · Part 2 · May 2021 Edition', title: 'Part 2 <em>Construction BMP Standards</em>', sum: 'Bound in the August 2024 file but still the May 2021 Edition. Pollution control plans, required construction BMPs, inspections, and enforcement.' });
  CHAPS.push({ tab: 'Part 3', sub: 'Offsite ACP', doc: 'sws', from: 735, to: 786, label: 'Storm Water Standards · Part 3 · May 2021 Edition', title: 'Part 3 <em>Offsite Alternative Compliance</em>', sum: 'Bound in the August 2024 file but still the May 2021 Edition. Offsite Stormwater Alternative Compliance Program and water quality equivalency sizing.' });
  CHAPS.push({ sep: 1 });
  CHAPS.push({ tab: 'DDM', sub: 'Drainage Design', doc: 'ddm', from: 1, to: 270, label: 'Drainage Design Manual · January 2017 Edition', title: 'Drainage Design <em>Manual</em>', sum: 'Hydrology, street drainage and inlets, storm drains, culverts, open channels, detention, energy dissipation, and green infrastructure. Third in the reference hierarchy.' });
  CHAPS.push({ tab: 'SDMC', sub: 'Municipal Code', docs: ['sdmc-142-2', 'sdmc-43-3', 'sdmc-142-1'], label: 'San Diego Municipal Code', title: 'Municipal Code <em>storm water divisions</em>', sum: 'Ch. 14 Art. 2 Div. 2 (Storm Water Runoff and Drainage), Ch. 4 Art. 3 Div. 3 (Stormwater Management and Discharge Control), and Ch. 14 Art. 2 Div. 1 (Grading). First in the reference hierarchy.' });
  CHAPS.push({ tab: 'Forms', sub: 'App. I + J-1', docs: ['appi', 'j1'], label: 'Storm Water Standards · separate City form files', title: 'Forms <em>I-1 to I-10 and J-1</em>', sum: 'Appendix I forms and checklists (August 2024 Edition) and Form J-1 Green Street PDP Exemption (January 2018 Edition).' });
  var CH = 0;
  $('chapNav').innerHTML = CHAPS.map(function (x, i) { return x.sep ? '<span class="sep"></span>' : '<button type="button" data-ch="' + i + '" aria-selected="' + (i === 0) + '"><b>' + esc(x.tab) + '</b><small>' + esc(x.sub) + '</small></button>'; }).join('');
  $('chapNav').addEventListener('click', function (e) { var b = e.target.closest('button[data-ch]'); if (b) showChap(+b.getAttribute('data-ch')); });
  function chapRefs(x) {
    return REFS.filter(function (r) { if (x.toc) return r.doc === 'sws' && (r.type === 'Chapter' || r.type === 'Appendix' || r.id === 'Start'); return x.docs ? x.docs.indexOf(r.doc) >= 0 : (r.doc === x.doc && r.page >= x.from && r.page <= x.to && r !== x.ref); })
      .slice().sort(function (a, b) { return byId[a.doc].order - byId[b.doc].order || a.page - b.page; });
  }
  function showChap(i) {
    CH = i; var x = CHAPS[i], refs = chapRefs(x);
    [].forEach.call($('chapNav').querySelectorAll('button'), function (b) { b.setAttribute('aria-selected', +b.getAttribute('data-ch') === i); });
    var counts = {}; refs.forEach(function (r) { counts[r.type] = (counts[r.type] || 0) + 1; });
    var sum = x.sum || ('PDF pages ' + x.from + '–' + x.to + ' (printed ' + byId.sws.labels[x.from - 1] + ' to ' + byId.sws.labels[x.to - 1] + '). ' + Object.keys(counts).map(function (t) { return counts[t] + ' ' + t.toLowerCase() + (counts[t] > 1 ? 's' : ''); }).join(', ') + ' indexed.');
    var startDoc = x.docs ? x.docs[0] : x.doc, startPage = x.ref ? x.ref.page : (x.from || 1);
    var art = [0, 1, 2].map(function (k) { var r = refs.filter(function (q) { return VISUAL[q.type]; })[k * 3] || null; return r ? thumb(r.doc, r.page, 70, CROP) : ''; }).join('');
    if (!art) art = thumb(startDoc, startPage, 70, CROP);
    $('chapAside').innerHTML = '<label>' + esc(x.label) + '</label><h2>' + x.title + '</h2><p>' + esc(sum) + '</p><div class="mr-chap-art">' + art + '</div>' +
      '<button type="button" class="mr-primary" id="readChap">' + icon('Read') + ' Read ' + (x.ref ? 'chapter' : 'from the start') + ' here</button>' +
      '<div class="mr-note"><b>Citation tip</b>' + (x.doc === 'sws' && x.from >= 653 ? 'Cite this part as the May 2021 Edition, with the printed page shown in the reader.' : 'Use "Copy citation" in the reader; it includes the edition, printed page, and PDF page.') + '</div>';
    $('chapList').innerHTML = '<div class="mr-lhead"><span>REFERENCE</span><span>TOPIC</span><span>PAGE</span><span>READ</span></div>' + refs.map(function (r) {
      var d = byId[r.doc], lvl = /Chapter|Appendix/.test(r.type) || (r.type === 'Section' && !/\.\d+\./.test(r.id) && x.ref) ? 0 : 1;
      return '<button type="button" class="mr-lrow lvl' + (r.type === 'Section' && (r.id.match(/\./g) || []).length < 2 ? 0 : 1) + '" data-ref="' + REFS.indexOf(r) + '"><strong>' + esc(r.id.replace(/^Part \d /, '')) + '</strong><span>' + (r.type !== 'Section' ? badge(r.type) + ' ' : '') + esc(r.title) + '</span><i>' + (d.id.indexOf('sdmc') === 0 ? esc(d.short.replace('SDMC ', '')) : esc(printed(d, r.page) || 'p.' + r.page)) + '</i><small>Read &rsaquo;</small></button>';
    }).join('');
    $('chapList').scrollTop = 0;
    $('readChap').addEventListener('click', function () { if (x.ref) openRef(x.ref, []); else openPage(byId[startDoc], startPage, null, []); });
    lazy($('chapAside'));
  }
  onRefClick($('chapList'));
  showChap(0);

  /* ---------- viewer ---------- */
  function openRef(r, terms) { openPage(byId[r.doc], r.page, r, terms || []); }
  function openPage(d, p, ref, terms, fromHash) {
    p = Math.max(1, Math.min(d.pages, p | 0 || 1));
    var wasHidden = $('reader').hidden;
    S.doc = d; S.page = p; S.ref = ref || null; S.terms = (terms || []).filter(function (w) { return w && w.length > 1; });
    if (!fromHash) {
      var h = ref ? '#ref/' + d.id + '/' + encodeURIComponent(ref.id) : '#page/' + d.id + '/' + p;
      if (location.hash !== h) history.pushState(null, '', h);
    }
    $('reader').hidden = false;
    updateBar(); render(); strip();
    if (wasHidden || $('reader').getBoundingClientRect().top < -200 || $('reader').getBoundingClientRect().top > window.innerHeight * 0.6) $('reader').scrollIntoView({ behavior: 'auto', block: 'start' });
  }
  function closeReader() {
    $('reader').hidden = true; S.doc = null; document.body.removeAttribute('data-rendered');
    if (location.hash) history.pushState(null, '', location.pathname + location.search);
    window.scrollTo(0, 0);
  }
  $('closeBtn').addEventListener('click', closeReader);
  function updateBar() {
    var d = S.doc, p = S.page, pr = printed(d, p), pt = partOf(d, p);
    $('vLabel').textContent = 'Original page · ' + d.short + (pt ? ' · ' + pt.name : '') + ' · ' + editionOf(d, p);
    var ref = S.ref && S.ref.page === p ? S.ref : null, nh = ref ? null : nearestHeading(d, p);
    $('vTitle').textContent = ref ? (ref.id + ' · ' + ref.title) : (nh ? 'Under ' + nh.id + ' · ' + nh.title : d.title);
    $('vMeta').innerHTML = (d.id.indexOf('sdmc') === 0 ? 'Division page ' + esc(pr || p) + ' ·' : (pr ? 'Printed page <strong>' + esc(pr) + '</strong> · ' : '')) + ' PDF page <strong>' + p + '</strong> of ' + d.pages;
    $('pageNo').textContent = 'Manual page ' + (pr && d.id.indexOf('sdmc') ? pr + ' · PDF p. ' + p : 'PDF p. ' + p);
    $('pageIn').value = p; $('pageOf').textContent = '/ ' + d.pages;
    $('prevBtn').disabled = p <= 1; $('nextBtn').disabled = p >= d.pages;
    $('officialLink').href = d.official + '#page=' + p;
    $('officialLink').title = 'Open the City-hosted PDF at page ' + p;
    var notes = [];
    if (pt && pt.short !== 'Part 1') notes.push(pt.name + ' is bound in the August 2024 file but still carries <strong>' + pt.edition + '</strong> footers; cite it as ' + pt.edition + '.');
    if (ref && /^Worksheet B\.5-/.test(ref.id)) notes.push('City working file for Worksheets B.5-1 to B.5-7: <a href="' + B5_XLSX + '" target="_blank" rel="noopener">Appendix B.5 Excel worksheets (Aug 2024, v2) &#8599;</a>. ' +
      (/B\.5-[24]$/.test(ref.id) ? 'This worksheet was revised in August 2024; do not use the January 2018 worksheets PDF for it.' : ''));
    if (d.id === 'appi') notes.push('Separate City file referenced by Appendix I of the manual (PDF p. 602). Forms are August 2024 Edition.');
    if (d.id === 'j1') notes.push('Form J-1 is the City\'s current download but is a <strong>January 2018 Edition</strong> form; guidance is in Appendix J of the August 2024 manual.');
    if (d.id === 'ddm') notes.push('Third in the reference hierarchy: the Municipal Code and the Stormwater Standards govern where they address the same item.');
    $('vNotes').innerHTML = notes.map(function (n) { return '<p>' + n + '</p>'; }).join(''); $('vNotes').hidden = !notes.length;
    $('pageText').textContent = '';
    loadText(d.id).then(function (t) { if (S.doc === d && S.page === p) $('pageText').textContent = t.raw[p - 1] || '(no text on this page)'; }, function () { $('pageText').textContent = 'Page text unavailable.'; });
  }
  /* nearby-page filmstrip from the pre-rendered thumbnails */
  function strip() {
    var d = S.doc, p = S.page, a = Math.max(1, p - 4), b = Math.min(d.pages, a + 8); a = Math.max(1, b - 8);
    var h = '';
    for (var i = a; i <= b; i++) h += '<button type="button" data-p="' + i + '"' + (i === p ? ' aria-current="page"' : '') + ' title="PDF page ' + i + '">' + thumb(d.id, i, 58, CROP) + '<span>' + esc(d.id.indexOf('sdmc') && printed(d, i) ? printed(d, i) : 'p.' + i) + '</span></button>';
    $('strip').innerHTML = h; lazy($('strip'));
  }
  $('strip').addEventListener('click', function (e) { var b = e.target.closest('button[data-p]'); if (b && S.doc) openPage(S.doc, +b.getAttribute('data-p'), S.ref, S.terms); });
  function getPdf(d) {
    if (!S.pdfs[d.id]) S.pdfs[d.id] = pdfjsLib.getDocument({ url: './' + d.pdf, disableAutoFetch: true, disableStream: true, rangeChunkSize: 262144, isEvalSupported: false }).promise;
    return S.pdfs[d.id];
  }
  function render() {
    var d = S.doc, p = S.page, seq = ++S.renderSeq, status = $('status');
    status.textContent = 'Loading page ' + p + '…';
    if (!window.pdfjsLib) { status.innerHTML = 'PDF viewer failed to load. <a href="' + esc(d.official) + '#page=' + p + '" target="_blank" rel="noopener">Open the City PDF at page ' + p + '</a>.'; return; }
    getPdf(d).then(function (pdf) { return pdf.getPage(p); }).then(function (page) {
      if (seq !== S.renderSeq) return;
      var base = page.getViewport({ scale: 1 }), avail = Math.max(280, $('stage').clientWidth - 34);
      var scale = S.zoom === 'fit' ? Math.min(avail / base.width, 2.2) : S.zoom;
      var vp = page.getViewport({ scale: scale }), dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      var c = $('canvas'), ctx = c.getContext('2d');
      c.width = Math.floor(vp.width * dpr); c.height = Math.floor(vp.height * dpr);
      c.style.width = Math.floor(vp.width) + 'px'; c.style.height = Math.floor(vp.height) + 'px';
      $('pageBox').style.width = Math.floor(vp.width) + 'px';
      if (S.renderTask) { try { S.renderTask.cancel(); } catch (e) {} }
      S.renderTask = page.render({ canvasContext: ctx, viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null });
      $('hl').innerHTML = '';
      return S.renderTask.promise.then(function () {
        if (seq !== S.renderSeq) return;
        status.textContent = '';
        document.body.setAttribute('data-rendered', d.id + ':' + p);
        return highlight(page, vp, seq);
      });
    }).catch(function (err) {
      if (err && err.name === 'RenderingCancelledException') return;
      if (seq !== S.renderSeq) return;
      status.innerHTML = 'Could not load this page from the hosted copy. <a href="' + esc(d.official) + '#page=' + p + '" target="_blank" rel="noopener">Open the City PDF at page ' + p + ' &#8599;</a>';
      if (window.console) console.warn('Page load failed', err);
    });
  }
  function highlight(page, vp, seq) {
    var terms = S.terms.map(function (t) { return t.toLowerCase(); }).filter(function (t) { return t.length > 1; });
    if (!terms.length) return;
    return page.getTextContent().then(function (tc) {
      if (seq !== S.renderSeq) return;
      /* join all text items so matches can span items (PDFs often split "B.5" and "-4") */
      var items = tc.items.filter(function (it) { return typeof it.str === 'string'; }), full = '', starts = [];
      items.forEach(function (it) { starts.push(full.length); full += it.str.toLowerCase().replace(/[\u2010-\u2015\u2212]/g, '-'); full += it.hasEOL ? ' ' : ''; });
      var phrase = terms.length > 1 ? terms.join(' ') : null, out = [];
      var find = phrase && full.indexOf(phrase) >= 0 ? [phrase] : terms;
      find.forEach(function (t) {
        var i = full.indexOf(t);
        while (i >= 0 && out.length < 400) {
          var end = i + t.length;
          items.forEach(function (it, k) {
            var s0 = starts[k], s1 = s0 + it.str.length;
            if (s1 <= i || s0 >= end || !it.str.length) return;
            var a = Math.max(i, s0) - s0, b = Math.min(end, s1) - s0, n = it.str.length;
            var tx = pdfjsLib.Util.transform(vp.transform, it.transform), fh = Math.hypot(tx[2], tx[3]), w = it.width * vp.scale;
            out.push('<span style="left:' + (tx[4] + w * a / n).toFixed(1) + 'px;top:' + (tx[5] - fh).toFixed(1) + 'px;width:' + Math.max(4, w * (b - a) / n).toFixed(1) + 'px;height:' + (fh * 1.2).toFixed(1) + 'px"></span>');
          });
          i = full.indexOf(t, end);
        }
      });
      $('hl').innerHTML = out.join('');
    });
  }
  function go(delta) { if (!S.doc) return; openPage(S.doc, S.page + delta, S.ref, S.terms); }
  $('prevBtn').addEventListener('click', function () { go(-1); });
  $('nextBtn').addEventListener('click', function () { go(1); });
  $('pageForm').addEventListener('submit', function (e) { e.preventDefault(); if (S.doc) openPage(S.doc, parseInt($('pageIn').value, 10), null, S.terms); });
  $('zoomFit').addEventListener('click', function () { S.zoom = 'fit'; render(); });
  $('zoomIn').addEventListener('click', function () { S.zoom = Math.min(4, (S.zoom === 'fit' ? currentScale() : S.zoom) * 1.25); render(); });
  $('zoomOut').addEventListener('click', function () { S.zoom = Math.max(0.4, (S.zoom === 'fit' ? currentScale() : S.zoom) / 1.25); render(); });
  function currentScale() { return parseFloat($('canvas').style.width) / 612 || 1; }
  $('citeBtn').addEventListener('click', function () { if (S.doc) copy(citation()); });
  document.addEventListener('keydown', function (e) {
    if (!S.doc || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if (e.key === 'ArrowLeft') go(-1); else if (e.key === 'ArrowRight') go(1);
  });
  var rz; window.addEventListener('resize', function () { if (S.doc && S.zoom === 'fit') { clearTimeout(rz); rz = setTimeout(render, 200); } });

  /* ---------- about ---------- */
  $('aboutDocs').innerHTML = '<table><thead><tr><th>Document (hierarchy order)</th><th>Edition</th><th>Official source</th></tr></thead><tbody>' + DOCS.map(function (d) {
    return '<tr><td><span class="dot ' + docColor(d) + '"></span>' + esc(d.title) + '</td><td>' + esc(d.edition) + (d.parts ? '<br>' + d.parts.map(function (p) { return esc(p.short + ': ' + p.edition + ' (PDF pp. ' + p.from_ + '-' + p.to + ')'); }).join('<br>') : '') +
      '</td><td><a href="' + esc(d.official) + '" target="_blank" rel="noopener">City PDF &#8599;</a><br><small>MD5 <code>' + esc(d.md5) + '</code></small></td></tr>';
  }).join('') + '</tbody></table><p>All documents are linked from the City\'s <a href="' + LDM + '" target="_blank" rel="noopener">Land Development Manual</a> page (Appendix O and Appendix B) and the <a href="https://www.sandiego.gov/city-clerk/officialdocs/municipal-code" target="_blank" rel="noopener">Municipal Code</a> page. Biofiltration Worksheets B.5-1 to B.5-7 working file: <a href="' + B5_XLSX + '" target="_blank" rel="noopener">Appendix B.5 Excel worksheets (Aug 2024, v2)</a>.</p>';
  $('aboutBtn').addEventListener('click', function () { var dl = $('about'); if (dl.showModal) dl.showModal(); else dl.setAttribute('open', ''); });

  /* ---------- deep links ---------- */
  function fromHash() {
    var h = decodeURIComponent(location.hash.slice(1)), m;
    if ((m = h.match(/^ref\/([^/]+)\/(.+)$/))) {
      var r = findRef(m[1], m[2]);
      if (r) { openPage(byId[r.doc], r.page, r, termsFor(r), true); return; }
    }
    if ((m = h.match(/^page\/([^/]+)\/(\d+)$/)) && byId[m[1]]) { openPage(byId[m[1]], +m[2], null, [], true); return; }
    if (!h && !$('reader').hidden) { $('reader').hidden = true; S.doc = null; }
  }
  window.addEventListener('popstate', fromHash);
  lazy();
  fromHash();
  document.body.setAttribute('data-ready', '1');
})();
