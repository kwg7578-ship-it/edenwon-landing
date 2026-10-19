/* 영동에덴원 v2 — 장바구니(localStorage edenwon_cart_v2) · 서랍 메뉴 · 검색 · 배너 슬라이더 · 탭 · 주문서 · 머리글 회원 칸
   기존 키(edenwon_profile 등)는 읽지 않는다. 로그아웃·탈퇴 때만 회원 관련 키를 지운다(B15, clearMember).
   서버 호출은 <html data-api> 가 있을 때만(LOCAL=1 리허설 · PREVIEW=0 출시). PREVIEW=1 미리보기는 아무것도 보내지 않는다. */
(function () {
  "use strict";
  /* 2-J-1 고정 문구: 편집기에서 바꾼 글 {원래 글: 바꾼 글}(쪽의 #ed-texts — 바꾼 글이 없으면 덩어리도 없음). T(원래 글), Tf(«{0}칸 …», 값) */
  var TXM = (function () { var e = document.getElementById("ed-texts"); try { return e ? JSON.parse(e.textContent) : {}; } catch (x) { return {}; } })();
  function T(d) { return Object.prototype.hasOwnProperty.call(TXM, d) ? TXM[d] : d; }
  function Tf(d) { var a = arguments; return T(d).replace(/\{(\d)\}/g, function (m, k) { return a[+k + 1]; }); }
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

  /* ── 회원 API(2-B-2): 쿠키를 싣고, 쓰기 요청에는 X-Edenwon: 1 을 붙인다(서버의 쓰기 요청 보호) ── */
  function acall(method, path, body) {
    var h = {};
    if (method !== "GET") { h["Content-Type"] = "application/json"; h["X-Edenwon"] = "1"; }
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, 15000) : null;
    return fetch(API + path, { method: method, credentials: "include", headers: h,
                               body: method !== "GET" ? JSON.stringify(body || {}) : undefined, signal: ctl ? ctl.signal : undefined })
      .then(function (r) {
        clearTimeout(timer);
        return r.json().catch(function () { return {}; }).then(function (j) { j._status = r.status; return j; });
      }, function (e) { clearTimeout(timer); throw e; });
  }
  /* 로그아웃·탈퇴 뒤 이 브라우저에 남은 회원 관련 값 지우기(B15). 장바구니·찜은 남긴다. */
  var MEMBER_KEYS = { local: ["edenwon_profile"], session: ["edenwon_order_lookup", "edenwon_pending_v2"] };
  function clearMember() {
    MEMBER_KEYS.local.forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
    MEMBER_KEYS.session.forEach(function (k) { try { sessionStorage.removeItem(k); } catch (e) {} });
  }
  /* 머리글 회원 칸: «로그인 · 회원가입» ↔ «○○님 · 마이 · 로그아웃». 자리는 미리 잡혀 있어 바뀌어도 밀리지 않는다. */
  var Member = { me: null, ready: null };
  function paintMember(me) {
    document.querySelectorAll("[data-hd-member], [data-dr-member]").forEach(function (box) {
      box.querySelectorAll("[data-m-anon]").forEach(function (el) { el.hidden = !!me; });
      box.querySelectorAll("[data-m-in]").forEach(function (el) { el.hidden = !me; });
      var n = box.querySelector("[data-hd-name], [data-dr-name]");
      if (n) n.textContent = me ? me.name + "님" : "";
    });
  }
  function loginHref() {
    return root() + "account/login.html?next=" + encodeURIComponent(location.pathname + location.search);
  }
  function initMember() {
    if (!API) { Member.ready = Promise.resolve(null); return; }
    var onAcct = /\/account\//.test(location.pathname);
    if (!onAcct) document.querySelectorAll("[data-hd-login], [data-dr-login]").forEach(function (a) { a.href = loginHref(); });
    Member.ready = acall("GET", "/api/v2/me").then(function (j) {
      Member.me = j && j.ok && j.member ? j.member : null; paintMember(Member.me); return Member.me;
    }, function () { return null; });
    document.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("[data-logout]");
      if (!b || b.disabled) return;
      e.preventDefault(); b.disabled = true;
      acall("POST", "/api/v2/auth/logout").then(function () {
        clearMember(); Member.me = null; paintMember(null); b.disabled = false;
        if (onAcct) location.href = root() + "index.html";
      }, function () { b.disabled = false; });
    });
  }
  window.Eden = { API: API, acall: acall, clearMember: clearMember, paintMember: paintMember, member: Member };

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
    _n: null,
    addGift: function (set, items) {   // 세트는 한 묶음이 한 줄(합치지 않음)
      var c = Cart.read();
      c.push({ gift: set, items: items.map(function (x) { return { key: x.key, option: x.option }; }), qty: 1, checked: true });
      Cart.write(c);
      return true;
    },
    render: function () {
      var n = Cart.count(), up = Cart._n !== null && n > Cart._n;
      Cart._n = n;
      document.querySelectorAll("[data-cart-count]").forEach(function (el) {
        el.textContent = n > 99 ? "99+" : String(n);
        el.hidden = n === 0;
        if (up) { el.classList.remove("is-pop"); void el.offsetWidth; el.classList.add("is-pop"); }   // 담을 때 한 번 톡
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

  /* ── 배너 슬라이더(개정 2-1): 화살표 · 점 · 키보드 ←/→ · 스와이프. 페이지를 다 불러온 뒤 사진이 겹쳐 바뀐다(6초 머묾, 1.2초 전환).
     일시정지 버튼 필수(WCAG 2.2.2). 마우스를 올리거나 포커스가 들어오면, 화면 밖이거나 탭이 숨겨지면 멈춘다.
     움직임 줄이기 설정이면 자동 전환 없음(첫 장 고정, 손으로만 넘김). 그 전까지는 첫 장만 있고 나머지 사진은 늦게 불러온다. ── */
  var REDUCE = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var SAVE_DATA = !!(navigator.connection && navigator.connection.saveData);

  /* ── 영상 자리(개정 3-1): 주소는 data- 에만. 처음 재생할 때 source 를 채운다. 움직임 줄이기·데이터 절약이면 아무것도 받지 않는다(포스터 사진만) ── */
  var VIDEO_OK = !REDUCE && !SAVE_DATA;
  function videoSet(v, on) {
    if (!v || !VIDEO_OK) return;
    if (on) {
      if (!v._filled) {
        v._filled = true; v.muted = true;
        ["webm", "mp4"].forEach(function (k) {
          var u = v.getAttribute("data-" + k);
          if (u) { var src = document.createElement("source"); src.src = u; src.type = "video/" + k; v.appendChild(src); }
        });
        v.addEventListener("playing", function () { v.classList.add("is-playing"); });
        v.load();
      }
      var pr = v.play(); if (pr && pr.catch) pr.catch(function () {});
    } else if (v._filled) v.pause();
  }
  function initVslot(fig) {
    var v = fig.querySelector("video"), btn = fig.querySelector("[data-vpause]");
    if (!v || !VIDEO_OK) return;
    var st = { user: false, vis: false, tab: false, ready: false };
    function sync() { videoSet(v, st.ready && st.vis && !st.tab && !st.user); }
    if (btn) {
      btn.hidden = false;
      btn.addEventListener("click", function () {
        st.user = !st.user;
        btn.classList.toggle("is-paused", st.user); btn.setAttribute("aria-pressed", st.user ? "true" : "false");
        btn.setAttribute("aria-label", st.user ? "영상 다시 재생" : "영상 멈춤");
        sync();
      });
    }
    document.addEventListener("visibilitychange", function () { st.tab = document.hidden; sync(); });
    if ("IntersectionObserver" in window)
      new IntersectionObserver(function (es) { st.vis = es[0].isIntersecting; sync(); }, { threshold: 0.25 }).observe(fig);
    else st.vis = true;
    function go() { st.ready = true; sync(); }
    if (document.readyState === "complete") go(); else window.addEventListener("load", go);
  }
  /* 2-I 배너 사진이 마우스를 따라 최대 10px(마우스 기기·움직임 줄이기 아님) — 값만 바꾸고 이동은 CSS(motion.css). 장 순서·겹침과 무관 */
  function initHeroFollow(root) {
    if (!(window.matchMedia && window.matchMedia("(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)").matches)) return;
    var x = 0, y = 0, ticking = false;
    function paint() { ticking = false; root.style.setProperty("--hx", x.toFixed(3)); root.style.setProperty("--hy", y.toFixed(3)); }
    function ask() { if (!ticking) { ticking = true; requestAnimationFrame(paint); } }
    root.addEventListener("mousemove", function (e) {
      var r = root.getBoundingClientRect();
      x = Math.max(-1, Math.min(1, (e.clientX - r.left) / r.width * 2 - 1));
      y = Math.max(-1, Math.min(1, (e.clientY - r.top) / r.height * 2 - 1));
      ask();
    });
    root.addEventListener("mouseleave", function () { x = y = 0; ask(); });
  }
  function initCarousel(root) {
    initHeroFollow(root);
    var slides = root.querySelectorAll("[data-slide]");
    var dots = root.querySelectorAll("[data-dot]");
    var num = root.querySelector("[data-num]");
    var pause = root.querySelector("[data-pause]");
    var n = slides.length, i = 0, fade = false, timer = null, DWELL = 6000;
    var st = { user: false, hover: false, focus: false, off: false, tab: false };
    function running() { return fade && n > 1 && !st.user && !st.hover && !st.focus && !st.off && !st.tab; }
    function schedule() {
      clearTimeout(timer); timer = running() ? setTimeout(function () { go(i + 1); }, DWELL) : null;
      slides.forEach(function (s, j) { videoSet(s.querySelector("video"), fade && j === i && !st.user && !st.off && !st.tab); });   // 영상은 지금 장·보일 때·멈추지 않았을 때만
    }
    function go(k) {
      i = (k + n) % n;
      slides.forEach(function (s, j) { if (fade) s.classList.toggle("is-on", j === i); else s.hidden = j !== i; });
      dots.forEach(function (d, j) { if (j === i) d.setAttribute("aria-current", "true"); else d.removeAttribute("aria-current"); });
      if (num) num.textContent = (i + 1 < 10 ? "0" : "") + (i + 1);
      root.setAttribute("data-tone", slides[i].classList.contains("hero__slide--light") ? "light" : "dark");
      root.setAttribute("data-index", String(i));
      if (slides[i].hasAttribute("data-sea")) root.setAttribute("data-sea", slides[i].getAttribute("data-sea"));   // 2-H H1-2: 계절 표시·진행 색
      schedule();
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
    if (n < 2 || REDUCE) return;
    function paint() {
      pause.classList.toggle("is-paused", st.user); pause.setAttribute("aria-pressed", st.user ? "true" : "false");
      var hv = !!root.querySelector("video");
      pause.setAttribute("aria-label", st.user ? (hv ? "배너 자동 넘김·영상 다시 시작" : "배너 자동 넘김 다시 시작") : (hv ? "배너 자동 넘김·영상 멈춤" : "배너 자동 넘김 멈춤"));
    }
    if (pause) pause.addEventListener("click", function () { st.user = !st.user; paint(); schedule(); });
    root.addEventListener("mouseenter", function () { st.hover = true; schedule(); });
    root.addEventListener("mouseleave", function () { st.hover = false; schedule(); });
    root.addEventListener("focusin", function (e) { st.focus = e.target !== pause; schedule(); });   // 일시정지 버튼 자체의 포커스는 멈춤 조건이 아님(WAI 캐러셀)
    root.addEventListener("focusout", function (e) { if (!root.contains(e.relatedTarget)) { st.focus = false; schedule(); } });
    document.addEventListener("visibilitychange", function () { st.tab = document.hidden; schedule(); });
    if ("IntersectionObserver" in window)
      new IntersectionObserver(function (es) { st.off = !es[0].isIntersecting; schedule(); }, { threshold: 0.25 }).observe(root);
    function enable() {      // 첫 화면을 다 그린 뒤: 나머지 사진을 불러오기 시작하고 겹쳐 바뀌는 방식으로
      root.classList.add("is-fade", "is-fade-init");
      fade = true;
      slides.forEach(function (s, j) { s.hidden = false; s.classList.toggle("is-on", j === i); });
      requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.remove("is-fade-init"); }); });
      if (pause) { pause.hidden = false; paint(); }
      schedule();
    }
    if (document.readyState === "complete") setTimeout(enable, 400);
    else window.addEventListener("load", function () { setTimeout(enable, 400); });
  }

  /* ── 움직임(개정 2-2): 스크롤 등장 · 머리글 붙음 표시. 처음 화면 안에 있던 것은 움직이지 않는다(첫 표시를 늦추지 않게). ── */
  function initMotion() {
    var hd = document.querySelector("[data-hd]");
    if (hd) {
      var stuck = false, tick = false;
      var onScroll = function () {
        tick = false;
        var s = window.scrollY > 24;
        if (s !== stuck) { stuck = s; hd.classList.toggle("is-stuck", s); }
      };
      window.addEventListener("scroll", function () { if (!tick) { tick = true; requestAnimationFrame(onScroll); } }, { passive: true });
      onScroll();
    }
    if (REDUCE || !("IntersectionObserver" in window)) return;
    if (!/\bpage-(home|products|detail|story)\b/.test(document.body.className)) return;
    var vh = window.innerHeight, list = [];
    document.querySelectorAll("main .card, main > section:not(.hero), main .sb, main .story-block, main .cats__item, main .gx").forEach(function (el) {
      if (el.closest(".rv") || (el.tagName === "SECTION" && el.querySelector(".card"))) return;
      if (el.getBoundingClientRect().top < vh) return;
      el.classList.add("rv"); list.push(el);
    });
    var io = new IntersectionObserver(function (es) {
      var k = 0;
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        if (el.classList.contains("card") || el.classList.contains("cats__item")) el.style.transitionDelay = Math.min(k++, 5) * 0.06 + "s";
        el.classList.add("is-in"); io.unobserve(el);
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    list.forEach(function (el) { io.observe(el); });
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
        var live = document.querySelector("[data-added-live]");   // 2-I 화면 읽기 알림
        if (live) { live.textContent = ""; setTimeout(function () { live.textContent = "장바구니에 담았습니다. " + text; }, 60); }
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
  /* 2장 이상(개정 2 §6-4): PC 는 작은 사진 누름·마우스 올림·화살표 키로 크로스페이드, 휴대폰·태블릿(<1024)은 큰 사진 가로 스냅 트랙을 밀어 넘긴다
     (개정 3-2 의 손가락 넘기기를 이 트랙이 맡는다). 둘째 장부터 큰 사진은 넘길 때(그 장·양옆)와 한가할 때 주소를 채운다. */
  function initGallery(g) {
    var thumbs = g.querySelectorAll("[data-thumb]"), shots = g.querySelectorAll("[data-shot]"), cur = 0;
    var main = g.querySelector("[data-track]"), count = g.querySelector("[data-count]");
    if (!main || shots.length < 2) return;
    g._mark = function () { mark(cur); };   // H3: 옵션 사진 겹을 내릴 때 옆 사진 줄 선택 표시 되돌리기
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function load(k) {
      var s = shots[k];
      if (!s) return;
      s.querySelectorAll("[data-srcset]").forEach(function (el) { el.setAttribute("srcset", el.getAttribute("data-srcset")); el.removeAttribute("data-srcset"); });
    }
    var narrow = window.matchMedia("(max-width:1023px)");   // 휴대폰·태블릿 = 스냅 트랙(pages.css 와 같은 기준)
    function swipe() { return narrow.matches; }
    function mark(k) {
      cur = k;
      thumbs.forEach(function (x) { if (+x.getAttribute("data-thumb") === k) x.setAttribute("aria-current", "true"); else x.removeAttribute("aria-current"); });
      shots.forEach(function (s) { s.classList.toggle("is-on", +s.getAttribute("data-shot") === k); });
      if (count) count.textContent = String(k + 1);
      load(k); load(k + 1); load(k - 1);
    }
    function show(k, fromTrack) {
      k = (k + shots.length) % shots.length;
      if (k === cur && !fromTrack) return;
      mark(k);
      var t = thumbs[k];
      if (t && t.parentNode.scrollHeight > t.parentNode.clientHeight + 1 || t && t.parentNode.scrollWidth > t.parentNode.clientWidth + 1) {
        t.parentNode.scrollTo({ top: t.offsetTop - t.parentNode.offsetTop - 10, left: t.offsetLeft - t.parentNode.offsetLeft - 10, behavior: reduce ? "auto" : "smooth" });
      }
      if (!fromTrack && swipe()) main.scrollTo({ left: k * main.clientWidth, behavior: reduce ? "auto" : "smooth" });
    }
    thumbs.forEach(function (t) {
      t.addEventListener("click", function () { show(+t.getAttribute("data-thumb")); });
      t.addEventListener("mouseenter", function () { if (window.matchMedia("(hover:hover)").matches && !swipe()) show(+t.getAttribute("data-thumb")); });
    });
    g.addEventListener("keydown", function (e) {
      var d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!d) return;
      e.preventDefault();
      show(cur + d);
      if (document.activeElement && document.activeElement.hasAttribute("data-thumb")) thumbs[cur].focus();
    });
    var tick = null;
    main.addEventListener("scroll", function () {   // 손가락으로 민 트랙 → 숫자·작은 사진 표시를 따라간다
      if (!swipe()) return;
      clearTimeout(tick);
      tick = setTimeout(function () { var k = Math.round(main.scrollLeft / main.clientWidth); if (k !== cur) show(k, true); }, 60);
      load(Math.round(main.scrollLeft / main.clientWidth) + 1);
    }, { passive: true });
    function idle() { shots.forEach(function (s, k) { load(k); }); }
    function later() { if (window.requestIdleCallback) requestIdleCallback(idle, { timeout: 4000 }); else setTimeout(idle, 1500); }
    if (document.readyState === "complete") later(); else window.addEventListener("load", later);
  }

  /* ── 과정 따라가기(2-G 개정 2 §6-3): 단계 줄(tablist)·이전·다음·화살표 키·휴대폰 밀기·«자동으로 보기»(4초, 다시 누르면 멈춤 — 기본 꺼짐).
     움직임은 CSS(0.45초 크로스페이드, 글 0.25초 늦게, 진행 선 0.4초). 사진은 lazy(겹친 패널이라 블록이 화면에 들어오면 같이 받는다) ── */
  /* ── 2-K-1 과정 «전체 펼쳐 보기»: 넘김 줄(이전·다음·자동 줄)에 단추를 넣는다(같은 줄 — 높이 변화 0). 펼치면 단계가 0.06초 간격으로 나타나고(CSS 0.35초),
     접으면 따라가기로 돌아와 블록 머리로 이동. 단계 «자세히»는 grid-template-rows 0fr → 1fr(0.3초), + ↔ −. 움직임 줄이기면 전환 없이 바로 ── */
  function initPJAll(root, onOpen) {
    var nav = root.querySelector(".pj__nav"), box = root.querySelector("[data-pj-panels]"), panels = root.querySelectorAll("[data-pj-panel]");
    if (!nav || !box) return;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!box.id) box.id = root.id + "-panels";
    var b = document.createElement("button");
    b.type = "button"; b.className = "pj__all"; b.setAttribute("data-pj-all", ""); b.setAttribute("aria-controls", box.id);
    function paint() { var on = root.classList.contains("is-open"); b.setAttribute("aria-expanded", String(on)); b.textContent = on ? "접기" : "과정 전체 펼쳐 보기"; }
    panels.forEach(function (p, i) { p.style.setProperty("--d", (i * 0.06).toFixed(2) + "s"); });
    b.addEventListener("click", function () {
      if (root.classList.contains("is-open")) {
        root.classList.remove("is-open", "is-enter"); paint();
        root.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });   // [data-sec] scroll-margin-top 이 머리글 높이를 비워 둔다
      } else {
        onOpen();
        root.classList.add("is-open");
        if (!reduce) { root.classList.add("is-enter"); void root.offsetHeight; requestAnimationFrame(function () { root.classList.remove("is-enter"); }); }
        paint();
      }
    });
    nav.insertBefore(b, nav.querySelector("[data-pj-auto]"));
    paint();
    root.querySelectorAll("[data-pj-more]").forEach(function (m) {
      var mb = m.querySelector("[data-pj-more-btn]"), pm = m.querySelector(".pj__pm");
      mb.addEventListener("click", function () {
        var on = !m.classList.contains("is-on");
        m.classList.toggle("is-on", on); mb.setAttribute("aria-expanded", String(on)); pm.textContent = on ? "−" : "+";
      });
    });
  }
  function initPJ(root) {
    var tabs = root.querySelectorAll("[data-pj-tab]"), panels = root.querySelectorAll("[data-pj-panel]"), rail = root.querySelector("[data-pj-rail]");
    var n = tabs.length, cur = 0, timer = null, auto = root.querySelector("[data-pj-auto]");
    if (n < 2) return;
    initPJAll(root, function () { stop(); });
    function go(k, focus) {
      k = (k + n) % n; cur = k;
      tabs.forEach(function (t, i) {
        t.setAttribute("aria-selected", String(i === k)); t.tabIndex = i === k ? 0 : -1; t.classList.toggle("is-past", i < k);
      });
      panels.forEach(function (p, i) { p.classList.toggle("is-on", i === k); });
      rail.style.setProperty("--p", String(k / (n - 1)));
      if (rail.scrollWidth > rail.clientWidth + 1) rail.scrollTo({ left: tabs[k].offsetLeft - 20, behavior: "smooth" });
      if (focus) tabs[k].focus();
    }
    function stop() {
      if (!timer) return;
      clearInterval(timer); timer = null; auto.setAttribute("aria-pressed", "false"); auto.textContent = T("자동으로 보기");
    }
    tabs.forEach(function (t, i) { t.addEventListener("click", function () { stop(); go(i); }); });
    rail.addEventListener("keydown", function (e) {
      var k = { ArrowRight: cur + 1, ArrowDown: cur + 1, ArrowLeft: cur - 1, ArrowUp: cur - 1, Home: 0, End: n - 1 }[e.key];
      if (k === undefined) return;
      e.preventDefault(); stop(); go(Math.max(0, Math.min(n - 1, k)), true);
    });
    root.querySelector("[data-pj-prev]").addEventListener("click", function () { stop(); go(cur - 1); });
    root.querySelector("[data-pj-next]").addEventListener("click", function () { stop(); go(cur + 1); });
    auto.addEventListener("click", function () {
      if (timer) { stop(); return; }
      auto.setAttribute("aria-pressed", "true"); auto.textContent = "멈춤";
      timer = setInterval(function () { if (!document.hidden) go(cur + 1); }, 4000);
    });
    var box = root.querySelector("[data-pj-panels]"), x0 = null, y0 = null;   // 휴대폰: 패널을 좌우로 밀어 넘긴다(세로로 끌면 그대로 스크롤)
    box.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    box.addEventListener("touchend", function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { stop(); go(cur + (dx < 0 ? 1 : -1)); }
      x0 = y0 = null;
    }, { passive: true });
  }

  /* ── 계절 자동(2-H H1-1): head 스크립트가 손님 날짜로 맞춘 data-season 에 계절 이름 글자를 맞춘다(빌드 값과 같으면 그대로) ── */
  function initSeasonWords() {
    document.documentElement.removeAttribute("data-season-moved");   // 홈 배너 스크립트가 못 지웠을 때를 위한 안전장치(H1-2)
    var ko = { spring: "봄", summer: "여름", autumn: "가을", winter: "겨울" }[document.documentElement.getAttribute("data-season")];
    if (!ko) return;
    document.querySelectorAll("[data-season-ko]").forEach(function (el) { if (el.textContent !== ko) el.textContent = ko; });
  }

  /* ── 소식 띠(H2·H2b): API(계절별 — 손님 날짜의 계절 글) → 빌드 때 받은 목록 → «블로그에서 보기» 단추. 3초(편집기 3~8초)마다 한 칸(띠 안 스크롤 — 밀림 0),
     일시정지(WCAG 2.2.2)·마우스 올림/포커스 멈춤·화면 밖·탭 숨김 멈춤·움직임 줄이기면 자동 넘김 없음, 새 탭 ── */
  function initFeed(root) {
    var vp = root.querySelector("[data-feed-viewport]"), track = root.querySelector("[data-feed-track]");
    var ctrl = root.querySelector("[data-feed-ctrl]"), empty = root.querySelector("[data-feed-empty]"), pause = root.querySelector("[data-feed-pause]");
    var api = root.getAttribute("data-feed-api"), src = root.getAttribute("data-feed-src"), label = root.getAttribute("data-feed-label") || "";
    var IV = (+root.getAttribute("data-feed-iv") || 3) * 1000, N = +root.getAttribute("data-feed-n") || 8;   // H2b: 간격(초)·띄울 글 수
    // H2b 계절: 날짜(KST) → [계절, 계절 해](1·2월은 앞 해 겨울). 손님 날짜 = 한국 시각 오늘(H1-1 과 같은 기준)
    function sea(iso) { var m = /^(\d{4})-(\d{2})-\d{2}$/.exec(iso || ""); return m ? [["winter", "spring", "summer", "autumn"][(+m[2]) % 12 / 3 | 0], +m[1] - (+m[2] <= 2 ? 1 : 0)] : null; }
    var kst = new Date(Date.now() + 324e5), T = sea(kst.getUTCFullYear() + "-" + ("0" + (kst.getUTCMonth() + 1)).slice(-2) + "-01");
    function pick(j) {   // build.py feed_pick 과 같은 규칙: 지금 계절 글 ≥3 → 그 글만, 모자라면 + 그 계절 글 중 가장 최근 해(H2b-2) + 최근 글
      if (!j.seasons) return (j.items || []).slice(0, N);
      var box = j.seasons[T[0]] || [], is = function (y) { return function (it) { var s = sea(it.date); return s && s[0] === T[0] && s[1] === y; }; };
      var now = box.filter(is(T[1])), past = null;
      if (now.length >= 3) return now.slice(0, N);
      box.forEach(function (it) { var s = sea(it.date); if (s && s[0] === T[0] && s[1] < T[1] && (past === null || s[1] > past)) past = s[1]; });
      var out = [], seen = {};
      now.concat(past === null ? [] : box.filter(is(past)), j.recent || j.items || []).forEach(function (it) { if (it.url && !seen[it.url]) { seen[it.url] = 1; out.push(it); } });
      return out.slice(0, N);
    }
    function day(iso) {   // build.py feed_when 과 같은 규칙: 올해 글·지금 계절 글은 «10월 17일», 지난해 글은 «2024 가을»
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ""), s = sea(iso); if (!m) return "";
      if (+m[1] === kst.getUTCFullYear() || (s[0] === T[0] && s[1] === T[1])) return (+m[2]) + "월 " + (+m[3]) + "일";
      return s[1] + " " + { spring: "봄", summer: "여름", autumn: "가을", winter: "겨울" }[s[0]];
    }
    function mk(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
    function render(items) {
      track.textContent = "";
      items.forEach(function (it) {
        if (!/^https:\/\/(m\.)?blog\.naver\.com\//.test(it.url || "")) return;
        var li = mk("li", "feed__item"), a = mk("a", "feed__card"), ph = mk("span", "feed__ph"), meta = mk("span", "feed__meta");
        a.href = it.url; a.target = "_blank"; a.rel = "noopener";
        if (it.thumb_480 && /^[0-9a-f]{16}-480$/.test(it.thumb_480)) {
          var im = document.createElement("img"), b = api + "/api/v2/feed/thumb/";
          im.src = b + it.thumb_480 + ".webp"; im.srcset = b + it.thumb_480 + ".webp 480w, " + b + it.thumb_960 + ".webp 960w";
          im.sizes = "(max-width:768px) 80vw, 25vw"; im.alt = ""; im.loading = "lazy"; im.decoding = "async"; im.width = 480; im.height = 360;
          ph.appendChild(im);
        }
        meta.appendChild(mk("span", "feed__src", label)); meta.appendChild(mk("span", "feed__date", day(it.date)));
        a.appendChild(ph); a.appendChild(meta); a.appendChild(mk("span", "feed__title", it.title || ""));
        li.appendChild(a); track.appendChild(li);
      });
      var has = track.children.length > 0;
      vp.hidden = ctrl.hidden = !has; empty.hidden = has || !!(list && list.children.length); tick();
    }
    // 2-K-2 목록형(home.feed.layout list·both): 최신 글 6줄(새 글이 위) — 작은 사진 64px + 제목 + 날짜, 새 탭
    var side = root.querySelector("[data-feed-side]"), list = root.querySelector("[data-feed-list]");
    function renderList(items) {
      list.textContent = "";
      items.forEach(function (it) {
        if (!/^https:\/\/(m\.)?blog\.naver\.com\//.test(it.url || "") || list.children.length >= 6) return;
        var li = mk("li"), a = mk("a", "feed__row"), ph = mk("span", "feed__rph");
        a.href = it.url; a.target = "_blank"; a.rel = "noopener";
        if (it.thumb_480 && /^[0-9a-f]{16}-480$/.test(it.thumb_480)) {
          var im = document.createElement("img"); im.src = api + "/api/v2/feed/thumb/" + it.thumb_480 + ".webp";
          im.alt = ""; im.width = 64; im.height = 64; im.loading = "lazy"; im.decoding = "async"; ph.appendChild(im);
        }
        a.appendChild(ph); a.appendChild(mk("span", "feed__rt", it.title || "")); a.appendChild(mk("span", "feed__rd", day(it.date)));
        li.appendChild(a); list.appendChild(li);
      });
      side.hidden = !list.children.length;
      empty.hidden = list.children.length > 0 || !!(track && track.children.length);
    }
    if (api && window.fetch && window.AbortController) {
      var ac = new AbortController(), to = setTimeout(function () { ac.abort(); }, 4000);
      fetch(api + "/api/v2/feed?source=" + encodeURIComponent(src) + "&view=season", { signal: ac.signal, credentials: "omit" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          clearTimeout(to); var p = j && j.items ? pick(j) : [];
          if (p.length && vp) render(p);
          if (list && j && j.items) { var r = (j.recent || j.items).slice(); if (r.length) renderList(r); }   // 옛 응답이면 items(최신 순)
        })
        .catch(function () { clearTimeout(to); });   // 실패하면 빌드 때 받은 목록(또는 단추) 그대로
    }
    if (!vp) return;   // 목록형(띠 없음) — 아래는 카드 띠 넘김
    var st = { paused: false, hover: false, focus: false, vis: false }, timer = null;
    function step(d) {
      var c = track.children; if (!c.length) return;
      var w = c[0].getBoundingClientRect().width + (parseFloat(getComputedStyle(track).columnGap) || 0), max = vp.scrollWidth - vp.clientWidth, x = vp.scrollLeft + d * w;
      if (x > max + 2) x = 0; else if (x < -2) x = max;
      vp.scrollTo({ left: x, behavior: REDUCE ? "auto" : "smooth" });
    }
    function tick() {
      clearInterval(timer); timer = null;
      if (!REDUCE && !st.paused && !st.hover && !st.focus && st.vis && !document.hidden && track.children.length > 1 && vp.scrollWidth > vp.clientWidth + 2)
        timer = setInterval(function () { step(1); }, IV);
    }
    root.querySelector("[data-feed-prev]").addEventListener("click", function () { step(-1); });
    root.querySelector("[data-feed-next]").addEventListener("click", function () { step(1); });
    pause.addEventListener("click", function () {
      st.paused = !st.paused; pause.classList.toggle("is-paused", st.paused); pause.setAttribute("aria-pressed", String(st.paused));
      pause.setAttribute("aria-label", st.paused ? "소식 자동 넘김 다시 시작" : "소식 자동 넘김 멈춤"); tick();
    });
    if (REDUCE) { pause.hidden = true; }   // 자동 넘김이 없으니 멈춤 단추도 필요 없음
    vp.addEventListener("keydown", function (e) { var d = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (d) { e.preventDefault(); step(d); } });
    root.addEventListener("mouseenter", function () { st.hover = true; tick(); });
    root.addEventListener("mouseleave", function () { st.hover = false; tick(); });
    root.addEventListener("focusin", function (e) { st.focus = e.target !== pause; tick(); });
    root.addEventListener("focusout", function (e) { if (!root.contains(e.relatedTarget)) { st.focus = false; tick(); } });
    document.addEventListener("visibilitychange", tick);
    if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { st.vis = es[0].isIntersecting; tick(); }, { threshold: 0.3 }).observe(root);
    else { st.vis = true; tick(); }
  }

  /* ── 계절 갤러리(2-H H1-4): 탭(?s= 또는 손님 계절) · 크게 보기(dialog — 열 때만 큰 사진, ←/→·Esc·밀어 넘기기, 닫으면 누른 사진으로) ── */
  function initSeasonGallery(root) {
    var tabs = [].slice.call(root.querySelectorAll("[role=tab]")), panels = root.querySelectorAll("[role=tabpanel]");
    function show(s, focus, push) {
      tabs.forEach(function (t) {
        var on = t.getAttribute("data-s") === s;
        t.setAttribute("aria-selected", on ? "true" : "false"); t.tabIndex = on ? 0 : -1;
        if (on && focus) t.focus();
      });
      panels.forEach(function (p) { p.hidden = p.getAttribute("data-s") !== s; });
      if (push) try { var u = new URL(location.href); u.searchParams.set("s", s); history.replaceState(null, "", u); } catch (e) {}
    }
    var want = new URLSearchParams(location.search).get("s"), ok = function (s) { return tabs.some(function (t) { return t.getAttribute("data-s") === s; }); };
    show(ok(want) ? want : (ok(document.documentElement.getAttribute("data-season")) ? document.documentElement.getAttribute("data-season") : tabs[0].getAttribute("data-s")), false, false);
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { show(t.getAttribute("data-s"), false, true); });
      t.addEventListener("keydown", function (e) {
        var j = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
        if (j === undefined) return;
        e.preventDefault(); show(tabs[(j + tabs.length) % tabs.length].getAttribute("data-s"), true, true);
      });
    });
    var lb = document.querySelector("[data-lb]");
    if (!lb || typeof lb.showModal !== "function") return;   // dialog 를 모르는 옛 브라우저: 사진 격자만
    var img = lb.querySelector("[data-lb-img]"), cap = lb.querySelector("[data-lb-cap]"), num = lb.querySelector("[data-lb-num]"), list = [], k = 0, opener = null;
    function paint() {
      var b = list[k];
      img.removeAttribute("srcset"); img.alt = b.getAttribute("data-alt"); img.setAttribute("srcset", b.getAttribute("data-full"));
      cap.textContent = b.getAttribute("data-cap") || "";
      num.textContent = (k + 1) + " / " + list.length;
    }
    function move(d) { k = (k + d + list.length) % list.length; paint(); }
    root.addEventListener("click", function (e) {
      var b = e.target.closest(".sgal__open");
      if (!b) return;
      list = [].slice.call(b.closest("[role=tabpanel]").querySelectorAll(".sgal__open")); k = list.indexOf(b); opener = b;
      paint(); lb.showModal();
    });
    lb.querySelector("[data-lb-prev]").addEventListener("click", function () { move(-1); });
    lb.querySelector("[data-lb-next]").addEventListener("click", function () { move(1); });
    lb.querySelector("[data-lb-close]").addEventListener("click", function () { lb.close(); });
    lb.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); move(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); move(-1); }
      else if (e.key === "Tab") {   // 포커스 갇힘: 단추 셋 안에서만 돈다(브라우저 주소창으로 나가지 않게)
        var f = [].slice.call(lb.querySelectorAll("button")), i = f.indexOf(document.activeElement);
        e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    });
    lb.addEventListener("click", function (e) { if (e.target === lb) lb.close(); });   // 사진 밖(어두운 곳)을 누르면 닫힘
    lb.addEventListener("close", function () { if (opener) opener.focus(); });
    var x0 = null, y0 = null;
    lb.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    lb.addEventListener("touchend", function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) move(dx < 0 ? 1 : -1);
      x0 = y0 = null;
    }, { passive: true });
  }

  /* ── 상품 카드 두 번째 사진(개정 3-2): 마우스 기기에서만, 첫 화면을 다 그린 뒤 카드가 화면 근처에 오면 주소를 채운다 ── */
  function initAltPhotos() {
    var alts = document.querySelectorAll(".card__alt");
    if (!alts.length || !(window.matchMedia && window.matchMedia("(hover:hover)").matches)) return;
    function fill(pic) {
      pic.querySelectorAll("[data-srcset]").forEach(function (el) { el.setAttribute("srcset", el.getAttribute("data-srcset")); el.removeAttribute("data-srcset"); });
      var img = pic.querySelector("img");
      if (img.complete && img.naturalWidth) pic.classList.add("is-ready");
      else img.addEventListener("load", function () { pic.classList.add("is-ready"); }, { once: true });
    }
    function start() {
      if (!("IntersectionObserver" in window)) { alts.forEach(fill); return; }
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); fill(e.target.querySelector(".card__alt")); } });
      }, { rootMargin: "200px 0px" });
      alts.forEach(function (a) { io.observe(a.closest(".card__photo, .gift__set-img")); });   // 사진 상자를 본다(.card__alt 는 CSS 가 늦게 오면 크기 0)
    }
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start);
  }

  /* ── 상세: 옵션을 고르면 아래 상자에 줄로 쌓인다(오설록 방식). 옵션별 수량·삭제 ── */
  /* ── 옵션별 사진(H3): 상세에서 옵션을 고르면 큰 사진 위에 그 옵션 사진 겹(0.35초 크로스페이드, 움직임 줄이기면 바로 — CSS).
     겹은 absolute(밀림 0)·누름 통과(휴대폰 밀기 그대로). 사진 없는 옵션·옆 사진 누름·밀기·화살표 키 → 겹 내림, 옆 사진 줄 선택 표시 되돌림.
     편집 화면에는 «ed:opt» 알림(어느 옵션인지) ── */
  function initOptPhoto(data) {
    var gal = document.querySelector("[data-gallery]"), OI = data.opt_img || {}, layer = null;
    if (!gal) return function () {};
    var main = gal.querySelector(".gallery__main"), box = gal.querySelector(".gallery__stage") || main, count = gal.querySelector(".gallery__count");
    function drop(x) { x.classList.remove("is-on"); setTimeout(function () { if (x.parentNode) x.parentNode.removeChild(x); }, 400); }
    function hide() {
      if (!layer) return;
      drop(layer); layer = null;
      if (count) count.style.visibility = "";
      if (gal._mark) gal._mark();
    }
    function show(id) {
      var o = OI[id];
      if (data.options.length > 1) {
        var lb = (data.options.filter(function (x) { return x.id === id; })[0] || {}).label || id;
        try { document.dispatchEvent(new CustomEvent("ed:opt", { detail: { key: data.key, option: id, label: lb, has: !!o } })); } catch (e) {}
      }
      if (!o) { hide(); return; }
      if (layer && layer.getAttribute("data-opt-img") === id) return;
      var x = document.createElement("div"), pic = document.createElement("picture"), s = document.createElement("source"), im = document.createElement("img");
      x.className = "gallery__opt"; x.setAttribute("data-opt-img", id);
      s.type = "image/webp"; s.srcset = o.webp; s.sizes = "(max-width: 768px) 100vw, 640px";
      im.src = o.src; im.srcset = o.jpg; im.sizes = s.sizes; im.width = o.w; im.height = o.h; im.alt = o.alt || ""; im.className = "gallery__img"; im.decoding = "async";
      if (o.pos) im.style.objectPosition = o.pos;
      pic.appendChild(s); pic.appendChild(im); x.appendChild(pic);
      box.insertBefore(x, count && count.parentNode === box ? count : null);
      var old = layer; layer = x;
      gal.querySelectorAll("[data-thumb]").forEach(function (t) { t.removeAttribute("aria-current"); });
      if (count) count.style.visibility = "hidden";
      function on() { if (layer !== x) return; requestAnimationFrame(function () { requestAnimationFrame(function () { x.classList.add("is-on"); if (old) drop(old); }); }); }
      if (im.complete) on(); else { im.addEventListener("load", on); im.addEventListener("error", function () { if (layer === x) hide(); if (old) drop(old); }); }   // 못 받으면 제품 사진으로
    }
    gal.querySelectorAll("[data-thumb]").forEach(function (t) {
      t.addEventListener("click", hide);
      t.addEventListener("mouseenter", function () { if (window.matchMedia("(hover:hover)").matches) hide(); });
    });
    gal.addEventListener("keydown", function (e) { if (/^Arrow/.test(e.key)) hide(); });
    if (main) main.addEventListener("scroll", hide, { passive: true });
    return show;
  }
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
    var optPhoto = initOptPhoto(data);
    if (sel) {
      if (data.options.length === 1 && !data.options[0].sold_out) { pick(data.options[0].id); }
      sel.addEventListener("change", function () { optPhoto(sel.value); pick(sel.value); if (data.options.length > 1) sel.value = ""; });
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

  /* ── 상세 «회원가»(2-B-2): 로그인 회원이면 내 소속의 할인가·남은 수량, 아니면 로그인 안내(돌아올 주소 포함) ── */
  function initMemberPrice() {
    var lnk = document.querySelector("[data-login-link]"), box = document.querySelector("[data-member-price]");
    var dataEl = document.getElementById("product-data");
    if (!API || !lnk || !box || !dataEl) return;
    lnk.href = loginHref();
    var data = JSON.parse(dataEl.textContent);
    Member.ready.then(function (me) {
      if (!me) return;
      return acall("GET", "/api/v2/account/prices?product=" + encodeURIComponent(data.key)).then(function (j) {
        if (!j.ok) return;
        var rows = (j.options || []).filter(function (o) { return o.member; });
        if (!rows.length) return;
        box.textContent = "";
        rows.forEach(function (o, i) {
          var m = o.member, t = rows.length > 1 ? o.label + " — " : "";   // 회원가 옵션이 둘 이상이면 옵션 이름을 앞에
          if (m.left === 0) t += m.label + " 할인 한도(1인 " + m.limit + "개" + (m.period === "yearly" ? ", 해마다" : "") + ")를 모두 쓰셔서 정가로 계산됩니다.";
          else {
            t += m.label + " 회원가 " + won(m.price);
            if (m.limit !== null) t += " · 남은 할인 " + m.left + "개 (1인 " + m.limit + "개" + (m.period === "yearly" ? ", 해마다" : "") + "까지)";
          }
          if (i) box.appendChild(document.createElement("br"));
          box.appendChild(document.createTextNode(t));
        });
        box.hidden = false; lnk.hidden = true;
      });
    }, function () {});
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

  /* ── 선물세트 묶음(2-B-3 개정 2-3): 장바구니 줄 {gift:"jam", items:[{key, option}×4], qty:1, checked}.
     세트 정의(허용 품목·할인)는 products.json 의 gift(서버 GIFT_SETS 와 같은 값). 금액은 표시용 — 주문 때 서버가 다시 정한다. ── */
  function giftView(P, it) {
    var G = P && P.gift, d = G && G.sets[it.gift];
    if (!d || !Array.isArray(it.items) || it.items.length !== G.slots) return null;
    var parts = [], sum = 0, so = false;
    for (var k = 0; k < it.items.length; k++) {
      var x = it.items[k], h = x && optOf(P, x.key, x.option);
      if (!h || d.allow.indexOf(x.key) < 0) return null;
      parts.push(h); sum += h.o.price; so = so || !!h.o.sold_out;
    }
    var off = Math.min(G.discount, sum);
    return { name: d.name, img: d.img, href: "giftset.html?set=" + it.gift, parts: parts, sum: sum, off: off, price: sum - off, so: so,
             label: parts.map(function (h) { return h.p.name + " " + h.o.label; }).join(" · ") };
  }
  function lineInfo(P, it) {   // 장바구니·주문서 공통: 일반 줄과 세트 줄을 같은 모양으로
    if (it && it.gift) {
      var g = giftView(P, it);
      return g && { gift: g, name: g.name, opt: "구성 " + g.parts.length + "가지", price: g.price, so: g.so, img: g.img, href: g.href };
    }
    var h = it && optOf(P, it.key, it.option), oi = h && optPic(h.p, h.o.id);
    return h && { name: h.p.name, opt: h.o.label, price: h.o.price, so: !!h.o.sold_out, img: oi ? oi.img : h.p.img, pos: oi && oi.pos, href: h.p.href, h: h };
  }
  function optPic(p, id) { var x = p && p.opt_img && p.opt_img[id]; return x && x.img ? x : null; }   // H3: 옵션별 사진(products.json opt_img — 없으면 null)
  function giftList(g) {
    var ul = document.createElement("ul"); ul.className = "set-parts";
    g.parts.forEach(function (h) {
      var li = document.createElement("li"); li.textContent = h.p.name + " " + h.o.label + (h.o.sold_out ? " (품절)" : ""); ul.appendChild(li);
    });
    return ul;
  }

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
        var hit = lineInfo(P, it), so = hit.so;
        var row = tpl.content.firstElementChild.cloneNode(true);
        var name = hit.name, opt = hit.opt;
        row.classList.toggle("is-soldout", so);
        row.querySelectorAll("[data-row-link]").forEach(function (a) { a.href = root() + hit.href; });
        row.querySelector(".crow__img img").src = root() + "images/v2/" + hit.img.replace(/\.jpg$/, "") + "-480.jpg";
        if (hit.pos) row.querySelector(".crow__img img").style.objectPosition = hit.pos;
        row.querySelector(".crow__name").textContent = name;
        row.querySelector(".crow__opt").textContent = opt + " · " + won(hit.price);
        if (hit.gift) {   // 세트: 펼치면 구성이 보인다
          var dt = document.createElement("details"), sm = document.createElement("summary");
          dt.className = "crow__set"; sm.textContent = "구성 보기 · 합산가 " + won(hit.gift.sum) + "에서 " + won(hit.gift.off) + " 할인";
          dt.appendChild(sm); dt.appendChild(giftList(hit.gift));
          row.querySelector(".crow__opt").insertAdjacentElement("afterend", dt);
        }
        row.querySelector(".crow__soldout").hidden = !so;
        var chk = row.querySelector("[data-row-check]");
        chk.checked = !so && it.checked !== false; chk.disabled = so;
        chk.setAttribute("aria-label", name + " " + opt + " 선택");
        row.querySelector(".qty__n").textContent = String(it.qty);
        row.querySelector(".crow__sum").textContent = won(hit.price * it.qty);
        var dec = row.querySelector("[data-dec]"), inc = row.querySelector("[data-inc]"), del = row.querySelector("[data-row-del]");
        dec.setAttribute("aria-label", name + " " + opt + " 수량 줄이기");
        inc.setAttribute("aria-label", name + " " + opt + " 수량 늘리기");
        del.setAttribute("aria-label", name + " " + opt + " 삭제");
        dec.disabled = it.qty <= 1 || so; inc.disabled = it.qty >= Cart.MAX_QTY || so || !!it.gift;   // 세트는 한 줄에 1개(더 담으면 새 줄)
        function upd(f, focus) { var cur = Cart.read(); f(cur); Cart.write(cur); render(focus); }
        chk.addEventListener("change", function () { upd(function (c) { c[i].checked = chk.checked; }); });
        dec.addEventListener("click", function () { upd(function (c) { c[i].qty = Math.max(1, c[i].qty - 1); }, { i: i, s: "[data-dec]" }); });
        inc.addEventListener("click", function () { upd(function (c) { c[i].qty = Math.min(Cart.MAX_QTY, c[i].qty + 1); }, { i: i, s: "[data-inc]" }); });
        del.addEventListener("click", function () { upd(function (c) { c.splice(i, 1); }, { s: "[data-check-all]" }); });
        list.appendChild(row);
        if (!so) { avail++; if (chk.checked) { sel++; sub += hit.price * it.qty; } }
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
      c.forEach(function (it) { var h = lineInfo(P, it); if (h && !h.so) it.checked = all.checked; });
      Cart.write(c); render();
    });
    page.querySelector("[data-del-selected]").addEventListener("click", function () {
      var c = Cart.read().filter(function (it) { var h = lineInfo(P, it); return h.so || it.checked === false; });
      Cart.write(c); render({ s: "[data-check-all]" });
    });
    function go(e, onlySelected) {
      var ok = Cart.read().some(function (it) { var h = lineInfo(P, it); return !h.so && (!onlySelected || it.checked !== false); });
      if (!ok) { e.preventDefault(); say(onlySelected ? "주문할 상품을 골라 주세요." : "주문할 수 있는 상품이 없습니다(품절)."); }
    }
    page.querySelector("[data-go-selected]").addEventListener("click", function (e) { go(e, true); });
    page.querySelector("[data-go-all]").addEventListener("click", function (e) { go(e, false); });
    loadProducts(page.getAttribute("data-products")).then(function (data) {
      P = data;
      var c = Cart.read(), kept = c.filter(function (it) { return lineInfo(P, it) && it.qty > 0; });
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
    var u = new URLSearchParams(location.search), lines = [], gifts = [], fromBuyNow = u.get("buy") === "now";
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
    function reqGifts() {   // 선물세트 묶음(서버 /api/v2 의 gifts). 세트 한 줄 = 묶음 1개
      return gifts.map(function (g) { return { set: g.it.gift, items: g.it.items.map(function (x) { return { key: x.key, option_id: x.option }; }) }; });
    }
    function withGifts(b) { if (gifts.length) b.gifts = reqGifts(); return b; }
    function say(t) { if (!errBox) return; errBox.textContent = t; errBox.hidden = !t; }
    function localQuote() {
      var goods = 0, gift = 0; lines.forEach(function (l) { goods += l.o.price * l.qty; });
      gifts.forEach(function (g) { goods += g.v.sum; gift += g.v.off; });
      var s = ship() === "parcel" && goods < FREE ? FEE : 0;   // 배송비는 선물세트 할인 전 금액 기준(기존 선물세트 주문과 같게)
      return { goods: goods, discount: 0, gift: gift, shipping: s, points: 0, amount: goods - gift + s, giftOk: true };
    }
    function paint() {
      var v = q || localQuote(), parcel = ship() === "parcel", after = v.goods - v.discount;
      $("[data-co-subtotal]").textContent = won(v.goods);
      $("[data-co-ship]").textContent = parcel ? (v.shipping ? won(v.shipping) : "무료") : "0원 (직접 수령)";
      $("[data-co-disc]").textContent = "−" + won(v.discount);
      $("[data-co-gift-row]").hidden = !v.gift; $("[data-co-gift]").textContent = "−" + won(v.gift || 0);
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
        call("POST", "/api/v2/quote", withGifts({ lines: reqLines(), receive: { method: ship() }, buyer: { phone: $("#buyer-phone").value },
                                         points_use: ptsVal() }), true).then(function (j) {
          if (my !== qSeq) return;
          if (j.ok) {
            var b = j.breakdown;
            q = { goods: b.goods, discount: b.discount, gift: b.gift || 0, shipping: b.shipping, points: b.points, amount: j.amount, max: j.points_max,
                  seg: j.segment && member && member.segment_label ? member.segment_label : "",
                  giftOk: !gifts.length || typeof b.gift === "number" };   // 세트를 모르는 서버면 할인이 빠진다 — 접수를 막는다
            if (!q.giftOk) { say("지금은 선물세트 주문을 받을 수 없습니다. 잠시 뒤 다시 시도하시거나 전화로 주문해 주세요."); errBox.setAttribute("data-from", "quote"); }
            var el = $("[data-pts]");
            if (el && ptsVal() !== b.points) el.value = String(b.points);
            if (errBox && errBox.getAttribute("data-from") === "quote" && (!gifts.length || typeof b.gift === "number")) say("");
            affNotes(j.lines);
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
        var href = loginHref();
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
        return loadBook();
      }, function () { member = null; });
    }
    /* 주소록(2-B-2): 회원이면 «주소록에서 고르기»(저장된 배송지가 있을 때)와 «이 배송지를 주소록에 저장»(5개 미만일 때) */
    var book = [], bookMax = 5;
    function loadBook() {
      return acall("GET", "/api/v2/account/addresses").then(function (j) {
        if (!j.ok) return;
        book = j.addresses || []; bookMax = j.max || 5;
        var box = $("[data-addr-book]"), pick = $("[data-addr-pick]"), list = $("[data-addr-picker]");
        box.hidden = false; pick.hidden = !book.length;
        $("[data-addr-save-row]").hidden = book.length >= bookMax;
        list.innerHTML = "";
        book.forEach(function (a) {
          var li = document.createElement("li"), b = document.createElement("button"), t = document.createElement("b"), m = document.createElement("span");
          b.type = "button"; b.setAttribute("data-pick-id", a.id);
          t.textContent = (a.label || "배송지") + (a.is_default ? " · 기본" : "");
          m.className = "muted"; m.textContent = a.recipient_name + " · " + fmtPhone(a.recipient_phone) + " · (" + a.zip + ") " + a.address1 + " " + a.address2;
          b.appendChild(t); b.appendChild(m); li.appendChild(b); list.appendChild(li);
          b.addEventListener("click", function () {
            $("#rcv-name").value = a.recipient_name; $("#rcv-phone").value = fmtPhone(a.recipient_phone);
            $("#zip").value = a.zip; $("#addr1").value = a.address1; $("#addr2").value = a.address2;
            list.hidden = true; pick.setAttribute("aria-expanded", "false");
            $("[data-addr-save-new]").checked = false;
            $("#addr2").focus();
          });
        });
      }, function () {});
    }
    function saveBook() {
      var c = $("[data-addr-save-new]");
      if (!member || !c || !c.checked || ship() !== "parcel") return Promise.resolve();
      return acall("POST", "/api/v2/account/addresses", { recipient_name: $("#rcv-name").value.trim(), recipient_phone: $("#rcv-phone").value,
                                                         zip: $("#zip").value.trim(), address1: $("#addr1").value.trim(), address2: $("#addr2").value.trim() })
        .then(function () {}, function () {});
    }
    /* 소속 할인 줄 안내(B10): quote 줄의 소속별 할인 수량·정가 수량·이번 주문 뒤 남는 할인 */
    function affNotes(jl) {
      lines.forEach(function (l, i) {
        var el = l.li && l.li.querySelector("[data-item-aff]"), x = jl && jl[i];
        if (!el) return;
        var t = "";
        if (x && x.aff_parts && x.aff_parts.length) {
          t = x.aff_parts.map(function (p) { return p.label + " 할인 " + p.qty + "개"; }).join(" · ");
          if (x.regular_qty) t += " · 정가 " + x.regular_qty + "개";
          if (x.limit_left_after !== null && x.limit_left_after !== undefined) t += " — 이번 주문 뒤 남는 할인 " + x.limit_left_after + "개";
        } else if (x && member && x.limit_left_after === 0) {
          t = "소속 할인 한도를 모두 쓰셔서 정가로 계산됩니다.";
        }
        el.textContent = t; el.hidden = !t;
      });
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
      if (gifts.length && !(q && q.giftOk)) { say("선물세트 금액을 확인하는 중입니다. 잠시 뒤 다시 눌러 주세요."); requote(true); return; }
      setBusy(true); say("");
      var body = {
        idempotency_key: idem, lines: reqLines(),
        buyer: { name: $("#buyer-name").value.trim(), phone: $("#buyer-phone").value },
        receive: { method: ship(), memo: memo(), recipient: { name: $("#rcv-name").value.trim(), phone: $("#rcv-phone").value,
                   zip: $("#zip").value.trim(), addr1: $("#addr1").value.trim(), addr2: $("#addr2").value.trim() } },
        payment: { method: pay() }, points_use: q ? q.points : 0, agree: true };
      withGifts(body);
      call("POST", "/api/v2/orders", body, true).then(function (j) {
        if (!j.ok) {
          setBusy(false);
          say(j.error || "주문을 접수하지 못했습니다. 잠시 뒤 다시 눌러 주세요."); errBox.removeAttribute("data-from");
          if (j.code === "points" || j.code === "sold_out") requote(true);
          return;
        }
        pending = { order_no: j.order_no, view_token: j.view_token, phone: body.buyer.phone, buynow: fromBuyNow, items: body.lines,
                    gifts: gifts.map(function (g) { return g.it; }) };
        try { sessionStorage.setItem(PENDING, JSON.stringify(pending)); } catch (e2) {}
        saveBook().then(function () { if (j.next === "card") startCard(); else goDone(); });
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
    var pickBtn = $("[data-addr-pick]");
    if (pickBtn) pickBtn.addEventListener("click", function () {
      var list = $("[data-addr-picker]"); list.hidden = !list.hidden;
      pickBtn.setAttribute("aria-expanded", String(!list.hidden));
      if (!list.hidden) { var f = list.querySelector("button"); if (f) f.focus(); }
    });
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
        if (it && it.gift) {
          var gv = giftView(P, it);
          if (!gv || gv.so) { dropped++; return; }
          gifts.push({ it: it, v: gv }); return;
        }
        var h = optOf(P, it.key, it.option);
        if (!h || h.o.sold_out || !(it.qty > 0)) { dropped++; return; }
        lines.push({ key: it.key, p: h.p, o: h.o, qty: Math.min(Cart.MAX_QTY, it.qty) });
      });
      if (!lines.length && !gifts.length) { empty.hidden = false; return; }
      form.hidden = false;
      var ul = $("[data-co-items]"), tpl = document.getElementById("co-item"), n = 0;
      lines.forEach(function (l) {
        var li = tpl.content.firstElementChild.cloneNode(true);
        var oi = optPic(l.p, l.o.id);   // H3: 옵션별 사진이 있으면 그것(글은 그대로)
        li.querySelector("img").src = root() + "images/v2/" + (oi ? oi.img : l.p.img).replace(/\.jpg$/, "") + "-480.jpg";
        if (oi && oi.pos) li.querySelector("img").style.objectPosition = oi.pos;
        li.querySelector(".co__item-name").textContent = l.p.name;
        li.querySelector(".co__item-opt").textContent = l.o.label + " · " + l.qty + "개";
        li.querySelector(".co__item-sum").textContent = won(l.o.price * l.qty);
        ul.appendChild(li); l.li = li;
        n += l.qty;
      });
      gifts.forEach(function (g) {
        var li = tpl.content.firstElementChild.cloneNode(true);
        li.querySelector("img").src = root() + "images/v2/" + g.v.img.replace(/\.jpg$/, "") + "-480.jpg";
        li.querySelector(".co__item-name").textContent = g.v.name;
        li.querySelector(".co__item-opt").textContent = g.v.label + " · 합산가에서 " + won(g.v.off) + " 할인";
        li.querySelector(".co__item-sum").textContent = won(g.v.price);
        ul.appendChild(li); n += 1;
      });
      $("[data-co-count]").textContent = (lines.length + gifts.length) + "종 · " + n + "개";
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
      var sig = function (g) { return g.gift + ":" + g.items.map(function (x) { return x.key + "/" + x.option; }).join(","); };
      var done = (p.gifts || []).map(sig);
      Cart.write(Cart.read().filter(function (it) {
        if (it.gift) { var k = done.indexOf(sig(it)); if (k >= 0) { done.splice(k, 1); return false; } return true; }
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

  /* ── 상세 «주문 후기»(2-B-3 F2): GET /api/v2/reviews?product= — 평균·개수·분포·목록(10개씩 «더 보기»).
     0개면 «첫 후기를 남겨 주세요» 한 줄만. API 가 없는 미리보기도 그 한 줄. 글은 textContent 로만 넣는다. ── */
  function initReviews(sec) {
    var key = sec.getAttribute("data-reviews"), list = sec.querySelector("[data-rv-list]"), more = sec.querySelector("[data-rv-more]");
    var page = 0;
    function stars(n) { return "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n); }
    function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
    function load(n) {
      more.disabled = true;
      call("GET", "/api/v2/reviews?product=" + encodeURIComponent(key) + "&page=" + n).then(function (j) {
        more.disabled = false;
        if (!j || !j.ok) return;
        var s = j.summary;
        if (n === 1) {
          sec.querySelector("[data-rv-empty]").hidden = s.count > 0;
          sec.querySelector("[data-rv-sum]").hidden = !s.count;
          sec.querySelector("[data-rv-note]").hidden = !s.count;
          if (s.count) {
            sec.querySelector("[data-rv-avg]").textContent = s.average.toFixed(1);
            sec.querySelector("[data-rv-stars]").textContent = stars(Math.round(s.average));
            sec.querySelector("[data-rv-count]").textContent = "후기 " + s.count + "개";
            var d = sec.querySelector("[data-rv-dist]"); d.innerHTML = "";
            [5, 4, 3, 2, 1].forEach(function (k) {
              var row = el("div"), bar = el("span", "rv-sum__bar"), fill = el("span", "rv-sum__fill"), c = s.distribution[String(k)] || 0;
              fill.style.width = (s.count ? Math.round(c * 100 / s.count) : 0) + "%"; bar.appendChild(fill);
              row.appendChild(el("span", null, k + "점")); row.appendChild(bar); row.appendChild(el("span", "muted", c + "개"));
              row.setAttribute("aria-label", k + "점 " + c + "개"); d.appendChild(row);
            });
            var b = document.querySelector("[data-rv-badge]");
            if (b) { b.querySelector("[data-rv-badge-avg]").textContent = s.average.toFixed(1); b.querySelector("[data-rv-badge-n]").textContent = "· 후기 " + s.count + "개"; b.hidden = false; }
          }
        }
        j.reviews.forEach(function (r) {
          var li = el("li", "rv-item"), head = el("p", "rv-item__head");
          var st = el("span", "rv-item__stars", stars(r.rating)); st.setAttribute("aria-label", "별점 " + r.rating + "점");
          head.appendChild(st); head.appendChild(el("span", "rv-item__who", r.author)); head.appendChild(el("span", "muted", r.date));
          li.appendChild(head); li.appendChild(el("p", "rv-item__body", r.body));
          if (r.products && r.products.length > 1) li.appendChild(el("p", "rv-item__items muted", "함께 주문: " + r.products.join(", ")));
          if (r.reply) { var rp = el("div", "rv-item__reply"); rp.appendChild(el("p", "rv-item__reply-h", "영동에덴원 답글")); rp.appendChild(el("p", null, r.reply)); li.appendChild(rp); }
          list.appendChild(li);
        });
        page = j.page; more.hidden = j.page >= j.pages;
      }, function () { more.disabled = false; });
    }
    if (!API) return;
    more.addEventListener("click", function () { load(page + 1); });
    load(1);
  }

  /* ── 선물세트 고르기(2-B-3 개정 2-3): 세트 2종 · 4칸 · 칸을 누르면 아래에서 시트(허용 품목만, 품절은 흐리게·선택 불가, 옵션이 있으면 옵션까지).
     구성품 합 − 할인을 바로 보여 주고, 담기(장바구니 한 줄) · 바로 구매. 주소 ?set= 으로 세트를 고른다(옛 giftset.html 링크 그대로). ── */
  function initGift(page) {
    var sheet = document.querySelector("[data-sheet]"), panel = sheet.querySelector(".sheet__panel");
    var slotsEl = page.querySelector("[data-slots]"), err = page.querySelector("[data-gift-err]");
    var P = null, G = null, set = null, picks = [], cur = -1, lastFocus = null, openInfo = {};
    var want = new URLSearchParams(location.search).get("set");
    function d() { return G.sets[set]; }
    function img(h) { return root() + "images/v2/" + h.p.img.replace(/\.jpg$/, "") + "-480.jpg"; }
    // G7e: 선물세트 화면 전용 구성품 사진(G.goods[키] — 없으면 상품 사진). 초점·대체 글, 편집 화면이 누를 곳 표시(data-gift-good)
    // H3: 옵션을 고른 칸은 옵션 사진 → 선물세트 전용 사진 → 상품 사진(opt 없으면 지금 그대로)
    function goodImg(im, key, p, opt) {
      var g = G.goods && G.goods[key], oi = opt && optPic(p, opt);
      if (oi) g = oi;
      im.src = root() + "images/v2/" + ((g && g.img) || p.img).replace(/\.jpg$/, "") + "-480.jpg";
      im.alt = (g && g.alt) || "";
      if (g && g.pos) im.style.objectPosition = g.pos;
      im.setAttribute("data-gift-good", key);
      if (oi) im.setAttribute("data-gift-opt", opt);
    }
    function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
    function choose(id) {
      if (!G.sets[id]) id = Object.keys(G.sets)[0];
      set = id; picks = new Array(G.slots).fill(null); openInfo = {};
      page.querySelectorAll("[data-set]").forEach(function (b) { b.setAttribute("aria-checked", b.getAttribute("data-set") === id ? "true" : "false"); });
      document.querySelectorAll("[data-gift-story]").forEach(function (s) { s.hidden = s.getAttribute("data-gift-story") !== id; });   // 2-G: 세트마다 본문
      paint();
    }
    function paint() {
      slotsEl.innerHTML = "";
      var sum = 0, n = 0;
      picks.forEach(function (x, i) {
        var li = el("li", "gift__slot-li"), b = el("button", "gift__slot" + (x ? " is-full" : ""));
        b.type = "button"; b.setAttribute("data-slot", i);
        if (x) {
          var h = optOf(P, x.key, x.option);
          var im = document.createElement("img"); goodImg(im, x.key, h.p, x.option); im.width = 240; im.height = 240; im.loading = "lazy";
          b.appendChild(im);
          b.appendChild(el("span", "sr-only", (i + 1) + "번째 칸: "));
          var t = el("span", "gift__slot-t"); t.appendChild(el("span", "gift__slot-n", h.p.name)); t.appendChild(el("span", "gift__slot-o muted", h.o.label + " · " + won(h.o.price)));
          b.appendChild(t); b.appendChild(el("span", "gift__slot-ch", "바꾸기"));
          sum += h.o.price; n++;
        } else {
          b.appendChild(el("span", "gift__slot-plus", "+"));
          b.appendChild(el("span", "gift__slot-empty", (i + 1) + "번째 칸 고르기"));
        }
        b.addEventListener("click", function () { open(i, b); });
        li.appendChild(b);
        if (x) li.appendChild(infoBox(i, x.key));
        slotsEl.appendChild(li);
      });
      var full = n === G.slots, off = full ? Math.min(G.discount, sum) : 0;
      page.querySelector("[data-gift-goods]").textContent = won(sum);
      page.querySelector("[data-gift-off]").textContent = "−" + won(off);
      page.querySelector("[data-gift-total]").textContent = won(sum - off);
      page.querySelector("[data-gift-hint]").textContent = full ? T("구성을 다 고르셨습니다. 칸을 누르면 바꿀 수 있습니다.") : Tf("{0}칸 남았습니다. 칸을 누르면 담을 수 있는 상품이 아래에서 올라옵니다.", G.slots - n);
      page.querySelector("[data-gift-cart]").disabled = !full; page.querySelector("[data-gift-buy]").disabled = !full;
      err.hidden = true;
    }
    /* 고른 구성품의 상품정보제공고시 — 누르면 그 자리에서 표가 펼쳐진다(상세 화면의 고시 표와 같은 행) */
    function infoBox(i, key) {
      var n = G.notice && G.notice[key], wrap = el("div", "gift__info"), id = "gift-info-" + i;
      var t = el("button", "gift__info-btn", openInfo[i] ? T("상품정보 접기") : T("상품정보 보기"));
      t.type = "button"; t.setAttribute("aria-expanded", openInfo[i] ? "true" : "false"); t.setAttribute("aria-controls", id);
      var box = el("div", "gift__info-box"); box.id = id; box.hidden = !openInfo[i];
      if (n) {
        box.appendChild(el("p", "gift__info-cat muted", "상품정보제공고시 · " + n.category));
        var dl = el("dl", "gift__info-dl");
        n.rows.forEach(function (r) { dl.appendChild(el("dt", null, r[0])); dl.appendChild(el("dd", null, r[1])); });
        box.appendChild(dl);
      }
      t.addEventListener("click", function () {
        openInfo[i] = !openInfo[i]; box.hidden = !openInfo[i];
        t.setAttribute("aria-expanded", openInfo[i] ? "true" : "false"); t.textContent = openInfo[i] ? T("상품정보 접기") : T("상품정보 보기");
      });
      wrap.appendChild(t); wrap.appendChild(box);
      return wrap;
    }
    function open(i, from) {
      cur = i; lastFocus = from;
      sheet.querySelector("[data-sheet-slot]").textContent = String(i + 1);
      var ul = sheet.querySelector("[data-sheet-list]"); ul.innerHTML = ""; ul.hidden = false;
      sheet.querySelector("[data-sheet-opts]").hidden = true;
      d().allow.forEach(function (k) {
        var p = P.products[k]; if (!p) return;
        var avail = p.options.filter(function (o) { return !o.sold_out; });
        var li = el("li"), b = el("button", "sheet__item" + (avail.length ? "" : " is-soldout"));
        b.type = "button"; b.disabled = !avail.length;
        var im = document.createElement("img"); goodImg(im, k, p); im.width = 96; im.height = 96; im.loading = "lazy";
        var prices = (avail.length ? avail : p.options).map(function (o) { return o.price; }).sort(function (a, b2) { return a - b2; });
        b.appendChild(im);
        var t = el("span", "sheet__t"); t.appendChild(el("span", "sheet__n", p.name));
        t.appendChild(el("span", "sheet__p muted", avail.length ? won(prices[0]) + (prices[0] !== prices[prices.length - 1] ? "~" : "") + (p.options.length > 1 ? " · 옵션 " + p.options.length + "가지" : "") : "품절"));
        b.appendChild(t);
        b.addEventListener("click", function () { if (p.options.length === 1) pick(k, p.options[0].id); else opts(k); });
        li.appendChild(b); ul.appendChild(li);
      });
      sheet.hidden = false; document.body.classList.add("sheet-open");
      requestAnimationFrame(function () { sheet.classList.add("is-open"); var f = ul.querySelector("button:not([disabled])"); (f || panel).focus(); });
    }
    function opts(k) {
      var p = P.products[k], box = sheet.querySelector("[data-sheet-opts]"), ul = box.querySelector("[data-sheet-opt-list]");
      sheet.querySelector("[data-sheet-list]").hidden = true; box.hidden = false;
      box.querySelector("[data-sheet-opt-h]").textContent = p.name + " — 옵션을 골라 주세요";
      ul.innerHTML = "";
      p.options.forEach(function (o) {
        var li = el("li"), b = el("button", "sheet__opt" + (o.sold_out ? " is-soldout" : ""), o.label + " · " + (o.sold_out ? "품절" : won(o.price)));
        b.type = "button"; b.disabled = !!o.sold_out;
        b.addEventListener("click", function () { pick(k, o.id); });
        li.appendChild(b); ul.appendChild(li);
      });
      var f = ul.querySelector("button:not([disabled])"); if (f) f.focus();
    }
    function close() {
      sheet.classList.remove("is-open"); document.body.classList.remove("sheet-open");
      sheet.hidden = true;
      var t = slotsEl.querySelector('[data-slot="' + cur + '"]') || lastFocus; if (t) t.focus();
    }
    function pick(k, id) { if (!picks[cur] || picks[cur].key !== k) delete openInfo[cur]; picks[cur] = { key: k, option: id }; var i = cur; paint(); cur = i; close(); }
    sheet.querySelectorAll("[data-sheet-close]").forEach(function (b) { b.addEventListener("click", close); });
    sheet.querySelector("[data-sheet-back]").addEventListener("click", function () {
      sheet.querySelector("[data-sheet-opts]").hidden = true; var ul = sheet.querySelector("[data-sheet-list]"); ul.hidden = false;
      var f = ul.querySelector("button:not([disabled])"); if (f) f.focus();
    });
    sheet.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key !== "Tab") return;
      var f = [].filter.call(panel.querySelectorAll("button:not([disabled])"), function (x) { return x.offsetParent !== null; });
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    });
    page.querySelectorAll("[data-set]").forEach(function (b) {
      b.addEventListener("click", function () { if (b.getAttribute("aria-checked") !== "true") choose(b.getAttribute("data-set")); });
    });
    page.querySelector("[data-gift-fill]").addEventListener("click", function () {
      d().def.forEach(function (x, i) {
        var p = P.products[x[0]]; if (!p || i >= G.slots) return;
        var o = p.options.filter(function (o) { return o.id === x[1] && !o.sold_out; })[0] || p.options.filter(function (o) { return !o.sold_out; })[0];
        if (o && !picks[i]) picks[i] = { key: x[0], option: o.id };
      });
      paint();
    });
    function ready() {
      var bad = picks.some(function (x) { var h = x && optOf(P, x.key, x.option); return !h || h.o.sold_out; });
      if (bad || picks.length !== G.slots) { err.textContent = "품절이거나 고르지 않은 칸이 있습니다."; err.hidden = false; return false; }
      return true;
    }
    page.querySelector("[data-gift-cart]").addEventListener("click", function (e) {
      if (!ready()) return;
      Cart.addGift(set, picks);
      Added.show(d().name + " 1세트(구성 " + G.slots + "가지)", e.currentTarget);
      choose(set);
    });
    page.querySelector("[data-gift-buy]").addEventListener("click", function () {
      if (!ready()) return;
      try { sessionStorage.setItem("edenwon_buynow_v2", JSON.stringify({ at: Date.now(), items: [{ gift: set, items: picks.slice(), qty: 1, checked: true }] })); } catch (e) {}
      location.href = root() + "checkout.html?buy=now";
    });
    loadProducts(root() + "assets/v2/products.json").then(function (data) {
      P = data; G = P.gift;
      Object.keys(G.sets).forEach(function (id) {
        var x = page.querySelector('[data-set-desc="' + id + '"]');
        if (x) x.textContent = G.sets[id].allow.map(function (k) { return P.products[k] ? P.products[k].name : k; }).join(" · ") + " 중에서 " + G.slots + "가지";
      });
      choose(want);
    });
  }

  /* ── 옛 장바구니 옮기기(2-C L3): 옛 화면의 edenwon_cart 에 담긴 것을 새 장바구니로 한 번만 옮긴다.
     옛 값은 지우지 않는다(되돌리기 때 옛 화면 장바구니가 그대로 남게) — 옮긴 내용을 edenwon_cart_moved 에 적어 같은 내용은 다시 옮기지 않는다.
     공개 중인 상품·옵션(products.json + 실시간 값)이고 품절이 아닌 것만. 못 옮긴 것이 있으면 안내 한 줄. ── */
  var OLD_CART_KEY = "edenwon_cart";
  function migrateOldCart() {
    var old, raw = null, moved = null;
    try { raw = localStorage.getItem(OLD_CART_KEY); moved = localStorage.getItem(OLD_CART_KEY + "_moved"); old = JSON.parse(raw || "null"); } catch (e) { old = null; }
    if (!Array.isArray(old) || !old.length || raw === moved) return;
    loadProducts(root() + "assets/v2/products.json").then(function (P) {
      var ok = [], dropped = 0;
      old.forEach(function (it) {
        var key = it && (it.product || it.key), id = it && it.option, n = Math.floor(Number(it && (it.count || it.qty)) || 0);
        var hit = key && id ? optOf(P, String(key), String(id)) : null;
        if (hit && !hit.o.sold_out && n > 0) ok.push({ key: String(key), option: String(id), qty: Math.min(Cart.MAX_QTY, n) });
        else dropped++;
      });
      if (ok.length) Cart.add(ok);
      try { localStorage.setItem(OLD_CART_KEY + "_moved", raw); } catch (e) {}
      var msg = dropped ? "예전 장바구니에서 " + (ok.length ? ok.length + "개 품목을 옮겼습니다. " : "") + "판매가 끝났거나 품절된 " + dropped + "개 품목은 옮기지 못했습니다." : "";
      if (ok.length && document.querySelector("[data-cart-page]")) {   // 장바구니 화면은 다시 그려야 옮긴 품목이 보인다
        try { if (msg) sessionStorage.setItem("edenwon_cart_moved", msg); } catch (e) {}
        location.reload(); return;
      }
      if (msg) cartMovedNote(msg);
    }, function () {});
  }
  function cartMovedNote(msg) {
    var p = document.createElement("p"); p.className = "cart-moved"; p.setAttribute("role", "status"); p.textContent = msg;
    var main = document.querySelector("main") || document.body; main.insertBefore(p, main.firstChild);
  }
  function showCartMoved() {
    var m = null;
    try { m = sessionStorage.getItem("edenwon_cart_moved"); sessionStorage.removeItem("edenwon_cart_moved"); } catch (e) {}
    if (m) cartMovedNote(m);
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
    var gone = false;
    document.querySelectorAll("[data-cert-end]").forEach(function (el) {
      if (today > el.getAttribute("data-cert-end")) { el.remove(); gone = true; }
    });
    if (gone) document.querySelectorAll("[data-cert-fallback]").forEach(function (el) { el.hidden = false; });   // 소개 문장은 인증 없는 문장으로
  }

  document.addEventListener("DOMContentLoaded", function () {
    initSeasonWords();
    document.querySelectorAll("[data-sgal]").forEach(initSeasonGallery);
    document.querySelectorAll("[data-feed]").forEach(initFeed);
    initMember();
    initMotion();
    initMemberPrice();
    initCertExpiry();
    initFonts();
    initFolds();
    initChoose();
    Added.init();
    initCardAdd();
    document.querySelectorAll("[data-catalog]").forEach(initCatalog);
    document.querySelectorAll("[data-gallery]").forEach(initGallery);
    document.querySelectorAll("[data-pj]").forEach(initPJ);
    initAltPhotos();
    document.querySelectorAll("[data-buy]").forEach(initBuy);
    document.querySelectorAll("[data-like]").forEach(initLike);
    document.querySelectorAll("[data-reviews]").forEach(initReviews);
    document.querySelectorAll("[data-gift]").forEach(initGift);
    showCartMoved();
    migrateOldCart();
    initSecNav();
    document.querySelectorAll("[data-cart-page]").forEach(initCartPage);
    document.querySelectorAll("[data-checkout]").forEach(initCheckout);
    initDone();
    if (API) document.querySelectorAll("[data-done]").forEach(initDoneLive);
    Cart.render();
    initDrawer();
    initSearch();
    document.querySelectorAll("[data-carousel]").forEach(initCarousel);
    document.querySelectorAll("[data-vslot]").forEach(initVslot);
    document.querySelectorAll("[data-tabs=picks]").forEach(initPickTabs);
  });
})();
