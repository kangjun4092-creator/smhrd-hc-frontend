// router.js — 화면 라우팅(render), 앱 셸(사이드바/탑바), 화면 전환(setMenu/goto), 공용 확인 모달.

function render(){
  const root=document.getElementById('app');
  if(state.screen==='intro') root.innerHTML=renderIntro();
  else if(state.screen==='signup') root.innerHTML=renderSignup();
  else if(state.screen==='login') root.innerHTML=renderLogin();
  else root.innerHTML=renderApp(); // 'app' 화면은 실제 로그인 사용자와 게스트(guestMode)를 구분하지 않고 동일하게 그린다

  if(state.confirm) root.innerHTML += renderConfirm();
  if(state.findIdModal.open) root.innerHTML += renderFindIdModal();
  if(state.findPwModal.open) root.innerHTML += renderFindPwModal();
  if(state.itemPreview.open) root.innerHTML += renderItemPreviewModal();
  if(state.crewParty.open) root.innerHTML += renderPartyInviteModal();
  if(state.crewParty.statusOpen) root.innerHTML += renderPartyStatusModal();
  if(state.exercise.replayOpen) root.innerHTML += renderReplayPopup();
  // 캘리브레이션 모달은 회원가입 화면뿐 아니라, 운동 탭에서 "캘리브레이션 필수" 조건에 걸려
  // 열릴 수도 있으므로 화면(screen)과 무관하게 calModalOpen 플래그만 본다.
  if(state.signup.calModalOpen) root.innerHTML += renderCalibrationModal();

  if(state.signup.calModalOpen && state.signup.calStage==='done'){
    setTimeout(calSetupEditCanvas,0);
  }

  // 이미 촬영 결과(result)가 있으면 팝업이 열려있든 닫혀있든 촬영이 끝난 상태라 카메라를
  // 다시 잡을 필요가 없다 — 결과가 있는 채로 render()가 다시 불릴 때마다(팝업 열기/닫기 등)
  // 카메라가 매번 재시작돼버리는 걸 막는다. 다시 촬영하려면 retakeExercise()가 result를
  // null로 비우고 나서 이 조건을 다시 통과하게 된다.
  if(state.screen==='app' && state.menu==='exercise' && state.exercise.step===2 && !state.exercise.result){
    setTimeout(setupCamera,0);
  }
  // 크루대전: 대결이 끝나기 전까지는(카메라 화면이 떠 있는 동안) 매 렙·매 틱마다 여기(render)를
  // 다시 타지 않고 updateBattleUI()로 DOM만 직접 갱신한다 — 그래야 실시간 포즈 인식 루프가
  // 물고 있는 cam-video/cam-canvas가 매번 새로 만들어지며 끊기는 걸 막을 수 있다. 이 훅은
  // 대전 화면에 처음 진입하거나(카메라 준비) 대전이 끝났을 때(결과 화면 전환) 같은, render()가
  // 실제로 호출되는 몇 안 되는 시점에만 카메라를 (재)연결한다.
  if(state.screen==='app' && state.menu==='crewBattle' && state.crewBattle && !state.crewBattle.result){
    setTimeout(setupCamera,0);
    setTimeout(drawBattleTeammates,0);
  }
  if(state.screen==='app' && state.menu==='exercise' && state.exercise.replayOpen){
    setTimeout(setupReplayComparison,0);
  }
  if(state.screen==='app' && state.menu==='profile' && state.subtabs.profile===0){
    setTimeout(drawAvatarCanvas,0);
  }
  if(state.itemPreview.open){
    setTimeout(drawItemPreviewCanvas,0);
  }
  if(state.screen==='app' && state.menu==='crew' && getCrewPageTabs()[state.subtabs.crew]==='크루채팅'){
    setTimeout(scrollCrewChatToBottom,0);
  }
  if(state.screen==='app'){
    setTimeout(drawTopbarAvatar,0);
    setTimeout(drawPodiumChars,0);
  }
}

