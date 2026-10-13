/* 영동에덴원 v2 — 회원 화면(2-B-2 STOP 3): 로그인 · 가입 · 비밀번호 찾기 · 마이페이지 · 주문 조회
   서버 호출은 <html data-api> 가 있을 때만. 미리보기(API 없음)는 예시 화면만 보이고 버튼은 꺼져 있다(마이페이지 메뉴 이동만 된다).
   app.js(window.Eden)의 acall·clearMember·paintMember 를 쓴다. 비밀번호·인증번호는 어디에도 저장하지 않는다. */
(function () {
  "use strict";
  var E = window.Eden || {}, API = E.API || "", acall = E.acall;
  var won = function (n) { return (n || 0).toLocaleString("ko-KR") + "원"; };
  var digits = function (v) { return String(v || "").replace(/\D/g, ""); };
  function fmtPhone(v) {
    var d = digits(v).slice(0, 11);
    if (d.length < 4) return d;
    if (d.length < 8) return d.slice(0, 3) + "-" + d.slice(3);
    return d.length === 11 ? d.slice(0, 3) + "-" + d.slice(3, 7) + "-" + d.slice(7) : d.slice(0, 3) + "-" + d.slice(3, 6) + "-" + d.slice(6);
  }
  var root = function () { return document.documentElement.getAttribute("data-root") || ""; };
  var NET = "연결이 원활하지 않습니다. 잠시 뒤 다시 시도해 주세요.";

  /* 돌아갈 주소: 같은 사이트 경로만(/ 로 시작, // 아님, 공백·역슬래시 없음). 서버도 같은 규칙으로 다시 거른다. */
  function nextParam() {
    var v = new URLSearchParams(location.search).get("next") || "";
    return /^\/(?!\/)[^\s\\]*$/.test(v) ? v : "";
  }
  function withNext(href) {
    var n = nextParam();
    return n ? href + (href.indexOf("?") < 0 ? "?" : "&") + "next=" + encodeURIComponent(n) : href;
  }

  /* ── 입력 부품 ── */
  function initInputs(scope) {
    scope.querySelectorAll("input[data-phone]").forEach(function (i) {
      i.addEventListener("input", function () { i.value = fmtPhone(i.value); });
    });
    scope.querySelectorAll("[data-pw-toggle]").forEach(function (b) {
      b.addEventListener("click", function () {
        var i = document.getElementById(b.getAttribute("aria-controls")), show = i.type === "password";
        i.type = show ? "text" : "password"; b.setAttribute("aria-pressed", String(show)); b.textContent = show ? "숨기기" : "보기";
      });
    });
  }
  function errOf(form, id) { return form.querySelector("[data-err-for='" + id + "']"); }
  function setErr(form, id, msg) {
    var p = errOf(form, id), el = form.querySelector("#" + id);
    if (p) { p.textContent = msg || ""; p.hidden = !msg; }
    if (el) { if (msg) el.setAttribute("aria-invalid", "true"); else el.removeAttribute("aria-invalid"); }
  }
  function clearErrs(form) {
    form.querySelectorAll("[data-err-for]").forEach(function (p) { p.hidden = true; p.textContent = ""; });
    form.querySelectorAll("[aria-invalid]").forEach(function (e) { e.removeAttribute("aria-invalid"); });
    formErr(form, "");
  }
  function formErr(form, msg) {
    var p = form.querySelector("[data-form-err]");
    if (p) { p.textContent = msg || ""; p.hidden = !msg; }
  }
  function okMsg(form, msg) {
    var p = form.querySelector("[data-form-ok]");
    if (p) { p.textContent = msg || ""; p.hidden = !msg; }
  }
  /* 처음 걸린 칸에 오류를 쓰고 초점. 하나라도 걸리면 false */
  function check(form, rules) {
    for (var i = 0; i < rules.length; i++) {
      if (!rules[i][2]) { setErr(form, rules[i][0], rules[i][1]); var el = form.querySelector("#" + rules[i][0]); if (el) el.focus(); return false; }
    }
    return true;
  }
  function busy(btn, on, label) {
    if (on) { btn.setAttribute("data-label", btn.textContent); btn.textContent = label || "처리 중…"; }
    else if (btn.getAttribute("data-label")) btn.textContent = btn.getAttribute("data-label");
    btn.disabled = on; btn.setAttribute("aria-busy", String(on));
  }

  /* ── 휴대폰 인증(가입·비밀번호 찾기·번호 변경 공용) ── */
  function Verify(form, onDone) {
    var box = form.querySelector("[data-verify]"), purpose = box.getAttribute("data-verify"), pre = box.getAttribute("data-prefix");
    var phone = form.querySelector("#" + pre + "-phone"), code = form.querySelector("#" + pre + "-code");
    var send = box.querySelector("[data-send-code]"), chk = box.querySelector("[data-check-code]");
    var msg = box.querySelector("[data-code-msg]"), ok = box.querySelector("[data-code-ok]"), codeBox = box.querySelector("[data-code-box]");
    var st = { token: null, phone: null }, cool = null;
    function cooldown(sec) {
      clearInterval(cool);
      var left = sec; send.disabled = true; send.textContent = "다시 받기 (" + left + "초)";
      cool = setInterval(function () {
        left--;
        if (left <= 0) { clearInterval(cool); send.disabled = false; send.textContent = "다시 받기"; }
        else send.textContent = "다시 받기 (" + left + "초)";
      }, 1000);
    }
    send.addEventListener("click", function () {
      if (send.disabled) return;
      setErr(form, pre + "-phone", ""); msg.hidden = true;
      var d = digits(phone.value);
      if (!/^01[016789]\d{7,8}$/.test(d)) { setErr(form, pre + "-phone", "휴대폰 번호를 정확히 입력해 주세요. 예: 010-1234-5678"); phone.focus(); return; }
      send.disabled = true; send.textContent = "보내는 중…";
      acall("POST", "/api/v2/auth/verify/send", { phone: d, purpose: purpose }).then(function (j) {
        if (!j.ok) { send.disabled = false; send.textContent = "인증번호 받기"; setErr(form, pre + "-phone", j.error || NET); return; }
        msg.textContent = j.message; msg.hidden = false; codeBox.hidden = false; code.value = ""; code.focus();
        st.phone = d; cooldown(30);
      }, function () { send.disabled = false; send.textContent = "인증번호 받기"; setErr(form, pre + "-phone", NET); });
    });
    chk.addEventListener("click", function () {
      if (chk.disabled) return;
      setErr(form, pre + "-code", "");
      if (!/^\d{6}$/.test(code.value.trim())) { setErr(form, pre + "-code", "문자로 받은 6자리 숫자를 입력해 주세요."); code.focus(); return; }
      busy(chk, true, "확인 중…");
      acall("POST", "/api/v2/auth/verify/check", { phone: st.phone || digits(phone.value), purpose: purpose, code: code.value.trim() }).then(function (j) {
        busy(chk, false);
        if (!j.ok) { setErr(form, pre + "-code", j.error || NET); code.focus(); return; }
        st.token = j.token; clearInterval(cool);
        phone.readOnly = code.readOnly = true; send.disabled = chk.disabled = true; send.textContent = "인증번호 받기";
        msg.hidden = true; ok.hidden = false;
        if (onDone) onDone();
      }, function () { busy(chk, false); setErr(form, pre + "-code", NET); });
    });
    code.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); chk.click(); } });
    return {
      token: function () { return st.token; },
      reset: function () {
        st.token = null; phone.readOnly = code.readOnly = false; send.disabled = chk.disabled = false; send.textContent = "인증번호 받기";
        ok.hidden = true; codeBox.hidden = true; code.value = "";
      }
    };
  }

  /* ── 로그인 ── */
  function pageLogin(page) {
    var form = page.querySelector("[data-login-form]"), btn = form.querySelector("[data-login-submit]");
    page.querySelector("[data-to-signup]").href = withNext("signup.html");
    page.querySelector("[data-to-find]").href = withNext("find.html");
    form.addEventListener("submit", function (e) {
      e.preventDefault(); if (btn.disabled) return; clearErrs(form);
      var ph = digits(form.querySelector("#login-phone").value), pw = form.querySelector("#login-pw").value;
      if (!check(form, [["login-phone", "휴대폰 번호를 정확히 입력해 주세요.", /^\d{10,11}$/.test(ph)], ["login-pw", "비밀번호를 입력해 주세요.", pw]])) return;
      busy(btn, true, "로그인 중…");
      // next 가 없으면 마이페이지, 있는데 같은 사이트 경로가 아니면 홈(지시서 §2)
      var nx = new URLSearchParams(location.search).get("next") === null ? new URL("index.html", location.href).pathname : (nextParam() || "/");
      acall("POST", "/api/v2/auth/login", { phone: ph, password: pw, next: nx }).then(function (j) {
        if (j.ok) { location.href = j.next || "/"; return; }
        busy(btn, false); formErr(form, j.error || NET); form.querySelector("#login-pw").select();
      }, function () { busy(btn, false); formErr(form, NET); });
    });
  }

  /* ── 가입 ── */
  function pageSignup(page) {
    var form = page.querySelector("[data-signup-form]"), btn = form.querySelector("[data-signup-submit]");
    var v = Verify(form), mkt = form.querySelector("#agree-mkt"), night = form.querySelector("#agree-night");
    page.querySelector("[data-to-login]").href = withNext("login.html");
    mkt.addEventListener("change", function () { night.disabled = !mkt.checked; if (!mkt.checked) night.checked = false; });
    form.addEventListener("submit", function (e) {
      e.preventDefault(); if (btn.disabled) return; clearErrs(form);
      var pw = form.querySelector("#su-pw").value, pw2 = form.querySelector("#su-pw2").value, name = form.querySelector("#su-name").value.trim();
      var terms = form.querySelector("#agree-terms").checked, priv = form.querySelector("#agree-privacy").checked;
      if (!check(form, [["su-phone", "휴대폰 인증을 먼저 마쳐 주세요.", v.token()],
                        ["su-pw", "비밀번호는 6자 이상으로 정해 주세요.", pw.length >= 6],
                        ["su-pw2", "비밀번호가 서로 다릅니다. 한 번 더 확인해 주세요.", pw === pw2],
                        ["su-name", "이름을 입력해 주세요.", name && name.length <= 40]])) return;
      if (!terms || !priv) {
        var p = errOf(form, "agree"); p.textContent = !terms ? "이용약관에 동의해 주세요." : "개인정보 수집·이용에 동의해 주세요."; p.hidden = false;
        form.querySelector(!terms ? "#agree-terms" : "#agree-privacy").focus(); return;
      }
      busy(btn, true, "가입하는 중…");
      acall("POST", "/api/v2/auth/signup", { token: v.token(), password: pw, name: name, terms_agree: true, privacy_agree: true,
                                            marketing_consent: mkt.checked, night_consent: night.checked }).then(function (j) {
        busy(btn, false);
        if (!j.ok) {
          if (j.code === "token") { v.reset(); setErr(form, "su-phone", j.error); form.querySelector("#su-phone").focus(); return; }
          if (j.code === "password") { setErr(form, "su-pw", j.error); return; }
          if (j.code === "name") { setErr(form, "su-name", j.error); return; }
          formErr(form, j.error || NET); return;
        }
        form.hidden = true;
        var done = page.querySelector("[data-signup-done]");
        done.querySelector("[data-done-name]").textContent = j.name;
        var nx = nextParam(), go = done.querySelector("[data-go-next]");
        if (nx) { go.href = nx; go.textContent = /checkout/.test(nx) ? "주문서로 돌아가기" : "보던 화면으로 돌아가기"; }
        done.hidden = false; done.focus();
        if (E.member) E.paintMember({ name: j.name });
      }, function () { busy(btn, false); formErr(form, NET); });
    });
  }

  /* ── 비밀번호 찾기 ── */
  function pageFind(page) {
    var form = page.querySelector("[data-find-form]"), btn = form.querySelector("[data-reset-submit]"), after = form.querySelector("[data-after-verify]");
    var v = Verify(form, function () { after.hidden = false; form.querySelector("#fd-pw").focus(); });
    form.addEventListener("submit", function (e) {
      e.preventDefault(); if (btn.disabled) return; clearErrs(form);
      var pw = form.querySelector("#fd-pw").value, pw2 = form.querySelector("#fd-pw2").value;
      if (!check(form, [["fd-phone", "휴대폰 인증을 먼저 마쳐 주세요.", v.token()],
                        ["fd-pw", "비밀번호는 6자 이상으로 정해 주세요.", pw.length >= 6],
                        ["fd-pw2", "비밀번호가 서로 다릅니다. 한 번 더 확인해 주세요.", pw === pw2]])) return;
      busy(btn, true, "바꾸는 중…");
      acall("POST", "/api/v2/auth/password/reset", { token: v.token(), password: pw }).then(function (j) {
        busy(btn, false);
        if (!j.ok) { if (j.code === "token") { v.reset(); after.hidden = true; setErr(form, "fd-phone", j.error); } else formErr(form, j.error || NET); return; }
        E.clearMember && E.clearMember();
        form.hidden = true; var d = page.querySelector("[data-reset-done]"); d.hidden = false; d.focus();
      }, function () { busy(btn, false); formErr(form, NET); });
    });
  }

  /* ── 마이페이지 ── */
  var STATE = { active: "적용 중", expired: "만료", revoked: "할인 중지", pending: "승인 대기" };
  var LB = { card: "카드", bank: "무통장 입금" };
  function pageMy(page) {
    var panes = {}, links = {};
    page.querySelectorAll("[data-pane]").forEach(function (p) { panes[p.getAttribute("data-pane")] = p; });
    page.querySelectorAll("[data-tab]").forEach(function (a) { links[a.getAttribute("data-tab")] = a; });
    var me = null, loaded = {};
    function show() {
      var h = location.hash.slice(1), parts = h.split("/"), id = panes[parts[0]] ? parts[0] : "orders";
      Object.keys(panes).forEach(function (k) { panes[k].hidden = k !== id; });
      Object.keys(links).forEach(function (k) { if (k === id) links[k].setAttribute("aria-current", "page"); else links[k].removeAttribute("aria-current"); });
      if (!API || !me) return;
      if (id === "orders") { if (parts[1]) orderDetail(decodeURIComponent(parts[1])); else { page.querySelector("[data-order-detail]").hidden = true; if (!loaded.orders) loadOrders(1); } }
      else if (!loaded[id]) { loaded[id] = true; ({ points: loadPoints, addresses: loadAddrs, affiliations: loadAffs, profile: loadProfile, withdraw: loadWithdraw })[id](); }
    }
    window.addEventListener("hashchange", show);
    if (!API) { show(); return; }
    acall("GET", "/api/v2/account").then(function (j) {
      if (j._status === 401 || !j.ok) {
        location.replace(root() + "account/login.html?next=" + encodeURIComponent(location.pathname + location.hash)); return;
      }
      me = j.account; paintHello(); show();
    }, function () { page.querySelector("[data-my-name]").textContent = "—"; show(); });
    function paintHello() {
      page.querySelector("[data-my-name]").textContent = me.name;
      page.querySelector("[data-my-points]").textContent = won(me.points);
    }

    // 주문
    var oPage = 1;
    function loadOrders(n) {
      loaded.orders = true;
      var ul = page.querySelector("[data-orders]"), more = page.querySelector("[data-orders-more]");
      acall("GET", "/api/v2/account/orders?page=" + n).then(function (j) {
        if (!j.ok) return;
        if (n === 1) ul.innerHTML = "";
        j.orders.forEach(function (o) {
          var li = document.createElement("li"), a = document.createElement("a");
          li.setAttribute("data-order-no", o.order_no); a.href = "#orders/" + encodeURIComponent(o.order_no);
          [["my__o-no", o.order_no], ["my__o-t", o.title + (o.item_count > 1 ? "" : "")], ["muted", o.created_at]].forEach(function (x) {
            var s = document.createElement("span"); s.className = x[0]; s.textContent = x[1]; a.appendChild(s);
          });
          var b = document.createElement("b"); b.textContent = won(o.amount); a.appendChild(b);
          var st = document.createElement("span"); st.className = "my__badge"; st.textContent = o.status; a.appendChild(st);
          li.appendChild(a); ul.appendChild(li);
        });
        page.querySelector("[data-orders-empty]").hidden = j.total > 0;
        oPage = j.page; more.hidden = j.page >= j.pages;
      });
    }
    page.querySelector("[data-orders-more]").addEventListener("click", function () { loadOrders(oPage + 1); });
    function orderDetail(no) {
      var box = page.querySelector("[data-order-detail]"), q = function (s) { return box.querySelector(s); };
      acall("GET", "/api/v2/account/orders/" + encodeURIComponent(no)).then(function (j) {
        if (!j.ok) { location.hash = "#orders"; return; }
        var o = j.order, b = o.breakdown;
        q("[data-od-no]").textContent = o.order_no; q("[data-od-status]").textContent = o.status; q("[data-od-date]").textContent = o.created_at;
        q("[data-od-receive]").textContent = o.receive === "parcel" ? "택배 배송" : "영동 농장 직접 수령";
        q("[data-od-pay]").textContent = LB[o.payment] + (o.payment === "card" ? (o.paid ? " · 결제 완료" : " · 결제 전") : "");
        var ul = q("[data-od-items]"); ul.innerHTML = "";
        o.items.forEach(function (it) {
          var li = document.createElement("li"), a = document.createElement("span"), m = document.createElement("span"), w = document.createElement("b");
          a.textContent = it.product + " "; m.className = "muted"; m.textContent = it.option_label + " · " + it.count + "개"; a.appendChild(m);
          w.textContent = won(it.line_amount); li.appendChild(a); li.appendChild(w); ul.appendChild(li);
        });
        q("[data-od-goods]").textContent = won(b.goods); q("[data-od-disc]").textContent = "−" + won(b.discount);
        q("[data-od-ship]").textContent = won(b.shipping); q("[data-od-pts]").textContent = "−" + won(b.points);
        q("[data-od-amount]").textContent = won(o.amount);
        q("[data-od-bank]").hidden = !o.bank_line; q("[data-od-bankline]").textContent = o.bank_line || "";
        q("[data-od-copy]").setAttribute("data-copy", (o.bank_line || "").replace(/^\S+\s(\S+).*$/, "$1"));
        q("[data-od-rcv]").hidden = !o.recipient;
        if (o.recipient) q("[data-od-rcvline]").textContent = o.recipient.name + " · " + fmtPhone(o.recipient.phone) + " · (" + o.recipient.zip + ") " + o.recipient.address1 + " " + o.recipient.address2;
        box.hidden = false; box.focus();
      });
    }
    page.querySelector("[data-od-copy]").addEventListener("click", function (e) {
      var v = e.currentTarget.getAttribute("data-copy"), out = page.querySelector("[data-od-copied]");
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(v).then(function () { out.textContent = "복사했습니다"; }, function () { out.textContent = "길게 눌러 직접 복사해 주세요"; });
      else out.textContent = "계좌번호: " + v;
    });

    // 적립금
    function loadPoints() {
      acall("GET", "/api/v2/account/points").then(function (j) {
        if (!j.ok) return;
        page.querySelector("[data-pts-balance]").textContent = won(j.balance);
        page.querySelector("[data-pts-rate]").textContent = j.rate;
        var tb = page.querySelector("[data-pts-log]"); tb.innerHTML = "";
        j.log.forEach(function (l) {
          var tr = document.createElement("tr");
          [l.created_at, l.label + (l.order_no ? " · " + l.order_no : ""), (l.amount > 0 ? "+" : "−") + won(Math.abs(l.amount))].forEach(function (t, i) {
            var td = document.createElement("td"); td.textContent = t; if (i === 2) td.className = "num"; tr.appendChild(td);
          });
          tb.appendChild(tr);
        });
        page.querySelector("[data-pts-empty]").hidden = j.log.length > 0;
      });
    }

    // 배송지
    var addrs = [], addrMax = 5, editing = null;
    var af = page.querySelector("[data-addr-form]");
    function loadAddrs() {
      acall("GET", "/api/v2/account/addresses").then(function (j) {
        if (!j.ok) return;
        addrs = j.addresses; addrMax = j.max;
        var ul = page.querySelector("[data-addr-list]"); ul.innerHTML = "";
        page.querySelector("[data-addr-count]").textContent = "(" + addrs.length + "/" + addrMax + ")";
        addrs.forEach(function (a) {
          var li = document.createElement("li"); li.setAttribute("data-addr-id", a.id);
          var p1 = document.createElement("p"), t = document.createElement("b"); t.textContent = a.label || "배송지"; p1.appendChild(t);
          if (a.is_default) { var d = document.createElement("span"); d.className = "my__badge"; d.textContent = "기본 배송지"; p1.appendChild(document.createTextNode(" ")); p1.appendChild(d); }
          var p2 = document.createElement("p"); p2.textContent = a.recipient_name + " · " + fmtPhone(a.recipient_phone);
          var p3 = document.createElement("p"); p3.className = "muted"; p3.textContent = "(" + a.zip + ") " + a.address1 + " " + a.address2;
          var acts = document.createElement("div"); acts.className = "my__acts";
          [["수정", "edit"], a.is_default ? null : ["기본으로", "default"], ["삭제", "del"]].forEach(function (x) {
            if (!x) return;
            var b = document.createElement("button"); b.type = "button"; b.className = "btn-small"; b.textContent = x[0];
            b.setAttribute("data-addr-" + x[1], a.id); b.setAttribute("aria-label", (a.label || "배송지") + " " + x[0]); acts.appendChild(b);
          });
          li.appendChild(p1); li.appendChild(p2); li.appendChild(p3); li.appendChild(acts); ul.appendChild(li);
        });
        af.hidden = addrs.length >= addrMax && !editing;
        if (addrs.length >= addrMax && !editing) formErr(af, "");
      });
    }
    function fillAddr(a) {
      af.querySelector("#ad-label").value = a ? a.label || "" : ""; af.querySelector("#ad-name").value = a ? a.recipient_name : (me ? me.name : "");
      af.querySelector("#ad-phone").value = a ? fmtPhone(a.recipient_phone) : (me ? fmtPhone(me.phone) : "");
      af.querySelector("#ad-zip").value = a ? a.zip : ""; af.querySelector("#ad-addr1").value = a ? a.address1 : ""; af.querySelector("#ad-addr2").value = a ? a.address2 : "";
      af.querySelector("#ad-default").checked = a ? a.is_default : false;
      af.querySelector("[data-addr-form-h]").textContent = a ? "배송지 고치기" : "새 배송지";
      af.querySelector("[data-addr-cancel]").hidden = !a;
    }
    page.querySelector("[data-addr-list]").addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      var id = +(b.getAttribute("data-addr-edit") || b.getAttribute("data-addr-default") || b.getAttribute("data-addr-del"));
      var a = addrs.filter(function (x) { return x.id === id; })[0]; if (!a) return;
      if (b.hasAttribute("data-addr-edit")) { editing = a; af.hidden = false; fillAddr(a); af.querySelector("#ad-name").focus(); return; }
      if (b.hasAttribute("data-addr-del") && !window.confirm((a.label || "배송지") + "를 지울까요?")) return;
      b.disabled = true;
      (b.hasAttribute("data-addr-del") ? acall("DELETE", "/api/v2/account/addresses/" + id)
        : acall("PATCH", "/api/v2/account/addresses/" + id, { is_default: true })).then(function () { if (editing && editing.id === id) { editing = null; fillAddr(null); } loadAddrs(); });
    });
    af.querySelector("[data-addr-cancel]").addEventListener("click", function () { editing = null; fillAddr(null); clearErrs(af); loadAddrs(); });
    af.addEventListener("submit", function (e) {
      e.preventDefault(); var btn = af.querySelector("[data-addr-save]"); if (btn.disabled) return; clearErrs(af);
      var g = function (id) { return af.querySelector("#" + id).value.trim(); };
      if (!check(af, [["ad-name", "받는 분 이름을 입력해 주세요.", g("ad-name")], ["ad-phone", "받는 분 휴대폰 번호를 정확히 입력해 주세요.", /^\d{10,11}$/.test(digits(g("ad-phone")))],
                      ["ad-zip", "우편번호를 입력해 주세요(우편번호 찾기).", g("ad-zip")], ["ad-addr1", "주소를 입력해 주세요.", g("ad-addr1")],
                      ["ad-addr2", "상세 주소를 입력해 주세요.", g("ad-addr2")]])) return;
      var body = { label: g("ad-label"), recipient_name: g("ad-name"), recipient_phone: g("ad-phone"), zip: g("ad-zip"), address1: g("ad-addr1"),
                   address2: g("ad-addr2"), is_default: af.querySelector("#ad-default").checked };
      busy(btn, true, "저장 중…");
      (editing ? acall("PATCH", "/api/v2/account/addresses/" + editing.id, body) : acall("POST", "/api/v2/account/addresses", body)).then(function (j) {
        busy(btn, false);
        if (!j.ok) { formErr(af, j.error || NET); return; }
        editing = null; fillAddr(null); loadAddrs();
      }, function () { busy(btn, false); formErr(af, NET); });
    });
    var zipBtn = af.querySelector("[data-zip-search]");
    zipBtn.addEventListener("click", function () {
      var go = function () {
        new window.daum.Postcode({ oncomplete: function (d) { af.querySelector("#ad-zip").value = d.zonecode; af.querySelector("#ad-addr1").value = d.roadAddress || d.jibunAddress; af.querySelector("#ad-addr2").focus(); } }).open();
      };
      if (window.daum && window.daum.Postcode) { go(); return; }
      var s = document.createElement("script"); s.src = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"; s.onload = go;
      s.onerror = function () { formErr(af, "우편번호 검색을 불러오지 못했습니다. 직접 입력해 주세요."); }; document.head.appendChild(s);
    });

    // 내 소속
    var defs = [], ff = page.querySelector("[data-aff-form]"), sel = ff.querySelector("#af-id");
    // [선택] 별도 체크 동의(개정 4-1 결정 3): 체크하지 않으면 «신고하기»가 꺼진다
    var afc = ff.querySelector("[data-af-consent]"), afb = ff.querySelector("[data-aff-submit]");
    function affReady() { afb.disabled = !afc.checked; }
    afc.addEventListener("change", affReady); affReady();
    function needs() {
      var d = defs.filter(function (x) { return x.id === sel.value; })[0] || { needs: [], description: "" };
      ff.querySelectorAll("[data-af-need]").forEach(function (box) { box.hidden = d.needs.indexOf(box.getAttribute("data-af-need")) < 0; });
      ff.querySelector("[data-af-desc]").textContent = d.description || "";
    }
    function loadAffs() {
      acall("GET", "/api/v2/affiliations").then(function (j) {
        defs = j.ok ? j.affiliations : []; sel.innerHTML = "";
        defs.forEach(function (d) { var o = document.createElement("option"); o.value = d.id; o.textContent = d.label; sel.appendChild(o); });
        needs();
      });
      mine();
    }
    function mine() {
      acall("GET", "/api/v2/account/affiliations").then(function (j) {
        if (!j.ok) return;
        var ul = page.querySelector("[data-aff-mine]"); ul.innerHTML = "";
        j.affiliations.forEach(function (a) {
          var li = document.createElement("li"); li.setAttribute("data-aff-id", a.id);
          var p = document.createElement("p"), t = document.createElement("b"), s = document.createElement("span");
          t.textContent = a.label; s.className = "my__badge" + (a.state === "active" ? "" : " my__badge--warn"); s.setAttribute("data-aff-state", ""); s.textContent = STATE[a.state] || a.state;
          p.appendChild(t); p.appendChild(document.createTextNode(" ")); p.appendChild(s); li.appendChild(p);
          var p2 = document.createElement("p"); p2.className = "muted";
          if (a.expires_at) { var ex = document.createElement("span"); ex.setAttribute("data-aff-exp", ""); ex.textContent = a.expires_at; p2.appendChild(ex); p2.appendChild(document.createTextNode("까지")); }
          else p2.textContent = "만료 없음";
          if (a.renew_due) p2.appendChild(document.createTextNode(" · 3월 31일까지 다시 신고해 주세요"));
          li.appendChild(p2);
          if (a.state === "revoked") { var p3 = document.createElement("p"); p3.textContent = "확인되지 않아 할인이 중지되었습니다. 문의: 고객센터"; li.appendChild(p3); }
          if (a.state === "expired") { var p4 = document.createElement("p"); p4.textContent = "만료되었습니다. 아래에서 다시 신고하시면 바로 적용됩니다."; li.appendChild(p4); }
          ul.appendChild(li);
        });
        page.querySelector("[data-aff-empty]").hidden = j.affiliations.length > 0;
      });
    }
    sel.addEventListener("change", needs);
    ff.addEventListener("submit", function (e) {
      e.preventDefault(); var btn = ff.querySelector("[data-aff-submit]"); if (btn.disabled || !afc.checked) return; clearErrs(ff);
      var d = defs.filter(function (x) { return x.id === sel.value; })[0]; if (!d) return;
      var sid = ff.querySelector("#af-sid").value.trim(), dept = ff.querySelector("#af-dept").value.trim();
      if (!check(ff, [["af-sid", "학번은 9자리 숫자로 입력해 주세요.", d.needs.indexOf("student_id") < 0 || /^\d{9}$/.test(sid)],
                      ["af-dept", "학과를 입력해 주세요.", d.needs.indexOf("department") < 0 || dept]])) return;
      busy(btn, true, "신고하는 중…");
      acall("POST", "/api/v2/account/affiliations", { affiliation: d.id, student_id: sid, department: dept, consent: afc.checked === true }).then(function (j) {
        busy(btn, false); affReady();
        if (!j.ok) { if (j.code === "student_id") setErr(ff, "af-sid", j.error); else if (j.code === "department") setErr(ff, "af-dept", j.error); else formErr(ff, j.error || NET); return; }
        afc.checked = false; affReady(); mine();
      }, function () { busy(btn, false); affReady(); formErr(ff, NET); });
    });

    // 회원정보
    var pf = page.querySelector("[data-pf-form]"), pmkt = pf.querySelector("#pf-mkt"), pnight = pf.querySelector("#pf-night");
    pmkt.addEventListener("change", function () { pnight.disabled = !pmkt.checked; if (!pmkt.checked) pnight.checked = false; });
    function loadProfile() {
      pf.querySelector("#pf-name").value = me.name; pf.querySelector("#pf-email").value = me.email || "";
      pmkt.checked = me.marketing_consent; pnight.checked = me.night_consent; pnight.disabled = !me.marketing_consent;
      page.querySelector("[data-pf-phone]").textContent = "(지금 " + fmtPhone(me.phone) + ")";
    }
    pf.addEventListener("submit", function (e) {
      e.preventDefault(); var btn = pf.querySelector("[data-pf-save]"); if (btn.disabled) return; clearErrs(pf); okMsg(pf, "");
      var name = pf.querySelector("#pf-name").value.trim(), email = pf.querySelector("#pf-email").value.trim();
      if (!check(pf, [["pf-name", "이름을 입력해 주세요.", name], ["pf-email", "이메일 주소를 확인해 주세요.", !email || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)]])) return;
      busy(btn, true, "저장 중…");
      acall("PATCH", "/api/v2/account", { name: name, email: email, marketing_consent: pmkt.checked, night_consent: pnight.checked }).then(function (j) {
        busy(btn, false);
        if (!j.ok) { if (j.code === "email") setErr(pf, "pf-email", j.error); else formErr(pf, j.error || NET); return; }
        me = j.account; paintHello(); okMsg(pf, "저장했습니다."); if (E.paintMember) E.paintMember({ name: me.name });
      }, function () { busy(btn, false); formErr(pf, NET); });
    });
    var phf = page.querySelector("[data-phone-form]"), pv = Verify(phf);
    phf.addEventListener("submit", function (e) {
      e.preventDefault(); var btn = phf.querySelector("[data-phone-save]"); if (btn.disabled) return; clearErrs(phf);
      if (!check(phf, [["pf-phone", "새 번호로 휴대폰 인증을 먼저 마쳐 주세요.", pv.token()]])) return;
      busy(btn, true, "바꾸는 중…");
      acall("PATCH", "/api/v2/account", { phone_token: pv.token() }).then(function (j) {
        busy(btn, false);
        if (!j.ok) { pv.reset(); setErr(phf, "pf-phone", j.error || NET); return; }
        me = j.account; pv.reset(); phf.querySelector("#pf-phone").value = "";
        page.querySelector("[data-pf-phone]").textContent = "(지금 " + fmtPhone(me.phone) + " — 바꿨습니다)";
      }, function () { busy(btn, false); formErr(phf, NET); });
    });
    var pwf = page.querySelector("[data-pw-form]");
    pwf.addEventListener("submit", function (e) {
      e.preventDefault(); var btn = pwf.querySelector("[data-pw-save]"); if (btn.disabled) return; clearErrs(pwf); okMsg(pwf, "");
      var cur = pwf.querySelector("#pf-cur").value, nw = pwf.querySelector("#pf-new").value, nw2 = pwf.querySelector("#pf-new2").value;
      if (!check(pwf, [["pf-cur", "현재 비밀번호를 입력해 주세요.", cur], ["pf-new", "새 비밀번호는 6자 이상으로 정해 주세요.", nw.length >= 6],
                       ["pf-new2", "새 비밀번호가 서로 다릅니다.", nw === nw2]])) return;
      busy(btn, true, "바꾸는 중…");
      acall("POST", "/api/v2/account/password", { current_password: cur, new_password: nw }).then(function (j) {
        busy(btn, false);
        if (!j.ok) { if (j.code === "password" && j._status === 401) setErr(pwf, "pf-cur", j.error); else formErr(pwf, j.error || NET); return; }
        pwf.reset(); okMsg(pwf, j.message);
      }, function () { busy(btn, false); formErr(pwf, NET); });
    });

    // 탈퇴
    var wf = page.querySelector("[data-wd-form]");
    function loadWithdraw() {
      acall("GET", "/api/account/withdraw-info").then(function (j) {
        if (!j.ok) return;
        page.querySelector("[data-wd-points]").textContent = won(j.points);
        page.querySelector("[data-wd-pend-n]").textContent = j.pending_orders; page.querySelector("[data-wd-pending]").hidden = !j.pending_orders;
        page.querySelector("[data-wd-rev-n]").textContent = j.reviews; page.querySelector("[data-wd-reviews]").hidden = !j.reviews;
      }, function () {});
    }
    wf.addEventListener("submit", function (e) {
      e.preventDefault(); var btn = wf.querySelector("[data-wd-submit]"); if (btn.disabled) return; clearErrs(wf);
      var pw = wf.querySelector("#wd-pw").value;
      if (!check(wf, [["wd-pw", "비밀번호를 입력해 주세요.", pw]])) return;
      if (!window.confirm("탈퇴하면 적립금이 소멸하고 되돌릴 수 없습니다. 탈퇴할까요?")) return;
      busy(btn, true, "처리 중…");
      acall("POST", "/api/v2/account/withdraw", { password: pw }).then(function (j) {
        busy(btn, false);
        if (!j.ok) { if (j.code === "password") setErr(wf, "wd-pw", j.error); else formErr(wf, j.error || NET); return; }
        E.clearMember && E.clearMember(); if (E.paintMember) E.paintMember(null);
        wf.hidden = true; page.querySelector("[data-wd-info]").hidden = true;
        var d = page.querySelector("[data-wd-done]"); d.hidden = false; d.focus();
        page.querySelector(".my__nav").hidden = true;
      }, function () { busy(btn, false); formErr(wf, NET); });
    });
  }

  /* ── 주문 조회(비회원) ── */
  function pageLookup(page) {
    var form = page.querySelector("[data-lookup-form]"), btn = form.querySelector("[data-lookup-submit]");
    var err = page.querySelector("[data-lookup-err]"), res = page.querySelector("[data-lookup-result]");
    if (E.member && E.member.ready) E.member.ready.then(function (me) {
      if (!me) return;
      var a = page.querySelector("[data-lookup-login]"); a.href = root() + "account/#orders"; a.textContent = "내 주문 보기";
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault(); if (btn.disabled) return; clearErrs(form); err.hidden = true;
      var no = form.querySelector("#lk-no").value.trim().toUpperCase(), ph = digits(form.querySelector("#lk-phone").value);
      if (!check(form, [["lk-no", "주문번호를 입력해 주세요.", no], ["lk-phone", "휴대폰 번호를 정확히 입력해 주세요.", /^\d{10,11}$/.test(ph)]])) return;
      busy(btn, true, "조회 중…");
      acall("POST", "/api/v2/orders/lookup", { order_no: no, phone: ph }).then(function (j) {
        busy(btn, false);
        if (!j.ok) { res.hidden = true; err.textContent = j.error || NET; err.hidden = false; return; }
        var o = j.order, q = function (s) { return res.querySelector(s); };
        q("[data-lk-no]").textContent = o.order_no; q("[data-lk-status]").textContent = o.status; q("[data-lk-date]").textContent = o.created_at;
        q("[data-lk-receive]").textContent = o.receive === "parcel" ? "택배 배송" : "영동 농장 직접 수령";
        var ul = q("[data-lk-items]"); ul.innerHTML = "";
        o.items.forEach(function (it) {
          var li = document.createElement("li"), a = document.createElement("span"), m = document.createElement("span"), w = document.createElement("b");
          a.textContent = it.product + " "; m.className = "muted"; m.textContent = it.option_label + " · " + it.count + "개"; a.appendChild(m);
          w.textContent = won(it.line_amount); li.appendChild(a); li.appendChild(w); ul.appendChild(li);
        });
        q("[data-lk-amount]").textContent = won(o.amount);
        res.hidden = false; res.focus();
      }, function () { busy(btn, false); err.textContent = NET; err.hidden = false; });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var page = document.querySelector("[data-acct]");
    if (!page) return;
    var kind = page.getAttribute("data-acct");
    if (kind === "mypage") { pageMy(page); if (API) initInputs(page); return; }
    if (!API) return;                       // 미리보기: 예시 화면만
    initInputs(page);
    ({ login: pageLogin, signup: pageSignup, find: pageFind, lookup: pageLookup })[kind](page);
  });
})();
