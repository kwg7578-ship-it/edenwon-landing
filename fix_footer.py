#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
영동에덴원 footer / 사업자정보 일괄 정정 스크립트
=====================================================
사업자등록증 기준으로 사이트 전체를 바로잡습니다.

  1) 상호  : (주)농업회사법인 에프엔엘바이오푸드  →  농업회사법인 주식회사 에프엔엘바이오푸드
  2) 주소  : 충북 … 모리2길 3-2                  →  충청북도 … 모리2길 3-1
  3) footer: 전 공개 페이지에 동일한 표준 footer 적용
             - 루트 페이지와 products/ 페이지의 링크 경로(../) 자동 처리
             - giftset.html 처럼 footer 없는 페이지는 footer 새로 삽입
             - order-admin.html(관리자 전용)은 제외

사용법 (반드시 저장소 루트 = index.html 있는 폴더에서 실행):
    python3 fix_footer.py            # dry-run : 무엇이 바뀌는지 미리보기만 (파일 안 건드림)
    python3 fix_footer.py --apply    # 실제 적용

적용 후 권장 절차:
    git diff            # 바뀐 내용 직접 확인
    (회귀 게이트 16/16 통과 확인)
    git add <바뀐 파일들>   # 명시적으로 지정 (git add -A 금지)
    git commit -m "fix: 사업자등록증 기준 상호·주소 정정 + footer 전 페이지 통일"
    # 커밋 후 Cloudflare Purge Cache
