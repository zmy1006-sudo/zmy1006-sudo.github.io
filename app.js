/* 项目分类筛选页 —— 纯静态，无依赖。数据由 build.mjs 生成到 data.js。 */
(function () {
  'use strict';

  var P = window.__PROJECTS__;
  if (!P || !P.items) {
    document.getElementById('subtitle').textContent = '数据未加载：请先运行 node scripts/build.mjs';
    return;
  }
  var G = P.groups;
  var items = P.items;

  function quarter(d) {
    var y = d.slice(0, 4), m = parseInt(d.slice(5, 7), 10) || 1;
    return y + '-Q' + Math.ceil(m / 3);
  }

  var KEY = {
    domain: function (i) { return i.domains; },
    kind: function (i) { return i.kinds; },
    origin: function (i) { return i.origin ? [i.origin] : []; },
    visibility: function (i) { return i.visibility ? [i.visibility] : []; },
    status: function (i) { return i.status ? [i.status] : []; },
    quarter: function (i) { return i.created ? [quarter(i.created)] : []; },
    lang: function (i) { return i.lang ? [i.lang] : []; }
  };

  function uniq(list) {
    var seen = {}, out = [];
    list.forEach(function (v) { if (v && !seen[v]) { seen[v] = 1; out.push(v); } });
    return out;
  }

  var quarters = uniq(items.map(function (i) { return quarter(i.created); })).sort().reverse();
  var langs = uniq(items.map(function (i) { return i.lang; }))
    .map(function (l) { return [l, items.filter(function (i) { return i.lang === l; }).length]; })
    .sort(function (a, b) { return b[1] - a[1] || a[0].localeCompare(b[0]); })
    .filter(function (x) { return x[0] !== '—'; })
    .map(function (x) { return x[0]; });

  var FILTERS = [
    { key: 'domain', label: '领域', values: Object.keys(G.domain), name: function (v) { return G.domain[v] || v; } },
    { key: 'kind', label: '类型', values: Object.keys(G.kind), name: function (v) { return G.kind[v] || v; } },
    { key: 'origin', label: '来源', values: Object.keys(G.origin), name: function (v) { return G.origin[v] || v; } },
    { key: 'visibility', label: '可见性', values: Object.keys(G.visibility), name: function (v) { return G.visibility[v] || v; } },
    { key: 'status', label: '状态', values: Object.keys(G.status), name: function (v) { return G.status[v] || v; } },
    { key: 'quarter', label: '时间（创建季度）', values: quarters, name: function (v) { return v.replace('-Q', ' 年 Q'); } },
    { key: 'lang', label: '语言', values: langs, name: function (v) { return v; } }
  ];

  // 一个值在数据里一个项目都没有（比如公开版里的“私有”）就不显示这个勾选项
  FILTERS.forEach(function (f) {
    f.values = f.values.filter(function (v) {
      return items.some(function (i) { return KEY[f.key](i).indexOf(v) !== -1; });
    });
  });

  var state = { q: '', sort: 'pushed', group: 'none', sel: {} };
  FILTERS.forEach(function (f) { state.sel[f.key] = []; });

  // ---------------- 过滤逻辑 ----------------
  function hit(item, groupKey) {
    return state.sel[groupKey].length === 0 || KEY[groupKey](item).some(function (v) {
      return state.sel[groupKey].indexOf(v) !== -1;
    });
  }
  function queryHit(item) {
    if (!state.q) return true;
    var q = state.q.toLowerCase();
    return [item.title, item.summary, item.name, item.lang].join(' ').toLowerCase().indexOf(q) !== -1;
  }
  function matches(item, except) {
    if (!queryHit(item)) return false;
    for (var k in state.sel) {
      if (k !== except && !hit(item, k)) return false;
    }
    return true;
  }
  function visible() { return items.filter(function (i) { return matches(i, null); }); }

  function countFor(groupKey, value) {
    return items.filter(function (i) {
      return matches(i, groupKey) && KEY[groupKey](i).indexOf(value) !== -1;
    }).length;
  }

  // ---------------- 渲染：筛选面板 ----------------
  var groupsEl = document.getElementById('groups');

  function renderFilters() {
    groupsEl.innerHTML = FILTERS.map(function (f) {
      var chips = f.values.map(function (v) {
        var on = state.sel[f.key].indexOf(v) !== -1;
        var n = countFor(f.key, v);
        return '<button type="button" class="chip" role="button" aria-pressed="' + on + '"' +
          ' data-f="' + f.key + '" data-v="' + esc(v) + '"' + (n === 0 && !on ? ' data-zero="true"' : '') + '>' +
          '<span class="box">' + (on ? '✓' : '') + '</span>' +
          '<span class="lbl">' + esc(f.name(v)) + '</span>' +
          '<span class="n">' + n + '</span></button>';
      }).join('');
      var active = state.sel[f.key].length;
      return '<div class="fgroup"><h3><span>' + f.label + '</span><span>' + (active ? active + ' 项已选' : '') + '</span></h3>' +
        '<div class="chips">' + chips + '</div></div>';
    }).join('');
  }

  groupsEl.addEventListener('click', function (e) {
    var btn = e.target.closest('.chip');
    if (!btn) return;
    toggle(btn.dataset.f, btn.dataset.v);
  });

  function toggle(key, value) {
    var arr = state.sel[key];
    var i = arr.indexOf(value);
    if (i === -1) arr.push(value); else arr.splice(i, 1);
    apply();
  }

  // ---------------- 渲染：结果 ----------------
  var listEl = document.getElementById('list');
  var emptyEl = document.getElementById('empty');
  var countEl = document.getElementById('count');

  function dateText(d) {
    if (!d) return '';
    var t = d.split('-');
    return t[0] + '-' + t[1];
  }

  function card(item) {
    var badges = [];
    if (item.masked) badges.push('<span class="badge private">私有 · 脱敏</span>');
    else if (item.visibility === 'private') badges.push('<span class="badge private">私有</span>');
    if (item.visibility === 'local') badges.push('<span class="badge local">仅本地</span>');
    if (item.origin === 'fork') badges.push('<span class="badge fork">Fork</span>');
    if (item.status === 'snapshot') badges.push('<span class="badge snapshot">版本快照</span>');
    if (item.status === 'archived') badges.push('<span class="badge archived">已归档</span>');

    var tags = item.domains.map(function (d) {
      return '<span class="tag d">' + esc(G.domain[d] || d) + '</span>';
    }).concat(item.kinds.map(function (k) {
      return '<span class="tag">' + esc(G.kind[k] || k) + '</span>';
    })).join('');

    var title = item.url
      ? '<a href="' + esc(item.url) + '" target="_blank" rel="noopener">' + esc(item.title) + '</a>'
      : esc(item.title);

    var meta = [];
    if (item.lang && item.lang !== '—') {
      meta.push('<span><i class="dot" style="background:' + esc(item.langColor) + '"></i>' + esc(item.lang) + '</span>');
    }
    meta.push('<span>' + dateText(item.created) + ' 创建</span>');
    meta.push('<span>' + dateText(item.pushed) + ' 更新</span>');
    if (item.hours) meta.push('<span>' + item.hours + ' h</span>');
    if (item.stars) meta.push('<span>★ ' + item.stars + '</span>');

    var open = item.url
      ? '<a class="open" href="' + esc(item.url) + '" target="_blank" rel="noopener">GitHub →</a>'
      : '<span class="open" title="私有或仅本地项目，没有公开链接">无公开链接</span>';

    return '<article class="card" data-id="' + esc(item.id) + '">' +
      '<div class="card-top"><h3>' + title + '</h3><div class="badges">' + badges.join('') + '</div></div>' +
      (item.summary ? '<p>' + esc(item.summary) + '</p>' : '') +
      '<div class="tags">' + tags + '</div>' +
      '<div class="meta">' + meta.join('') + open + '</div>' +
      '</article>';
  }

  function sortItems(list) {
    var s = state.sort;
    return list.slice().sort(function (a, b) {
      if (s === 'created') return a.created.localeCompare(b.created);
      if (s === 'hours') return (b.hours || -1) - (a.hours || -1);
      if (s === 'name') return a.title.localeCompare(b.title, 'zh-Hans-CN');
      return b.pushed.localeCompare(a.pushed);
    });
  }

  function groupOf(item, mode) {
    if (mode === 'domain') return (item.domains[0] || 'other');
    if (mode === 'quarter') return quarter(item.created);
    if (mode === 'visibility') return item.visibility;
    return '';
  }

  function render() {
    var list = sortItems(visible());
    countEl.innerHTML = '<b>' + list.length + '</b> / ' + items.length + ' 个项目';

    if (!list.length) {
      listEl.innerHTML = '';
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;

    if (state.group === 'none') {
      listEl.innerHTML = '<div class="grid">' + list.map(card).join('') + '</div>';
      return;
    }

    var order = [];
    var buckets = {};
    var label = function (v) {
      if (state.group === 'domain') return G.domain[v] || v;
      if (state.group === 'quarter') return v.replace('-Q', ' 年 Q');
      return G.visibility[v] || v;
    };
    var keyOf = state.group === 'visibility'
      ? { public: 0, private: 1, local: 2 }
      : null;

    list.forEach(function (i) {
      var k = groupOf(i, state.group);
      if (!buckets[k]) { buckets[k] = []; order.push(k); }
      buckets[k].push(i);
    });
    if (keyOf) order.sort(function (a, b) { return (keyOf[a] ?? 9) - (keyOf[b] ?? 9); });
    else if (state.group !== 'domain') order.sort().reverse();

    listEl.innerHTML = order.map(function (k) {
      return '<section><div class="sec-title">' + esc(label(k)) +
        '<span>' + buckets[k].length + ' 个</span></div>' +
        '<div class="grid">' + buckets[k].map(card).join('') + '</div></section>';
    }).join('');
  }

  // ---------------- hash 同步 ----------------
  function readHash() {
    var h = location.hash.replace(/^#/, '');
    if (!h) return;
    var sp = new URLSearchParams(h);
    state.q = sp.get('q') || '';
    state.sort = sp.get('sort') || 'pushed';
    state.group = sp.get('group') || 'none';
    FILTERS.forEach(function (f) {
      var v = sp.get(f.key);
      state.sel[f.key] = v ? v.split(',').filter(Boolean) : [];
    });
  }
  function writeHash() {
    var sp = new URLSearchParams();
    if (state.q) sp.set('q', state.q);
    if (state.sort !== 'pushed') sp.set('sort', state.sort);
    if (state.group !== 'none') sp.set('group', state.group);
    FILTERS.forEach(function (f) {
      if (state.sel[f.key].length) sp.set(f.key, state.sel[f.key].join(','));
    });
    var s = sp.toString();
    history.replaceState(null, '', s ? '#' + s : location.pathname + location.search);
  }

  function apply() {
    renderFilters();
    render();
    writeHash();
  }

  // ---------------- 控件 ----------------
  var qEl = document.getElementById('q');
  var sortEl = document.getElementById('sort');
  var groupEl = document.getElementById('group');
  var sub = document.getElementById('subtitle');
  var stamp = document.getElementById('stamp');

  qEl.addEventListener('input', function () { state.q = qEl.value.trim(); apply(); });
  sortEl.addEventListener('change', function () { state.sort = sortEl.value; apply(); });
  groupEl.addEventListener('change', function () { state.group = groupEl.value; apply(); });
  document.getElementById('reset').addEventListener('click', function () {
    FILTERS.forEach(function (f) { state.sel[f.key] = []; });
    state.q = ''; qEl.value = '';
    apply();
  });

  // 深浅色
  var themeBtn = document.getElementById('theme');
  function setTheme(t) {
    document.documentElement.dataset.theme = t;
    themeBtn.textContent = t === 'dark' ? '☀️ 浅色' : '🌙 深色';
    try { localStorage.setItem('theme', t); } catch (e) {}
  }
  themeBtn.addEventListener('click', function () {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });
  var saved = null;
  try { saved = localStorage.getItem('theme'); } catch (e) {}
  setTheme(saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

  // 统计副标题
  var nPub = items.filter(function (i) { return i.visibility === 'public'; }).length;
  var nPri = items.filter(function (i) { return i.visibility === 'private'; }).length;
  var nLoc = items.filter(function (i) { return i.visibility === 'local'; }).length;
  var nFork = items.filter(function (i) { return i.origin === 'fork'; }).length;
  sub.textContent = P.owner + ' · 共 ' + items.length + ' 个项目：公开 ' + nPub +
    (nPri ? ' · 私有 ' + nPri : '') + (nLoc ? ' · 仅本地 ' + nLoc : '') + ' · fork ' + nFork;
  if (P.generatedAt) stamp.textContent = '数据同步于 ' + P.generatedAt.slice(0, 10);

  readHash();
  qEl.value = state.q;
  sortEl.value = state.sort;
  groupEl.value = state.group;
  apply();

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
})();
