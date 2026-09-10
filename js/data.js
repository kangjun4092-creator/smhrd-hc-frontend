// data.js — 정적 데이터/카탈로그 (종목, 지역 데이터 등). 미션은 이제 서버(GET /api/missions/today)에서 받아오므로 여기엔 목업이 없습니다.

// PC 브라우저로 테스트할 땐 로컬 백엔드를 직접 쓰는 게 devtunnel보다 훨씬 빠르다(1.3s ↔ 6.7ms
// 왕복시간 직접 측정 비교, 2026-09-10). 폰으로 테스트할 때만 아래 devtunnel 주소로 다시 바꿔주면 됨.
//const API_BASE = 'http://localhost:8080';
const API_BASE = 'https://m8zvvvvx-8080.jpe1.devtunnels.ms'; // 폰 테스트용
const OAUTH_REDIRECT_URI = 'https://m8zvvvvx-5500.jpe1.devtunnels.ms/index.html';

// 새로고침하면 랜딩페이지로 돌아가던 문제 — state가 메모리에만 있고 어디에도 저장이 안 됐던
// 게 원인이라, 로그인 토큰·마지막으로 보던 메뉴를 localStorage에 저장해두고 새로고침 시
// bootstrap.js에서 이 값으로 세션을 복원한다. 로그아웃/회원탈퇴할 때는 반드시 clearSession()도
// 같이 불러야 다음 새로고침에서 다시 로그인된 채로 돌아오지 않는다.
const SESSION_TOKEN_KEY = 'ounhome_token';
const SESSION_MENU_KEY = 'ounhome_menu';
function saveSession(token) {
  try { localStorage.setItem(SESSION_TOKEN_KEY, token); } catch (err) { /* 시크릿 모드 등 저장 불가 환경 — 무시 */ }
}
function saveSessionMenu(menu) {
  try { localStorage.setItem(SESSION_MENU_KEY, menu); } catch (err) { }
}
function loadSessionToken() {
  try { return localStorage.getItem(SESSION_TOKEN_KEY); } catch (err) { return null; }
}
function loadSessionMenu() {
  try { return localStorage.getItem(SESSION_MENU_KEY); } catch (err) { return null; }
}
function clearSession() {
  try { localStorage.removeItem(SESSION_TOKEN_KEY); localStorage.removeItem(SESSION_MENU_KEY); } catch (err) { }
}


const EXS = [
  {id:'squat', name:'스쿼트', target:'하체 · 둔근', level:'초급'},
];

function randInt(a,b){ return a+Math.floor(Math.random()*(b-a+1)); }

// 아이디·닉네임·크루명 중복확인용 목업 데이터. 실제로는 DB 조회(SQL SELECT ... WHERE)로 대체된다.
const EXISTING_USERS = [
  {id:'hometrainer01', nickname:'써니핏'},
  {id:'runner99', nickname:'런닝수달'},
  {id:'proteinman', nickname:'단백질맨'},
];
// 첫 번째로 등록된 시(지금은 전남광주통합특별시)가 지역 드롭다운들의 기본값이 된다
// (REGION_DATA[f.city]가 없을 때 Object.keys(REGION_DATA)[0]로 대체하는 로직들 참고).
const REGION_DATA = {
  '전남광주통합특별시': { '북구':['오룡동','운암동'], '광산구':['수완동','신창동'], '동구':['학동','계림동'], '남구':['봉선동','진월동'], '서구':['상무동','화정동'] },
  '서울시': { '강남구':['역삼동','삼성동'], '마포구':['합정동','망원동'], '성동구':['성수동'] },
  '부산시': { '해운대구':['우동','중동'] },
  '대전시': { '유성구':['봉명동'] },
};
// renderSignup ~ setSignupDong 구간: 화면(입력 폼) 렌더링만 담당하는 순수 프론트엔드 로직.
// (FR-AC-001) 실제 "가입 제출" 처리는 아래 doSignup() 지점에서 이어집니다.
