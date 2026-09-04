// landing.js — 로그인 전 랜딩(소개) 페이지. 비회원 체험 진입점(startGuest*)도 여기 있습니다.

function renderHistoryPreview(){
  return `
  <div class="card" style="max-width:640px;margin:0 auto;text-align:center;">
    <img src="assets/history-demo-preview.png" alt="날짜별 운동 점수·정확도가 정리된 운동 히스토리 화면 예시" style="width:100%;border-radius:12px;border:2px solid var(--outline);display:block;">
    <p class="hint" style="margin-top:12px;">회원가입하면 내가 운동할 때마다 이렇게 날짜별로 점수·정확도가 자동으로 쌓여요.</p>
  </div>`;
}
// 랜딩 페이지 전용 카드 — 로그인 후 "메인" 카테고리(renderMain)는 더 이상 이 소개 카드를
// 재사용하지 않고 내 기록 중심 대시보드를 따로 그린다.
// action이 있는 카드만 클릭 가능하다 — 직접 함수 호출(예: 체험 시작)일 수도, 페이지 내 다른
// 섹션으로 스크롤 이동일 수도 있어 문자열로 받는다.
const LANDING_FEATURES = [
  {icon:'🎯', title:'AI 자세 판정 및 운동', desc:'웹캠만으로 스쿼트 같은 운동 자세를 실시간으로 분석하고 정확도를 채점해요.', action:'startGuestExercise()', cta:'지금 체험하기',
   image:'assets/ai-demo-preview.png', imageAlt:'캘리브레이션 실루엣 위에 스켈레톤이 겹쳐 스쿼트 자세를 실시간으로 판정하는 화면 예시'},
  {icon:'⚔️', title:'실시간 크루대전', desc:'우리 크루와 다른 동네 크루가 실시간으로 스쿼트 점수 대결을 펼쳐요.', action:'startGuestCrew()', cta:'우리 동네 크루확인하기',
   image:'assets/crew-battle-demo-preview.png', imageAlt:'앉은 자세 스쿼트 판정 웹캠 화면과 팀별 실시간 점수·팀원 캐릭터가 함께 표시되는 5vs5 크루대전 화면 예시'},
  {icon:'📋', title:'운동 히스토리 관리', desc:'날짜별 운동 기록과 점수·정확도를 한눈에 모아서 관리해요.', action:"scrollToSection('history-preview')", cta:'예시 보기 ↓',
   image:'assets/history-demo-preview.png', imageAlt:'날짜별 운동 점수·정확도가 정리된 운동 히스토리 화면 예시'},
  {icon:'🏆', title:'우리 동네 랭킹 확인', desc:'역삼동 1위는 892점의 "써니핏"님! 지역별·종목별 랭킹에서 내 순위는 어디쯤일지 확인해보세요.', action:'startGuestRanking()', cta:'랭킹 보기',
   image:'assets/ranking-demo-preview.png', imageAlt:'지역별 랭킹 화면의 1~3위 포디움과 순위표 예시'},
];
function renderLandingFeatures(){
  return `
  <div class="grid grid-3">
    ${LANDING_FEATURES.map(f=>`
      <div class="card exercise-card" style="text-align:center;" onclick="${f.action}">
        ${f.image ? `<img src="${f.image}" alt="${f.imageAlt||''}" style="width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:12px;border:2px solid var(--outline);margin-bottom:12px;display:block;">` : ''}
        <div class="ex-badge" style="margin:0 auto 10px;">${f.icon}</div>
        <h3 style="margin:0 0 6px;font-size:15px;">${f.title}</h3>
        <p class="desc" style="margin:0;">${f.desc}</p>
        <span class="pill pill-accent" style="margin-top:8px;">${f.cta}</span>
      </div>`).join('')}
  </div>`;
}
function scrollToSection(id){
  const el=document.getElementById(id);
  if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
}
function renderLandingBottomNav(){
  const items=[
    {icon:'🏠', label:'홈', action:"window.scrollTo({top:0,behavior:'smooth'})"},
    {icon:'🎯', label:'AI 자세판정', action:'startGuestExercise()'},
    {icon:'⚔️', label:'크루대전', action:'startGuestCrew()'},
  ];
  return `
  <nav class="landing-bottomnav">
    ${items.map(it=>`
      <div class="landing-bottomnav-item" onclick="${it.action}">
        <span class="icon">${it.icon}</span><span class="label">${it.label}</span>
      </div>`).join('')}
  </nav>`;
}
function renderIntro(){
  return `
  <div class="landing-shell">
    <div class="landing-topbar">
      <div class="brand" style="cursor:default;">
        <div class="brand-mark">홈</div>
        <div class="brand-name">우리동네<br>홈트챌린지<small>HOME TRAINING</small></div>
      </div>
    </div>
    <div class="landing-hero" id="home">
      <p class="auth-eyebrow" style="text-align:center;">우리동네 홈트챌린지</p>
      <h1>집에서, 우리 동네 사람들과 함께 운동해요</h1>
      <p>웹캠으로 자세를 실시간 판정하고, 미션과 랭킹으로 이웃과 함께 성장하는 홈트레이닝 서비스예요.</p>
      <div class="cta-row">
        <button class="btn btn-primary" style="padding:12px 28px;" onclick="goto('signup')">회원가입</button>
        <button class="btn btn-secondary" style="padding:12px 28px;" onclick="goto('login')">기존 계정 로그인</button>
      </div>
    </div>
    <div class="landing-body">
      <h2 class="landing-section-title">이런 걸 할 수 있어요</h2>
      ${renderLandingFeatures()}

      <div id="history-preview" style="margin-top:52px;">
        <h2 class="landing-section-title">운동 히스토리 예시</h2>
        ${renderHistoryPreview()}
      </div>
    </div>
  </div>
  ${renderLandingBottomNav()}`;
}

/* ---------- 로그인 전 "게스트 모드" ----------
   랜딩 페이지 소개 카드를 누르면 회원가입 없이도 screen='app'으로 들어가 로그인했을 때와 완전히
   같은 화면(사이드바 전체 카테고리)을 그대로 둘러볼 수 있다. renderApp()은 실제 로그인 사용자와
   게스트를 구분하지 않고 똑같이 그린다 — state.user/state.crew/state.history 등은 로그인 여부와
   무관하게 항상 존재하는 데모값이라 그대로 재사용된다. 다만 계정에 실제로 뭔가를 남기는 액션
   (운동 결과 저장, 크루 가입요청·생성, 메인 화면의 포인트받기·전체보기)만 state.guestMode를 보고
   로그인 화면으로 유도한다. */
function startGuestExercise(){
  state.guestMode=true;
  state.screen='app';
  state.menu='exercise';
  state.exercise={step:0, picked:null, camPhase:'idle', camStream:null, timerId:null, seconds:0, result:null, retakesUsed:0, liveReps:[], replayOpen:false};
  render();
}
function startGuestCrew(){
  state.guestMode=true;
  state.screen='app';
  state.menu='crew';
  render();
}
function startGuestRanking(){
  state.guestMode=true;
  state.screen='app';
  state.menu='ranking';
  render();
}

/* ---------- 회원가입 ---------- */
// 시 -> 구 -> 동 순으로 좁혀가는 활동 지역 선택용 데이터. 랭킹 집계 단위는 기존과 동일하게
// 동(가장 마지막 값) 기준을 유지하고, 저장 시에는 세 값을 합쳐 기존과 같은 "시 구 동" 문자열로 만든다.
