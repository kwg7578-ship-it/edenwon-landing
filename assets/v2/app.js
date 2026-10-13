/* 영동에덴원 v2 — 장바구니(localStorage edenwon_cart_v2) · 서랍 메뉴 · 검색 · 배너 슬라이더 · 탭 · 주문서
   기존 키(edenwon_profile 등)는 읽지도 쓰지도 않는다.
   서버 호출은 <html data-api> 가 있을 때만(LOCAL=1 리허설 · PREVIEW=0 출시). PREVIEW=1 미리보기는 아무것도 보내지 않는다. */
(function () {
  "use strict";
  var CART_KEY = "edenwon_cart_v2";
  var API = document.documentElement.getAttribute("data-api") || "";

  /* ── 주문 API 호출(JSON). cred=true 면 로그인 쿠키를 싣는다(/api/v2/*). 응답 상태는 _status 로 붙인다. ── */
  function call(method, path, body, cred) {
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, 15000) : null;
    return fetch(API + path, { method: method, credentials: cred ? "include" : "omit",
                               headers: body ? { "Content-Type": "application/json" } : {},
                               body: body ? JSON.stringify(body) : undefined, signal: ctl ? ctl.signal : undefined })
      .then(function (r) {
        clearTimeout(timer);
        return r.json().catch(function () { return {}; }).then(function (j) { j._status = r.status; return j; });
      }, function (e) { clearTimeout(timer); throw e; });
  }

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
      document.querySelectorAll("[data-cart-sr]").forEach(function (el) {
        el.textContent = n ? "장바구니 " + n + "개" : "장바구니";
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
    if (API) loadProducts(root() + "assets/v2/products.json").then(function (P) {
      var lp = P.live && P.products[data.key];
      if (!lp) return;
      lp.options.forEach(function (o) { if (byId[o.id]) { byId[o.id].price = o.price; byId[o.id].sold_out = o.sold_out; } });
      if (sel) Array.prototype.forEach.call(sel.options, function (op) {
        var o = byId[op.value]; if (!o) return;
        op.disabled = o.sold_out; op.textContent = o.label + " · " + won(o.price) + (o.sold_out ? " (품절)" : "");
      });
      lines = lines.filter(function (l) { return !byId[l.option].sold_out; });
      render();
    }).catch(function () {});
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
      links.forEach(function (a) {
        var on = a.getAttribute("href") === "#" + cur.id;
        if (on) {
          if (a.getAttribute("aria-current") !== "true") {
            a.setAttribute("aria-current", "true");
            var bar = a.parentNode;   // 모바일 가로 줄: 현재 항목이 보이게
            if (bar.scrollWidth > bar.clientWidth) bar.scrollTo({ left: a.offsetLeft - 20, behavior: "smooth" });
          }
        } else a.removeAttribute("aria-current");
      });
    }
    window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  /* ── 상품 값(가격·옵션·품절): 빌드 스냅샷(products.json) 위에 실행 중 GET /api/products 값을 덮는다.
     API 가 없거나 실패하면 스냅샷 그대로(담기는 막지 않는다). 최종 금액은 어차피 주문 때 서버가 다시 계산한다. ── */
  var _products = null;
  function loadProducts(url) {
    if (_products) return _products;
    var snap = fetch(url, { credentials: "same-origin" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
    _products = !API ? snap : snap.then(function (P) {
      return call("GET", "/api/products").then(function (j) {
        if (j && j.ok && Array.isArray(j.products)) {
          j.products.forEach(function (p) {
            var mine = P.products[p.key];
            if (mine && Array.isArray(p.options) && p.options.length)
              mine.options = p.options.map(function (o) { return { id: o.id, label: o.label, price: o.price, sold_out: !!o.sold_out }; });
          });
          P.live = true;
        }
        return P;
      }, function () { return P; });
    });
    return _products;
  }
  function optOf(P, key, id) {
    var p = P.products[key]; if (!p) return null;
    for (var i = 0; i < p.options.length; i++) if (p.options[i].id === id) return { p: p, o: p.options[i] };
    return null;
  }
  var root = function () { return document.documentElement.getAttribute("data-root") || ""; };

  /* ── 장바구니 (Cart2) ── */
  function initCartPage(page) {
    var list = page.querySelector("[data-cart-list]"), tpl = document.getElementById("cart-row");
    var full = page.querySelector("[data-cart-full]"), empty = page.querySelector("[data-cart-empty]");
    var all = page.querySelector("[data-check-all]"), notice = page.querySelector("[data-cart-notice]");
    var msg = page.querySelector("[data-cart-msg]");
    var P = null;
    function say(t) { msg.textContent = t; msg.hidden = !t; }
    function render(focusSel) {
      var items = Cart.read();
      empty.hidden = items.length > 0; full.hidden = items.length === 0;
      list.innerHTML = "";
      var sub = 0, sel = 0, avail = 0;
      items.forEach(function (it, i) {
        var hit = optOf(P, it.key, it.option), so = hit.o.sold_out;
        var row = tpl.content.firstElementChild.cloneNode(true);
        var name = hit.p.name, opt = hit.o.label;
        row.classList.toggle("is-soldout", so);
        row.querySelectorAll("[data-row-link]").forEach(function (a) { a.href = root() + hit.p.href; });
        row.querySelector(".crow__img img").src = root() + "images/v2/" + hit.p.img.replace(/\.jpg$/, "") + "-480.jpg";
        row.querySelector(".crow__name").textContent = name;
        row.querySelector(".crow__opt").textContent = opt + " · " + won(hit.o.price);
        row.querySelector(".crow__soldout").hidden = !so;
        var chk = row.querySelector("[data-row-check]");
        chk.checked = !so && it.checked !== false; chk.disabled = so;
        chk.setAttribute("aria-label", name + " " + opt + " 선택");
        row.querySelector(".qty__n").textContent = String(it.qty);
        row.querySelector(".crow__sum").textContent = won(hit.o.price * it.qty);
        var dec = row.querySelector("[data-dec]"), inc = row.querySelector("[data-inc]"), del = row.querySelector("[data-row-del]");
        dec.setAttribute("aria-label", name + " " + opt + " 수량 줄이기");
        inc.setAttribute("aria-label", name + " " + opt + " 수량 늘리기");
        del.setAttribute("aria-label", name + " " + opt + " 삭제");
        dec.disabled = it.qty <= 1 || so; inc.disabled = it.qty >= Cart.MAX_QTY || so;
        function upd(f, focus) { var cur = Cart.read(); f(cur); Cart.write(cur); render(focus); }
        chk.addEventListener("change", function () { upd(function (c) { c[i].checked = chk.checked; }); });
        dec.addEventListener("click", function () { upd(function (c) { c[i].qty = Math.max(1, c[i].qty - 1); }, { i: i, s: "[data-dec]" }); });
        inc.addEventListener("click", function () { upd(function (c) { c[i].qty = Math.min(Cart.MAX_QTY, c[i].qty + 1); }, { i: i, s: "[data-inc]" }); });
        del.addEventListener("click", function () { upd(function (c) { c.splice(i, 1); }, { s: "[data-check-all]" }); });
        list.appendChild(row);
        if (!so) { avail++; if (chk.checked) { sel++; sub += hit.o.price * it.qty; } }
      });
      page.querySelector("[data-sel-count]").textContent = String(sel);
      page.querySelector("[data-line-count]").textContent = String(items.length);
      all.checked = avail > 0 && sel === avail; all.disabled = avail === 0;
      page.querySelector("[data-subtotal]").textContent = won(sub);
      page.querySelector("[data-total]").textContent = won(sub);
      if (focusSel) {
        var el = focusSel.i !== undefined ? list.children[focusSel.i] && list.children[focusSel.i].querySelector(focusSel.s) : page.querySelector(focusSel.s);
        if (el && !el.disabled) el.focus();
      }
    }
    all.addEventListener("change", function () {
      var c = Cart.read();
      c.forEach(function (it) { var h = optOf(P, it.key, it.option); if (h && !h.o.sold_out) it.checked = all.checked; });
      Cart.write(c); render();
    });
    page.querySelector("[data-del-selected]").addEventListener("click", function () {
      var c = Cart.read().filter(function (it) { var h = optOf(P, it.key, it.option); return h.o.sold_out || it.checked === false; });
      Cart.write(c); render({ s: "[data-check-all]" });
    });
    function go(e, onlySelected) {
      var ok = Cart.read().some(function (it) { var h = optOf(P, it.key, it.option); return !h.o.sold_out && (!onlySelected || it.checked !== false); });
      if (!ok) { e.preventDefault(); say(onlySelected ? "주문할 상품을 골라 주세요." : "주문할 수 있는 상품이 없습니다(품절)."); }
    }
    page.querySelector("[data-go-selected]").addEventListener("click", function (e) { go(e, true); });
    page.querySelector("[data-go-all]").addEventListener("click", function (e) { go(e, false); });
    loadProducts(page.getAttribute("data-products")).then(function (data) {
      P = data;
      var c = Cart.read(), kept = c.filter(function (it) { return optOf(P, it.key, it.option) && it.qty > 0; });
      if (kept.length !== c.length) {
        Cart.write(kept);
        notice.textContent = "판매가 끝났거나 바뀐 상품 " + (c.length - kept.length) + "개를 장바구니에서 뺐습니다.";
        notice.hidden = false;
      }
      render();
    }).catch(function () { notice.textContent = "상품 정보를 불러오지 못했습니다. 잠시 뒤 다시 열어 주세요."; notice.hidden = false; full.hidden = false; empty.hidden = true; });
  }

  /* ── 주문서 (Checkout2)
     data-api 가 없으면(PREVIEW=1 미리보기) 화면만: 접수 버튼은 꺼져 있고 어떤 요청도 보내지 않는다.
     data-api 가 있으면(2-B-1 STOP 3) 금액은 /api/v2/quote, 접수는 /api/v2/orders, 회원은 /api/v2/me.
     금액은 서버가 정한다 — 화면 계산은 서버 응답이 오기 전·실패했을 때의 표시용일 뿐이다. ── */
  var PENDING = "edenwon_pending_v2";   // 접수한 주문 {order_no, view_token, phone, buynow, items} — 완료 화면에서 장바구니 정리
  function digitsOf(v) { return String(v || "").replace(/\D/g, ""); }
  function fmtPhone(d) { d = digitsOf(d); return d.length === 11 ? d.slice(0, 3) + "-" + d.slice(3, 7) + "-" + d.slice(7) : d.length === 10 ? d.slice(0, 3) + "-" + d.slice(3, 6) + "-" + d.slice(6) : d; }
  function loadScript(src) {
    return new Promise(function (ok, no) {
      var s = document.createElement("script"); s.src = src; s.async = true;
      s.onload = ok; s.onerror = no; document.head.appendChild(s);
    });
  }
  function newKey() {
    var a = new Uint8Array(16); window.crypto.getRandomValues(a);
    return "v2-" + Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
  }
  function initCheckout(page) {
    var form = page.querySelector("[data-co-form]"), empty = page.querySelector("[data-co-empty]");
    var FEE = +page.getAttribute("data-ship-fee"), FREE = +page.getAttribute("data-ship-free");
    var u = new URLSearchParams(location.search), lines = [], fromBuyNow = u.get("buy") === "now";
    var $ = function (s) { return form.querySelector(s); };
    var member = null, q = null, qSeq = 0, qTimer = null, busy = false, pending = null, idem = API ? newKey() : "";
    var btn = $("[data-co-submit]"), errBox = $("[data-co-error]"), failBox = $("[data-cardfail]");
    function source() {
      if (fromBuyNow) {
        try { var b = JSON.parse(sessionStorage.getItem("edenwon_buynow_v2") || "null"); return b && Array.isArray(b.items) ? b.items : []; } catch (e) { return []; }
      }
      var c = Cart.read();
      return u.get("items") === "all" ? c : c.filter(function (it) { return it.checked !== false; });
    }
    function ship() { return $("[data-ship]:checked").value; }
    function pay() { return $("[data-pay]:checked").value; }
    function ptsVal() { var el = $("[data-pts]"); return el ? parseInt(digitsOf(el.value) || "0", 10) : 0; }
    function reqLines() { return lines.map(function (l) { return { key: l.key, option_id: l.o.id, qty: l.qty }; }); }
    function say(t) { if (!errBox) return; errBox.textContent = t; errBox.hidden = !t; }
    function localQuote() {
      var goods = 0; lines.forEach(function (l) { goods += l.o.price * l.qty; });
      var s = ship() === "parcel" && goods < FREE ? FEE : 0;
      return { goods: goods, discount: 0, shipping: s, points: 0, amount: goods + s };
    }
    function paint() {
      var v = q || localQuote(), parcel = ship() === "parcel", after = v.goods - v.discount;
      $("[data-co-subtotal]").textContent = won(v.goods);
      $("[data-co-ship]").textContent = parcel ? (v.shipping ? won(v.shipping) : "무료") : "0원 (직접 수령)";
      $("[data-co-disc]").textContent = "−" + won(v.discount);
      $("[data-co-seg]").textContent = v.seg ? " (" + v.seg + ")" : "";
      $("[data-co-pts]").textContent = "−" + won(v.points);
      var hint = $("[data-co-freehint]");
      hint.hidden = !(parcel && after < FREE);
      hint.textContent = won(FREE - after) + " 더 담으면 무료 배송";
      $("[data-co-total]").textContent = won(v.amount);
      $("[data-co-cta]").textContent = busy ? "주문 접수 중…" : won(v.amount) + (pay() === "bank" || v.amount === 0 ? " 주문하기" : " 결제하기");
      $("[data-bank-note]").hidden = pay() !== "bank";
      var addr = $("[data-addr]");
      addr.hidden = !parcel;
      addr.querySelectorAll("input").forEach(function (i) { if (i.id !== "memo") i.required = parcel; });
    }
    function ptsHint() {
      var have = $("[data-pts-have]"), hint = $("[data-pts-hint]");
      if (!member || !hint) return;
      have.textContent = "(보유 " + won(member.points) + ")";
      hint.textContent = q && member.points > 0 && q.max === 0 && digitsOf($("#buyer-phone").value) !== member.phone
        ? "주문하시는 분 휴대폰이 회원 번호와 달라 적립금을 쓸 수 없습니다."
        : "주문하시는 분 휴대폰이 회원 번호와 같을 때 쓸 수 있습니다.";
    }
    function requote(now) {
      paint();
      if (!API) return;
      clearTimeout(qTimer);
      qTimer = setTimeout(function () {
        var my = ++qSeq;
        call("POST", "/api/v2/quote", { lines: reqLines(), receive: { method: ship() }, buyer: { phone: $("#buyer-phone").value },
                                         points_use: ptsVal() }, true).then(function (j) {
          if (my !== qSeq) return;
          if (j.ok) {
            var b = j.breakdown;
            q = { goods: b.goods, discount: b.discount, shipping: b.shipping, points: b.points, amount: j.amount, max: j.points_max,
                  seg: j.segment && member && member.segment_label ? member.segment_label : "" };
            var el = $("[data-pts]");
            if (el && ptsVal() !== b.points) el.value = String(b.points);
            if (errBox && errBox.getAttribute("data-from") === "quote") say("");
          } else {
            q = null;
            if (j.error) { say(j.error); errBox.setAttribute("data-from", "quote"); }
          }
          ptsHint(); paint();
        }, function () { if (my === qSeq) { q = null; paint(); } });
      }, now ? 0 : 300);
    }
    function loadMe() {
      return call("GET", "/api/v2/me", null, true).then(function (j) {
        member = j && j.ok && j.member ? j.member : null;
        var href = API + "/login?next=" + encodeURIComponent(location.href);
        form.querySelectorAll("[data-login]").forEach(function (a) { a.href = href; });
        $("[data-login-row]").hidden = !!member;
        $("[data-pts-anon]").hidden = !!member;
        $("[data-pts-member]").hidden = !member;
        if (!member) return;
        var n = $("#buyer-name"), p = $("#buyer-phone"), filled = false;
        if (!n.value) { n.value = member.name || ""; filled = true; }
        if (!p.value) { p.value = fmtPhone(member.phone); filled = true; }
        var af = $("[data-autofill]");
        if (filled) {
          af.textContent = "회원 정보로 자동 입력했습니다." + (member.segment_label ? " " + member.segment_label + " 가격이 적용됩니다." : "");
          af.hidden = false;
        }
        ptsHint();
      }, function () { member = null; });
    }
    function memo() { var s = $("[data-memo-sel]").value; return s === "custom" ? $("#memo").value.trim() : s; }
    function validate() {
      var bad = null;
      function need(sel, msg, ok) { if (!bad && !ok) bad = { el: $(sel), msg: msg }; }
      var nm = $("#buyer-name").value.trim(), ph = digitsOf($("#buyer-phone").value);
      need("#buyer-name", "주문하시는 분 이름을 입력해 주세요.", nm && nm.length <= 40);
      need("#buyer-phone", "주문하시는 분 휴대폰 번호를 정확히 입력해 주세요.", ph.length >= 10 && ph.length <= 11);
      if (ship() === "parcel") {
        need("#rcv-name", "받는 분 이름을 입력해 주세요.", $("#rcv-name").value.trim());
        need("#rcv-phone", "받는 분 휴대폰 번호를 정확히 입력해 주세요.", /^\d{10,11}$/.test(digitsOf($("#rcv-phone").value)));
        need("#zip", "우편번호를 입력해 주세요(우편번호 찾기).", $("#zip").value.trim());
        need("#addr1", "주소를 입력해 주세요.", $("#addr1").value.trim());
        need("#addr2", "상세 주소를 입력해 주세요.", $("#addr2").value.trim());
      }
      need("[data-agree]", "주문 내용 확인과 결제 동의에 체크해 주세요.", $("[data-agree]").checked);
      form.querySelectorAll("[aria-invalid]").forEach(function (e) { e.removeAttribute("aria-invalid"); });
      if (bad) { say(bad.msg); errBox.removeAttribute("data-from"); bad.el.setAttribute("aria-invalid", "true"); bad.el.focus(); }
      return !bad;
    }
    function setBusy(b) { busy = b; btn.disabled = b; btn.setAttribute("aria-busy", String(b)); paint(); }
    function goDone() {
      location.href = root() + "order-complete.html?o=" + encodeURIComponent(pending.order_no) + "&t=" + encodeURIComponent(pending.view_token);
    }
    function cardFail(msg) {
      setBusy(false);
      btn.hidden = true;
      failBox.querySelector("[data-cardfail-msg]").textContent = msg + "주문은 아직 결제 전입니다.";
      failBox.hidden = false;
      failBox.querySelector("[data-to-bank]").focus();
    }
    function startCard() {
      call("POST", "/api/nicepay/params", { order_no: pending.order_no, phone: pending.phone }).then(function (j) {
        if (!j.ok || !j.params) { cardFail((j.error ? j.error + " " : "카드 결제를 시작하지 못했습니다. ")); return; }
        if (!/^https:\/\/pg-web\.nicepay\.co\.kr\//.test(j.js || "")) { cardFail("카드 결제창 주소가 올바르지 않습니다. "); return; }
        loadScript(j.js).then(function () {
          if (typeof window.goPay !== "function") { cardFail("카드 결제창을 열지 못했습니다. "); return; }
          var old = document.getElementById("nicepayForm"); if (old) old.remove();
          var f = document.createElement("form");
          f.id = f.name = "nicepayForm"; f.method = "post"; f.acceptCharset = "euc-kr"; f.action = j.params.ReturnURL;
          Object.keys(j.params).forEach(function (k) {
            var i = document.createElement("input"); i.type = "hidden"; i.name = k; i.value = j.params[k]; f.appendChild(i);
          });
          document.body.appendChild(f);
          window.nicepaySubmit = function () { f.submit(); };   // 결제창 인증 성공 → 서버(/nicepay/return)가 승인 뒤 완료 화면으로 보낸다
          window.nicepayClose = function () { cardFail("카드 결제창이 닫혔습니다. "); };
          window.goPay(f);
        }, function () { cardFail("카드 결제창을 불러오지 못했습니다. "); });
      }, function () { cardFail("연결이 원활하지 않아 카드 결제를 시작하지 못했습니다. "); });
    }
    if (failBox) {
      failBox.querySelector("[data-to-bank]").addEventListener("click", function (e) {
        var b = e.currentTarget; b.disabled = true;
        call("POST", "/api/nicepay/to-bank", { order_no: pending.order_no, phone: pending.phone }).then(function (j) {
          if (j.ok) { goDone(); return; }
          b.disabled = false;
          failBox.querySelector("[data-cardfail-msg]").textContent = "무통장 입금으로 바꾸지 못했습니다. 주문번호 " + pending.order_no + " 로 문의해 주세요.";
        }, function () { b.disabled = false; failBox.querySelector("[data-cardfail-msg]").textContent = "연결이 원활하지 않습니다. 다시 눌러 주세요."; });
      });
      failBox.querySelector("[data-abandon]").addEventListener("click", function (e) {
        var b = e.currentTarget; b.disabled = true;
        call("POST", "/api/nicepay/abandon", { order_no: pending.order_no, phone: pending.phone }).then(function (j) {
          b.disabled = false;
          if (!j.ok) { failBox.querySelector("[data-cardfail-msg]").textContent = j.error || "주문을 취소하지 못했습니다."; return; }
          try { sessionStorage.removeItem(PENDING); } catch (e2) {}
          pending = null; idem = newKey();       // 취소된 주문은 지워지므로 새 키로 다시 주문
          failBox.hidden = true; btn.hidden = false;
          say("주문을 취소했습니다. 장바구니는 그대로입니다."); errBox.removeAttribute("data-from");
          btn.focus();
        }, function () { b.disabled = false; failBox.querySelector("[data-cardfail-msg]").textContent = "연결이 원활하지 않습니다. 다시 눌러 주세요."; });
      });
    }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!API || busy || pending) return;
      if (!validate()) return;
      setBusy(true); say("");
      var body = {
        idempotency_key: idem, lines: reqLines(),
        buyer: { name: $("#buyer-name").value.trim(), phone: $("#buyer-phone").value },
        receive: { method: ship(), memo: memo(), recipient: { name: $("#rcv-name").value.trim(), phone: $("#rcv-phone").value,
                   zip: $("#zip").value.trim(), addr1: $("#addr1").value.trim(), addr2: $("#addr2").value.trim() } },
        payment: { method: pay() }, points_use: q ? q.points : 0, agree: true };
      call("POST", "/api/v2/orders", body, true).then(function (j) {
        if (!j.ok) {
          setBusy(false);
          say(j.error || "주문을 접수하지 못했습니다. 잠시 뒤 다시 눌러 주세요."); errBox.removeAttribute("data-from");
          if (j.code === "points" || j.code === "sold_out") requote(true);
          return;
        }
        pending = { order_no: j.order_no, view_token: j.view_token, phone: body.buyer.phone, buynow: fromBuyNow, items: body.lines };
        try { sessionStorage.setItem(PENDING, JSON.stringify(pending)); } catch (e2) {}
        if (j.next === "card") startCard(); else goDone();
      }, function () {
        setBusy(false);
        say("연결이 원활하지 않습니다. 잠시 뒤 다시 눌러 주세요. 여러 번 눌러도 주문은 한 번만 접수됩니다."); errBox.removeAttribute("data-from");
      });
    });
    form.querySelectorAll("[data-ship]").forEach(function (r) { r.addEventListener("change", function () { requote(); }); });
    var payTouched = false;
    form.querySelectorAll("[data-pay]").forEach(function (r) { r.addEventListener("change", function () { payTouched = true; paint(); }); });
    var memoSel = $("[data-memo-sel]"), memoBox = $("[data-memo-custom]");
    memoSel.addEventListener("change", function () { memoBox.hidden = memoSel.value !== "custom"; if (!memoBox.hidden) memoBox.querySelector("input").focus(); });
    if (API) {
      $("#buyer-phone").addEventListener("change", function () { requote(); });
      var pts = $("[data-pts]");
      pts.addEventListener("input", function () { pts.value = digitsOf(pts.value).replace(/^0+(?=\d)/, ""); requote(); });
      $("[data-pts-all]").addEventListener("click", function () { pts.value = String(member ? member.points : 0); requote(true); });
    }
    var zipBtn = $("[data-zip-search]");
    if (zipBtn) zipBtn.addEventListener("click", function () {
      var go = function () {
        new window.daum.Postcode({ oncomplete: function (d) {
          $("#zip").value = d.zonecode; $("#addr1").value = d.roadAddress || d.jibunAddress; $("#addr2").focus();
        } }).open();
      };
      if (window.daum && window.daum.Postcode) go();
      else loadScript("https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js").then(go, function () { say("우편번호 검색을 불러오지 못했습니다. 직접 입력해 주세요."); });
    });
    loadProducts(page.getAttribute("data-products")).then(function (P) {
      var src = source(), dropped = 0;
      src.forEach(function (it) {
        var h = optOf(P, it.key, it.option);
        if (!h || h.o.sold_out || !(it.qty > 0)) { dropped++; return; }
        lines.push({ key: it.key, p: h.p, o: h.o, qty: Math.min(Cart.MAX_QTY, it.qty) });
      });
      if (!lines.length) { empty.hidden = false; return; }
      form.hidden = false;
      var ul = $("[data-co-items]"), tpl = document.getElementById("co-item"), n = 0;
      lines.forEach(function (l) {
        var li = tpl.content.firstElementChild.cloneNode(true);
        li.querySelector("img").src = root() + "images/v2/" + l.p.img.replace(/\.jpg$/, "") + "-480.jpg";
        li.querySelector(".co__item-name").textContent = l.p.name;
        li.querySelector(".co__item-opt").textContent = l.o.label + " · " + l.qty + "개";
        li.querySelector(".co__item-sum").textContent = won(l.o.price * l.qty);
        ul.appendChild(li);
        n += l.qty;
      });
      $("[data-co-count]").textContent = lines.length + "종 · " + n + "개";
      if (dropped) { var nt = $("[data-co-notice]"); nt.textContent = "품절이거나 판매가 끝난 상품 " + dropped + "개는 주문서에서 뺐습니다."; nt.hidden = false; }
      paint();
      if (API) {
        loadMe().then(function () { requote(true); });
        // 카드 선택지: 결제 설정이 있다고 확인될 때만 보이고(그 전·실패·설정 없음은 숨김), 고객이 아직 고르지 않았으면 카드를 기본으로
        call("GET", "/api/v2/config").then(function (j) {
          if (!(j && j.ok && j.card)) return;
          $("[data-card-opt]").hidden = false;
          if (!payTouched) $("input[data-pay][value=card]").checked = true;
          paint();
        }, function () {});
      }
    }).catch(function () { empty.hidden = false; empty.querySelector(".cart-empty__msg").textContent = "상품 정보를 불러오지 못했습니다."; });
  }

  /* ── 주문 완료 — 실제 주문(data-api): 주소의 o·t 로 조회해 채우고, 접수한 장바구니 품목을 비운다 ── */
  function finishPending(no) {
    var p = null;
    try { p = JSON.parse(sessionStorage.getItem(PENDING) || "null"); } catch (e) {}
    if (!p || p.order_no !== no) return;
    if (p.buynow) { try { sessionStorage.removeItem("edenwon_buynow_v2"); } catch (e) {} }
    else {
      Cart.write(Cart.read().filter(function (it) {
        return !p.items.some(function (l) { return l.key === it.key && l.option_id === it.option; });
      }));
    }
    try { sessionStorage.removeItem(PENDING); } catch (e) {}
  }
  function initDoneLive(box) {
    var u = new URLSearchParams(location.search), o = u.get("o"), t = u.get("t");
    var msg = document.querySelector("[data-done-msg]"), title = document.querySelector("[data-done-title]"), lead = document.querySelector("[data-done-lead]");
    function fail(text) { title.textContent = "주문 정보를 확인하지 못했습니다"; lead.textContent = ""; msg.textContent = text; msg.hidden = false; }
    if (!o || !t) { fail("주소에 주문 정보가 없습니다. 문자로 받은 주문번호로 «주문 내역 보기»에서 확인해 주세요."); return; }
    call("GET", "/api/v2/orders/" + encodeURIComponent(o) + "?t=" + encodeURIComponent(t)).then(function (j) {
      if (!j.ok) {
        fail(j._status === 404 ? "주문을 찾을 수 없습니다. 주소가 만료되었을 수 있습니다. 문자로 받은 주문번호로 «주문 내역 보기»에서 확인해 주세요."
                               : (j.error || "주문 정보를 불러오지 못했습니다. 새로고침해 주세요."));
        return;
      }
      var card = j.payment === "card", unpaidCard = card && !j.paid;
      title.textContent = unpaidCard ? "카드 결제가 끝나지 않았습니다" : card ? "결제가 완료되었습니다" : "주문이 접수되었습니다";
      lead.textContent = unpaidCard ? "주문은 결제 전 상태입니다. 다시 결제하시려면 주문서에서 새로 주문해 주세요."
        : card ? "주문번호를 문자로 보내드렸습니다.\n준비를 시작하면 다시 알려드립니다."
        : j.amount === 0 ? "적립금으로 결제가 끝났습니다.\n준비를 시작하면 다시 알려드립니다."
        : "주문번호와 입금 안내를 문자로 보내드렸습니다.\n입금이 확인되면 준비를 시작하고 다시 알려드립니다.";
      box.querySelector("[data-done-no]").textContent = j.order_no;
      box.querySelector("[data-done-copyno]").setAttribute("data-copy", j.order_no);
      box.querySelector("[data-done-amount-label]").textContent = card ? "결제 금액" : "입금 금액";
      box.querySelector("[data-done-amount]").textContent = won(j.amount);
      box.querySelectorAll("[data-bank-row]").forEach(function (el) { el.hidden = card || j.amount === 0; });
      box.querySelector("[data-done-receive]").textContent = j.receive === "parcel" ? "택배 배송" : "영동 농장 직접 수령";
      box.querySelector("[data-done-status]").textContent = j.status;
      var ul = box.querySelector("[data-done-items]"), n = 0;
      j.items.forEach(function (it) {
        var li = document.createElement("li"), a = document.createElement("span"), b = document.createElement("b"), m = document.createElement("span");
        a.textContent = it.product + " "; m.className = "muted"; m.textContent = it.option_label + " · " + it.count + "개"; a.appendChild(m);
        b.textContent = won(it.line_amount); li.appendChild(a); li.appendChild(b); ul.appendChild(li); n += it.count;
      });
      box.querySelector("[data-done-count]").textContent = j.items.length + "종 · " + n + "개";
      box.hidden = false;
      if (!unpaidCard) finishPending(j.order_no);
    }, function () { fail("연결이 원활하지 않습니다. 새로고침해 주세요."); });
  }

  /* ── 주문 완료 (Done2): 복사 버튼 · 문자 바이트 ── */
  function initDone() {
    var out = document.querySelector("[data-copied]");
    document.querySelectorAll("[data-copy]").forEach(function (b) {
      b.addEventListener("click", function () {
        var v = b.getAttribute("data-copy");
        function done(ok) { if (out) out.textContent = ok ? "복사했습니다: " + v : "복사하지 못했습니다. 길게 눌러 직접 복사해 주세요."; }
        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(v).then(function () { done(true); }, function () { done(false); });
        else {
          var t = document.createElement("textarea"); t.value = v; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
          document.body.appendChild(t); t.select(); var ok = false; try { ok = document.execCommand("copy"); } catch (e) {} t.remove(); done(ok);
        }
      });
    });
    var sms = document.querySelector("[data-sms]");
    if (sms) {
      var text = sms.textContent, bytes = 0;
      for (var i = 0; i < text.length; i++) bytes += text.charCodeAt(i) < 128 ? 1 : 2;   // 문자 바이트(한글 2, 영문·숫자 1)
      document.querySelector("[data-sms-bytes]").textContent = (bytes <= 90 ? "SMS" : "LMS") + " · " + bytes + "바이트";
      document.querySelector("[data-sms-note]").textContent = bytes <= 90
        ? "90바이트 이하라 단문(SMS)으로 나갑니다. 내용이 길어지면 자동으로 장문(LMS)으로 바뀝니다."
        : "90바이트를 넘어 장문(LMS)으로 나갑니다.";
    }
  }

  /* ── 접힌 구역(상품정보제공고시·배송·교환): 바로가기·주소 #id 로 오면 펼친다 ── */
  function initFolds() {
    function openFor(id) {
      var sec = id && document.getElementById(id);
      var d = sec && sec.querySelector("details[data-fold]");
      if (d) d.open = true;
    }
    document.querySelectorAll("[data-sec-link], a[href^='#']").forEach(function (a) {
      a.addEventListener("click", function () { openFor(a.getAttribute("href").slice(1)); });
    });
    window.addEventListener("hashchange", function () { openFor(location.hash.slice(1)); });
    if (location.hash) openFor(location.hash.slice(1));
  }

  /* ── 식초 «고르는 법» 카드 → 구매 영역의 선택 상자로 ── */
  function initChoose() {
    document.querySelectorAll("[data-choose]").forEach(function (a) {
      a.addEventListener("click", function (e) {
        var sel = document.querySelector("[data-opt-select]");
        if (!sel) return;
        e.preventDefault();
        sel.scrollIntoView({ block: "center", behavior: "smooth" });
        sel.focus({ preventScroll: true });
        var msg = document.querySelector("[data-buy-msg]");
        if (msg) { msg.textContent = a.getAttribute("data-choose") + " 계열에서 골라 주세요."; msg.hidden = false; }
      });
    });
  }

  // 친환경 인증 유효기간: 종료일(한국 날짜)이 지나면 인증 줄·표지를 뺀다. 빌드도 같은 규칙으로 빼지만, 다시 빌드하기 전의 페이지를 위한 안전장치.
  function initCertExpiry() {
    var today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    document.querySelectorAll("[data-cert-end]").forEach(function (el) {
      if (today > el.getAttribute("data-cert-end")) el.remove();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initCertExpiry();
    initFonts();
    initFolds();
    initChoose();
    Added.init();
    initCardAdd();
    document.querySelectorAll("[data-catalog]").forEach(initCatalog);
    document.querySelectorAll("[data-gallery]").forEach(initGallery);
    document.querySelectorAll("[data-buy]").forEach(initBuy);
    document.querySelectorAll("[data-like]").forEach(initLike);
    initSecNav();
    document.querySelectorAll("[data-cart-page]").forEach(initCartPage);
    document.querySelectorAll("[data-checkout]").forEach(initCheckout);
    initDone();
    if (API) document.querySelectorAll("[data-done]").forEach(initDoneLive);
    Cart.render();
    initDrawer();
    initSearch();
    document.querySelectorAll("[data-carousel]").forEach(initCarousel);
    document.querySelectorAll("[data-tabs=picks]").forEach(initPickTabs);
  });
})();
