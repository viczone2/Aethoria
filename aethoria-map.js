/* Aethoria Map — widget autonome, sans dépendance.
 * <div data-aethoria-map data-api="https://map.exemple.fr" data-image="carte.jpg"></div>
 * <script src="aethoria-map.js" defer></script>
 * ou : AethoriaMap.mount(element, { api, image, refresh }) */
(function (g) {
  'use strict';

  var TYPES = {
    city: ['Cité', '#d9b86a'], fort: ['Fort', '#a23a2c'], port: ['Port', '#3c6375'],
    camp: ['Camp', '#2f6a2a'], mine: ['Mine', '#545b5f'], poi: ['Lieu', '#6b4c70']
  };

  var CSS = [
    '.am{display:grid;grid-template-columns:minmax(0,1fr) 250px;gap:24px;align-items:start;font-family:var(--pix,"Courier New",monospace);color:var(--ink,#3b2a17)}',
    '.am-view{position:relative;overflow:hidden;width:100%;margin:0 auto;background:#2f1d0f;border:4px solid var(--edge,#c1a477);box-shadow:var(--hard-paper,6px 6px 0 rgba(59,42,23,.4));touch-action:pan-y;cursor:grab;user-select:none;-webkit-user-select:none;aspect-ratio:1/1}',
    '.am-view.am-z{touch-action:none}.am-view.am-grab{cursor:grabbing}',
    '.am-layer{position:absolute;inset:0;transform-origin:0 0;--inv:1}',
    '.am-img{display:block;width:100%;height:100%;pointer-events:none}',
    '.am-pin,.am-dot{position:absolute;transform:translate(-50%,-50%) scale(var(--inv));z-index:2}',
    '.am-pin:hover,.am-dot:hover,.am-on{z-index:6}',
    '.am-pin i{display:block;width:14px;height:14px;background:var(--c);border:2px solid #f3e6c4;transform:rotate(45deg);box-shadow:0 0 0 2px rgba(0,0,0,.45);cursor:pointer}',
    '.am-dot{width:10px;height:10px;background:#86c677;border:2px solid #1f3d1b;box-shadow:0 0 0 2px rgba(0,0,0,.35);transition:left 1s linear,top 1s linear}',
    '.am-dot::before{content:"";position:absolute;inset:-8px}',
    '.am-lab{position:absolute;left:50%;top:100%;margin-top:7px;transform:translateX(-50%);white-space:nowrap;font-size:12px;line-height:1.3;padding:2px 8px;background:rgba(47,29,15,.92);color:#f3e6c4;border-left:3px solid var(--c,#86c677);display:none;pointer-events:none}',
    '.am-dot .am-lab{margin-top:9px}',
    '.am-pin:hover .am-lab,.am-dot:hover .am-lab,.am-on .am-lab,.am-t-city .am-lab,.am-zoom .am-lab{display:block}',
    '.am-ctrl{position:absolute;top:10px;right:10px;display:flex;flex-direction:column;gap:6px;z-index:8}',
    '.am-ctrl button{width:34px;height:34px;background:var(--tile-hi,#ebdbb2);color:var(--ink,#3b2a17);border:2px solid var(--edge,#c1a477);font:700 18px/1 var(--pix,monospace);cursor:pointer;box-shadow:2px 2px 0 rgba(0,0,0,.35)}',
    '.am-ctrl button:hover{background:#fff3d0}',
    '.am-status{position:absolute;left:10px;bottom:10px;z-index:8;padding:4px 10px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#f3e6c4;background:rgba(47,29,15,.9);border-left:4px solid #86c677}',
    '.am-off .am-status{border-left-color:#a23a2c}',
    '.am-side{padding:18px;background:var(--parchment,#d8c397) var(--t-light,none);border:3px solid var(--edge,#c1a477);box-shadow:var(--hard-paper,6px 6px 0 rgba(59,42,23,.4))}',
    '.am-side h4{font-size:15px;letter-spacing:.1em;text-transform:uppercase;margin:0 0 6px}',
    '.am-n{font-size:28px;font-weight:700;line-height:1.1;margin-bottom:8px}',
    '.am-side ul{list-style:none;margin:0 0 16px;padding:0;max-height:240px;overflow:auto}',
    '.am-side li{padding:4px 0;border-bottom:2px solid rgba(138,111,69,.25);font-size:15px}',
    '.am-side li.am-empty{color:var(--stone,#6c5736)}',
    '.am-lg li{display:flex;align-items:center;gap:10px;border:0;padding:3px 0}',
    '.am-lg i{display:inline-block;width:12px;height:12px;background:var(--c);border:2px solid #f3e6c4;transform:rotate(45deg);outline:2px solid rgba(0,0,0,.4)}',
    '.am-hint{font-size:13px;color:var(--stone,#6c5736);line-height:1.4}',
    '@media(max-width:860px){.am{grid-template-columns:1fr}}'
  ].join('');

  function h(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function injectCss() {
    if (document.getElementById('am-css')) return;
    var s = h('style');
    s.id = 'am-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function mount(root, opt) {
    opt = opt || {};
    injectCss();
    var api = String(opt.api || '').replace(/\/+$/, '');
    var every = Math.max(2000, +opt.refresh || 5000);

    root.textContent = '';
    root.classList.add('am');

    var view = h('div', 'am-view'), layer = h('div', 'am-layer'), img = h('img', 'am-img');
    img.alt = "Carte d'Aethoria";
    img.draggable = false;
    layer.appendChild(img);
    view.appendChild(layer);

    var ctrl = h('div', 'am-ctrl');
    [['+', 'Zoom avant'], ['−', 'Zoom arrière'], ['⌂', 'Recentrer']].forEach(function (d) {
      var b = h('button', null, d[0]);
      b.type = 'button';
      b.setAttribute('aria-label', d[1]);
      ctrl.appendChild(b);
    });
    var status = h('div', 'am-status', 'Connexion…');
    view.appendChild(ctrl);
    view.appendChild(status);

    var side = h('aside', 'am-side');
    var count = h('div', 'am-n', '–');
    var plist = h('ul');
    var legend = h('ul', 'am-lg');
    side.appendChild(h('h4', null, 'Joueurs en ligne'));
    side.appendChild(count);
    side.appendChild(plist);
    side.appendChild(h('h4', null, 'Repères'));
    side.appendChild(legend);
    side.appendChild(h('p', 'am-hint', 'Glissez pour déplacer · Ctrl + molette ou double-clic pour zoomer.'));
    root.appendChild(view);
    root.appendChild(side);

    /* ---- zoom / déplacement ---- */
    var S = { s: 1, x: 0, y: 0 };
    function apply() {
      var w = view.clientWidth, hh = view.clientHeight;
      S.x = clamp(S.x, w - w * S.s, 0);
      S.y = clamp(S.y, hh - hh * S.s, 0);
      layer.style.transform = 'translate(' + S.x + 'px,' + S.y + 'px) scale(' + S.s + ')';
      layer.style.setProperty('--inv', String(1 / S.s));
      root.classList.toggle('am-zoom', S.s >= 2.2);
      view.classList.toggle('am-z', S.s > 1.01);
    }
    function zoomAt(f, cx, cy) {
      var ns = clamp(S.s * f, 1, 8), r = ns / S.s;
      S.x = cx - (cx - S.x) * r;
      S.y = cy - (cy - S.y) * r;
      S.s = ns;
      apply();
    }
    function center(f) {
      zoomAt(f, view.clientWidth / 2, view.clientHeight / 2);
    }
    ctrl.children[0].addEventListener('click', function () { center(1.5); });
    ctrl.children[1].addEventListener('click', function () { center(1 / 1.5); });
    ctrl.children[2].addEventListener('click', function () { S.s = 1; S.x = 0; S.y = 0; apply(); });

    var ptrs = {};
    view.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.am-ctrl')) return;
      ptrs[e.pointerId] = { x: e.clientX, y: e.clientY, drag: false };
      view.classList.add('am-grab');
    });
    view.addEventListener('pointermove', function (e) {
      var p = ptrs[e.pointerId];
      if (!p) return;
      var ids = Object.keys(ptrs), r = view.getBoundingClientRect();
      if (ids.length === 1) {
        var dx = e.clientX - p.x, dy = e.clientY - p.y;
        if (!p.drag && Math.abs(dx) + Math.abs(dy) < 4) return;
        if (!p.drag) {
          p.drag = true;
          try { view.setPointerCapture(e.pointerId); } catch (_) { /* ignoré */ }
        }
        S.x += dx; S.y += dy;
        p.x = e.clientX; p.y = e.clientY;
        apply();
      } else if (ids.length === 2) {
        var o = ptrs[ids[0] === String(e.pointerId) ? ids[1] : ids[0]];
        var d0 = Math.hypot(p.x - o.x, p.y - o.y), d1 = Math.hypot(e.clientX - o.x, e.clientY - o.y);
        p.x = e.clientX; p.y = e.clientY;
        if (d0 > 0) zoomAt(d1 / d0, (e.clientX + o.x) / 2 - r.left, (e.clientY + o.y) / 2 - r.top);
      }
    });
    function up(e) {
      delete ptrs[e.pointerId];
      if (!Object.keys(ptrs).length) view.classList.remove('am-grab');
    }
    view.addEventListener('pointerup', up);
    view.addEventListener('pointercancel', up);
    view.addEventListener('wheel', function (e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      var r = view.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.25 : 0.8, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    view.addEventListener('dblclick', function (e) {
      if (e.target.closest('.am-ctrl')) return;
      var r = view.getBoundingClientRect();
      zoomAt(2, e.clientX - r.left, e.clientY - r.top);
    });
    window.addEventListener('resize', apply);

    img.addEventListener('load', function () {
      if (!img.naturalWidth) return;
      var ratio = img.naturalWidth / img.naturalHeight;
      view.style.aspectRatio = img.naturalWidth + ' / ' + img.naturalHeight;
      view.style.maxWidth = Math.max(360, Math.round(window.innerHeight * 0.8 * ratio)) + 'px';
      apply();
    });
    if (opt.image) img.src = opt.image;

    /* ---- données ---- */
    var nodes = {};
    function pct(v, min, size) { return ((v - min) / size * 100) + '%'; }

    function sync(prefix, items, make, b, W, H) {
      var seen = {};
      items.forEach(function (it) {
        var k = prefix + it.key;
        seen[k] = true;
        var n = nodes[k];
        if (!n) { n = make(it); nodes[k] = n; layer.appendChild(n); }
        n.lastChild.textContent = it.label;
        n.style.left = pct(it.x, b.minX, W);
        n.style.top = pct(it.z, b.minZ, H);
        n.style.display = (it.x < b.minX || it.x > b.maxX || it.z < b.minZ || it.z > b.maxZ) ? 'none' : '';
      });
      Object.keys(nodes).forEach(function (k) {
        if (k.indexOf(prefix) === 0 && !seen[k]) {
          layer.removeChild(nodes[k]);
          delete nodes[k];
        }
      });
    }
    function makePin(it) {
      var n = h('div', 'am-pin am-t-' + it.type), t = TYPES[it.type] || TYPES.poi;
      n.style.setProperty('--c', t[1]);
      n.appendChild(h('i'));
      n.appendChild(h('span', 'am-lab'));
      n.addEventListener('click', function () { n.classList.toggle('am-on'); });
      return n;
    }
    function makeDot() {
      var n = h('div', 'am-dot');
      n.appendChild(h('span', 'am-lab'));
      return n;
    }

    var legendKey = '';
    function render(d) {
      var b = d.bounds, W = b.maxX - b.minX, H = b.maxZ - b.minZ;
      if (!(W > 0 && H > 0)) return;
      if (!opt.image) {
        var url = api + d.image;
        if (img.getAttribute('src') !== url) img.src = url;
      }
      var dup = {};
      sync('p:', (d.players || []).map(function (p) {
        dup[p.name] = (dup[p.name] || 0) + 1;
        return { key: p.name + '|' + dup[p.name], label: p.name, x: p.x, z: p.z };
      }), makeDot, b, W, H);
      sync('m:', (d.markers || []).map(function (m) {
        return { key: m.id, type: m.type, label: m.label, x: m.x, z: m.z };
      }), makePin, b, W, H);

      count.textContent = String(d.online || 0);
      plist.textContent = '';
      var ps = d.players || [];
      if (!ps.length) plist.appendChild(h('li', 'am-empty', d.online ? 'Positions masquées' : 'Personne pour le moment'));
      ps.forEach(function (p) { plist.appendChild(h('li', null, p.name)); });

      var types = {};
      (d.markers || []).forEach(function (m) { types[TYPES[m.type] ? m.type : 'poi'] = true; });
      var key = Object.keys(types).sort().join(',');
      if (key !== legendKey) {
        legendKey = key;
        legend.textContent = '';
        Object.keys(TYPES).forEach(function (t) {
          if (!types[t]) return;
          var li = h('li'), i = h('i');
          i.style.setProperty('--c', TYPES[t][1]);
          li.appendChild(i);
          li.appendChild(h('span', null, TYPES[t][0]));
          legend.appendChild(li);
        });
        if (!key) legend.appendChild(h('li', 'am-empty', 'Aucun repère'));
      }
    }

    function setOnline(on) {
      root.classList.toggle('am-off', !on);
      status.textContent = on ? '● En direct' : '○ Hors ligne';
    }

    var timer = 0, dead = false;
    function poll() {
      if (dead) return;
      if (document.hidden) { timer = setTimeout(poll, every); return; }
      fetch(api + '/api/map', { cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); })
        .then(function (d) { setOnline(true); render(d); })
        .catch(function () { setOnline(false); })
        .then(function () { if (!dead) timer = setTimeout(poll, every); });
    }
    poll();

    return { destroy: function () { dead = true; clearTimeout(timer); root.textContent = ''; } };
  }

  g.AethoriaMap = { mount: mount };

  function auto() {
    var els = document.querySelectorAll('[data-aethoria-map]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      mount(el, {
        api: el.getAttribute('data-api') || '',
        image: el.getAttribute('data-image') || '',
        refresh: +el.getAttribute('data-refresh') || 5000
      });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto);
  else auto();
})(window);
