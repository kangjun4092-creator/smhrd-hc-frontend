# smhrd-hc-frontend

`smhrd-hc-prototype`(디자인/기능 검증용 프로토타입)에서 실제 구현에 필요한 부분만 가져와
정리한 프론트엔드입니다. 원본 프로토타입의 `script.js`(4300여 줄 단일 파일)를 화면
구간(사이드바 카테고리)별로 여러 파일로 나눴다는 점만 다르고, 동작·마크업·로직은 그대로입니다.

## 왜 나눴나

`smhrd-hc-backend`(Java/Spring Boot)처럼 폴더/파일이 도메인별로 나뉘어 있어야
- 어디를 고치면 되는지 찾기 쉽고,
- 나중에 각 화면을 실제 API 호출로 바꿔나갈 때(다음 단계) 파일 단위로 작업하기 편합니다.

번들러(Webpack/Vite 등)는 쓰지 않았습니다 — 예전과 동일하게 일반 `<script>` 태그 여러 개를
순서대로 로드하는 방식이라, 지금처럼 그냥 정적 파일 서버로 열면 바로 동작합니다.

## 폴더 구조

```
index.html
style.css
Bodyweight_Squats.gif      스쿼트 레퍼런스 영상(운동 튜토리얼에서 사용)
assets/                    아바타·데모 프리뷰 이미지
js/
  data.js         정적 데이터(종목, 미션 템플릿, 지역 데이터)
  state.js        전역 상태 객체 — 지금은 이 하나가 서버·DB 역할을 대신함
  utils.js        공용 유틸(토스트, 확인모달, 아바타, 해시 등)
  router.js       화면 라우팅 + 앱 셸(사이드바/탑바)
  landing.js      로그인 전 랜딩 페이지
  auth.js         회원가입/로그인/소셜로그인/아이디·비밀번호 찾기
  calibration.js  웹캠 체형 캘리브레이션 (MediaPipe Pose)
  main.js         메인 대시보드
  exercise.js     운동(웹캠 자세 판정) — 가장 큰 파일
  mission.js      일간 미션
  profile.js      마이페이지(캐릭터/미션현황/히스토리/계정관리)
  shop.js         포인트 상점
  crew.js         홈크루(가입/공지/채팅/크루대전)
  ranking.js      랭킹
  support.js      고객센터
  bootstrap.js    전역 클릭 리스너 + render() 최초 호출 (항상 마지막 로드)
```

로드 순서 규칙은 `index.html`의 스크립트 태그 주석에 적어뒀습니다 — 실제로 순서를 지켜야 하는
건 `data.js → state.js`와 `bootstrap.js를 항상 마지막에 두는 것` 두 가지뿐입니다.

## 실행 방법

번들러나 별도 설치 없이, 정적 파일 서버로만 열면 됩니다.

- VSCode "Live Server" 확장 → `index.html` 우클릭 → Open with Live Server
- 또는 Node가 있다면: `npx serve .`

`file://`로 직접 열면 카메라 권한과 CORS(나중에 백엔드 연동 시) 때문에 일부 기능이 막힐 수
있으니 위 방법 중 하나로 `http://localhost:...` 주소로 띄워서 확인하세요.

## smhrd-hc-prototype과의 관계

`smhrd-hc-prototype`은 그대로 두었습니다(디자인 시안·리디자인 실험·목업 이미지 등이 함께
있는 작업 공간이라 계속 그 용도로 쓰시면 됩니다). 이 폴더는 그 중 실제 서비스로 이어갈
부분만 뽑아 별도 저장소로 관리하기 위한 곳입니다. `mockup/`, `redesign/`, `wireframe/`,
`alarm_exam/`, `tools/`, 메모용 `.txt` 파일들은 프로토타입 쪽에만 남아 있고 여기엔
없습니다 — 실행에 필요 없는 참고/실험 자료이기 때문입니다.

## 다음 단계 (아직 안 한 것)

- `smhrd-hc-backend`가 떠 있는 상태에서, 각 파일의 `state` 목업 조작 부분을
  `fetch('http://localhost:8080/api/...')` 호출로 하나씩 바꿔가는 작업이 남아있습니다.
  예: `auth.js`의 `doSignup()` → `POST /api/auth/signup`, `exercise.js`의
  `saveExerciseResult()` → `POST /api/exercise-records` 등.
- 자세 인식(MediaPipe) 자체는 계속 브라우저에서만 실행됩니다 — 서버로 영상이 전송되지
  않는 구조는 그대로 유지하면 됩니다.
