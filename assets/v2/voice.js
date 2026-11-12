/* 영동에덴원 v2 — 말로 찾기(음성 V1, 2026-11-12)
   · 브라우저 음성 인식(크롬=Google, 사파리=Apple)으로 받아쓴 글을 규칙으로 알아듣는다. AI·서버로 소리 보내기 없음.
   · 들은 글은 어디에도 남기지 않는다: 저장소(localStorage·sessionStorage)·콘솔·서버 0. 화면에 «들은 말: …»을 잠깐 보이고 지운다.
   · 알아듣기(EdenVoice.match)는 화면 없이도 돈다(node 시험이 같은 함수를 부름).
   · 결제·주문 함수는 부르지 않는다(이 파일에서 그런 이름을 부르는 곳 0 — 정적 검사 test_voice1 V7). */
(function (G) {
  "use strict";

  /* ── 한글 자모 나누기 · 편집 거리 ── */
  var CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ", JUNG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ",
      JONG = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
  function jamo(s) {
    var o = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i) - 0xAC00;
      if (c >= 0 && c < 11172) { o.push(CHO[Math.floor(c / 588)], JUNG[Math.floor((c % 588) / 28)]); if (c % 28) o.push(JONG[c % 28]); }
      else o.push(s[i]);
    }
    return o;
  }
  function lev(a, b) {
    var m = a.length, n = b.length, p = [], q, i, j;
    for (j = 0; j <= n; j++) p[j] = j;
    for (i = 1; i <= m; i++) {
      q = [i];
      for (j = 1; j <= n; j++) q[j] = Math.min(p[j] + 1, q[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      p = q;
    }
    return p[n];
  }

  /* ── 1·2 글 다듬기 · 수량 떼기 ── */
  var NUMW = { "한": 1, "하나": 1, "두": 2, "둘": 2, "투": 2, "세": 3, "셋": 3, "석": 3, "네": 4, "넷": 4, "넉": 4, "다섯": 5, "여섯": 6, "일곱": 7, "여덟": 8, "아홉": 9, "열": 10 };
  var UNIT = "개|병|통|봉지|봉|세트|키로|킬로|kg|상자|박스|포대|덩이|덩어리|팩|단|망";
  var RE_QTY = new RegExp("(\\d+|" + Object.keys(NUMW).join("|") + ")\\s*(" + UNIT + ")(?=\\s|$)|(?:^|\\s)(\\d+|하나|둘|셋|넷|다섯|여섯|일곱|여덟|아홉|열)(?=\\s|$)", "g");
  var TAILS = [
    /\s*보여\s*(주세요|주이소|주소|줘요|줘|줄래요|줄래|봐요|봐)$/, /\s*찾아\s*(주세요|주이소|줘요|줘|봐요|봐)$/,
    /\s*뭐\s*(있어요|있어|있노|있나요|있나|있니|있지|있습니까)$/, /\s*(있어요|있어|있나요|있나|있능교|있습니까|있니|있지|있을까요|있는지)$/,
    /\s*(담아\s*)?(주세요|주이소|주소|줘요|줘|줄래요|줄래)$/, /\s*하고\s*(싶어요|싶어|싶습니다)$/, /\s*(들어간|든)\s*(거|것)$/,
    /\s*(좀|쫌|요)$/
  ];
  var LEAD = /^(혹시|저기요|저기|그|음|아)\s+/;
  var PART = /(을|를|이|가|은|는|도|좀|쫌)$/;
  function clean(raw, o) {
    o = o || {};
    var t = String(raw || "").toLowerCase().replace(/[.,!?~…"'“”‘’()\[\]·]/g, " ").replace(/\s+/g, " ").trim(), qty = null;
    t = t.replace(RE_QTY, function (m, a, u, b) { var v = a || b; qty = /^\d+$/.test(v) ? +v : NUMW[v]; return " "; }).replace(/\s+/g, " ").trim();
    if (!o.noStrip) {
      var prev;
      do {
        prev = t;
        t = t.replace(LEAD, "");
        TAILS.forEach(function (r) { t = t.replace(r, ""); });
        t = t.replace(/(^|\s)(좀|쫌)(\s|$)/g, " ").trim();
      } while (t !== prev);
    }
    return { text: t, qty: qty };
  }

  /* ── 사전 색인(한 번) ── */
  function index(D) {
    if (D._ix) return D._ix;
    var all = [];
    (D.entries || []).forEach(function (e) {
      var ex = {}; (e.x || []).forEach(function (a) { ex[a] = 1; });
      e.a.forEach(function (a) { all.push({ a: a, j: jamo(a), x: !!ex[a] || a.length === 1, e: e }); });
    });
    all.sort(function (p, q) { return q.a.length - p.a.length; });
    D._ix = all; return all;
  }
  function tkey(e) { return e.k + ":" + (e.key || "") + ":" + (e.opt || "") + ":" + (e.c ? e.c.map(function (c) { return c.key; }).join("/") : ""); }
  function same(e1, e2) { return tkey(e1) === tkey(e2) || (e1.key && e1.key === e2.key && (e1.k === "product" || e1.k === "option") && (e2.k === "product" || e2.k === "option")); }
  function result(e, how, qty) {
    var r = { how: how, qty: qty };
    if (e.k === "none") r.type = "none";
    else if (e.k === "ask") { r.type = "multi"; r.cands = e.c.map(function (x) { return { key: x.key, name: x.n, href: x.h }; }); }
    else if (e.k === "hint") { r.type = "hint"; r.say = e.say; r.key = e.key; r.opt = e.opt; r.name = e.n; r.href = e.h; }
    else { r.type = e.k === "option" ? "product" : (e.k === "cat" ? "category" : e.k); r.key = e.key; r.opt = e.opt || null; r.name = e.n; r.href = e.h; }
    return r;
  }
  function multi(es, how, qty) {
    var seen = {}, c = [];
    function put(key, name, href, isCat) { var k = key + (isCat ? ":c" : ""); if (seen[k]) return; seen[k] = 1; c.push({ key: key, name: name, href: href }); }
    es.forEach(function (e) {
      if (e.k === "none") return;
      if (e.c) e.c.forEach(function (x) { put(x.key, x.n, x.h); });   // 되묻기 묶음은 그 후보들로
      else put(e.key, e.n, e.h, e.k === "cat");
    });
    return { type: "multi", cands: c.slice(0, 3), how: how, qty: qty };
  }

  /* ── 3~6 알아듣기: 말 전체가 같음 → 공백 무시 포함 → 자모 근접 → (결과) 상품·분류·세트·쪽·여러 후보·안내·못 알아들음 ──
     o: { noStrip, noSpace, noFuzzy, noAsk, T(근접 기준, 기본 0.2), M(되묻기 폭, 기본 0.06) } — 변이 시험용 스위치 */
  function match(raw, D, o) {
    o = o || {};
    var T = o.T == null ? 0.2 : o.T, M = o.noAsk ? -1 : (o.M == null ? 0.06 : o.M);
    var c = clean(raw, o), s = c.text, ns = o.noSpace ? s : s.replace(/\s+/g, ""), ix = index(D), i, h;
    if (!ns) return { type: "none", how: "empty", qty: c.qty };
    var tries = [ns]; if (!o.noStrip && PART.test(ns) && ns.length > 1) tries.push(ns.replace(PART, ""));
    for (var t = 0; t < tries.length; t++) {   // 3 말 전체가 별명과 같음
      for (i = 0; i < ix.length; i++) if (ix[i].a === tries[t]) return result(ix[i].e, "exact", c.qty);
    }
    var best = null, tie = [];   // 4 가장 긴 별명이 말 안에 들어 있음(한 글자·«x» 별명은 빼고)
    for (i = 0; i < ix.length; i++) {
      h = ix[i]; if (h.x) continue;
      if (best && h.a.length < best.a.length) break;
      if (ns.indexOf(h.a) >= 0) { if (!best) best = h; tie.push(h.e); }
    }
    if (best && best.a.length < ns.length && !o.noFuzzy) {   // 말의 일부만 맞았으면: 말 전체가 더 긴 별명과 아주 가까운지(«비빈 고추장» → 비빔고추장)
      var Jw = jamo(ns), near0 = null;
      for (i = 0; i < ix.length; i++) {
        h = ix[i]; if (h.x || h.a.length <= best.a.length || h.a.indexOf(best.a) < 0 && lev(jamo(h.a), best.j) > 2) continue;
        var rr = lev(Jw, h.j) / Math.max(Jw.length, h.j.length);
        if (rr <= T / 2 && (!near0 || rr < near0.r)) near0 = { r: rr, h: h };
      }
      if (near0 && !same(near0.h.e, best.e)) return near0.h.e.k === "none" ? { type: "none", how: "notours", qty: c.qty } : result(near0.h.e, "fuzzy-whole", c.qty);
    }
    if (best) {
      var diff = tie.filter(function (e) { return !same(e, best.e); });
      if (best.e.k === "none" || diff.some(function (e) { return e.k === "none"; })) return { type: "none", how: "notours", qty: c.qty };
      if (diff.length && !o.noAsk) return multi([best.e].concat(diff), "sub-tie", c.qty);
      return result(best.e, "sub", c.qty);
    }
    if (o.noFuzzy || ns.length < 2) return { type: "none", how: "nomatch", qty: c.qty };
    var J = jamo(ns), sc = [];   // 5 자모 근접(두 글자 이상 별명만)
    for (i = 0; i < ix.length; i++) {
      h = ix[i]; if (h.x || h.a.length < 2) continue;
      var r = lev(J, h.j) / Math.max(J.length, h.j.length);
      if (r <= T + Math.max(M, 0)) sc.push({ r: r, e: h.e });
    }
    sc.sort(function (p, q) { return p.r - q.r; });
    if (!sc.length || sc[0].r > T) return { type: "none", how: "nomatch", qty: c.qty };
    if (sc[0].e.k === "none") return { type: "none", how: "notours", qty: c.qty };
    var near = sc.filter(function (x) { return x.r <= sc[0].r + M && !same(x.e, sc[0].e) && x.e.k !== "none"; });
    if (near.length && !o.noAsk) return multi([sc[0].e].concat(near.map(function (x) { return x.e; })), "fuzzy-tie", c.qty);
    return result(sc[0].e, "fuzzy", c.qty);
  }

  var API_ = { match: match, clean: clean, jamo: jamo, lev: lev };
  if (typeof module === "object" && module.exports) { module.exports = API_; return; }
  G.EdenVoice = API_;

  /* ════════ 화면(브라우저) ════════ */
  var doc = G.document, UA = (G.navigator && G.navigator.userAgent) || "";
  function T_(s) { return G.Eden && G.Eden.T ? G.Eden.T(s) : s; }
  function root() { return doc.documentElement.getAttribute("data-root") || ""; }
  var SR = G.SpeechRecognition || G.webkitSpeechRecognition;
  var IOS = /iP(hone|ad|od)/.test(UA) || (/Macintosh/.test(UA) && G.navigator.maxTouchPoints > 1);
  var KAKAO = /KAKAOTALK/i.test(UA);
  var INAPP = KAKAO || /NAVER\(inapp|; ?wv\)|Instagram|FBAN|FBAV|Line\/|DaumApps|everytimeApp|BAND\//i.test(UA) || (IOS && !/Safari\//.test(UA) && !/CriOS|FxiOS|EdgiOS/.test(UA));
  var IOS_OTHER = IOS && /CriOS|FxiOS|EdgiOS|OPiOS/.test(UA);   // 아이폰 크롬 등 — WKWebView 라 음성 인식이 안 켜짐(WebKit 239816)
  var STATE = INAPP ? "inapp" : (SR && !IOS_OTHER ? "on" : "off");

  function stat(ev) { /* STOP 2(측정 1안)에서 POST /api/v2/voice-stats {event} — 지금은 아무것도 보내지 않음 */ }

  var btn, panel, live, heard, body, timer, rec, dict, dictP;
  function loadDict() {
    if (!dictP) dictP = fetch(root() + "assets/v2/voice-dict.json", { credentials: "same-origin" }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (d) { dict = d; return d; });
    return dictP;
  }
  function el(tag, cls, text) { var e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function open() {
    if (!panel) {
      panel = el("div", "vc"); panel.id = "voice-panel"; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", T_("말로 찾기"));
      var x = el("button", "vc__close", "×"); x.type = "button"; x.setAttribute("aria-label", T_("닫기")); x.addEventListener("click", close);
      live = el("p", "vc__live"); live.setAttribute("aria-live", "polite"); live.setAttribute("role", "status");
      heard = el("p", "vc__heard"); body = el("div", "vc__body");
      panel.appendChild(x); panel.appendChild(live); panel.appendChild(heard); panel.appendChild(body);
      doc.body.appendChild(panel);
      panel.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
    }
    panel.hidden = false; btn.setAttribute("aria-expanded", "true");
    heard.textContent = ""; body.textContent = "";
  }
  function close() {
    if (rec) { try { rec.abort(); } catch (e) {} rec = null; }
    clearTimeout(timer);
    if (panel) { panel.hidden = true; heard.textContent = ""; body.textContent = ""; live.textContent = ""; }
    btn.removeAttribute("data-listening"); btn.setAttribute("aria-expanded", "false"); btn.focus();
  }
  function say(t) { live.textContent = t; }
  function go(href) { heard.textContent = ""; G.location.href = root() + href; }
  function link(name, href) { var a = el("a", "vc__pick", name); a.href = root() + href; return a; }
  function examples() {
    var p = el("p", "vc__ex"), ex = (dict && dict.examples) || [];
    p.textContent = T_("이렇게 말해 보세요") + ": " + ex.map(function (s) { return "«" + s + "»"; }).join(" · ");
    body.appendChild(p);
  }
  function typed(note) {   // 마이크를 못 쓸 때·못 알아들었을 때: 글로 넣어 같은 규칙으로 찾기
    var f = el("form", "vc__form"), i = el("input"), b = el("button", "btn btn--dark", T_("찾기"));
    if (note) body.appendChild(el("p", "vc__note", note));
    i.type = "search"; i.setAttribute("aria-label", T_("찾을 말")); i.autocomplete = "off"; b.type = "submit";
    f.appendChild(i); f.appendChild(b); body.appendChild(f);
    f.addEventListener("submit", function (e) { e.preventDefault(); var v = i.value; i.value = ""; loadDict().then(function () { act(match(v, dict)); }, fail); });
    i.focus();
  }
  function fail() { say(T_("잠시 뒤 다시 눌러 주세요.")); }
  function act(r) {
    body.textContent = "";
    if (r.type === "product" || r.type === "category" || r.type === "set" || r.type === "page") {
      stat(r.type === "product" ? "match_product" : "match_category");
      say(Tf_("«{0}»(으)로 갑니다", r.name));
      timer = setTimeout(function () { go(r.href); }, 900);
    } else if (r.type === "multi") {
      stat("match_multi");
      say(T_("혹시 이 중에 찾으세요?"));
      r.cands.forEach(function (c) { body.appendChild(link(c.name, c.href)); });
      var f = body.querySelector("a"); if (f) f.focus();
    } else if (r.type === "hint") {
      stat("match_multi");
      say(r.say);
      body.appendChild(link(T_("보기"), r.href));
      var no = el("button", "vc__no", T_("아니요")); no.type = "button"; no.addEventListener("click", close); body.appendChild(no);
      body.querySelector("a").focus();
    } else {
      stat("nomatch");
      say(T_("잘 알아듣지 못했어요."));
      examples(); typed();
    }
  }
  function Tf_(d) { var a = arguments; return T_(d).replace(/\{(\d)\}/g, function (m, k) { return a[+k + 1]; }); }
  function listen() {
    open(); stat("mic_open");
    loadDict().catch(function () {});
    rec = new SR(); rec.lang = "ko-KR"; rec.interimResults = false; rec.maxAlternatives = 3; rec.continuous = false;
    btn.setAttribute("data-listening", ""); say(T_("듣고 있어요"));
    rec.onresult = function (ev) {
      var alts = [], res = ev.results[0];
      for (var i = 0; i < res.length; i++) alts.push(res[i].transcript);
      stat("heard");
      heard.textContent = T_("들은 말") + ": " + alts[0];   // 화면에만 잠깐 — 저장·콘솔 없음
      loadDict().then(function () {
        var r = null;
        for (var j = 0; j < alts.length && (!r || r.type === "none"); j++) r = match(alts[j], dict);
        alts = null;
        act(r);
        setTimeout(function () { if (heard) heard.textContent = ""; }, 2500);
      }, fail);
    };
    rec.onerror = function (ev) {
      btn.removeAttribute("data-listening");
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") { stat("perm_denied"); say(T_("마이크를 허용하면 말로 찾을 수 있어요")); body.textContent = ""; typed(); }
      else if (ev.error === "no-speech") { say(T_("잘 못 들었어요. 다시 눌러 말해 주세요.")); body.textContent = ""; loadDict().then(examples, function () {}); }
      else if (ev.error !== "aborted") { say(T_("음성 인식을 쓸 수 없어요. 글로 찾아 보세요.")); body.textContent = ""; typed(); }
    };
    rec.onend = function () { btn.removeAttribute("data-listening"); rec = null; };
    try { rec.start(); } catch (e) { rec.onerror({ error: "start" }); }
  }
  function inapp() {
    open(); say(T_("이 앱 안에서는 말로 찾기를 쓸 수 없어요."));
    if (KAKAO) {
      var a = el("a", "btn btn--dark vc__ext", T_("다른 브라우저로 열기"));
      a.href = "kakaotalk://web/openExternal?url=" + encodeURIComponent(G.location.href);
      body.appendChild(a);
    } else {
      body.appendChild(el("p", "vc__note", T_("오른쪽 위 메뉴(⋮ 또는 ···)에서 «다른 브라우저로 열기»를 누르면 말로 찾을 수 있어요.")));
    }
    var a2 = body.querySelector("a"); if (a2) a2.focus();
  }
  function init() {
    var all = doc.querySelectorAll("[data-voice]");   // 머리글 단추(넓은 화면) · 아래 둥근 단추(휴대폰) — 화면 폭에 따라 하나만 보임(CSS)
    if (!all.length) return;
    Array.prototype.forEach.call(all, function (b) {
      b.setAttribute("data-voice-state", STATE);   // on · inapp(흐린 아이콘) · off(자리만 — 보이지 않음)
      if (STATE === "off") { b.setAttribute("aria-hidden", "true"); b.tabIndex = -1; return; }
      b.addEventListener("click", function () {
        if (panel && !panel.hidden) { close(); return; }
        btn = b;
        if (STATE === "inapp") inapp(); else listen();
      });
    });
    btn = all[0];
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init); else init();
})(typeof window !== "undefined" ? window : this);