/* ---------- 소개(랜딩) 페이지 ---------- */
// 로그인 전 첫 진입 화면. 비회원은 로그인/회원가입 창을 바로 보는 대신 여기서 서비스를
// 먼저 둘러본 뒤, 상단 버튼으로 회원가입 또는 로그인으로 이동한다.
// 로그인 전 방문자에게 "운동하면 이렇게 기록이 쌓인다"를 미리 보여주는 예시 이미지 —
// 실제 내 기록은 회원가입 후에나 생기므로, 임의의 샘플 히스토리 화면 이미지를 보여준다.
/* ---------- 앱 셸 ---------- */
const MENUS = [
  {id:'main', label:'메인', icon:'🏠'},
  {id:'exercise', label:'운동', icon:'🏋️'},
  {id:'shop', label:'포인트 상점', icon:'🛍️'},
  {id:'crew', label:'홈크루', icon:'🏘️'},
  {id:'ranking', label:'랭킹', icon:'🏆'},
  {id:'profile', label:'마이페이지', icon:'👤'},
  {id:'support', label:'고객센터', icon:'💬'},
];
function renderApp(){
  return `
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand" onclick="goHome()" style="cursor:pointer;" title="메인으로 이동">
        <div class="brand-mark">홈</div>
        <div class="brand-name">우리동네<br>홈트챌린지<small>HOME TRAINING</small></div>
      </div>
      ${MENUS.map(m=>`
        <div class="navitem ${state.menu===m.id?'active':''}" onclick="setMenu('${m.id}')">
          <span class="navicon"></span><span class="navicon-emoji">${m.icon}</span><span class="navlabel">${m.label}</span>
        </div>`).join('')}
    </aside>
    <div class="main">
      <div class="topbar">
        <div>
          <div class="topbar-title">${state.guestMode ? `<span style="cursor:pointer;text-decoration:underline;" onclick="goto('login')">동네설정하기</span>` : state.user.region}</div>
        </div>
        <div class="user-chip">
          <div class="points-pill">P <span class="mono">${state.guestMode ? 0 : state.user.points.toLocaleString()}</span></div>
          <span class="topbar-nick">${state.guestMode ? '비회원' : (state.user.nickname||'홈트초보')}</span>
          <div class="topbar-avatar" onclick="setMenu('profile')" title="마이페이지">
            <canvas id="topbar-avatar-canvas"></canvas>
            <span class="mono">Lv.${state.guestMode ? 0 : state.user.level}</span>
          </div>
        </div>
      </div>
      <div class="view">
        ${state.menu==='main' ? renderMain() :
          state.menu==='exercise' ? renderExercise() :
          state.menu==='profile' ? renderProfile() :
          state.menu==='shop' ? renderShop() :
          state.menu==='crew' ? renderCrew() :
          state.menu==='crewBattle' ? renderCrewBattle() :
          state.menu==='ranking' ? renderRanking() :
          renderSupport()}
      </div>
    </div>
  </div>
  ${state.guestMode ? `<div class="guest-back-fab" onclick="backToLanding()">← 돌아가기</div>` : ''}`;
}
function setMenu(id){state.menu=id; render();}
// 좌측 상단 로고(배너) 클릭 시: 서비스 소개 콘텐츠를 담은 "메인" 카테고리로 이동한다.
function goHome(){ state.menu='main'; render(); }
// 비회원이 랜딩 카드를 눌러 앱 화면(startGuestExercise 등)으로 들어온 뒤, 다시 랜딩 페이지로
// 돌아가고 싶을 때 쓰는 함수 — goto()와 달리 로그인/회원가입 화면이 아니라 소개 페이지로 간다.
function backToLanding(){ state.guestMode=false; state.screen='intro'; render(); }
// 로그인 후 첫 화면(메인 카테고리) — 서비스 소개 대신 "나"에 관한 요약 대시보드를 보여준다.
// 순위·등급비율의 상승/하락 화살표는 실제로는 서버가 어제 대비 오늘 값을 이력으로 갖고
// 있어야 하지만, 이 프로토타입은 이력을 따로 저장하지 않으므로 (닉네임+오늘 날짜)를 시드로
// 한 값을 "어제 값"처럼 흉내낸다 — 그래서 하루 동안은 새로고침해도 화살표가 바뀌지 않는다.
// 게스트 모드 중 회원가입/로그인으로 넘어갈 수도 있으므로(renderExStepSave, renderCrewJoin,
// renderMain 등의 guestMode 분기 참고), 화면을 명시적으로 바꿀 때는 항상 게스트 모드를 함께
// 꺼서 로그인 이후에 계속 게스트 취급되지 않게 한다.
function goto(screen){state.guestMode=false; state.screen=screen; render();}
function setSub(key,idx){state.subtabs[key]=idx; render();}

function renderConfirm(){
  const c=state.confirm;
  return `
  <div class="confirm-backdrop" onclick="if(event.target===this)closeConfirm()">
    <div class="confirm-box">
      <h3>${c.title}</h3>
      <p>${c.desc}</p>
      <div class="confirm-actions">
        <button class="btn btn-ghost btn-sm" onclick="closeConfirm()">취소</button>
        <button class="btn ${c.danger?'btn-danger':'btn-primary'} btn-sm" id="confirm-yes">${c.yesLabel}</button>
      </div>
    </div>
  </div>`;
}
