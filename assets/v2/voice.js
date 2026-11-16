/* 영동에덴원 v2 — 말로 찾기(음성 V1, 2026-11-12)
   · 브라우저 음성 인식(크롬=Google, 사파리=Apple)으로 받아쓴 글을 규칙으로 알아듣는다. AI·서버로 소리 보내기 없음.
   · 들은 글은 어디에도 남기지 않는다: 저장소·콘솔·서버 0 (localStorage 에는 접기 상태 flag edenwon_vc_collapsed="1" 하나만 — 들은 글 아님). 화면에 «들은 말: …»을 잠깐 보이고 지운다.
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
  /* 소리 접힘(2a·대표 11-16): 받아쓰기가 자주 헷갈리는 자모를 한 꼴로 모아 «근접» 단계에서만 견줌 — 샤↔사↔차 같은 일반 규칙(개별 상품 예외 아님).
     반자음 떨어짐(ㅑ→ㅏ…)·ㅐ/ㅔ 합침·거센/된소리 섞임(ㅊ→ㅅ 등). 정확·부분일치 단계는 접지 않아 또렷한 말은 그대로 간다. */
  var SNDFOLD = { "ㅑ": "ㅏ", "ㅕ": "ㅓ", "ㅛ": "ㅗ", "ㅠ": "ㅜ", "ㅒ": "ㅔ", "ㅖ": "ㅔ", "ㅐ": "ㅔ", "ㅆ": "ㅅ", "ㅊ": "ㅅ", "ㅋ": "ㄱ", "ㅌ": "ㄷ", "ㅍ": "ㅂ", "ㅟ": "ㅣ", "ㅢ": "ㅣ" };
  function fold(ja) { for (var i = 0; i < ja.length; i++) if (SNDFOLD[ja[i]]) ja[i] = SNDFOLD[ja[i]]; return ja; }
  function foldj(s) { return fold(jamo(s)); }
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
      e.a.forEach(function (a) { all.push({ a: a, j: jamo(a), jf: foldj(a), x: !!ex[a] || a.length === 1, e: e }); });
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
    var J = jamo(ns), Jf = foldj(ns), sc = [];   // 5 자모 근접(두 글자 이상 별명만) — 2a: 또렷한 자모 거리 우선, 소리 접힘 거리는 가산으로만(틀린 매칭 줄임)
    for (i = 0; i < ix.length; i++) {
      h = ix[i]; if (h.x || h.a.length < 2) continue;
      var denom = Math.max(J.length, h.j.length);
      var r = lev(J, h.j) / denom, rf = lev(Jf, h.jf) / denom, rr = Math.min(r, rf);   // 2a·3: 또렷한 거리 또는 소리 접힘 거리 중 가까운 쪽(차이→샤인 같은 센 오인식도 잡음) — 가짜일치는 V1/NZ·coverOk 로 거름
      if (rr <= T + Math.max(M, 0)) sc.push({ r: rr, ru: r, e: h.e });   // ru=또렷한 거리(되묻기 묶음 판정은 이걸로)
    }
    sc.sort(function (p, q) { return p.r - q.r; });
    if (!sc.length || sc[0].r > T) return { type: "none", how: "nomatch", qty: c.qty };
    if (sc[0].e.k === "none") return { type: "none", how: "notours", qty: c.qty };
    var near = sc.filter(function (x) { return x.r <= sc[0].r + M && x.ru <= sc[0].ru + M && !same(x.e, sc[0].e) && x.e.k !== "none"; });   // 접힘으로 끌려온 후보는 또렷한 거리까지 가까워야 되묻기(시초→식초 하나로)
    if (near.length && !o.noAsk) return multi([sc[0].e].concat(near.map(function (x) { return x.e; })), "fuzzy-tie", c.qty);
    return result(sc[0].e, "fuzzy", c.qty);
  }

  /* ════ A단계(2026-11-16): 규칙 명령 — 담기·합계·보기·빼기·주문·지난번·추천(AI 없음). AI·서버로 소리 보내기 없음은 V1 과 같음 ════ */
  var LAST_RE = /지난\s?번|저번|예전처럼|전에\s?(산|담았|담은|시킨|샀)|그대로|똑같이/;
  var ASSIST_RE = /추천|예산|인기|잘\s?나가|가성비|제일\s?(좋|잘|맛)|뭐\s?(가\s?(좋|맛있)|사|살|좋|맛있|부터|담을|사면)|어떤\s?(게|거)\s?좋|좋은\s?거\s?뭐|[가-힣]*원\s?(으로|어치|대로|짜리)/;
  var DEL_RE = /빼|지워|지우|줄여|줄이|취소/;
  var ADD_VERB = /담아|담기|담을|담아서|넣어|넣고|추가|장바구니\s?에/;   // 명확한 담기 말(장바구니에 = 담을 곳) — 없고 상품 하나·수량 없으면 V1 찾기로
  var MONEY_RE = /(지금|담은\s?거|담긴\s?거|전체|전부|모두|장바구니|카트|바구니)\s?\S*\s?(얼마|올마|금액)|^\s?얼마\s?(예요|에요|야|인가요?|지|인교)?\s?$/;   // 2f: 장바구니 맥락 «얼마/금액» 이면 SUM 우선(VIEW보다) — «배송 얼마나»·«비트코인 얼마야»는 제외
  var ORDER_RE = /(주문|결제|계산)\s?(할게|하러|해\s?줘|할래|하자|해\s?주세요|하고\s?싶)|주문서/;
  var VIEW_RE = /(장바구니|카트|바구니|담은\s?거|담긴\s?거|뭐\s?담았|담았는지)\s?\S*\s?(보여|열어|보자|확인|로\s?가|가\s?줘|갈래|줘|보)|^\s?(장바구니|내\s?장바구니)\s?$/;
  var SUM_RE = /장바구니|카트|바구니|총(?!각)|전부|다\s?해서|합계|합이|총액|금액|얼마치|결제하면|얼마나\s?돼|(얼마|올마)\s?나와|값이?\s?(얼마|올마)/;
  var BAG_RE = /장바구니|카트|바구니/;   // 2b: «상품+수량+장바구니»=ADD 판별용(담는 곳)
  var VIEWV_RE = /보여|열어|보자|확인|보\b/;   // 보기 말 — 있으면 담기로 보지 않음
  var SPLIT_RE = /\s*(?:이?랑|하고|그리고|및|,|、|\+)\s*/;
  var EACH_RE = /씩/;
  var VSTRIP = /담아서|담아|담기|담을|넣어서|넣어|넣고|빼\s?주세요|빼\s?줘|빼고|빼|지워\s?주세요|지워\s?줘|지워|지우|줄여\s?줘|줄여|줄이|취소|주문\S*|결제\S*|계산\S*|주세요|주이소|주라|해\s?주세요|해\s?줘|부탁\S*/g;
  var _QU = "개|병|통|봉지|봉|세트|팩|상자|박스|포대|단|망|키로|킬로|kg|근|줄";

  function optCounts(D) {
    if (D._oc) return D._oc;
    var oc = {}; (D.entries || []).forEach(function (e) { if (e.k === "option") oc[e.key] = (oc[e.key] || 0) + 1; });
    D._oc = oc; return oc;
  }
  function coverOk(text, key, opt, D) {   // 짧은 별명이 긴 낯선 말 속에 든 가짜일치 거르기 — 맨 앞에서 시작 + 60%↑ 덮어야(비트코인·앞에 딴 상품 삼킴 막음)
    var ns = text.replace(/\s+/g, ""), nsj = foldj(ns), nl = nsj.length, ok = false;   // 2a·3: 소리 접힘 자모로 견줌(사인머스캣잼→샤인머스캣잼 통과)
    (D.entries || []).forEach(function (e) {
      if (e.key !== key || (e.opt || null) !== (opt || null)) return;
      (e.a || []).forEach(function (a) {
        var aa = a.replace(/\s+/g, ""); if (aa.length < 2) return;
        var aj = foldj(aa), pref = aj.length <= nl;
        for (var i = 0; pref && i < aj.length; i++) if (aj[i] !== nsj[i]) pref = false;   // 접힘 자모가 맨 앞에서 일치
        if (pref && aj.length >= nl * 0.6) ok = true;
      });
    });
    return ok;
  }
  function resolveItem(text, D) {   // 세그먼트 → 상품/옵션/되묻기(ask)/화면안내(page). 어순 바뀐 옵션도(고추장 흑마늘)
    if (!text) return { ok: false };
    var w = text.split(" ").filter(Boolean), forms = [text, text.replace(/\s+/g, "")];
    if (w.length === 2) { forms.push(w[1] + w[0]); forms.push(w[1] + " " + w[0]); }   // 어순 바뀐 옵션(고추장 흑마늘 → 흑마늘고추장) — 2단어만(3+ 는 앞 상품 삼킴 막음)
    var best = null, other = null;
    for (var i = 0; i < forms.length; i++) {
      var r = match(forms[i], D, { noAsk: true });
      if (!r || r.type === "none") continue;
      if (r.type !== "product") { other = other || r; continue; }
      if ((r.how === "sub" || r.how === "sub-tie") && !coverOk(forms[i], r.key, r.opt, D)) continue;   // 부분일치(짧은 별명이 긴 낯선 말 속)만 거름 — fuzzy 받아쓰기·exact 옵션은 통과
      if (r.opt) return { ok: true, key: r.key, opt: r.opt, name: r.name, href: r.href };   // 옵션 지정 — 바로
      if (!best) best = r;
    }
    if (!best) return other ? { ok: false, other: other } : { ok: false };
    var n = optCounts(D)[best.key] || 0;
    if (n >= 6) return { ok: true, page: true, key: best.key, name: best.name, href: best.href };
    if (n >= 2) return { ok: true, ask: true, key: best.key, name: best.name, href: best.href };
    return { ok: true, key: best.key, opt: null, name: best.name, href: best.href };
  }
  function fin(r, qty, exq) {
    if (r.page) return { page: true, key: r.key, name: r.name, href: r.href, qty: qty, exq: !!exq };
    if (r.ask) return { ask: true, key: r.key, name: r.name, href: r.href, qty: qty, exq: !!exq };
    return { key: r.key, opt: r.opt || null, name: r.name, href: r.href, qty: qty, exq: !!exq };
  }
  var CNT_U = /^(개|병|통|봉지|봉|세트|팩|상자|박스|포대|단|망)$/;
  var BIGNUM = { "스무": 20, "스물": 20, "서른": 30, "마흔": 40, "쉰": 50, "예순": 60, "일흔": 70, "여든": 80, "아흔": 90, "백": 100, "이백": 200, "삼백": 300 };
  function qtyTok(tok) {   // 수량 토큰이면 숫자(키로·kg 등 크기 단위는 옵션일 수 있어 수량으로 안 봄)
    var m = tok.match(/^(\d+)(?:개|병|통|봉지|봉|세트|팩|상자|박스|포대|단|망)?$/); if (m) return +m[1];
    if (NUMW[tok] != null) return NUMW[tok];
    if (BIGNUM[tok] != null) return BIGNUM[tok];
    m = tok.match(/^(한|하나|두|둘|세|셋|석|네|넷|넉|다섯|여섯|일곱|여덟|아홉|열|스무|스물|서른|마흔|쉰|예순|일흔|여든|아흔|백|이백|삼백)(?:개|병|통|봉지|봉|세트|팩|상자|박스|단|망)$/);
    return m ? (NUMW[m[1]] != null ? NUMW[m[1]] : BIGNUM[m[1]]) : null;
  }
  function parseItems(raw, D) {   // 토큰 스캔: 연결어·공백 모두 통일, 상품 창(1~3) + 뒤 수량
    var body = raw.replace(VSTRIP, " ").replace(/\s줘(?=\s|$)/g, " ").replace(/\s요(?=\s|$)/g, " ").replace(/\s좀(?=\s|$)/g, " ")
      .replace(/으로(?=\s|$)/g, " ").replace(SPLIT_RE, " ").replace(/씩/g, " ").replace(/\s+/g, " ").trim();
    var toks = body.split(" ").filter(Boolean), items = [], unknown = 0, i = 0;
    while (i < toks.length) {
      if (qtyTok(toks[i]) != null) { i++; continue; }
      var end = i; while (end < toks.length && end - i < 3 && qtyTok(toks[end]) == null) end++;
      var got = null, used = 0, L;
      for (L = end - i; L >= 1 && !got; L--) { var r1 = resolveItem(toks.slice(i, i + L).join(" "), D); if (r1.ok && r1.opt) { got = r1; used = L; } }   // 옵션 지정은 긴 창 우선
      if (!got) for (L = 1; L <= end - i && !got; L++) { var r2 = resolveItem(toks.slice(i, i + L).join(" "), D); if (r2.ok) { got = r2; used = L; } }   // 상품은 짧은 창 우선(옆 상품 안 삼킴)
      if (!got) { i++; unknown++; continue; }
      i += used;
      var qty = 1, exq = false;
      if (i < toks.length) { var q = qtyTok(toks[i]); if (q != null) { qty = q; exq = true; i++; if (i < toks.length && CNT_U.test(toks[i])) i++; } }
      items.push(fin(got, qty, exq));
    }
    return { items: items, unknown: unknown };
  }
  function assistTarget(raw, D) {   // 추천/예산 → 분류/세트(있으면), 없으면 인기
    var r = match(raw, D, { noAsk: true });
    if (r && (r.type === "category" || r.type === "set")) return { type: r.type, key: r.key, name: r.name, href: r.href };
    if (r && r.type === "product") return { type: "category", key: r.key, name: r.name, href: r.href };
    return null;
  }
  function parseCommand(raw, D, o) {
    o = o || {};
    var t = String(raw || "").toLowerCase().replace(/[.,!?~…"'“”‘’()\[\]·]/g, " ").replace(/\s+/g, " ").trim();
    if (!t) return { intent: "none" };
    if (LAST_RE.test(t)) return { intent: "last", items: parseItems(t, D).items };
    if (ASSIST_RE.test(t)) return { intent: "assist", target: assistTarget(t, D) };
    if (DEL_RE.test(t)) {
      var pd = parseItems(t, D);
      var di = pd.items.map(function (it) { return it.ask || it.page ? { key: it.key, opt: null, name: it.name, href: it.href, qty: it.qty || 1, exq: it.exq } : it; });   // 빼기는 상품 단위(되묻지 않음)·수량 유지
      return di.length ? { intent: "del", items: di } : { intent: "none" };
    }
    if (ORDER_RE.test(t)) return { intent: "order" };
    var pa = parseItems(t, D);
    if (ADD_VERB.test(t) && pa.items.length) return { intent: "add", items: pa.items };   // 2b: 담기 말+상품이면 ADD(장바구니에 담아) — VIEW/SUM 보다 우선
    if (pa.items.length && pa.items.some(function (it) { return it.exq; }) && BAG_RE.test(t) && !MONEY_RE.test(t) && !VIEWV_RE.test(t))
      return { intent: "add", items: pa.items };   // 2b: «상품+수량+장바구니»(담기 말 없이도) = ADD — 돈/보기 말 없을 때만
    if (MONEY_RE.test(t)) return { intent: "sum" };   // 2f: 얼마/금액 → SUM 우선
    if (VIEW_RE.test(t)) return { intent: "view" };
    if (SUM_RE.test(t)) return { intent: "sum" };
    if (!pa.items.length) return { intent: "none" };
    var multi = pa.items.length > 1, exq = pa.items.some(function (it) { return it.exq; });
    return (multi || exq) ? { intent: "add", items: pa.items } : { intent: "find", items: pa.items };   // 상품 하나·수량 없음·담기 말 없음 → V1 찾기(이동)
  }

  var API_ = { match: match, clean: clean, jamo: jamo, lev: lev, parseCommand: parseCommand };
  if (typeof module === "object" && module.exports) { module.exports = API_; return; }
  G.EdenVoice = API_;

  /* ════════ 화면(브라우저) ════════ */
  var doc = G.document, UA = (G.navigator && G.navigator.userAgent) || "";
  var ISPREVIEW = !doc.documentElement.getAttribute("data-api");   // 1(대표 11-16): «들은 말: …»은 미리보기(data-api 없음)에서만 — 출시판엔 안 나옴. 저장은 여전히 0
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
      panel.appendChild(x);
      if (SPK) {   // ⑤ 소리 끄기 토글(음성 합성 되는 기기만) · edenwon_vc_mute 기억
        var mb = el("button", "vc__mute"); mb.type = "button"; mb.textContent = muted() ? T_("소리 켜기") : T_("소리 끄기"); mb.setAttribute("aria-pressed", String(muted()));
        mb.addEventListener("click", function () { var m = !muted(); setMuted(m); if (m) { try { SPK.cancel(); } catch (e) {} } mb.textContent = m ? T_("소리 켜기") : T_("소리 끄기"); mb.setAttribute("aria-pressed", String(m)); });
        panel.appendChild(mb);
      }
      panel.appendChild(live); panel.appendChild(heard); panel.appendChild(body);
      doc.body.appendChild(panel);
      panel.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
    }
    panel.hidden = false; btn.setAttribute("aria-expanded", "true");
    heard.textContent = ""; body.textContent = "";
  }
  function close() {
    if (rec) { try { rec.abort(); } catch (e) {} rec = null; }
    if (SPK) { try { SPK.cancel(); } catch (e) {} }
    clearTimeout(timer);
    if (panel) { panel.hidden = true; heard.textContent = ""; body.textContent = ""; live.textContent = ""; }
    btn.removeAttribute("data-listening"); btn.setAttribute("aria-expanded", "false"); btn.focus();
  }
  var MUTE_KEY = "edenwon_vc_mute", SPK = G.speechSynthesis, fromMic = false;
  function muted() { try { return G.localStorage.getItem(MUTE_KEY) === "1"; } catch (e) { return false; } }
  function setMuted(m) { try { if (m) G.localStorage.setItem(MUTE_KEY, "1"); else G.localStorage.removeItem(MUTE_KEY); } catch (e) {} }   // ⑤ 소리 끄기 기억(S1 허용 키)
  function speak(t) {   // ⑤ 소리 답: 마이크 누른 뒤에만 · 소리 끄기면 안 함 · 음성 합성 안 되는 기기는 글만. AI·서버로 소리 보내기 0
    if (!SPK || !fromMic || muted() || !t) return;
    try { SPK.cancel(); var u = new G.SpeechSynthesisUtterance(String(t)); u.lang = "ko-KR"; SPK.speak(u); } catch (e) {}
  }
  function say(t) { live.textContent = t; speak(t); }
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
    f.addEventListener("submit", function (e) { e.preventDefault(); var v = i.value; i.value = ""; fromMic = false; loadDict().then(function () { handle([v]); }, fail); });   // 글 입력은 소리 답 없음
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

  /* ════ A단계 화면 핸들러 — 담기·빼기·보기·주문·추천(AI 없음). 소리 답·SUM 견적은 다음 단계 ════ */
  var CONTACT_OVER = "한 번에 20개까지예요. 더 필요하시면 단체·기업 구매로 문의해 주세요.";
  function defaultOpt(key) {   // 단일옵션 상품 기본 옵션 id(사전 do) — 없으면 null(다옵션=되묻기)
    if (!dict) return null;
    var es = dict.entries || [], i;
    for (i = 0; i < es.length; i++) if (es[i].k === "product" && es[i].key === key && es[i].do) return es[i].do;
    for (i = 0; i < es.length; i++) if (es[i].k === "option" && es[i].key === key) return es[i].opt;
    return null;
  }
  function prodName(key) { var e = dict && (dict.entries || []).filter(function (x) { return x.k === "product" && x.key === key; })[0]; return e ? e.n : key; }
  function optList(key) {   // 2d: 상품의 옵션 [{opt, label}] — 종류 이름 읽기·되묻기 단추용(옵션 이름에서 상품 이름 떼기)
    if (!dict) return [];
    var pw = prodName(key).split(/\s+/), out = [], seen = {};
    (dict.entries || []).forEach(function (e) {
      if (e.k !== "option" || e.key !== key || seen[e.opt]) return; seen[e.opt] = 1;
      var lab = e.n; pw.forEach(function (w) { if (w) lab = lab.split(w).join(""); });
      lab = lab.replace(/\s+/g, " ").trim() || e.n;
      out.push({ opt: e.opt, label: lab, name: e.n, href: e.h });
    });
    return out;
  }
  function cartRefresh() {   // 대표 11-16 ④·2g: 머리글 숫자 + 열린 장바구니 화면 즉시 갱신
    try { if (G.EdenCart) G.EdenCart.render(); } catch (e) {}
    var cp = doc.querySelector("[data-cart-page]");
    if (!cp) return;
    if (cp._edRender) { try { cp._edRender(); return; } catch (e) {} }   // 2g: 리로드 없이 즉시 다시 그림(P 준비됐을 때)
    timer = setTimeout(function () { G.location.reload(); }, 1100);     // 아직 상품 로드 전이면 리로드로 대체
  }
  function loginLink() { var a = el("a", "vc__pick", T_("로그인")); a.href = root() + "account/login.html?next=" + encodeURIComponent(G.location.pathname + G.location.search); return a; }
  function contactLink() { var a = el("a", "vc__pick", T_("단체·기업 구매 문의")); a.href = root() + "contact.html"; return a; }
  function gate(then) {   // 회원만(비회원은 로그인 안내 · 들은 문장 저장·이어담기 없음 — ⑤)
    var M = G.Eden && G.Eden.member;
    function dec() { if (!M || M.me) then(); else { stat("login_needed"); say(T_("회원만 말로 담을 수 있어요. 로그인한 뒤 다시 말씀해 주세요.")); body.textContent = ""; body.appendChild(loginLink()); var a = body.querySelector("a"); if (a) a.focus(); } }
    if (M && M.ready && M.ready.then) M.ready.then(dec, dec); else dec();
  }
  function confirmAdd(items) {
    body.textContent = "";
    var lines = [], names = [], over = false, ambig = [];
    items.forEach(function (it) {
      if (it.ask || it.page) { ambig.push(it); return; }
      var oid = it.opt || defaultOpt(it.key); if (!oid) { ambig.push(it); return; }
      var rq = it.qty || 1, q = Math.min(rq, 20); if (rq > 20) over = true;
      lines.push({ key: it.key, option: oid, qty: q }); names.push(it.name + " " + q + T_("개"));
    });
    if (!lines.length && ambig.length === 1) {
      var a0 = ambig[0];
      if (a0.page) {   // 2d: 6종+ → 종류 많아서 화면에서 골라 주세요(이동 전 말하기)
        say(Tf_("«{0}»은 종류가 많아서 화면에서 골라 주세요.", a0.name));
        if (a0.href) { body.appendChild(link(T_("고르기"), a0.href)); body.querySelector("a").focus(); timer = setTimeout(function () { go(a0.href); }, 2400); }
        return;
      }
      var ol = optList(a0.key);   // 2d: 2~5종 → 종류 이름 읽어 주며 되묻기 + 단추(누르면 그 종류로 담기)
      if (ol.length) {
        say(Tf_("«{0}» 종류는 {1}가 있어요. 어느 걸로 할까요?", a0.name, ol.map(function (o) { return o.label; }).join(", ")));
        ol.forEach(function (o) { var b = el("button", "vc__pick", o.label); b.type = "button"; b.addEventListener("click", function () { doAdd([{ key: a0.key, option: o.opt, qty: a0.qty || 1 }], (a0.qty || 1) > 20); }); body.appendChild(b); });
        var bn = el("button", "vc__no", T_("아니요")); bn.type = "button"; bn.addEventListener("click", close); body.appendChild(bn);
        body.querySelector("button").focus();
        return;
      }
    }
    if (!lines.length) {
      if (ambig.length === 1 && ambig[0].href) { say(Tf_("«{0}» 종류를 골라 주세요", ambig[0].name)); body.appendChild(link(T_("고르기"), ambig[0].href)); body.querySelector("a").focus(); }
      else act({ type: "none" });
      return;
    }
    say(T_("담을까요?"));
    body.appendChild(el("p", "vc__heard", names.join(", ")));
    if (over) { body.appendChild(el("p", "vc__note", T_(CONTACT_OVER))); body.appendChild(contactLink()); }
    if (ambig.length) { body.appendChild(el("p", "vc__note", T_("나머지 종류는 상품 화면에서 골라 주세요."))); ambig.forEach(function (a) { if (a.href) body.appendChild(link(a.name, a.href)); }); }
    var bAdd = el("button", "btn btn--dark vc__ext", T_("담기")); bAdd.type = "button";
    var bFix = el("button", "vc__no", T_("고치기")); bFix.type = "button";
    var bNo = el("button", "vc__no", T_("아니요")); bNo.type = "button";
    bAdd.addEventListener("click", function () { doAdd(lines, over); });
    bFix.addEventListener("click", function () {   // 2e: 담을 상품 교체 — 다시 들은 말이 대기 중인 담기를 대신함(후보 여럿이면 confirmAdd 가 되묻음)
      if (SR && STATE === "on") { say(T_("담을 상품을 다시 말해 주세요.")); body.textContent = ""; listen(); }
      else { body.textContent = ""; typed(T_("담을 상품을 바꿔 적어 주세요.")); }
    });
    bNo.addEventListener("click", close);
    body.appendChild(bAdd); body.appendChild(bFix); body.appendChild(bNo); bAdd.focus();
  }
  function doAdd(lines, over) {
    var ok = false; try { ok = G.EdenCart && G.EdenCart.add(lines); } catch (e) {}
    stat(ok ? "voice_add" : "voice_add_fail");
    if (ok) { say(T_("담았어요.")); body.textContent = ""; if (over) { body.appendChild(el("p", "vc__note", T_(CONTACT_OVER))); body.appendChild(contactLink()); } cartRefresh(); }
    else say(T_("담지 못했어요. 장바구니를 확인해 주세요."));
  }
  function confirmDel(items) {
    body.textContent = "";
    var cur = (G.EdenCart && G.EdenCart.read()) || [], acts = [], names = [];
    items.forEach(function (it) {
      if (!cur.some(function (c) { return c.key === it.key && (!it.opt || c.option === it.opt); })) return;
      acts.push({ key: it.key, opt: it.opt || null, qty: it.exq ? (it.qty || 1) : null });   // ③ 수량 있으면 그만큼, 없으면 통째
      names.push(it.name + (it.exq ? " " + (it.qty || 1) + T_("개") : ""));
    });
    if (!acts.length) { say(T_("장바구니에 그 상품이 없어요.")); return; }
    say(T_("뺄까요?"));
    body.appendChild(el("p", "vc__heard", names.join(", ")));
    var bDel = el("button", "btn btn--dark vc__ext", T_("빼기")); bDel.type = "button";
    var bNo = el("button", "vc__no", T_("아니요")); bNo.type = "button";
    bDel.addEventListener("click", function () { doDel(acts); });
    bNo.addEventListener("click", close);
    body.appendChild(bDel); body.appendChild(bNo); bDel.focus();
  }
  function doDel(acts) {
    try {
      var cur = G.EdenCart.read();
      acts.forEach(function (a) {
        for (var i = cur.length - 1; i >= 0; i--) if (cur[i].key === a.key && (!a.opt || cur[i].option === a.opt)) {
          if (a.qty == null || cur[i].qty <= a.qty) cur.splice(i, 1); else cur[i].qty -= a.qty;
        }
      });
      G.EdenCart.write(cur);
    } catch (e) {}
    stat("voice_del"); say(T_("뺐어요.")); body.textContent = ""; cartRefresh();
  }
  function doAssist(target) {   // ④ 예산·추천 → «곧 AI 상담» + 분류/인기 안내
    say(T_("곧 AI 상담에서 도와드릴게요."));
    body.appendChild(link(target && target.name ? target.name : T_("인기 상품 보기"), target && target.href ? target.href : "products.html"));
    var a = body.querySelector("a"); if (a) a.focus();
  }
  function wonDigit(n) { return Math.round(n).toLocaleString("ko-KR") + "원"; }
  function wonKo(n) {   // ① 반올림 없이 자연스러운 한국어 금액 — «3만 2천5백 원»(소리용)
    n = Math.round(n); if (n <= 0) return "0원";
    var man = Math.floor(n / 10000), r = n % 10000, s = "";
    if (man) s += man + "만";
    var cheon = Math.floor(r / 1000), r2 = r % 1000;
    if (cheon) s += (s ? " " : "") + cheon + "천";
    var baek = Math.floor(r2 / 100), r3 = r2 % 100;
    if (baek) s += baek + "백";
    if (r3) s += r3;
    return s + "원";
  }
  function sumSel() {   // 대표 11-16 (가): 주문서 source() 와 같은 기준 — 체크한 품목만(+ 유효)
    var all = ((G.EdenCart && G.EdenCart.read()) || []).filter(function (c) { return c.key && c.option && c.qty > 0; });
    var items = all.filter(function (c) { return c.checked !== false; });
    return { all: all, items: items, unchecked: all.length > items.length };
  }
  function sumSuf(sel) {   // 조건부 덧붙임 — 해제 품목 있을 때만 «체크한 N개 기준», 적립금>0 회원일 때만 «적립금 쓰기 전». 둘 다 없으면 금액만
    var s = "", M = G.Eden && G.Eden.member;
    if (sel.unchecked) s += Tf_(" (체크한 {0}개 기준이에요)", sel.items.length);
    if (M && M.me && (+M.me.points || 0) > 0) s += T_(" (적립금 쓰기 전 금액이에요)");
    return s;
  }
  function doSum() {   // SUM: 체크한 품목만 /api/v2/quote(주문서와 같은 기준) → 서버 금액 읽기(브라우저 계산 0). 비회원도 읽기(⑥)
    var sel = sumSel();
    if (!sel.all.length) { say(T_("장바구니가 비어 있어요.")); return; }
    if (!sel.items.length) { say(T_("체크한 품목이 없어요. 장바구니에서 골라 주세요.")); timer = setTimeout(function () { go("cart.html"); }, 1000); return; }
    if (!(G.Eden && G.Eden.acall && G.Eden.API)) {
      if (G.Eden && G.Eden.member && G.Eden.member.me && G.Eden.member.me._mock) { mockSum(sel); return; }   // 미리보기 모의(라이브 연결 0)
      say(T_("합계는 장바구니에서 확인해 주세요.")); timer = setTimeout(function () { go("cart.html"); }, 900); return;
    }
    say(T_("합계를 알아볼게요…"));
    var M = G.Eden.member, phone = (M && M.me && M.me.phone) || "";
    var req = { lines: sel.items.map(function (c) { return { key: c.key, option_id: c.option, qty: c.qty }; }), receive: { method: "parcel" }, buyer: { phone: phone }, points_use: 0 };
    G.Eden.acall("POST", "/api/v2/quote", req, true).then(function (j) {
      if (!j || !j.ok || !j.breakdown) { say(j && j.error ? j.error : T_("합계를 불러오지 못했어요. 장바구니에서 확인해 주세요.")); return; }
      var b = j.breakdown, free = !b.shipping, suf = sumSuf(sel);
      say(Tf_("상품 {0}, ", wonKo(b.goods)) + (free ? T_("배송비 무료, ") : Tf_("배송비 {0}, ", wonKo(b.shipping))) + Tf_("모두 {0}", wonKo(j.amount)) + suf);   // 소리: 한국어 금액 + 조건부
      body.textContent = "";
      body.appendChild(el("p", "vc__note", "상품 " + wonDigit(b.goods) + " · " + (free ? T_("배송비 무료") : "배송비 " + wonDigit(b.shipping)) + " · 모두 " + wonDigit(j.amount) + suf));   // 화면: 같은 값
      body.appendChild(link(T_("장바구니 보기"), "cart.html"));
    }, function () { say(T_("합계를 불러오지 못했어요.")); });
  }
  function doLast(items) { say(T_("지난번 주문 담기는 곧 지원할게요.")); }   // LAST(STOP4)는 다음
  var _prodP;
  function loadProd() { if (!_prodP) _prodP = fetch(root() + "assets/v2/products.json", { credentials: "same-origin" }).then(function (r) { if (!r.ok) throw 0; return r.json(); }); return _prodP; }
  function mockSum(sel) {   // 미리보기 전용 모의 합계(서버 연결 0 · «모의 금액» 표시 · 실 금액은 라이브 서버 견적) — 체크 품목만·조건부 덧붙임
    loadProd().then(function (P) {
      var byk = (P && P.products) || {}, goods = 0;
      sel.items.forEach(function (c) { var p = byk[c.key]; if (!p) return; var o = (p.options || []).filter(function (x) { return x.id === c.option; })[0]; if (o) goods += (o.price || 0) * c.qty; });
      var sh = (P && P.shipping) || { fee: 5000, free_over: 100000 }, shipping = goods >= sh.free_over ? 0 : sh.fee, amount = goods + shipping, free = !shipping, mk = sumSuf(sel) + T_(" (미리보기 모의 금액)");
      say(Tf_("상품 {0}, ", wonKo(goods)) + (free ? T_("배송비 무료, ") : Tf_("배송비 {0}, ", wonKo(shipping))) + Tf_("모두 {0}", wonKo(amount)) + mk);
      body.textContent = "";
      body.appendChild(el("p", "vc__note", "상품 " + wonDigit(goods) + " · " + (free ? T_("배송비 무료") : "배송비 " + wonDigit(shipping)) + " · 모두 " + wonDigit(amount) + mk));
      body.appendChild(link(T_("장바구니 보기"), "cart.html"));
    }, function () { say(T_("합계는 장바구니에서 확인해 주세요.")); });
  }
  function runCmd(cmd) {
    body.textContent = "";
    var i = cmd && cmd.intent;
    if (!i || i === "none") { act({ type: "none" }); return; }
    if (i === "find") { var f = cmd.items[0]; stat("match_product"); say(Tf_("«{0}»(으)로 갑니다", f.name)); timer = setTimeout(function () { go(f.href); }, 900); return; }
    if (i === "view") { stat("voice_view"); say(T_("장바구니로 갑니다")); timer = setTimeout(function () { go("cart.html"); }, 700); return; }
    if (i === "assist") { stat("voice_assist"); doAssist(cmd.target); return; }
    if (i === "sum") { stat("voice_sum"); doSum(); return; }
    if (i === "order") { gate(function () { stat("voice_order"); say(T_("주문서로 갑니다")); timer = setTimeout(function () { go("cart.html"); }, 700); }); return; }
    if (i === "last") { gate(function () { doLast(cmd.items); }); return; }
    if (i === "add") { gate(function () { confirmAdd(cmd.items); }); return; }
    if (i === "del") { gate(function () { confirmDel(cmd.items); }); return; }
    act({ type: "none" });
  }
  function showHeard(raw0, picked) {   // 1(대표 11-16): 미리보기에서만 · 저장 0. 1순위와 실제 고른 후보가 다르면 둘 다 보임
    if (!ISPREVIEW || !heard) return;
    heard.textContent = (picked && picked !== raw0)
      ? T_("들은 말") + ": " + raw0 + " → " + T_("고른 말") + ": " + picked
      : T_("들은 말") + ": " + raw0;
  }
  function handle(alts) {   // 명령(담기·빼기·합계 등)이면 runCmd · 찾기/못 알아들음이면 V1 match→act(상품·여러 후보·안내 그대로)
    var cmd = null, i, picked = alts[0];
    for (i = 0; i < alts.length && (!cmd || cmd.intent === "none"); i++) { cmd = parseCommand(alts[i], dict); if (cmd && cmd.intent !== "none") picked = alts[i]; }
    if (cmd && cmd.intent !== "none" && cmd.intent !== "find") { showHeard(alts[0], picked); runCmd(cmd); return; }
    var r = null, rp = alts[0];
    for (i = 0; i < alts.length && (!r || r.type === "none"); i++) { r = match(alts[i], dict); if (r && r.type !== "none") rp = alts[i]; }
    showHeard(alts[0], (r && r.type !== "none") ? rp : alts[0]);   // 고른 말은 실제로 결과가 나온 후보(없으면 1순위 그대로)
    act(r || { type: "none" });
  }
  function listen() {
    open(); stat("mic_open"); fromMic = true;   // ⑤ 소리 답은 마이크 뒤에만
    loadDict().catch(function () {});
    rec = new SR(); rec.lang = "ko-KR"; rec.interimResults = false; rec.maxAlternatives = 5; rec.continuous = false;   // 2a: 후보 5개(처음 해석되는 것 사용 — handle 이 돌림)
    btn.setAttribute("data-listening", ""); say(T_("듣고 있어요"));
    rec.onresult = function (ev) {
      var alts = [], res = ev.results[0];
      for (var i = 0; i < res.length; i++) alts.push(res[i].transcript);
      stat("heard");
      loadDict().then(function () {
        handle(alts);   // 1: «들은 말»은 handle 안에서(고른 후보까지) — 다음 마이크 누를 때 open()이 지움. 저장·콘솔 0
        alts = null;
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
  var COLL_KEY = "edenwon_vc_collapsed";
  function collRead() { try { return G.localStorage.getItem(COLL_KEY) === "1"; } catch (e) { return false; } }   // 실패 시 펼침
  function collSave(c) { try { if (c) G.localStorage.setItem(COLL_KEY, "1"); else G.localStorage.removeItem(COLL_KEY); } catch (e) {} }
  function foldInit() {   // ㉮ 접기(휴대폰 둥근 단추): × → 오른쪽 가장자리 탭 · 탭 → 펼침 · localStorage 기억 · 키보드는 단추라 기본 동작
    var wrap = doc.querySelector("[data-vc-wrap]");
    if (!wrap) return;
    wrap.setAttribute("data-voice-state", STATE);   // off 면 CSS 가 wrap 째 숨김
    if (STATE === "off") return;
    var fold = wrap.querySelector("[data-vc-fold]"), tab = wrap.querySelector("[data-vc-unfold]"), fab = wrap.querySelector(".vc-fab");
    function apply(c) { if (c) wrap.setAttribute("data-vc-collapsed", ""); else { wrap.removeAttribute("data-vc-collapsed"); wrap.removeAttribute("data-vc-away"); } }   // 펼치면 숨김도 품(바로 보이게)
    if (fold) fold.addEventListener("click", function () { apply(true); collSave(true); if (tab) tab.focus(); });
    if (tab) tab.addEventListener("click", function () { apply(false); collSave(false); if (fab) fab.focus(); });
    apply(collRead());
    wrap.setAttribute("data-vc-ready", "");   // JS 준비 뒤에만 ×·탭 보임
    scrollHide(wrap);   // 11-15 보강②: 아래로 스크롤 중 숨김·멈춤/올림 때 표시
  }
  function scrollHide(wrap) {   // 11-15 규칙: 아래로=숨김(멈춰도 그대로) · 보임=위로/맨 위(y<120)/맨 끝 · 접힘(탭)은 항상 보임 · reduced-motion 이면 CSS transition 0(움직임 없이 바로)
    var lastY = G.pageYOffset || 0, ticking = false;
    function set(h) { if (wrap.hasAttribute("data-vc-away") !== h) { if (h) wrap.setAttribute("data-vc-away", ""); else wrap.removeAttribute("data-vc-away"); } }
    function atBottom(y) { var de = doc.documentElement; return y + G.innerHeight >= (de.scrollHeight || doc.body.scrollHeight) - 1; }
    G.addEventListener("scroll", function () {
      if (ticking) return; ticking = true;
      G.requestAnimationFrame(function () {
        var y = G.pageYOffset || 0;
        if (wrap.hasAttribute("data-vc-collapsed") || y < 120 || atBottom(y)) set(false);   // 접힘·맨 위·맨 끝 → 보임
        else if (y > lastY + 4) set(true);                                                   // 아래로 → 숨김(멈춰도 그대로)
        else if (y < lastY - 4) set(false);                                                  // 위로 → 보임
        lastY = y; ticking = false;
      });
    }, { passive: true });
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
    foldInit();
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init); else init();
})(typeof window !== "undefined" ? window : this);
