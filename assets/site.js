/* Shared header/nav and footer. Include on every page right after <body>:
 *   <script src="../assets/tools.js"></script><script src="../assets/site.js" data-current="<tool id or 'home'>"></script>
 * The site root is derived from this script's URL, so pages work at any depth and under a GitHub Pages /repo/ path. */
(function () {
  'use strict';
  var me = document.currentScript, root = me.src.replace(/assets\/site\.js(\?.*)?$/, '');
  var current = me.getAttribute('data-current') || '';
  var footer = me.getAttribute('data-footer') !== 'none';
  var S = window.SW_SITE || {}, T = window.SW_TOOLS || [];
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  window.SW_ROOT = root;

  var links = '<a href="' + root + '"' + (current === 'home' ? ' aria-current="page"' : '') + '>Home</a>' +
    T.map(function (t) { return '<a href="' + root + t.path + '"' + (current === t.id ? ' aria-current="page"' : '') + '>' + esc(t.title) + '</a>'; }).join('');
  var header = document.createElement('header');
  header.className = 'site-header';
  header.innerHTML =
    '<div class="site-header-row">' +
      '<a class="site-title" href="' + root + '">' + esc(S.title) + '</a>' +
      '<button class="nav-toggle" type="button" aria-expanded="false" aria-controls="siteNav">Menu</button>' +
      '<nav id="siteNav" class="site-nav" aria-label="Tools">' + links + '</nav>' +
    '</div>' +
    '<p class="site-disclaimer">' + esc(S.disclaimer) + '</p>';
  me.parentNode.insertBefore(header, me);
  var btn = header.querySelector('.nav-toggle'), nav = header.querySelector('.site-nav');
  btn.addEventListener('click', function () { var o = nav.classList.toggle('open'); btn.setAttribute('aria-expanded', o ? 'true' : 'false'); });

  if (footer) document.addEventListener('DOMContentLoaded', function () {
    var f = document.createElement('footer');
    f.className = 'site-footer';
    f.innerHTML = '<p><strong>' + esc(S.disclaimer) + '</strong></p>' +
      '<p>Independent reviewer reference tools. Not affiliated with, produced by, or endorsed by the City of San Diego. ' +
      'Official sources: <a href="https://www.sandiego.gov/planning/programs/landdevcode/landdevmanual" target="_blank" rel="noopener">Land Development Manual</a> &middot; ' +
      '<a href="https://www.sandiego.gov/city-clerk/officialdocs/municipal-code" target="_blank" rel="noopener">San Diego Municipal Code</a>.</p>';
    document.body.appendChild(f);
  });
})();
