# 영동에덴원 홈페이지 — 배포 가이드

## 📁 파일 구조

```
edenwon-landing/
├── index.html              ← 메인 랜딩 (CSS 내장 — 단독으로 열어도 디자인 완전)
├── products/               ← 제품 상세 페이지 9개 (모두 CSS 내장)
│   ├── vinegar.html         (발효의 초심 — 식초 22종)
│   ├── doenjang.html        (옹기숙성 된장)
│   ├── gochujang.html       (옹기숙성 고추장)
│   ├── eoganjang.html       (옹기숙성 어간장)
│   ├── cheonggukjang.html   (옹기발효 청국장)
│   ├── bibim-doenjang.html  (옹기숙성 비빔된장)
│   ├── bibim-gochujang.html (옹기숙성 비빔고추장)
│   ├── jam.html             (진짜'S 잼)
│   └── jocheong.html        (진짜'S 조청)
├── style.css               ← 디자인 소스 (수정용 — 아래 설명 참고)
├── apply_css.py            ← style.css를 모든 HTML에 동기화하는 스크립트
├── generate_pages.py       ← 단일 제품 상세 페이지 일괄 생성 스크립트
├── README.md               ← 이 파일
└── images/                 ← 이미지 폴더 (직접 추가 필요)
```

> **중요**: 모든 HTML 파일은 CSS가 내부에 내장되어 있어, 파일 하나만 열어도 디자인이 완전하게 보입니다. `style.css`는 디자인을 한곳에서 수정하기 위한 소스 파일입니다.

## 🖼️ 이미지 현황

### ✅ 완료 — 이미 포함된 이미지 (36장)

