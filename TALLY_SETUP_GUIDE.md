# Tally.so 문의 폼 만들기 가이드

문의 폼을 Tally.so에서 직접 만들고 사이트에 붙이는 방법입니다.
모든 단계 합쳐 약 **15분** 정도 소요됩니다.

---

## 1단계 — Tally 계정 만들기 (2분)

1. [tally.so](https://tally.so) 접속
2. 우측 상단 **"Sign up"** 클릭
3. 이메일 입력 → 인증 메일 클릭 → 가입 완료
4. 워크스페이스 이름을 묻는다면: `영동에덴원` 입력

> **무료 플랜으로 충분합니다** — 월 200건, 무제한 폼, 한글 완벽 지원

---

## 2단계 — 폼 만들기 (10분)

### 빈 폼에서 시작

1. 로그인 후 대시보드에서 **"Create form"** 클릭
2. **"Start from scratch"** 선택 (빈 폼)
3. 폼 제목 입력: `영동에덴원 문의하기`

### 필드 차례로 추가

각 필드는 **"+ Add question"** 버튼으로 추가합니다.

#### 필드 1 — 문의 카테고리 (Multiple choice)

```
질문 타입: Multiple choice (단일 선택)
질문: 어떤 문의를 도와드릴까요?
필수: ✓ (Required 체크)

선택지:
○ 제품 구매 문의 (개인)
○ 단체 견학·체험 신청
○ 제품 도매·납품 (B2B)
○ 발효수업·교육 문의
○ 미디어·취재 문의
○ 기타
```

#### 필드 2 — 성함 (Short answer)

```
질문 타입: Short answer
질문: 성함을 알려주세요
필수: ✓
Placeholder: 홍길동
```

#### 필드 3 — 이메일 (Email)

```
질문 타입: Email
질문: 이메일 주소
필수: ✗ (선택) — 아래 문구 추가
설명(Description): 이메일 또는 전화번호 중 하나 이상 남겨주세요
```

#### 필드 4 — 전화번호 (Phone number)

```
질문 타입: Phone number
질문: 전화번호
필수: ✗ (선택)
```

#### 필드 5 — 소속 (Short answer)

```
질문 타입: Short answer
질문: 소속 (선택)
필수: ✗
설명: 회사·기관·단체명 (단체 문의 시 기재)
```

#### 필드 6 — 문의 내용 (Long answer)

```
질문 타입: Long answer
질문: 문의 내용
필수: ✓
Placeholder: 자세히 적어주실수록 빠르게 도와드릴 수 있습니다
```

#### 필드 7 — 개인정보 동의 (Checkboxes)

```
질문 타입: Checkboxes
질문: 개인정보 수집·이용 동의
필수: ✓

선택지:
☐ 개인정보 처리방침을 확인했으며, 문의 회신 목적의 정보 수집·이용에 동의합니다.

설명(Description): 처리방침 전문은 영동에덴원 사이트 하단 링크에서 확인 가능합니다.
```

### 폼 마무리 화면 설정

폼 마지막에 자동으로 추가된 "Thank you" 페이지를 클릭해서:

```
제목: 문의를 보내주셔서 감사합니다
설명: 빠른 시일 내에 회신드리겠습니다.
       급한 문의는 카카오톡 채널(http://pf.kakao.com/_yaKxlX)로도 연락주세요.
```

---

## 3단계 — 이메일 알림 설정 (2분)

문의가 접수되면 카카오 이메일로 알림이 와야 합니다.

1. 폼 편집 화면 상단 **"Integrations"** 탭 클릭
2. **"Email notifications"** 옵션 활성화
3. 알림받을 이메일: `kwg7978@naver.com` 입력
4. 저장

> Tally는 무료 플랜에서도 이메일 알림이 기본 제공됩니다.

---

## 4단계 — 폼 게시 + 임베드 코드 받기 (1분)

1. 폼 편집 완료 후 우측 상단 **"Publish"** 클릭
2. **"Share"** 탭으로 이동
3. **"Embed"** → **"Embed on your website"** 선택
4. 옵션:
   - **Hide title**: ✓ (체크) — 제목은 우리 페이지에 이미 있음
   - **Transparent background**: ✓ (체크) — 사이트 배경색이 비치도록
   - **Align left**: ✓ (체크)
   - **Dynamic height**: ✓ (체크) — 폼 길이에 따라 자동 조절
5. **"Copy embed code"** 클릭 → 코드 복사

복사한 코드는 아래와 비슷한 형태입니다:

```html
<iframe data-tally-src="https://tally.so/embed/XXXXXX?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1"
        loading="lazy"
        width="100%"
        height="500"
        frameborder="0"
        marginheight="0"
        marginwidth="0"
        title="영동에덴원 문의하기"></iframe>
<script async src="https://tally.so/widgets/embed.js"></script>
```

---

## 5단계 — 사이트에 폼 붙이기 (3분)

1. `contact.html` 파일을 텍스트 편집기(메모장도 가능)로 엽니다
2. 아래 부분을 찾습니다:

```html
<div class="contact-page__placeholder">
  <div class="contact-page__placeholder-icon">📝</div>
  <h2 class="contact-page__placeholder-title">문의 폼 준비 중입니다</h2>
  <p class="contact-page__placeholder-text">
    문의 폼을 곧 이곳에 표시할 예정입니다.<br />
    그동안 위의 카카오톡 채널이나 전화로 연락주세요.
  </p>
</div>
```

3. 이 부분을 **통째로 지우고**, 4단계에서 복사한 Tally 임베드 코드를 그 자리에 붙여넣습니다.

4. 저장 후 Cloudflare Pages에 재배포:
   - Cloudflare 대시보드 → Pages → `edenwon-landing`
   - **"Create new deployment"**
   - 전체 폴더 다시 업로드

---

## 6단계 — 작동 확인 (필수)

배포 후 다음을 직접 테스트하세요:

1. `https://yd-edenwon.com/contact.html` 접속
2. 폼이 제대로 보이는지 확인
3. **실제로 본인이 폼을 한 번 제출**해보기
   - 카테고리 "기타" 선택
   - 이름 "테스트"
   - 이메일 본인 것
   - 내용 "테스트 메시지"
   - 동의 체크 → 제출
4. `kwg7978@naver.com` 이메일에 알림 도착하는지 확인
5. Tally 대시보드 → 폼 → "Submissions" 탭에서도 접수 내역 확인

---

## 향후 확장 — 카카오톡 알림 추가 (박람회 후)

이메일만으로 부족하다 싶으면, Make.com으로 카카오톡 알림도 추가할 수 있습니다.

```
Tally 제출 → Make → 카카오톡 알림톡 자동 발송
```

설정 약 30분, 비용 사실상 무료(월 50건 무료). 박람회 후 안정화되면 추가 가이드 드리겠습니다.

---

## 문제 발생 시

- **폼이 안 보임**: 임베드 코드 끝에 `<script async src="..."></script>` 부분이 빠졌는지 확인
- **알림이 안 옴**: Tally 대시보드의 Integrations → Email 설정 다시 확인 (스팸함도 확인)
- **모바일에서 깨짐**: 임베드 옵션의 "Dynamic height" 체크가 꺼져있는지 확인

뭐가 막히면 화면 캡처해서 알려주세요.
