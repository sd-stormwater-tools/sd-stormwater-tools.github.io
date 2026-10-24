/* Minimal spreadsheet evaluator for the City's Appendix B.5 Excel worksheets (data/b5-workbook.js).
 * It evaluates the City's own cell formulas so results match the workbook cell-for-cell.
 * Supported: + - * / ^ & comparisons, unary minus, ranges, IF MIN MAX ROUND IFERROR INDEX MATCH VLOOKUP SUM.
 * Works in the browser (window.B5Engine) and in Node (module.exports) for tests. */
(function (root) {
  'use strict';
  function Err(code) { this.err = code; }
  Err.prototype.toString = function () { return this.err; };
  var DIV0 = new Err('#DIV/0!'), NA = new Err('#N/A'), VALUE = new Err('#VALUE!'), REF = new Err('#REF!');
  function isErr(x) { return x instanceof Err; }

  /* ---------- tokenizer + parser (Pratt) ---------- */
  function tokenize(s) {
    var t = [], i = 0, m;
    var re = /\s*(?:(\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+)|("(?:[^"]|"")*")|(\$?[A-Z]{1,3}\$?\d+(?::\$?[A-Z]{1,3}\$?\d+)?)|([A-Z][A-Z0-9.]*)\s*\(|(TRUE|FALSE)\b|(<=|>=|<>|[-+*/^&=<>(),]))/y;
    while (i < s.length) {
      re.lastIndex = i; m = re.exec(s);
      if (!m) { if (/^\s*$/.test(s.slice(i))) break; throw new Error('Cannot parse formula near: ' + s.slice(i)); }
      i = re.lastIndex;
      if (m[1] !== undefined) t.push({ k: 'num', v: parseFloat(m[1]) });
      else if (m[2] !== undefined) t.push({ k: 'str', v: m[2].slice(1, -1).replace(/""/g, '"') });
      else if (m[3] !== undefined) t.push({ k: 'ref', v: m[3].replace(/\$/g, '') });
      else if (m[4] !== undefined) t.push({ k: 'fn', v: m[4] });
      else if (m[5] !== undefined) t.push({ k: 'bool', v: m[5] === 'TRUE' });
      else t.push({ k: 'op', v: m[6] });
    }
    return t;
  }
  var BP = { '=': 1, '<>': 1, '<': 1, '>': 1, '<=': 1, '>=': 1, '&': 2, '+': 3, '-': 3, '*': 4, '/': 4, '^': 5 };
  function parse(src) {
    var t = tokenize(src), p = 0;
    function peek() { return t[p]; }
    function next() { return t[p++]; }
    function expect(v) { var x = next(); if (!x || x.v !== v) throw new Error('Expected ' + v + ' in ' + src); }
    function primary() {
      var x = next();
      if (!x) throw new Error('Unexpected end in ' + src);
      if (x.k === 'num') return { t: 'n', v: x.v };
      if (x.k === 'str') return { t: 's', v: x.v };
      if (x.k === 'bool') return { t: 's', v: x.v };
      if (x.k === 'ref') return x.v.indexOf(':') > 0 ? { t: 'rng', v: x.v } : { t: 'ref', v: x.v };
      if (x.k === 'fn') {
        var args = [];
        if (peek() && peek().v === ')') { next(); return { t: 'fn', n: x.v, a: args }; }
        for (;;) { args.push(expr(0)); var y = next(); if (y.v === ')') break; if (y.v !== ',') throw new Error('Bad args in ' + src); }
        return { t: 'fn', n: x.v, a: args };
      }
      if (x.v === '(') { var e = expr(0); expect(')'); return e; }
      if (x.v === '-') return { t: 'neg', a: primary() };
      if (x.v === '+') return primary();
      throw new Error('Unexpected ' + x.v + ' in ' + src);
    }
    function expr(min) {
      var left = primary();
      for (;;) {
        var o = peek(); if (!o || o.k !== 'op' || !(o.v in BP) || BP[o.v] <= min) break;
        next(); left = { t: 'bin', o: o.v, l: left, r: expr(BP[o.v]) };
      }
      return left;
    }
    var ast = expr(0); if (p < t.length) throw new Error('Trailing tokens in ' + src);
    return ast;
  }

  /* ---------- cell helpers ---------- */
  function colNum(c) { var n = 0; for (var i = 0; i < c.length; i++) n = n * 26 + c.charCodeAt(i) - 64; return n; }
  function colName(n) { var s = ''; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }
  function split(a) { var m = /^([A-Z]+)(\d+)$/.exec(a); return [colNum(m[1]), +m[2]]; }
  function rangeCells(r) {
    var ab = r.split(':'), a = split(ab[0]), b = split(ab[1]), rows = [];
    for (var y = Math.min(a[1], b[1]); y <= Math.max(a[1], b[1]); y++) {
      var row = []; for (var x = Math.min(a[0], b[0]); x <= Math.max(a[0], b[0]); x++) row.push(colName(x) + y); rows.push(row);
    }
    return rows;
  }
  function num(v) { if (isErr(v)) return v; if (v === null || v === undefined || v === '') return 0; if (typeof v === 'boolean') return v ? 1 : 0; if (typeof v === 'number') return v; var n = Number(v); return isNaN(n) ? VALUE : n; }
  function excelRound(x, d) { var f = Math.pow(10, d), y = Math.abs(x) * f; y = Math.round(+y.toPrecision(15)); return (x < 0 ? -y : y) / f; }

  /* ---------- workbook ---------- */
  function Sheet(def) {
    this.def = def; this.inputs = {}; this.cache = {}; this.ast = {};
  }
  Sheet.prototype.set = function (addr, v) { this.inputs[addr] = v; this.cache = {}; };
  Sheet.prototype.raw = function (addr) {
    if (addr in this.inputs) { var v = this.inputs[addr]; return v === '' || v === null || v === undefined ? null : v; }
    var c = this.def.cells[addr]; if (!c) return null;
    if ('v' in c) return c.v;
    return this.get(addr);
  };
  Sheet.prototype.get = function (addr) {
    if (addr in this.inputs) return this.raw(addr);
    var c = this.def.cells[addr]; if (!c) return null; if ('v' in c) return c.v;
    if (addr in this.cache) { if (this.cache[addr] === undefined) throw new Error('Circular ref ' + addr); return this.cache[addr]; }
    this.cache[addr] = undefined;
    var ast = this.ast[addr] || (this.ast[addr] = parse(c.f)), r;
    try { r = this.ev(ast); } catch (e) { throw new Error(addr + ': ' + e.message); }
    if (Array.isArray(r)) r = r[0][0];
    if (typeof r === 'number' && !isFinite(r)) r = DIV0;
    this.cache[addr] = r; return r;
  };
  Sheet.prototype.rng = function (r) { var self = this; return rangeCells(r).map(function (row) { return row.map(function (a) { return self.get(a); }); }); };
  Sheet.prototype.ev = function (n) {
    var self = this;
    switch (n.t) {
      case 'n': case 's': return n.v;
      case 'ref': return this.get(n.v);
      case 'rng': return this.rng(n.v);
      case 'neg': var a = num(this.ev(n.a)); return isErr(a) ? a : -a;
      case 'bin': return this.bin(n.o, this.ev(n.l), this.ev(n.r));
      case 'fn': return this.fn(n.n, n.a);
    }
  };
  Sheet.prototype.bin = function (o, l, r) {
    if (Array.isArray(l)) l = l[0][0]; if (Array.isArray(r)) r = r[0][0];
    if (isErr(l)) return l; if (isErr(r)) return r;
    if (o === '&') return String(l === null ? '' : l) + String(r === null ? '' : r);
    if (o === '=' || o === '<>' || o === '<' || o === '>' || o === '<=' || o === '>=') {
      var a = l === null ? (typeof r === 'string' ? '' : 0) : l, b = r === null ? (typeof l === 'string' ? '' : 0) : r;
      if (typeof a === 'string' && typeof b === 'string') { a = a.toLowerCase(); b = b.toLowerCase(); }
      else if (typeof a === 'string' || typeof b === 'string') { var sa = typeof a === 'string'; // Excel: text > numbers
        return { '=': false, '<>': true, '<': !sa, '>': sa, '<=': !sa, '>=': sa }[o]; }
      return { '=': a === b, '<>': a !== b, '<': a < b, '>': a > b, '<=': a <= b, '>=': a >= b }[o];
    }
    var x = num(l), y = num(r); if (isErr(x)) return x; if (isErr(y)) return y;
    switch (o) { case '+': return x + y; case '-': return x - y; case '*': return x * y; case '/': return y === 0 ? DIV0 : x / y; case '^': return Math.pow(x, y); }
  };
  function flat(v) { return Array.isArray(v) ? [].concat.apply([], v) : [v]; }
  Sheet.prototype.fn = function (name, a) {
    var self = this, E = function (i) { return self.ev(a[i]); };
    switch (name) {
      case 'IF': var c = E(0); if (Array.isArray(c)) c = c[0][0]; if (isErr(c)) return c;
        return (typeof c === 'string' ? c !== '' : !!c) ? E(1) : (a.length > 2 ? E(2) : false);
      case 'IFERROR': var v = E(0); if (Array.isArray(v)) v = v[0][0]; return isErr(v) ? E(1) : v;
      case 'MIN': case 'MAX': case 'SUM':
        var vals = [], err = null;
        a.forEach(function (x, i) {
          var isR = a[i].t === 'rng', v = flat(E(i));
          v.forEach(function (y) { if (isErr(y)) err = err || y; else if (typeof y === 'number') vals.push(y); else if (!isR && y !== null) { var z = num(y); if (isErr(z)) err = err || z; else vals.push(z); } });
        });
        if (err) return err;
        if (name === 'SUM') return vals.reduce(function (s, y) { return s + y; }, 0);
        return vals.length ? Math[name.toLowerCase()].apply(null, vals) : 0;
      case 'ROUND': var x = num(E(0)), d = num(E(1)); if (isErr(x)) return x; if (isErr(d)) return d; return excelRound(x, d);
      case 'INDEX': var R = E(0), r = num(E(1)), cc = a.length > 2 ? num(E(2)) : 1; if (isErr(r)) return r; if (isErr(cc)) return cc;
        if (R.length === 1 && a.length === 2) { cc = r; r = 1; }
        if (r < 1 || r > R.length || cc < 1 || cc > R[0].length) return REF; return R[r - 1][cc - 1];
      case 'MATCH': var look = E(0), arr = flat(E(1)), type = a.length > 2 ? num(E(2)) : 1; if (Array.isArray(look)) look = look[0][0]; if (isErr(look)) return look;
        if (type === 0) { for (var i = 0; i < arr.length; i++) if (arr[i] === look) return i + 1; return NA; }
        /* approximate ascending match (binary search like Excel) */
        var lo = 0, hi = arr.length - 1, best = -1;
        while (lo <= hi) { var mid = (lo + hi) >> 1, mv = arr[mid];
          if (mv === null || typeof mv !== 'number') { hi = mid - 1; continue; }
          if (mv <= look) { best = mid; lo = mid + 1; } else hi = mid - 1; }
        return best < 0 ? NA : best + 1;
      case 'VLOOKUP': var lv = E(0), tab = E(1), col = num(E(2)), exact = a.length > 3 ? E(3) : true; if (Array.isArray(lv)) lv = lv[0][0]; if (isErr(lv)) return lv;
        for (var k = 0; k < tab.length; k++) if (exact === false || exact === 0 ? tab[k][0] === lv : false) return tab[k][col - 1];
        if (exact === false || exact === 0) return NA;
        var bi = -1; for (k = 0; k < tab.length; k++) if (typeof tab[k][0] === 'number' && tab[k][0] <= lv) bi = k; return bi < 0 ? NA : tab[bi][col - 1];
    }
    throw new Error('Unsupported function ' + name);
  };
  function Workbook(data) { this.data = data; this.sheets = {}; }
  Workbook.prototype.sheet = function (name) { return this.sheets[name] || (this.sheets[name] = new Sheet(this.data.sheets[name])); };
  var api = { Workbook: Workbook, isErr: isErr, excelRound: excelRound, parse: parse };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.B5Engine = api;
})(this);