`images/` 폴더에 다음이 이미 들어가 있습니다:
- **메주 공정 사진 15장** — 된장·고추장·어간장 "콩에서 장까지" 여정 + 메인 갤러리
- **식초 공정 사진 14장** — 식초 상세 페이지
- **제품 패키지 사진 7장** — 배경을 사이트 톤(#F4EDE0)으로 통일 처리해 9개 제품 카드 중 7개에 연결
- **봄 사진** — 사계절 갤러리 봄 칸 (봄 농지 사진 3장 여분 보관)
- **여름 사진** — 사계절 갤러리 여름 칸 (여름 농지 사진 15장 여분 보관)
- **가을 사진** — 사계절 갤러리 가을 칸 (가을 농지 사진 10장 여분 보관)
- **겨울 사진** — Hero 배경(눈 옹기) + 사계절 겨울 칸 (겨울 사진 4장 여분 보관)

### ⬜ 추가로 필요한 이미지 (7개)

아직 `images/` 폴더에 없는 이미지입니다.

**제품 패키지 사진 2개** — 비빔장 (배경은 #F4EDE0 으로 통일 권장)
| 파일명 | 제품 |
|---|---|
| `product-bibim-doenjang.jpg` | 옹기숙성 비빔된장 |
| `product-bibim-gochujang.jpg` | 옹기숙성 비빔고추장 |

**공정 사진 6개** — (식초·잼·조청·비빔장 — 별도 전달 예정)
| 파일명 | 용도 |
|---|---|
| `vinegar-process-1.jpg` | 식초 공정 1 |
| `vinegar-process-2.jpg` | 식초 공정 2 |
| `vinegar-process-3.jpg` | 식초 공정 3 |
| `process-cauldron-1.jpg` | 무쇠가마솥 공정 (잼·조청 공용) |
| `process-cauldron-2.jpg` | 무쇠가마솥 공정 (잼·조청 공용) |
| `process-bibim-1.jpg` | 비빔장 공정 (비빔된장·비빔고추장 공용) |

**선택 1개**
| 파일명 | 용도 |
|---|---|
| `map-placeholder.jpg` | 지도 미리보기 (없어도 지도 링크는 작동) |

> **참고**: 비빔장 공정 사진은 `process-bibim-1.jpg` 하나만 있어도 됩니다 (현재 비빔장 페이지는 2장 슬롯이지만, 같은 사진을 재사용하거나 1장만 넣어도 무방).

### 메주 공정 사진 15장 목록 (참고용 — 이미 포함됨)

bean-selection / meju-boiling / meju-shaping / meju-shaping-closeup /
meju-drying / meju-drying-closeup / meju-room-early / meju-room-earlymid /
meju-room-mid / meju-room-side / meju-room-single / meju-inside /
meju-pot-entry / meju-pot-brine / meju-pot-brine-sunlit

### 권장 사이즈
- **Hero**: 1920 × 1280px
- **제품 사진**: 800 × 600px (4:3)
- **사계절 그리드**: 600 × 800px (3:4 세로)
- **공정 사진**: 800 × 600px (4:3)
- **모든 이미지**: JPEG, 250KB 이하 ([TinyPNG](https://tinypng.com/)로 압축)

## ✏️ 콘텐츠 수정이 필요한 부분

상세 페이지는 박람회 브로슈어 내용을 기반으로 1차 작성했습니다. 아래는 검토·수정 권장:

### 식초 상세 (`products/vinegar.html`)
- **Lineup 섹션**: 식초 22종이 프리미엄·산야초·과실 3분류로 들어가 있음. 종류 추가·삭제 시 `<span class="variety-tag">` 줄을 복제·삭제.

### 비빔된장·비빔고추장 상세
- 제공된 정보가 한 줄 설명뿐이라 Story 내용이 간략합니다. 더 풍부한 내용이 있으면 보강 권장.

### 모든 상세 페이지의 활용법
- 일반적인 활용 예시로 작성했습니다. 영동에덴원만의 추천 활용법이 있으면 교체하세요.

### 일괄 수정 방법

**제품 내용 수정**: `generate_pages.py` 안의 `PRODUCTS` 데이터를 수정한 뒤 `python3 generate_pages.py` 실행 → 8개 단일 제품 상세 페이지가 한 번에 재생성됩니다. (식초 페이지 `vinegar.html`은 별도 — 직접 수정)

**디자인(색상·폰트 등) 수정**: `style.css`를 수정한 뒤 `python3 apply_css.py` 실행 → index.html과 9개 상세 페이지 전체에 일괄 반영됩니다. (HTML 파일에 CSS가 내장되어 있으므로, 이 동기화 과정이 필요합니다)

---

## 🚀 Cloudflare Pages 배포

### 방법 A: 드래그&드롭 (가장 빠름)

1. Cloudflare 대시보드 → **Workers & Pages** → **Create application** → **Pages** → **Upload assets**
2. 프로젝트 이름: `edenwon-landing`
3. `edenwon-landing` 폴더 전체를 드래그&드롭
4. **Deploy site** 클릭

### 방법 B: GitHub 연동 (장기 추천)

1. GitHub에 저장소 생성 후 폴더 push
   ```bash
   cd edenwon-landing
   git init
   git add .
   git commit -m "영동에덴원 홈페이지"
   git remote add origin https://github.com/Edenwon/edenwon-landing.git
   git push -u origin main
   ```
2. Cloudflare → **Pages** → **Connect to Git** → 저장소 선택
3. 빌드 설정: Build command 비워둠 / Build output directory `/`
4. **Save and Deploy** → 이후 `git push`마다 자동 재배포

---

## 🌐 도메인 연결 (yd-edenwon.com)

1. Cloudflare Pages 프로젝트 → **Custom domains** → **Set up a custom domain**
2. `yd-edenwon.com` 입력 → **Continue**
3. DNS 레코드 자동 추가 + SSL 자동 발급
4. `www.yd-edenwon.com`도 같은 방식으로 추가 권장

---

## 📱 QR 코드 생성

박람회용 QR은 추적 파라미터를 붙이면 유입 측정 가능:
```
https://yd-edenwon.com/?src=expo2026
```
- 생성: [QR Code Monkey](https://www.qrcode-monkey.com/)
- 오류 보정 **H (30%)**, 1000×1000px 이상
- 인쇄 전 반드시 본인 핸드폰으로 스캔 테스트

---

## ✅ 박람회 전 체크리스트

- [ ] 이미지 25개 추가
- [ ] 비빔장 상세 페이지 내용 보강
- [ ] 카카오톡 채널 URL 작동 확인 (모든 페이지)
- [ ] 메인 → 상세 페이지 "자세히 보기" 링크 작동 확인 (9개)
- [ ] 상세 → 메인 "← 영동에덴원" 링크 확인
- [ ] 모바일·PC 검증
- [ ] QR 코드 스캔 테스트
- [ ] 브로슈어 QR을 `yd-edenwon.com`으로 갱신 후 인쇄 발주

---

## 🔧 향후 확장 (박람회 후)

- 갤러리 페이지 (더 많은 농사·발효 사진)
- 문의 폼 (Formspree·Tally)
- 공지사항 게시판
- AI 챗봇 (라즈베리파이 RAG + Cloudflare Tunnel)
- 영문 페이지 (수출 대응)

"테스트"
<- 이전 관계 결이 있으면 — 그 결과 *지금 결*의 차이를 deploy test Tue  2 Jun 11:31:18 KST 2026 -->
