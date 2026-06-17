/* 영동에덴원 후기 위젯 (공용)
 * - 상세페이지(/products/xxx.html): URL 파일명에서 product_key 추출 → ?product= 로 그 제품 후기
 * - 홈(index.html 등): 전체 published 후기(최근순)
 * - 검수 통과(published) 후기만 표시, 0건이면 섹션 자체를 만들지 않음(숨김)
 * - 상세는 <footer> 앞, 홈은 #contact 앞에 자동 삽입
 * - 페이지에는 <script src="/reviews-widget.js" defer></script> 한 줄만 추가하면 됨
 */
(function () {
  var API = "https://api.yd-edenwon.com";
  var path = location.pathname;
  var isProduct = path.indexOf("/products/") !== -1;
  var productKey = isProduct ? path.split("/").pop().replace(/\.html$/, "") : "";
  var url = API + "/api/reviews" + (productKey ? ("?product=" + encodeURIComponent(productKey)) : "");

  function esc(s) { return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function stars(n) { n = n || 0; return "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n); }

  function injectStyle() {
    if (document.getElementById("edenwon-rv-style")) return;
    var css =
      ".rvw .rvw-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px;margin-top:10px;}"
      + ".rvw-card{background:#fff;border:1px solid var(--border,rgba(42,31,20,.1));border-radius:14px;padding:18px 18px 16px;text-align:left;}"
      + ".rvw-card .rvw-star{color:var(--amber,#B97B2D);letter-spacing:2px;font-size:1.05rem;}"
      + ".rvw-card .rvw-body{color:var(--ink,#2A1F14);margin:8px 0 8px;line-height:1.65;white-space:pre-wrap;}"
      + ".rvw-card .rvw-who{font-size:.82rem;color:#8a7a64;}"
      + ".rvw-card .rvw-buy{color:#a99a86;}"
      + ".rvw-card .rvw-reply{background:rgba(139,111,71,.08);border-radius:8px;padding:9px 11px;margin-top:10px;font-size:.88rem;color:#6d5d49;}"
      + ".rvw-note{font-size:.78rem;color:#9a8d78;margin-top:20px;}";
    var st = document.createElement("style");
    st.id = "edenwon-rv-style";
    st.textContent = css;
    document.head.appendChild(st);
  }

  function cardHTML(v) {
    var reply = v.reply ? '<div class="rvw-reply">' + esc(v.reply) + "</div>" : "";
    var who = esc(v.author_name || "");
    if (v.products) who += ' <span class="rvw-buy">· ' + esc(v.products.split(",").join(", ")) + "</span>";
    return '<div class="rvw-card">'
      + '<div class="rvw-star">' + stars(v.rating) + "</div>"
      + '<div class="rvw-body">' + esc(v.body || "") + "</div>"
      + '<div class="rvw-who">' + who + "</div>"
      + reply + "</div>";
  }

  function build(reviews) {
    var sec = document.createElement("section");
    sec.className = "rvw";
    sec.id = "reviews";
    sec.innerHTML =
      '<div class="container">'
      + '<div class="section-label">Reviews</div>'
      + '<h2 class="section-title">먼저 맛보신 분들</h2>'
      + '<div class="rvw-grid">' + reviews.map(cardHTML).join("") + "</div>"
      + '<p class="rvw-note">후기 작성 고객께는 결제액의 1%를 적립금으로 드립니다.</p>'
      + "</div>";
    return sec;
  }

  function place(sec) {
    var anchor = document.querySelector("#contact, section.contact");
    if (anchor && anchor.parentNode) { anchor.parentNode.insertBefore(sec, anchor); return; }
    var footer = document.querySelector("footer");
    if (footer && footer.parentNode) { footer.parentNode.insertBefore(sec, footer); return; }
    document.body.appendChild(sec);
  }

  function run() {
    fetch(url).then(function (r) { return r.json(); }).then(function (d) {
      if (!d || !d.ok || !d.reviews || !d.reviews.length) return;  // 0건 → 섹션 미생성(숨김)
      injectStyle();
      place(build(d.reviews));
    }).catch(function () {});
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
})();
