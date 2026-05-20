#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""영동에덴원 단일 제품 상세 페이지 일괄 생성기

- 발효 제품(된장·고추장·어간장): "콩에서 장까지" 공정 여정 표시
- 그 외 제품: 대표 공정 사진 스트립 표시
- 모든 페이지는 style.css를 인라인으로 내장 (단독 실행 가능)
  실행: python3 generate_pages.py
"""

import os

OUT_DIR = "products"
KAKAO = "http://pf.kakao.com/_yaKxlX"

# 된장·고추장·어간장이 공유하는 "콩에서 장까지" 공정 여정
JOURNEY = [
    ("bean-selection.jpg", "콩 선별"),
    ("meju-boiling.jpg",   "콩 삶기"),
    ("meju-shaping.jpg",   "메주 빚기"),
    ("meju-drying.jpg",    "바람치기"),
    ("meju-room-mid.jpg",  "발효실 숙성"),
    ("meju-pot-brine.jpg", "옹기 입항"),
]

PRODUCTS = [
    {
        "slug": "doenjang",
        "eyebrow": "Aged Soybean Paste",
        "title": "옹기숙성 된장",
        "tagline": "직접 농사 지은 콩으로 띄운 메주와 천일염,<br />옹기 안에서 2년 이상 익혀낸 깊은 맛.",
        "hero": "product-doenjang.jpg",
        "story_title": "콩 한 알에서 시작하는 2년",
        "story": [
            "직접 농사 지은 콩으로 메주를 띄우고,<br />국내산 천일염으로 옹기 안에서 복합 발효·숙성합니다.",
            "2년 이상 서두르지 않은 시간이<br />된장의 깊이를 만듭니다.",
        ],
        "process_title": "콩에서 장까지",
        "journey": JOURNEY,
        "uses": [
            "구수한 된장찌개·된장국의 기본으로",
            "쌈장·강된장의 베이스로",
            "나물 무침 등 다양한 요리에",
        ],
        "cta_title": "옹기가 익힌 된장,<br />직접 만나보세요",
    },
    {
        "slug": "gochujang",
        "eyebrow": "Aged Red Pepper Paste",
        "title": "옹기숙성 고추장",
        "tagline": "직접 만든 엿기름과 메주 가루, 표고 가루를 더해<br />옹기 안에서 1년 이상 익혀낸 고추장.",
        "hero": "product-gochujang.jpg",
        "story_title": "손이 많이 가는 진짜 고추장",
        "story": [
            "직접 만든 엿기름 당화액, 메주 가루,<br />찰개떡 가루, 표고 가루를 정성껏 혼합합니다.",
            "옹기 안에서 1년 이상 복합 발효·숙성하는<br />그 손길이 고추장의 깊은 맛을 만듭니다.",
        ],
        "process_title": "콩에서 장까지",
        "journey": JOURNEY,
        "uses": [
            "비빔밥·비빔국수의 감칠맛으로",
            "볶음·찌개 양념으로",
            "초고추장·쌈장 등으로",
        ],
        "cta_title": "옹기가 익힌 고추장,<br />직접 만나보세요",
    },
    {
        "slug": "eoganjang",
        "eyebrow": "Aged Fish Soy Sauce",
        "title": "옹기숙성 어간장",
        "tagline": "3년 숙성 액젓과 2년 숙성 간장을 혼합해<br />다시 익혀낸 감칠맛 깊은 어간장.",
        "hero": "product-eoganjang.jpg",
        "story_title": "시간 위에 시간을 더하다",
        "story": [
            "3년 숙성한 대멸 액젓과<br />2년 숙성한 간장을 혼합합니다.",
            "다시 2년 이상 숙성시킨<br />시간 위의 시간이 어간장의 깊이입니다.",
        ],
        "process_title": "콩에서 장까지",
        "journey": JOURNEY,
        "uses": [
            "무침·조림에 감칠맛 더하기",
            "국·찌개의 간 맞추기",
            "나물·볶음 요리에",
        ],
        "cta_title": "옹기가 익힌 어간장,<br />직접 만나보세요",
    },
    {
        "slug": "cheonggukjang",
        "eyebrow": "Fermented Soybean",
        "title": "옹기발효 청국장",
        "tagline": "직접 농사 지은 콩을 옹기단지에서<br />냄새 없이 정성껏 띄운 청국장.",
        "hero": "product-cheonggukjang.jpg",
        "story_title": "옹기단지가 만든 깔끔한 청국장",
        "story": [
            "직접 농사 지은 콩을<br />옹기단지에서 최적의 환경으로 띄웁니다.",
            "옹기가 숨 쉬며 만들어내는 환경 덕분에<br />거부감 없이 깔끔하게 발효됩니다.",
        ],
        "process_title": "콩을 띄우는 시간",
        # 청국장 전용 공정 사진이 준비되면 photos 교체
        "photos": ["bean-selection.jpg", "meju-boiling.jpg"],
        "photo_caption": "직접 농사 지은 콩을 선별하고 삶는 과정",
        "uses": [
            "청국장찌개의 깊은 맛으로",
            "따뜻한 밥에 비벼서",
            "건강한 한 끼 반찬으로",
        ],
        "cta_title": "옹기가 띄운 청국장,<br />직접 만나보세요",
    },
    {
        "slug": "bibim-doenjang",
        "eyebrow": "Seasoned Soybean Paste",
        "title": "옹기숙성 비빔된장",
        "tagline": "밥에 비벼도, 쌈장으로도 좋은<br />누구나 맛있게 즐기는 비빔된장.",
        "hero": "product-bibim-doenjang.jpg",
        "story_title": "누구나 좋아하는 밥도둑",
        "story": [
            "옹기에서 익힌 된장에 정성을 더했습니다.",
            "따뜻한 밥에 비벼도, 채소에 쌈장으로 곁들여도 좋은<br />누구나 맛있게 즐기는 비빔된장입니다.",
        ],
        "process_title": "정성이 담기는 시간",
        "photos": ["process-bibim-1.jpg", "process-bibim-2.jpg"],
        "photo_caption": "옹기에서 익힌 장에 정성을 더하는 과정",
        "uses": [
            "따뜻한 밥에 쓱쓱 비벼서",
            "상추·깻잎 등 쌈채소에 곁들여",
            "간편한 한 끼 반찬으로",
        ],
        "cta_title": "누구나 맛있는 비빔된장,<br />직접 만나보세요",
    },
    {
        "slug": "bibim-gochujang",
        "eyebrow": "Seasoned Red Pepper Paste",
        "title": "옹기숙성 비빔고추장",
        "tagline": "밥에 비벼도, 쌈장으로도 좋은<br />누구나 맛있게 즐기는 비빔고추장.",
        "hero": "product-bibim-gochujang.jpg",
        "story_title": "누구나 좋아하는 밥도둑",
        "story": [
            "옹기에서 익힌 고추장에 정성을 더했습니다.",
            "따뜻한 밥에 비벼도, 채소에 쌈장으로 곁들여도 좋은<br />누구나 맛있게 즐기는 비빔고추장입니다.",
        ],
        "process_title": "정성이 담기는 시간",
        "photos": ["process-bibim-1.jpg", "process-bibim-2.jpg"],
        "photo_caption": "옹기에서 익힌 장에 정성을 더하는 과정",
        "uses": [
            "따뜻한 밥에 쓱쓱 비벼서",
            "상추·깻잎 등 쌈채소에 곁들여",
            "간편한 한 끼 반찬으로",
        ],
        "cta_title": "누구나 맛있는 비빔고추장,<br />직접 만나보세요",
    },
    {
        "slug": "jam",
        "eyebrow": "Real Jam",
        "title": "진짜'S 잼",
        "tagline": "젤라틴도 펙틴도 없이, 원물만으로<br />무쇠가마솥에서 천천히 달여낸 잼.",
        "hero": "product-jam.jpg",
        "story_title": "원물만으로 정직하게",
        "story": [
            "젤라틴·펙틴 같은 식품첨가물을 넣지 않습니다.",
            "오직 원물만으로 풍미를 끌어올리기 위해<br />무쇠가마솥에서 3시간 이상 천천히 달여냅니다.",
        ],
        "process_title": "무쇠가마솥의 시간",
        "photos": ["process-cauldron-1.jpg", "process-cauldron-2.jpg"],
        "photo_caption": "무쇠가마솥에서 천천히 달이는 과정",
        "uses": [
            "갓 구운 빵·토스트에",
            "요거트·치즈와 곁들여",
            "따뜻한 차에 더해서",
        ],
        "cta_title": "정직하게 달여낸 잼,<br />직접 만나보세요",
    },
    {
        "slug": "jocheong",
        "eyebrow": "Real Rice Syrup",
        "title": "진짜'S 조청",
        "tagline": "직접 만든 엿기름과 농산물로<br />무쇠가마솥에서 6시간 이상 달여낸 조청.",
        "hero": "product-jocheong.jpg",
        "story_title": "엿기름부터 직접",
        "story": [
            "조청의 시작인 엿기름부터 직접 만듭니다.",
            "직접 농사 지은 다양한 농산물을 더해<br />무쇠가마솥에서 6시간 이상 정성껏 달여냅니다.",
        ],
        "process_title": "무쇠가마솥의 시간",
        "photos": ["process-cauldron-1.jpg", "process-cauldron-2.jpg"],
        "photo_caption": "무쇠가마솥에서 천천히 달이는 과정",
        "uses": [
            "떡·한과에 곁들여",
            "요리의 자연스러운 단맛으로",
            "따뜻한 차나 음료에",
        ],
        "cta_title": "정직하게 달여낸 조청,<br />직접 만나보세요",
    },
]

TEMPLATE = """<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title} — 영동에덴원</title>
  <meta name="description" content="{meta_desc}" />

  <meta property="og:title" content="{title} — 영동에덴원" />
  <meta property="og:description" content="{meta_desc}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://yd-edenwon.com/products/{slug}.html" />
  <meta property="og:image" content="https://yd-edenwon.com/images/{hero}" />
  <meta property="og:locale" content="ko_KR" />

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&family=Gowun+Batang:wght@400;700&family=Noto+Sans+KR:wght@300;400;500;700&display=swap" rel="stylesheet" />

