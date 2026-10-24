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

  var searchSeq = 0, debounce = null;
  function runSearch() {
    var q = $('q').value.trim(), box = $('results'), seq = ++searchSeq, groups = groupsOn();
    if (q.length < 2) { box.innerHTML = ''; return; }
    var refs = searchRefs(q, groups), html = '';
    if (refs.length) {
      html += '<div class="mr-group"><span>References</span><span>' + refs.length + '</span></div>';
      html += refs.slice(0, 12).map(refHit).join('');
      if (refs.length > 12) html += '<button class="mr-more" data-more-refs>Show all ' + refs.length + ' references</button>';
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
        th += '<div class="mr-group"><span>Full text · ' + esc(g.d.short) + '</span><span>' + g.hits.length + ' page' + (g.hits.length > 1 ? 's' : '') + '</span></div>';
        th += '<div data-doc="' + g.d.id + '">' + g.hits.slice(0, 5).map(function (h) { return textHit(g.d, h.page, terms); }).join('') + '</div>';
        if (g.hits.length > 5) th += '<button class="mr-more" data-more-doc="' + g.d.id + '">Show all ' + g.hits.length + ' pages in ' + esc(g.d.short) + '</button>';
      });
      box._text = res; box._terms = terms;
      box.innerHTML = html + (total ? th : '<p class="mr-msg">' + (refs.length ? 'No full-text matches for all words.' : 'No matches. Try fewer or shorter words.') + '</p>');
    });
  }
  function refHit(r) {
    var d = byId[r.doc], pr = printed(d, r.page);
    return '<button class="mr-hit" data-ref="' + REFS.indexOf(r) + '"><span class="t"><b>' + esc(r.id) + '</b> ' + esc(r.title) + '</span>' +
      '<small>' + esc(d.short) + (partOf(d, r.page) ? ' · ' + esc(partOf(d, r.page).short) : '') + ' · ' + (pr && d.id.indexOf('sdmc') ? 'p. ' + esc(pr) + ' · ' : '') + 'PDF p. ' + r.page + '</small></button>';
  }
  function textHit(d, p, terms) {
    var pr = printed(d, p);
    return '<button class="mr-hit" data-doc="' + d.id + '" data-page="' + p + '"><span class="t"><b>' + esc(d.short) + '</b> · ' + (partOf(d, p) ? esc(partOf(d, p).short) + ' · ' : '') + (pr && d.id.indexOf('sdmc') ? 'p. ' + esc(pr) + ' · ' : '') + 'PDF p. ' + p + '</span><small>' + snippet(d, p, terms) + '</small></button>';
  }
  $('results').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var box = $('results');
    if (b.hasAttribute('data-more-refs')) { var div = document.createElement('div'); div.innerHTML = box._refs.slice(12, 300).map(refHit).join(''); b.replaceWith(div); return; }
    if (b.hasAttribute('data-more-doc')) {
      var id = b.getAttribute('data-more-doc'), g = box._text.filter(function (x) { return x.d.id === id; })[0];
      var list = box.querySelector('div[data-doc="' + id + '"]'); list.innerHTML = g.hits.slice(0, 300).map(function (h) { return textHit(g.d, h.page, box._terms); }).join(''); b.remove(); return;
    }
    if (b.hasAttribute('data-ref')) { var r = REFS[+b.getAttribute('data-ref')]; openRef(r, termsFor(r)); }
    else if (b.hasAttribute('data-page')) openPage(byId[b.getAttribute('data-doc')], +b.getAttribute('data-page'), null, box._terms);
  });
  /* highlight the bare reference number (e.g. "B.5-4", "142.0220"); multi-word captions are split across PDF text items */
  function termsFor(r) { var id = r.id.replace(/^Part \d /, '').replace(/^(Worksheet|Table|Figure|Form|App\.|Ch\.|§)\s*/, ''); return id.length > 1 ? [id.toLowerCase()] : []; }
  $('q').addEventListener('input', function () { clearTimeout(debounce); debounce = setTimeout(runSearch, 220); });
  $('searchForm').addEventListener('submit', function (e) {
    e.preventDefault(); clearTimeout(debounce); runSearch();
    var top = searchRefs($('q').value, groupsOn(), true)[0];
    if (top) openRef(top, termsFor(top));  /* Enter on an exact reference ID opens it */
  });
  $('clearBtn').addEventListener('click', function () { $('q').value = ''; $('results').innerHTML = ''; $('q').focus(); });
  [].forEach.call(document.querySelectorAll('input[name=grp]'), function (c) { c.addEventListener('change', runSearch); });

  /* ---------- quick picks ---------- */
  var QUICK = [['sws', 'Worksheet B.5-4'], ['sws', 'Worksheet B.5-5'], ['sws', 'Worksheet B.5-6'], ['sws', 'Table 5-1'], ['sws', '1.7', '50% Rule · 1.7'],
    ['sws', 'Figure B.1-1', 'Isopluvials · Fig. B.1-1'], ['sws', 'Worksheet B.2-1', 'DCV · B.2-1'], ['appi', 'Form I-1'], ['sdmc-142-2', '§142.0220']];
  $('quick').innerHTML = '<small>Frequently used</small>' + QUICK.map(function (q) {
    var r = REFS.filter(function (x) { return x.doc === q[0] && x.id === q[1]; })[0];
    return r ? '<button type="button" data-ref="' + REFS.indexOf(r) + '">' + esc(q[2] || q[1].replace('Worksheet ', '')) + '</button>' : '';
  }).join('');
  $('quick').addEventListener('click', function (e) { var b = e.target.closest('button[data-ref]'); if (b) { var r = REFS[+b.getAttribute('data-ref')]; openRef(r, termsFor(r)); } });

  /* ---------- browse ---------- */
  var TYPES = ['Chapter', 'Section', 'Table', 'Figure', 'Worksheet', 'Form', 'Appendix'];
  $('docSel').innerHTML = DOCS.map(function (d) { return '<option value="' + d.id + '">' + esc(d.short) + (d.id === 'sws' ? ' (Aug 2024 file)' : ' (' + esc(d.edition.replace(/^Page header /, '')) + ')') + '</option>'; }).join('');
  $('docSel').value = 'sws';
  function fillTypes() {
    var id = $('docSel').value, have = TYPES.filter(function (t) { return REFS.some(function (r) { return r.doc === id && r.type === t; }); });
    var prev = $('typeSel').value;
    $('typeSel').innerHTML = '<option value="">All (' + REFS.filter(function (r) { return r.doc === id; }).length + ')</option>' + have.map(function (t) {
      return '<option value="' + t + '">' + t + (t === 'Appendix' ? 'es' : 's') + ' (' + REFS.filter(function (r) { return r.doc === id && r.type === t; }).length + ')</option>';
    }).join('');
    $('typeSel').value = have.indexOf(prev) >= 0 ? prev : '';
    fillList();
  }
  function fillList() {
    var id = $('docSel').value, t = $('typeSel').value;
    var list = REFS.filter(function (r) { return r.doc === id && (!t || r.type === t); }).slice().sort(function (a, b) { return a.page - b.page; });
    var d = byId[id];
    $('browseList').innerHTML = list.map(function (r) {
      var pr = printed(d, r.page);
      return '<li><button type="button" data-ref="' + REFS.indexOf(r) + '"><b>' + esc(r.id) + '</b><span>' + esc(r.title) + '</span><small>' + (pr && id.indexOf('sdmc') ? esc(pr) : 'p.' + r.page) + '</small></button></li>';
    }).join('');
  }
  $('docSel').addEventListener('change', fillTypes);
  $('typeSel').addEventListener('change', fillList);
  $('browseList').addEventListener('click', function (e) { var b = e.target.closest('button[data-ref]'); if (b) openRef(REFS[+b.getAttribute('data-ref')], []); });
  fillTypes();

  /* ---------- viewer ---------- */
  function openRef(r, terms) { openPage(byId[r.doc], r.page, r, terms || []); }
  function openPage(d, p, ref, terms, fromHash) {
    p = Math.max(1, Math.min(d.pages, p | 0 || 1));
    S.doc = d; S.page = p; S.ref = ref || null; S.terms = (terms || []).filter(function (w) { return w && w.length > 1; });
    if (!fromHash) {
      var h = ref ? '#ref/' + d.id + '/' + encodeURIComponent(ref.id) : '#page/' + d.id + '/' + p;
      if (location.hash !== h) history.pushState(null, '', h);
    }
    updateBar(); render();
    if (window.matchMedia('(max-width: 900px)').matches) $('viewer').scrollIntoView({ behavior: 'auto', block: 'start' });
  }
  function updateBar() {
    var d = S.doc, p = S.page, pr = printed(d, p), pt = partOf(d, p);
    $('empty').hidden = true; $('canvasWrap').hidden = false; $('textBox').hidden = false; $('vTools').hidden = false;
    $('vDoc').textContent = d.short + (pt ? ' · ' + pt.name : '') + ' · ' + editionOf(d, p);
    var ref = S.ref && S.ref.page === p ? S.ref : null, nh = ref ? null : nearestHeading(d, p);
    $('vTitle').textContent = ref ? (ref.id + ' · ' + ref.title) : (nh ? 'Under ' + nh.id + ' · ' + nh.title : d.title);
    $('vMeta').innerHTML = (d.id.indexOf('sdmc') === 0 ? 'Division page ' + esc(pr || p) : (pr ? 'Printed page <strong>' + esc(pr) + '</strong> · ' : '')) + ' PDF page <strong>' + p + '</strong> of ' + d.pages;
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
    [].forEach.call(document.querySelectorAll('.mr-list li'), function (li) { li.classList.remove('on'); });
    if (ref) { var btn = document.querySelector('.mr-list button[data-ref="' + REFS.indexOf(ref) + '"]'); if (btn) btn.parentNode.classList.add('on'); }
    loadText(d.id).then(function (t) { if (S.doc === d && S.page === p) $('pageText').textContent = t.raw[p - 1] || '(no text on this page)'; }, function () { $('pageText').textContent = 'Page text unavailable.'; });
  }
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
  function go(delta) { if (!S.doc) return; openPage(S.doc, S.page + delta, null, S.terms); }
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
    return '<tr><td>' + esc(d.title) + '</td><td>' + esc(d.edition) + (d.parts ? '<br>' + d.parts.map(function (p) { return esc(p.short + ': ' + p.edition + ' (PDF pp. ' + p.from_ + '-' + p.to + ')'); }).join('<br>') : '') +
      '</td><td><a href="' + esc(d.official) + '" target="_blank" rel="noopener">City PDF &#8599;</a><br><small>MD5 <code>' + esc(d.md5) + '</code></small></td></tr>';
  }).join('') + '</tbody></table><p>All documents are linked from the City\'s <a href="' + LDM + '" target="_blank" rel="noopener">Land Development Manual</a> page (Appendix O and Appendix B) and the <a href="https://www.sandiego.gov/city-clerk/officialdocs/municipal-code" target="_blank" rel="noopener">Municipal Code</a> page. Biofiltration Worksheets B.5-1 to B.5-7 working file: <a href="' + B5_XLSX + '" target="_blank" rel="noopener">Appendix B.5 Excel worksheets (Aug 2024, v2)</a>.</p>';
  $('aboutBtn').addEventListener('click', function () { var dl = $('about'); if (dl.showModal) dl.showModal(); else dl.setAttribute('open', ''); });

  /* ---------- deep links ---------- */
  function fromHash() {
    var h = decodeURIComponent(location.hash.slice(1)), m;
    if ((m = h.match(/^ref\/([^/]+)\/(.+)$/))) {
      var r = REFS.filter(function (x) { return x.doc === m[1] && x.id === m[2]; })[0];
      if (r) { openPage(byId[r.doc], r.page, r, termsFor(r), true); return; }
    }
    if ((m = h.match(/^page\/([^/]+)\/(\d+)$/)) && byId[m[1]]) { openPage(byId[m[1]], +m[2], null, [], true); return; }
  }
  window.addEventListener('popstate', fromHash);
  fromHash();
  document.body.setAttribute('data-ready', '1');
})();