"""

import re
import sys
import pathlib

APPLY = "--apply" in sys.argv
ROOT = pathlib.Path(".")
EXCLUDE = {"order-admin.html"}  # 관리자 전용, footer 불필요

# ── 1) 전역 텍스트 정정 (위치 무관, 순수 문자열 치환) ──────────────
TEXT_FIXES = [
    ("(주)농업회사법인 에프엔엘바이오푸드", "농업회사법인 주식회사 에프엔엘바이오푸드"),
    ("모리2길 3-2", "모리2길 3-1"),
    ("충북 영동군 학산면", "충청북도 영동군 학산면"),
]

# ── 2) 표준 footer (prefix = "" 또는 "../") ─────────────────────────
def footer_html(prefix):
    return (
        '<footer>\n'
        '    <div class="footer__brand">\n'
        f'      <img src="{prefix}images/logo-symbol-white.png" alt="" class="footer__symbol" />\n'
        '      <div class="footer__mark">영동에덴원</div>\n'
        '    </div>\n'
        '    <div class="footer__legal">\n'
        '      농업회사법인 주식회사 에프엔엘바이오푸드 <span class="footer__sep">|</span> 대표 길우관<br />\n'
        '      사업자등록번호 550-87-01994 <span class="footer__sep">|</span> 통신판매업 2021-충북영동-0123<br />\n'
        '      충청북도 영동군 학산면 모리2길 3-1<br />\n'
        '      010-5126-7578 <span class="footer__sep">|</span> kwg7978@naver.com<br />\n'
        f'      <a href="{prefix}terms.html">이용약관</a> <span class="footer__sep">|</span>\n'
        f'      <a href="{prefix}privacy.html">개인정보처리방침</a> <span class="footer__sep">|</span>\n'
        f'      <a href="{prefix}refund.html">교환·반품·환불 안내</a><br />\n'
        '      <span style="opacity:0.5;">ⓒ 2026 영동에덴원 · All rights reserved.</span>\n'
        '    </div>\n'
        '  </footer>'
    )

# giftset 처럼 footer CSS가 없는 페이지용 (변수 의존 없이 하드코딩, .edenwon-footer로 스코프)
GIFTSET_FOOTER_STYLE = (
    '<style>\n'
    '.edenwon-footer{background:#2A1F14;color:rgba(244,237,224,0.5);padding:2.8rem 1.5rem;'
    'text-align:center;font-size:0.8rem;line-height:2;border-top:1px solid rgba(244,237,224,0.08);}\n'
    '.edenwon-footer .footer__brand{display:flex;flex-direction:column;align-items:center;gap:0.5rem;margin-bottom:1.1rem;}\n'
    '.edenwon-footer .footer__symbol{height:36px;width:auto;opacity:0.92;}\n'
    '.edenwon-footer .footer__mark{font-family:"Gowun Batang",serif;color:rgba(244,237,224,0.78);letter-spacing:0.06em;font-size:0.98rem;}\n'
    '.edenwon-footer .footer__legal{font-size:0.75rem;letter-spacing:0.02em;}\n'
    '.edenwon-footer .footer__legal a{color:inherit;opacity:0.7;text-decoration:none;border-bottom:1px solid rgba(244,237,224,0.2);}\n'
    '.edenwon-footer .footer__legal a:hover{opacity:1;}\n'
    '.edenwon-footer .footer__sep{opacity:0.35;}\n'
    '</style>'
)

def giftset_footer_html():
    # giftset.html 은 루트 → prefix 없음, class만 .edenwon-footer 로 다르게
    return footer_html("").replace("<footer>", '<footer class="edenwon-footer">', 1)

FOOTER_RE = re.compile(r"<footer\b.*?</footer>", re.DOTALL)


def collect_files():
    files = sorted(ROOT.glob("*.html"))
    products = ROOT / "products"
    if products.is_dir():
        files += sorted(products.glob("*.html"))
    return [f for f in files if f.name not in EXCLUDE]


def process(path):
    """파일 1개 처리. (수정된 텍스트, 변경요약리스트) 반환. 변경 없으면 (원본, [])."""
    original = path.read_text(encoding="utf-8")
    text = original
    changes = []

    # 1) 전역 텍스트 정정
    for old, new in TEXT_FIXES:
        n = text.count(old)
        if n:
            text = text.replace(old, new)
            changes.append(f"텍스트 '{old[:14]}…' {n}건 정정")

    # 2) footer
    prefix = "../" if path.parent.name == "products" else ""
    if path.name == "giftset.html":
        # giftset 은 footer CSS가 없어 자체 스타일(.edenwon-footer) footer 사용
        if "edenwon-footer{" not in text and "</head>" in text:
            text = text.replace("</head>", GIFTSET_FOOTER_STYLE + "\n</head>", 1)
            changes.append("footer 전용 스타일 주입")
        gf = giftset_footer_html()
        if FOOTER_RE.search(text):
            new_text = FOOTER_RE.sub(lambda m: gf, text, count=1)
            if new_text != text:
                text = new_text
                changes.append("footer 교체 (edenwon-footer)")
        elif "</body>" in text:
            text = text.replace("</body>", "  " + gf + "\n</body>", 1)
            changes.append("footer 신규 삽입")
        else:
            changes.append("⚠ </body> 못 찾음 → 수동 확인 필요")
    elif FOOTER_RE.search(text):
        new_text = FOOTER_RE.sub(lambda m: footer_html(prefix), text, count=1)
        if new_text != text:
            text = new_text
            changes.append(f"footer 교체 (경로 prefix='{prefix or '없음'}')")
    else:
        changes.append("footer 없음 → 건너뜀 (확인 필요할 수 있음)")

    return text, changes


def main():
    files = collect_files()
    print(f"{'[적용 모드]' if APPLY else '[DRY-RUN — 미리보기만]'}  대상 파일 {len(files)}개 "
          f"(order-admin.html 제외)\n" + "=" * 60)
    touched = []
    for f in files:
        new_text, changes = process(f)
        real_changes = [c for c in changes if "건너뜀" not in c and "없음 →" not in c]
        if real_changes:
            loc = "products/" if f.parent.name == "products" else "root"
            print(f"\n● {f.name}  [{loc}]")
            for c in changes:
                print(f"    - {c}")
            if APPLY:
                f.write_text(new_text, encoding="utf-8")
            touched.append(f)
    print("\n" + "=" * 60)
    if APPLY:
        print(f"✅ {len(touched)}개 파일 수정 완료. 이제 `git diff` 로 확인하세요.")
    else:
        print(f"※ DRY-RUN 결과: {len(touched)}개 파일이 바뀔 예정입니다.")
        print("  실제 적용하려면:  python3 fix_footer.py --apply")
    # 변경 없는 파일도 보고
    untouched = [f.name for f in files if f not in touched]
    if untouched:
        print(f"\n변경 없음 ({len(untouched)}): {', '.join(untouched)}")


if __name__ == "__main__":
    main()