__STYLE_BLOCK__
</head>
<body>

  <!-- ============ NAV ============ -->
  <nav class="detail-nav">
    <div class="detail-nav__inner">
      <a href="../index.html" class="detail-nav__back">← 영동에덴원</a>
      <span class="detail-nav__brand">Yeongdong Edenwon</span>
    </div>
  </nav>


  <!-- ============ DETAIL HERO ============ -->
  <header class="detail-hero">
    <div class="detail-hero__inner">
      <div class="detail-hero__eyebrow">{eyebrow}</div>
      <h1 class="detail-hero__title">{title}</h1>
      <p class="detail-hero__tagline">{tagline}</p>
    </div>
    <div class="detail-hero__image">
      <img src="../images/{hero}" alt="영동에덴원 {title}" />
    </div>
  </header>


  <!-- ============ STORY ============ -->
  <section class="detail-section">
    <div class="detail-section__inner">
      <div class="detail-section__label">Story</div>
      <h2 class="detail-section__title">{story_title}</h2>
      <div class="detail-section__body">
{story_paragraphs}
      </div>
    </div>
  </section>


  <!-- ============ PROCESS ============ -->
__PROCESS_SECTION__


  <!-- ============ 활용법 ============ -->
  <section class="detail-section">
    <div class="detail-section__inner">
      <div class="detail-section__label">How to Enjoy</div>
      <h2 class="detail-section__title">이렇게 즐기세요</h2>

      <div class="detail-uses">
{use_items}
      </div>
    </div>
  </section>


  <!-- ============ CTA ============ -->
  <section class="detail-cta">
    <h2 class="detail-cta__title">{cta_title}</h2>
    <p class="detail-cta__sub">
      가격 및 구매 안내는 카카오톡 채널로 문의해 주세요.
    </p>
    <div class="detail-cta__buttons">
      <a href="{kakao}" target="_blank" rel="noopener" class="btn btn--kakao" style="min-width:220px;">💬&nbsp;&nbsp;카카오톡 문의</a>
      <a href="../index.html#products" class="btn btn--ghost" style="border-color:rgba(244,237,224,0.5);">다른 제품 보기</a>
    </div>
  </section>


  <!-- ============ FOOTER ============ -->
  <footer>
    <div class="footer__mark">영동에덴원</div>
    <div class="footer__legal">
      (주)농업회사법인 에프엔엘바이오푸드 &nbsp;|&nbsp; 대표 길우관<br />
      사업자등록번호 550-87-01994 &nbsp;|&nbsp; 통신판매업 신고 2021-충북영동-0123<br />
      충북 영동군 학산면 모리2길 3-2 &nbsp;|&nbsp; 010-5126-7578<br />
      <span style="opacity: 0.5;">ⓒ 2026 영동에덴원 · All rights reserved.</span>
    </div>
  </footer>

