/* 영동에덴원 v2 — 장바구니(localStorage edenwon_cart_v2) · 서랍 메뉴 · 검색 · 배너 슬라이더 · 탭
   기존 키(edenwon_profile 등)는 읽지도 쓰지도 않는다. 서버로 아무것도 보내지 않는다. */
(function () {
  "use strict";
  var CART_KEY = "edenwon_cart_v2";

  /* ── 장바구니 저장소 ── */
  var Cart = {
    read: function () {
      try {
        var v = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
        return Array.isArray(v) ? v : [];
      } catch (e) { return []; }
    },
    write: function (items) {
      try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch (e) {}
      Cart.render();
    },
    count: function () { return Cart.read().length; },
    MAX_QTY: 20,
    /* 같은 상품·옵션이면 수량을 더한다(줄당 최대 20). 품절 옵션은 담지 않는다(soldOut 이 true 면 거절). */
    add: function (lines, soldOut) {
      var items = Cart.read();
      for (var i = 0; i < lines.length; i++) {
        var l = lines[i];
        if (!l.key || !l.option || !(l.qty > 0)) return false;
        if (soldOut && soldOut(l.key, l.option)) return false;
      }
      lines.forEach(function (l) {
        var hit = null;
        items.forEach(function (it) { if (it.key === l.key && it.option === l.option) hit = it; });
        if (hit) hit.qty = Math.min(Cart.MAX_QTY, hit.qty + l.qty);
        else items.push({ key: l.key, option: l.option, qty: Math.min(Cart.MAX_QTY, l.qty), checked: true });
      });
      Cart.write(items);
      return true;
    },
    render: function () {
      var n = Cart.count();
      document.querySelectorAll("[data-cart-count]").forEach(function (el) {
        el.textContent = n > 99 ? "99+" : String(n);
        el.hidden = n === 0;
      });
      document.querySelectorAll("[data-cart-link]").forEach(function (el) {
        el.setAttribute("aria-label", n ? "장바구니 " + n + "개" : "장바구니");
      });
    }
  };
  window.EdenCart = Cart;
  window.addEventListener("storage", function (e) { if (e.key === CART_KEY) Cart.render(); });

  /* ── 서랍 메뉴: 왼쪽에서 열림, 포커스 가둠, ESC 닫힘 ── */
  function initDrawer() {
    var drawer = document.getElementById("drawer");
    var opener = document.querySelector("[data-drawer-open]");
    if (!drawer || !opener) return;
    var panel = drawer.querySelector(".drawer__panel");
    var lastFocus = null;
    function focusables() {
      return Array.prototype.filter.call(panel.querySelectorAll("a[href],button:not([disabled])"), function (el) { return el.offsetParent !== null; });
    }
    function open() {
      lastFocus = document.activeElement;
      drawer.hidden = false;
      document.body.classList.add("is-locked");
      opener.setAttribute("aria-expanded", "true");
      requestAnimationFrame(function () { drawer.classList.add("is-open"); var f = focusables(); if (f.length) f[0].focus(); });
    }
    function close() {
      drawer.classList.remove("is-open");
      drawer.hidden = true;
      document.body.classList.remove("is-locked");
      opener.setAttribute("aria-expanded", "false");
      if (lastFocus) lastFocus.focus();
    }
    opener.addEventListener("click", open);
    drawer.querySelectorAll("[data-drawer-close]").forEach(function (el) { el.addEventListener("click", close); });
    drawer.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key !== "Tab") return;
      var f = focusables(); if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    window.matchMedia("(min-width: 769px)").addEventListener("change", function (m) { if (m.matches && !drawer.hidden) close(); });
  }

  /* ── 검색 열기/닫기 ── */
  function initSearch() {
    var btn = document.querySelector("[data-search-toggle]");
    var box = document.getElementById("search");
    if (!btn || !box) return;
    btn.addEventListener("click", function () {
      var show = box.hidden;
      box.hidden = !show;
      btn.setAttribute("aria-expanded", String(show));
      if (show) box.querySelector("input").focus();
    });
    box.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { box.hidden = true; btn.setAttribute("aria-expanded", "false"); btn.focus(); }
    });
  }

  /* ── 배너 슬라이더: 자동 넘김 없음. 화살표 · 점 · 키보드 ←/→ · 스와이프 ── */
  function initCarousel(root) {
    var slides = root.querySelectorAll("[data-slide]");
    var dots = root.querySelectorAll("[data-dot]");
    var num = root.querySelector("[data-num]");
    var n = slides.length, i = 0;
    function go(k) {
      i = (k + n) % n;
      slides.forEach(function (s, j) { s.hidden = j !== i; });
      dots.forEach(function (d, j) { if (j === i) d.setAttribute("aria-current", "true"); else d.removeAttribute("aria-current"); });
      if (num) num.textContent = (i + 1 < 10 ? "0" : "") + (i + 1);
      root.setAttribute("data-tone", slides[i].classList.contains("hero__slide--light") ? "light" : "dark");
      root.setAttribute("data-index", String(i));
    }
    var prev = root.querySelector("[data-prev]"), next = root.querySelector("[data-next]");
    if (prev) prev.addEventListener("click", function () { go(i - 1); });
    if (next) next.addEventListener("click", function () { go(i + 1); });
    dots.forEach(function (d) { d.addEventListener("click", function () { go(+d.getAttribute("data-dot")); }); });
    root.addEventListener("keydown", function (e) {
      if (e.target.closest("input,textarea,select")) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); go(i - 1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); go(i + 1); }
    });
    var x0 = null, y0 = null;
    root.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    root.addEventListener("touchend", function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? i + 1 : i - 1);
      x0 = y0 = null;
    }, { passive: true });
    go(0);
  }

  /* ── 탭(홈 추천): 분류별로 앞에서 N개만 보이기 ── */
  function initPickTabs(list) {
    var tabs = Array.prototype.slice.call(list.querySelectorAll("[role=tab]"));
    var panel = document.querySelector("[data-picks]");
    if (!panel) return;
    var limit = +panel.getAttribute("data-limit") || 4;
    var cards = panel.querySelectorAll(".card");
    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
      });
      panel.setAttribute("aria-labelledby", tab.id);
      var id = tab.getAttribute("data-tab"), shown = 0;
      cards.forEach(function (c) {
        var ok = (id === "all" || c.getAttribute("data-cat") === id) && shown < limit;
        c.hidden = !ok; if (ok) shown++;
      });
      if (focus) tab.focus();
    }
    tabs.forEach(function (t, k) {
      t.addEventListener("click", function () { select(t); });
      t.addEventListener("keydown", function (e) {
        var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (d) { e.preventDefault(); select(tabs[(k + d + tabs.length) % tabs.length], true); }
      });
    });
  }

  /* ── 웹글꼴: 렌더링을 막지 않게 media=print 로 받아 두었다가 켠다.
     홈은 첫 배너 사진이 뜬 뒤(최대 3초) 켠다 — 한글 글꼴 조각들이 배너 사진과 대역폭을 다투지 않게. ── */
  function enableFonts() {
    document.querySelectorAll("link[data-webfont]").forEach(function (l) { l.media = "all"; });
  }
  function initFonts() {
    var hero = document.querySelector("[data-slide] img[fetchpriority=high]");
    if (!hero || hero.complete) { enableFonts(); return; }
    var done = false;
    function go() { if (!done) { done = true; enableFonts(); } }
    hero.addEventListener("load", go);
    hero.addEventListener("error", go);
    setTimeout(go, 3000);
  }

  var won = function (n) { return n.toLocaleString("ko-KR") + "원"; };

  /* ── 담은 뒤 안내: «장바구니로 가기 / 계속 보기» ── */
  var Added = (function () {
    var box, last;
    function close() { if (!box) return; box.hidden = true; if (last && document.contains(last)) last.focus(); }
    return {
      init: function () {
        box = document.getElementById("added");
        if (!box) return;
        box.querySelector("[data-added-close]").addEventListener("click", close);
        box.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
      },
      show: function (text, from) {
        if (!box) return;
        last = from || document.activeElement;
        box.querySelector("[data-added-item]").textContent = text;
        box.hidden = false;
        box.querySelector("a,button").focus();
      }
    };
  })();

  /* ── 카드의 담기 버튼(옵션 1개짜리 · 품절 아님만 버튼으로 그려진다) ── */
  function initCardAdd() {
    document.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-add]");
      if (!btn) return;
      var ok = Cart.add([{ key: btn.getAttribute("data-add"), option: btn.getAttribute("data-add-option"), qty: 1 }]);
      if (ok) Added.show(btn.getAttribute("aria-label").replace(/ 장바구니에 담기$/, "") + " · 1개", btn);
    });
  }

  /* ── 제품 목록: 분류 탭(주소 ?cat=) · 정렬(?sort=) · 검색어(?q=) ── */
  function initCatalog(root) {
    var tabs = Array.prototype.slice.call(root.querySelectorAll("[data-cat-tabs] [role=tab]"));
    var sorts = root.querySelectorAll("[data-sort]");
    var grid = root.querySelector("[data-grid]");
    var cards = Array.prototype.slice.call(grid.querySelectorAll(".card"));
    var panel = root.querySelector("#plist");
    var countEl = root.querySelector("[data-count]");
    var empty = root.querySelector("[data-empty]");
    var qNote = root.querySelector("[data-query-note]");
    var banner = root.querySelector("[data-pbanner]");
    var CATS = tabs.map(function (t) { return t.getAttribute("data-cat"); });
    function state() {
      var u = new URLSearchParams(location.search);
      var c = u.get("cat"), s = u.get("sort");
      return { cat: CATS.indexOf(c) >= 0 ? c : "all", sort: (s === "low" || s === "high") ? s : "rec", q: (u.get("q") || "").trim() };
    }
    function url(st) {
      var u = new URLSearchParams();
      if (st.cat !== "all") u.set("cat", st.cat);
      if (st.sort !== "rec") u.set("sort", st.sort);
      if (st.q) u.set("q", st.q);
      var qs = u.toString();
      return location.pathname + (qs ? "?" + qs : "");
    }
    function apply(st) {
      tabs.forEach(function (t) {
        var on = t.getAttribute("data-cat") === st.cat;
        t.setAttribute("aria-selected", String(on)); t.tabIndex = on ? 0 : -1;
        if (on) panel.setAttribute("aria-labelledby", t.id);
      });
      sorts.forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-sort") === st.sort)); });
      var slides = banner.querySelectorAll("[data-banner]"), cur = null;
      slides.forEach(function (sl) { var on = sl.getAttribute("data-banner") === st.cat; sl.hidden = !on; if (on) cur = sl; });
      banner.className = "pbanner pbanner--" + cur.getAttribute("data-tone");
      banner.querySelector("[data-banner-title]").textContent = cur.getAttribute("data-title");
      banner.querySelector("[data-banner-sub]").textContent = cur.getAttribute("data-sub");
      var q = st.q.toLowerCase(), n = 0;
      cards.forEach(function (c) {
        var ok = (st.cat === "all" || c.getAttribute("data-cat") === st.cat) &&
                 (!q || c.getAttribute("data-name").toLowerCase().indexOf(q) >= 0);
        c.hidden = !ok; if (ok) n++;
      });
      var sorted = cards.slice().sort(function (a, b) {
        if (st.sort === "rec") return a.getAttribute("data-order") - b.getAttribute("data-order");
        var pa = a.getAttribute("data-price"), pb = b.getAttribute("data-price");
        pa = pa === "" ? null : +pa; pb = pb === "" ? null : +pb;
        if (pa === null && pb === null) return a.getAttribute("data-order") - b.getAttribute("data-order");
        if (pa === null) return 1;            // '구성 고르기'(가격 없음)는 맨 뒤
        if (pb === null) return -1;
        return st.sort === "low" ? (pa - pb || a.getAttribute("data-order") - b.getAttribute("data-order"))
                                 : (pb - pa || a.getAttribute("data-order") - b.getAttribute("data-order"));
      });
      sorted.forEach(function (c) { grid.appendChild(c); });
      countEl.textContent = String(n);
      empty.hidden = n !== 0;
      qNote.hidden = !st.q;
      qNote.textContent = st.q ? "«" + st.q + "» 검색 결과 ·" : "";
      var qi = document.getElementById("q"); if (qi && st.q) qi.value = st.q;
    }
    function go(patch) {
      var st = state();
      for (var k in patch) st[k] = patch[k];
      history.pushState(null, "", url(st));
      apply(st);
    }
    tabs.forEach(function (t, k) {
      t.addEventListener("click", function () { go({ cat: t.getAttribute("data-cat") }); });
      t.addEventListener("keydown", function (e) {
        var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (d) { e.preventDefault(); var nt = tabs[(k + d + tabs.length) % tabs.length]; go({ cat: nt.getAttribute("data-cat") }); nt.focus(); }
      });
    });
    sorts.forEach(function (b) { b.addEventListener("click", function () { go({ sort: b.getAttribute("data-sort") }); }); });
    window.addEventListener("popstate", function () { apply(state()); });
    apply(state());
  }

  /* ── 상세: 사진 고르기 ── */
  function initGallery(g) {
    var thumbs = g.querySelectorAll("[data-thumb]"), shots = g.querySelectorAll("[data-shot]");
    thumbs.forEach(function (t) {
      t.addEventListener("click", function () {
        var k = t.getAttribute("data-thumb");
        thumbs.forEach(function (x) { x.setAttribute("aria-pressed", String(x === t)); });
        shots.forEach(function (s) { s.hidden = s.getAttribute("data-shot") !== k; });
      });
    });
  }

  /* ── 상세: 옵션을 고르면 아래 상자에 줄로 쌓인다(오설록 방식). 옵션별 수량·삭제 ── */
  function initBuy(buy) {
    var data = JSON.parse(document.getElementById("product-data").textContent);
    var byId = {}; data.options.forEach(function (o) { byId[o.id] = o; });
    var sel = buy.querySelector("[data-opt-select]");
    var list = buy.querySelector("[data-lines]");
    var tpl = document.getElementById("line-tpl");
    var msg = buy.querySelector("[data-buy-msg]");
    var lines = [];   // {option, qty}
    var soldOut = function (key, opt) { return key !== data.key || !byId[opt] || byId[opt].sold_out; };
    function say(t) { if (!msg) return; msg.textContent = t; msg.hidden = !t; }
    function render() {
      if (!list) return;
      list.innerHTML = "";
      var tq = 0, tw = 0;
      lines.forEach(function (l, i) {
        var o = byId[l.option], li = tpl.content.firstElementChild.cloneNode(true);
        var label = data.name + " · " + o.label;
        li.querySelector(".line__name").textContent = label;
        li.querySelector(".qty__n").textContent = String(l.qty);
        li.querySelector(".line__sum").textContent = won(o.price * l.qty);
        var del = li.querySelector("[data-del]"), dec = li.querySelector("[data-dec]"), inc = li.querySelector("[data-inc]");
        del.setAttribute("aria-label", o.label + " 선택 삭제");
        dec.setAttribute("aria-label", o.label + " 수량 줄이기");
        inc.setAttribute("aria-label", o.label + " 수량 늘리기");
        dec.disabled = l.qty <= 1; inc.disabled = l.qty >= Cart.MAX_QTY;
        del.addEventListener("click", function () { lines.splice(i, 1); render(); if (sel) sel.focus(); });
        dec.addEventListener("click", function () { l.qty = Math.max(1, l.qty - 1); render(); list.querySelectorAll("[data-dec]")[i].focus(); });
        inc.addEventListener("click", function () { l.qty = Math.min(Cart.MAX_QTY, l.qty + 1); render(); list.querySelectorAll("[data-inc]")[i].focus(); });
        list.appendChild(li);
        tq += l.qty; tw += o.price * l.qty;
      });
      var tqEl = buy.querySelector("[data-total-qty]"), twEl = buy.querySelector("[data-total]");
      if (tqEl) tqEl.textContent = String(tq);
      if (twEl) twEl.textContent = won(tw);
    }
    function pick(id) {
      if (!id || !byId[id] || byId[id].sold_out) return;
      say("");
      var hit = null; lines.forEach(function (l) { if (l.option === id) hit = l; });
      if (hit) hit.qty = Math.min(Cart.MAX_QTY, hit.qty + 1); else lines.push({ option: id, qty: 1 });
      render();
    }
    if (sel) {
      if (data.options.length === 1 && !data.options[0].sold_out) { pick(data.options[0].id); }
      sel.addEventListener("change", function () { pick(sel.value); if (data.options.length > 1) sel.value = ""; });
    }
    function picked() {
      if (!lines.length) {
        say((sel && sel.labels && sel.labels[0] ? sel.labels[0].textContent.trim() : "옵션") + "을(를) 먼저 골라 주세요.");
        if (sel) { sel.scrollIntoView({ block: "center" }); sel.focus(); }
        return null;
      }
      return lines.map(function (l) { return { key: data.key, option: l.option, qty: l.qty }; });
    }
    document.querySelectorAll("[data-to-cart]").forEach(function (b) {
      b.addEventListener("click", function () {
        var ls = picked(); if (!ls) return;
        if (Cart.add(ls, soldOut)) {
          var n = ls.reduce(function (a, l) { return a + l.qty; }, 0);
          Added.show(data.name + " · " + ls.length + "가지 " + n + "개", b);
        }
      });
    });
    document.querySelectorAll("[data-buy-now]").forEach(function (b) {
      b.addEventListener("click", function () {
        var ls = picked(); if (!ls) return;
        if (ls.some(function (l) { return soldOut(l.key, l.option); })) return;
        // 바로 구매: 장바구니와 따로, 이 품목만 담은 임시 주문(같은 탭 동안만)
        try { sessionStorage.setItem("edenwon_buynow_v2", JSON.stringify({ at: Date.now(), items: ls })); } catch (e) {}
        location.href = (document.documentElement.getAttribute("data-root") || "") + "checkout.html?buy=now";
      });
    });
    render();
  }

  /* ── 찜(이 기기에만 저장: edenwon_wish_v2) ── */
  function initLike(btn) {
    var KEY = "edenwon_wish_v2", key = btn.getAttribute("data-like");
    function read() { try { var v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
    function paint(on) { document.querySelectorAll("[data-like]").forEach(function (b) { if (b.getAttribute("data-like") === key) b.setAttribute("aria-pressed", String(on)); }); }
    btn.setAttribute("aria-pressed", String(read().indexOf(key) >= 0));
    btn.addEventListener("click", function () {
      var v = read(), i = v.indexOf(key);
      if (i >= 0) v.splice(i, 1); else v.push(key);
      try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {}
      paint(i < 0);
    });
  }

  /* ── 상세 탭: 지금 보는 구역 표시(화면 40% 지점을 지난 마지막 구역, 없으면 첫 구역) ── */
  function initSecNav() {
    var links = document.querySelectorAll("[data-sec-link]"), secs = document.querySelectorAll("[data-sec]");
    if (!links.length) return;
    var ticking = false;
    function update() {
      ticking = false;
      var line = window.innerHeight * 0.4, cur = secs[0];
      secs.forEach(function (s) { if (s.getBoundingClientRect().top <= line) cur = s; });
      links.forEach(function (a) { if (a.getAttribute("href") === "#" + cur.id) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current"); });
    }
    window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  document.addEventListener("DOMContentLoaded", function () {
    initFonts();
    Added.init();
    initCardAdd();
    document.querySelectorAll("[data-catalog]").forEach(initCatalog);
    document.querySelectorAll("[data-gallery]").forEach(initGallery);
    document.querySelectorAll("[data-buy]").forEach(initBuy);
    document.querySelectorAll("[data-like]").forEach(initLike);
    initSecNav();
    Cart.render();
    initDrawer();
    initSearch();
    document.querySelectorAll("[data-carousel]").forEach(initCarousel);
    document.querySelectorAll("[data-tabs=picks]").forEach(initPickTabs);
  });
})();