</body>
</html>
"""


def build_journey_section(title, journey):
    """공정 여정 섹션 HTML 생성"""
    stages = []
    for i, (img, label) in enumerate(journey, 1):
        stages.append(
            '        <div class="process-journey__stage">\n'
            f'          <div class="process-journey__img"><img src="../images/{img}" '
            f'alt="{label}" loading="lazy" /></div>\n'
            f'          <p class="process-journey__label">'
            f'<span class="process-journey__num">{i:02d}</span> {label}</p>\n'
            '        </div>'
        )
    return (
        '  <section class="detail-section detail-section--alt">\n'
        '    <div class="detail-section__inner">\n'
        '      <div class="detail-section__label">Process</div>\n'
        f'      <h2 class="detail-section__title">{title}</h2>\n\n'
        '      <div class="process-journey">\n'
        + "\n".join(stages) + "\n"
        '      </div>\n'
        '    </div>\n'
        '  </section>'
    )


def build_photos_section(title, photos, caption):
    """대표 공정 사진 스트립 섹션 HTML 생성"""
    items = "\n".join(
        f'        <div class="detail-photos__item"><img src="../images/{img}" '
        f'alt="공정 사진" loading="lazy" /></div>'
        for img in photos
    )
    return (
        '  <section class="detail-section detail-section--alt">\n'
        '    <div class="detail-section__inner">\n'
        '      <div class="detail-section__label">Process</div>\n'
        f'      <h2 class="detail-section__title">{title}</h2>\n\n'
        '      <div class="detail-photos">\n'
        + items + "\n"
        '      </div>\n'
        f'      <p class="detail-photos__caption">{caption}</p>\n'
        '    </div>\n'
        '  </section>'
    )


def build():
    with open("style.css", encoding="utf-8") as f:
        css = f.read()
    style_block = "  <style>\n" + css + "\n  </style>"

    for p in PRODUCTS:
        story_paragraphs = "\n".join(
            f"        <p>{s}</p>" for s in p["story"]
        )
        use_items = "\n".join(
            '        <div class="detail-uses__item">\n'
            '          <span class="detail-uses__bullet">●</span>\n'
            f'          <span class="detail-uses__text">{u}</span>\n'
            '        </div>'
            for u in p["uses"]
        )
        if "journey" in p:
            process_section = build_journey_section(p["process_title"], p["journey"])
        else:
            process_section = build_photos_section(
                p["process_title"], p["photos"], p["photo_caption"]
            )
        meta_desc = (
            p["tagline"].replace("<br />", " ").replace("<br>", " ")
            + " — 영동에덴원"
        )
        html = TEMPLATE.format(
            title=p["title"],
            slug=p["slug"],
            eyebrow=p["eyebrow"],
            tagline=p["tagline"],
            hero=p["hero"],
            story_title=p["story_title"],
            story_paragraphs=story_paragraphs,
            use_items=use_items,
            cta_title=p["cta_title"],
            meta_desc=meta_desc,
            kakao=KAKAO,
        )
        html = html.replace("__STYLE_BLOCK__", style_block)
        html = html.replace("__PROCESS_SECTION__", process_section)
        path = os.path.join(OUT_DIR, f"{p['slug']}.html")
        with open(path, "w", encoding="utf-8") as f:
            f.write(html)
        kind = "공정 여정" if "journey" in p else "사진 스트립"
        print(f"생성: {path}  ({kind})")


if __name__ == "__main__":
    build()
    print(f"\n총 {len(PRODUCTS)}개 상세 페이지 생성 완료")
