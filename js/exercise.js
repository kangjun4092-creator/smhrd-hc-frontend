// exercise.js — '운동' 카테고리: 종목 선택 → 튜토리얼 → 웹캠 촬영(실시간 자세 판정) → 결과 저장. 가장 큰 파일입니다.

/* ========================================================================
   1. 운동 (EXERCISE WIZARD)
   ======================================================================== */
// (FR-EX-001~004) 종목 선택 ~ 웹캠 촬영(startSkeletonLoop, toggleRecording)까지는
// 브라우저에서 도는 촬영·자세 인식 로직이라 프론트엔드에 그대로 남습니다.
//   웹캠 스트림(JS) > (실제 구현 시) MediaPipe Pose 실시간 분석(WASM) > 관절 각도·등급 계산(JS)
// generateResult()는 지금 랜덤 값으로 판정을 흉내만 낸 것이고, 실제로는 위 계산 결과를
// 그대로 써서 점수를 만들면 됩니다. 이 결과를 "저장"하는 순간(saveExerciseResult())부터
// 아래처럼 서버 연동이 필요합니다.
//   촬영 결과 저장(saveExerciseResult) > Java 운동기록 API > DB 연결 > SQL INSERT/UPDATE
//   (운동 기록 테이블 INSERT, 포인트·경험치는 계정 테이블 UPDATE — 트랜잭션 처리 권장)
// 리플레이 분석은 더 이상 별도 단계가 아니다 — 웹캠 촬영이 끝나면 그 화면 위에 바로 팝업으로
// 뜬다(renderReplayPopup 참고). 촬영 중이던 카메라 화면 그대로 뒤에 남아있는 게 자연스러워서
// 단계를 옮기지 않고 팝업으로 처리했다.
const EX_STEPS=['종목 선택','튜토리얼','웹캠 촬영','결과 저장'];
// 스쿼트 실시간 판정 기준. tools/extract-exercise-reference.html(종목별 캡처 이미지로
// 관절 각도를 뽑는 공용 도구, 스쿼트 항목)로 분석해서 나온 값으로 교체한다
// (지금은 일반적인 스쿼트 각도로 잡은 임시값).
// standing = 서 있을 때 무릎 각도, bottom = 정자세 최저점 무릎 각도, 나머지는 bottom과의
// 오차(도) 허용범위.
const SQUAT_REFERENCE = {
  standingKneeAngle: 172, bottomKneeAngle: 88,
  perfectTol: 6, greatTol: 12, goodTol: 20,
};
const EXERCISE_REP_TARGET = 10; // 실시간 판정이 지원되는 운동(스쿼트)의 세션(세트)당 반복 횟수
// 하루에 완료할 수 있는 운동세트(세션) 한도 — 기본 3세트, 5레벨마다 기본 한도 +1, 포인트 상점
// "세트 추가권" 1개 구매마다 +3세트. state.user.setsUsedToday는 saveExerciseResult()에서
// 세션을 저장할 때마다 늘어난다(재촬영은 이미 FREE_RETAKES/티켓으로 따로 제한되므로 여기 세지 않음).
const EXERCISE_DAILY_SETS_BASE = 3;
function getDailySetLimit(){ return EXERCISE_DAILY_SETS_BASE + Math.floor((state.user.level||1)/5) + (state.user.extraSets||0); }
const CAM_FINAL_COUNTDOWN_SECONDS = 3; // 자세 보정이 끝난 뒤 실제 촬영 시작까지의 음성 카운트다운(3,2,1,스타트!)
const CAM_ALIGN_HOLD_MS = 2000; // 정렬(자세 보정) 원형 게이지가 다 차기까지 유지해야 하는 시간
const CAM_GUIDE_SPEAK_INTERVAL_MS = 2500; // 같은 안내 음성이 너무 자주 반복되지 않도록 하는 간격
const CAM_READY_RING_CIRC = 226; // 2π·36 (cam-ready-overlay 원형 게이지 반지름 36과 맞춘 둘레)
function setReadyRingPct(pct){
  const el=document.getElementById('cam-ready-ring');
  if(el) el.style.strokeDashoffset = CAM_READY_RING_CIRC*(1-Math.max(0,Math.min(1,pct)));
}
function showReadyRing(show){
  const el=document.getElementById('cam-ready-ring-wrap');
  if(el) el.style.display=show?'flex':'none';
}
// 허리(상체) 각도 기준값. 튜토리얼 영상에서 별도로 뽑은 값이 아니라, 일반적인 스쿼트 안전
// 자세 기준으로 잡은 값이라 나중에 tools/extract-exercise-reference.html처럼 실측 보정 가능.
const TORSO_STANDING_MIN_ANGLE = 130; // 정렬(서있는) 단계에서 허리가 곧게 펴져 있다고 볼 최소 각도(완화됨)
const TORSO_LEAN_WARN_DEG = 60; // 렙 진행 중 "서 있을 때 허리 각도" 대비 이만큼 이상 더 숙여지면 위험으로 판단(완화됨)
function exerciseStepHead(){
  return `
  <div class="view-head">
    <h1>운동</h1>
  </div>
  <div class="subtabs subtabs-compact">
    ${EX_STEPS.map((s,i)=>`<div class="tab ${state.exercise.step===i?'active':''}">${i+1}. ${s}</div>`).join('')}
  </div>`;
}
function renderExercise(){
  const st=state.exercise.step;
  let body='';
  if(st===0) body=renderExStepPick();
  else if(st===1) body=renderExStepTutorial();
  else if(st===2) body=renderExStepCam();
  else body=renderExStepSave();
  return exerciseStepHead()+body;
}

// 종목 카드 아이콘 — 이니셜 텍스트 대신 실제 자세(앉은 자세 등)를 알아볼 수 있는 작은
// 스틱 피규어 SVG. 캐릭터 디자인과는 무관하게 자세만 표현하면 되므로 여기서 직접 그린다.
const EX_ICONS = {
  squat: `<svg viewBox="0 0 48 48" width="26" height="26" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="31" cy="9" r="5" fill="currentColor" stroke="none"/>
    <path d="M31 15 L25 28"/>
    <path d="M25 28 L13 32"/>
    <path d="M13 32 L19 44"/>
    <path d="M28 18 L9 16"/>
  </svg>`,
};
function renderExStepPick(){
  const limit=getDailySetLimit();
  const used=state.user.setsUsedToday||0;
  const remain=Math.max(0, limit-used);
  const noSetsLeft = !state.guestMode && remain<=0;
  return `
  <div class="card" style="max-width:420px;margin-bottom:16px;">
    <p class="section-label" style="margin:0 0 4px;">오늘 가능한 운동세트</p>
    <p class="desc mono" style="margin:0;">${used} / ${limit}세트 사용 · ${remain>0?`<b style="color:var(--accent);">${remain}세트 남음</b>`:'<b style="color:var(--danger);">모두 사용함</b>'}</p>
    ${noSetsLeft ? `<p class="hint" style="margin-top:6px;">포인트 상점에서 '세트 추가권'을 구매하면 오늘 바로 더 운동할 수 있어요.</p>` : `<p class="hint" style="margin-top:6px;">레벨업(5레벨마다 +1) 또는 '세트 추가권' 구매로 한도를 늘릴 수 있어요.</p>`}
  </div>
  <div class="grid grid-3" style="max-width:420px;">
    ${EXS.map(e=>`
      <div class="card exercise-card ${state.exercise.picked===e.id?'selected':''}" onclick="pickExercise('${e.id}')">
        <div class="ex-badge">${EX_ICONS[e.id]||e.name.charAt(0)}</div>
        <h3>${e.name}</h3>
        <p class="desc">타겟: ${e.target}</p>
        <button class="btn btn-primary btn-block" style="margin-top:12px;${(state.exercise.picked===e.id && !noSetsLeft)?'':'opacity:.4;cursor:not-allowed;'}" ${(state.exercise.picked===e.id && !noSetsLeft)?'':'disabled'} onclick="event.stopPropagation();goToTutorial()">운동 시작하기</button>
      </div>`).join('')}
  </div>
  <div style="margin-top:20px;max-width:420px;">
    ${renderTutorialMissionList()}
  </div>`;
}
function pickExercise(id){state.exercise.picked=id; render();}
// 게스트 모드에서 "나중에 할게요"를 누르면 게스트 상태는 유지한 채(다른 카테고리도 계속
// 둘러볼 수 있게) 운동 위저드만 종목 선택 화면으로 되돌린다.
function resetExerciseWizard(){
  state.exercise={step:0, picked:null, camPhase:'idle', camStream:null, timerId:null, seconds:0, result:null, retakesUsed:0, liveReps:[], replayOpen:false};
  render();
}
function goExStep(n){
  state.exercise.step=n; render();
  if(n===1) startTutorialGate(); // 튜토리얼에 들어올 때마다(뒤로 왔다가 다시 와도) 대기시간을 새로 건다
}
// 튜토리얼을 최소 몇 초는 보게 한 뒤에 "웹캠 촬영 시작" 버튼을 눌러 다음 단계로 넘어갈 수
// 있게 한다 — 버튼 라벨에 남은 초를 직접 보여주고, 다 되면 disabled를 풀고 문구를 되돌린다.
const TUTORIAL_GATE_SECONDS = 5;
function startTutorialGate(){
  let left=TUTORIAL_GATE_SECONDS;
  const btn=document.getElementById('ex-tutorial-start-btn');
  if(!btn) return;
  btn.textContent=`웹캠 촬영 시작 (${left}초)`;
  const tick=()=>{
    const b=document.getElementById('ex-tutorial-start-btn');
    if(!b) return; // 다른 화면으로 이동하면 자연 종료
    left--;
    if(left>0){
      b.textContent=`웹캠 촬영 시작 (${left}초)`;
      setTimeout(tick,1000);
    } else {
      b.textContent='웹캠 촬영 시작';
      b.disabled=false; b.style.opacity='1'; b.style.cursor='pointer';
    }
  };
  setTimeout(tick,1000);
}
// 회원가입 시점에는 캘리브레이션이 선택사항이었지만(그냥 둘러보는 사람도 있어서), 실제로
// 운동을 시작하려는 시점(튜토리얼 진입)부터는 필수로 막는다 — 자세 분석 정확도를 위해 체형
// 보정값이 반드시 있어야 하기 때문. 아직 보정을 안 했다면 캘리브레이션 모달부터 띄운다.
function goToTutorial(){
  if(!state.user.calibration){
    toast('운동을 시작하려면 체형 캘리브레이션이 먼저 필요해요');
    openCalibrationModal();
    return;
  }
  // 게스트 모드는 회원 레벨·일일 세트 개념이 없는 맛보기라 한도를 적용하지 않는다.
  if(!state.guestMode && (state.user.setsUsedToday||0)>=getDailySetLimit()){
    toast(`오늘 가능한 운동세트를 모두 사용했어요 (${getDailySetLimit()}세트). 포인트 상점에서 세트 추가권을 구매하거나 내일 다시 시도해주세요.`);
    return;
  }
  goExStep(1);
}

function renderExStepTutorial(){
  const ex=EXS.find(e=>e.id===state.exercise.picked) || EXS[0];
  const isSquat = ex.id==='squat';
  return `
  <div class="grid grid-2">
    <div class="card">
      <p class="section-label">${ex.name} 정자세 가이드</p>
      ${isSquat ? `
      <div class="cam-stage" style="aspect-ratio:1/1;margin-bottom:14px;">
        <img src="Bodyweight_Squats.gif" alt="스쿼트 정자세 레퍼런스" style="width:100%;height:100%;object-fit:cover;">
      </div>` : ''}
      <ul class="steplist">
        <li><span class="num">1</span>발을 어깨너비로 벌리고 무게중심을 뒤꿈치에 둡니다.</li>
        <li><span class="num">2</span>허리를 곧게 편 상태로 천천히 내려갑니다.</li>
        <li><span class="num">3</span>무릎이 발끝을 넘지 않도록 각도를 유지합니다.</li>
        <li><span class="num">4</span>동작 최저점에서 1초 정지 후 천천히 복귀합니다.</li>
      </ul>
      <div style="margin-top:16px;display:flex;gap:8px;">
        <button class="btn btn-ghost" onclick="goExStep(0)">이전</button>
        <button class="btn btn-primary" id="ex-tutorial-start-btn" disabled style="opacity:.5;cursor:not-allowed;" onclick="goExStep(2)">웹캠 촬영 시작 (${TUTORIAL_GATE_SECONDS}초)</button>
      </div>
    </div>
    ${isSquat ? renderTutorialMissionList() : ''}
  </div>`;
}
// 종목선택·튜토리얼 화면에 개인 일일 미션과 각각의 진행 개수·보상 포인트를 보여준다 —
// 운동을 시작하기 전에 바로 "아, 이만큼 더 하면 얼마 받는구나"를 알 수 있게.
function renderTutorialMissionList(){
  const missions=allMissions();
  return `
  <div class="card">
    <p class="section-label">개인 일일 미션</p>
    <div style="display:flex;flex-direction:column;gap:8px;max-height:460px;overflow-y:auto;">
      ${missions.map(m=>{
        const cur=Math.min(state.missions.counters[m.metric]||0, m.target);
        const done=cur>=m.target;
        return `
        <div style="border:1.5px solid var(--line);border-radius:10px;padding:10px 12px;">
          <div class="flex-between">
            <span class="mono" style="font-size:11px;color:var(--gold);font-weight:700;">+${m.reward}P</span>
            <span class="mono" style="font-size:12px;color:${done?'var(--accent)':'var(--ink-dim)'};">${cur}/${m.target}</span>
          </div>
          <p style="margin:6px 0 0;font-size:12.5px;">${m.label}</p>
          <div class="progress" style="margin-top:6px;height:6px;"><span style="width:${Math.min(100,cur/m.target*100)}%"></span></div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}
function renderExStepCam(){
  const isSquat = state.exercise.picked==='squat';
  const hasResult = !!state.exercise.result;
  return `
  <div class="grid cal-grid">
    <div>
      <div class="cam-stage" id="cam-stage">
        <div class="cam-placeholder" id="cam-placeholder">카메라를 확인하는 중...<br>브라우저의 카메라 권한을 허용해주세요.</div>
        <video id="cam-video" autoplay playsinline muted style="display:none;"></video>
        <canvas class="cam-overlay-canvas" id="cam-canvas"></canvas>
        <div class="cam-badge"><span class="rec-dot"></span><span id="cam-status">대기중</span></div>
        <div class="cam-timer mono" id="cam-timer">00:00</div>
        <div class="cam-live-stats">
          <div class="stat"><span class="num mono" id="live-reps">0${isSquat?` / ${EXERCISE_REP_TARGET}`:''}</span><span class="lbl">인식 횟수</span></div>
          <div class="stat"><span class="num mono" id="live-acc">--%</span><span class="lbl">추정 정확도</span></div>
        </div>
        <div id="cam-grade-flash" class="cam-grade-flash"></div>
        <div id="cam-ready-overlay" class="cam-ready-overlay">
          <div class="ready-ring" id="cam-ready-ring-wrap" style="display:none;">
            <svg viewBox="0 0 84 84" width="84" height="84">
              <circle class="ring-track" cx="42" cy="42" r="36"/>
              <circle class="ring-fill" id="cam-ready-ring" cx="42" cy="42" r="36"/>
            </svg>
          </div>
          <div class="count" id="cam-ready-count"></div>
          <div class="msg" id="cam-ready-msg">화면 속 스켈레톤에 맞춰 자리를 잡아주세요</div>
        </div>
      </div>
      <div style="margin-top:14px;display:flex;gap:8px;">
        ${hasResult
          ? `<button class="btn btn-primary" onclick="openReplayPopup()">분석 결과 다시 보기</button>`
          : `<button class="btn btn-primary" id="cam-toggle" onclick="toggleRecording()">촬영 시작</button>`}
        <button class="btn btn-ghost" onclick="goExStep(1)">이전</button>
      </div>
    </div>
    <div class="card">
      <p class="section-label">촬영 안내</p>
      <ul class="steplist">
        <li><span class="num">·</span>전신이 프레임에 들어오도록 카메라와 2~3m 거리를 둡니다.</li>
        ${isSquat
          ? `<li><span class="num">·</span><span><strong>카메라는 12시 방향에 두고, 다리 방향은 2시 방향을 향하도록 살짝 틀어 서주세요.</strong> (각도 판정 정확도를 위해 정면보다는 대각선 자세가 필요해요)</span></li>
             <li><span class="num">·</span>"촬영 시작"을 누르면 바로 측정되지 않고, 거리·방향·자세를 맞추라는 음성 안내가 나와요. 다 맞으면 자동으로 ${CAM_FINAL_COUNTDOWN_SECONDS}초 카운트다운 후 측정이 시작됩니다.</li>
             <li><span class="num">·</span><span>자리를 잡을 때는 <strong>서있는 내 체형 고스트</strong>가, 측정이 시작되면 <strong>목표 앉은 자세(스쿼트 최저점) 고스트</strong>로 바뀌어 계속 표시됩니다.</span></li>
             <li><span class="num">·</span><span>무릎 각도뿐 아니라 <strong>허리(상체) 각도</strong>도 함께 판정해 부상 위험이 있으면 알려드려요.</span></li>
             <li><span class="num">·</span>동작마다 PERFECT/GREAT/GOOD/MISS가 실시간으로 표시됩니다.</li>
             <li><span class="num">·</span>${EXERCISE_REP_TARGET}회를 채우면 자동으로 촬영이 종료됩니다.</li>`
          : `<li><span class="num">·</span>YOLO-Pose가 관절 keypoint를 실시간 추적합니다.</li>
             <li><span class="num">·</span>촬영 종료 시 자동으로 리플레이 분석이 시작됩니다.</li>`}
      </ul>
    </div>
  </div>`;
}

function setupCamera(){
  const video=document.getElementById('cam-video');
  const placeholder=document.getElementById('cam-placeholder');
  if(!video) return;
  if(state.exercise.camStream){video.srcObject=state.exercise.camStream; video.style.display='block'; if(placeholder)placeholder.style.display='none';}
  if(navigator.mediaDevices && navigator.mediaDevices.getUserMedia){
    navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false}).then(stream=>{
      state.exercise.camStream=stream;
      const v=document.getElementById('cam-video');
      if(v){v.srcObject=stream; v.style.display='block';}
      const ph=document.getElementById('cam-placeholder');
      if(ph) ph.style.display='none';
      startPoseFeedback();
    }).catch(()=>{
      const ph=document.getElementById('cam-placeholder');
      if(ph) ph.innerHTML='카메라를 사용할 수 없습니다.<br>웹캠 프리뷰 없이 모의 자세 인식으로 진행합니다.';
      startPoseFeedback();
    });
  } else {
    const ph=document.getElementById('cam-placeholder');
    if(ph) ph.innerHTML='이 브라우저에서는 카메라를 지원하지 않습니다.<br>모의 자세 인식으로 진행합니다.';
    startPoseFeedback();
  }
}
// 스쿼트는 실제 MediaPipe 판정 루프로, 나머지 운동(아직 학습 데이터 없음)은 기존 모의
// 스켈레톤 애니메이션으로 분기한다.
function startPoseFeedback(){
  if(state.exercise.picked==='squat' && state.exercise.camStream) exStartPoseLoop();
  else startSkeletonLoop();
  // 크루대전은 개인별로 "촬영 시작"을 눌러 알아서 시작하는 방식(1인 운동 화면과 동일한 정렬
  // 유지+카운트다운)이 아니라, 카메라가 켜지는 순간부터 다 같이 보는 공용 10초 카운트다운을
  // 태워서 모두 같은 순간에 측정이 시작되게 한다 — 보정이 빠른 사람이 혼자 먼저 시작해버려
  // 팀원마다 측정 시작 시점이 어긋나는 문제 때문에 추가.
  if(state.crewBattle && !state.crewBattle.result) startBattleReadyCountdown();
}
let exBattleCountdownStarted=false;
const CAM_BATTLE_COUNTDOWN_SECONDS=10;
function startBattleReadyCountdown(){
  if(exBattleCountdownStarted) return;
  exBattleCountdownStarted=true;
  let left=CAM_BATTLE_COUNTDOWN_SECONDS;
  const tick=()=>{
    const el=document.getElementById('cam-battle-countdown');
    if(!el) return; // 화면 이동 시 자연 종료
    if(left>0){
      el.textContent=left;
      left--;
      setTimeout(tick,1000);
    } else {
      el.textContent='START';
      beginRecording();
      startBattleTicker(); // 상대팀·팀원 점수도 이 순간부터 같이 오르기 시작한다 (crew.js)
      setTimeout(()=>{
        const e2=document.getElementById('cam-battle-countdown');
        if(e2) e2.textContent='';
      },3000);
    }
  };
  tick();
}
function startSkeletonLoop(){
  const canvas=document.getElementById('cam-canvas');
  if(!canvas) return;
  const stage=document.getElementById('cam-stage');
  function resize(){canvas.width=stage.clientWidth; canvas.height=stage.clientHeight;}
  resize();
  const ctx=canvas.getContext('2d');
  let t=0;
  cancelAnimationFrame(startSkeletonLoop._raf);
  function draw(){
    if(!document.getElementById('cam-canvas')) return; // view changed
    t+=0.05;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const cx=canvas.width/2, cy=canvas.height/2, sway=Math.sin(t)*10;
    const bob = state.exercise.camPhase==='recording' ? Math.abs(Math.sin(t*1.6))*canvas.height*0.10 : 0;
    const joints={
      head:[cx+sway*0.3, cy-canvas.height*0.28+bob*0.2],
      neck:[cx+sway*0.3, cy-canvas.height*0.18+bob*0.2],
      lsh:[cx-30+sway*0.3, cy-canvas.height*0.15+bob*0.2], rsh:[cx+30+sway*0.3, cy-canvas.height*0.15+bob*0.2],
      lel:[cx-46+sway, cy-canvas.height*0.02+bob*0.3], rel:[cx+46+sway, cy-canvas.height*0.02+bob*0.3],
      lwr:[cx-52+sway, cy+canvas.height*0.10+bob*0.4], rwr:[cx+52+sway, cy+canvas.height*0.10+bob*0.4],
      hip:[cx+sway*0.2, cy+canvas.height*0.06+bob*0.5],
      lhip:[cx-22+sway*0.2, cy+canvas.height*0.08+bob*0.5], rhip:[cx+22+sway*0.2, cy+canvas.height*0.08+bob*0.5],
      lkn:[cx-24+sway*0.1, cy+canvas.height*0.24+bob], rkn:[cx+24+sway*0.1, cy+canvas.height*0.24+bob],
      lft:[cx-26, cy+canvas.height*0.40], rft:[cx+26, cy+canvas.height*0.40],
    };
    const bones=[['head','neck'],['neck','lsh'],['neck','rsh'],['lsh','lel'],['lel','lwr'],['rsh','rel'],['rel','rwr'],
      ['lsh','hip'],['rsh','hip'],['hip','lhip'],['hip','rhip'],['lhip','lkn'],['lkn','lft'],['rhip','rkn'],['rkn','rft']];
    ctx.strokeStyle='rgba(111,187,238,0.85)'; ctx.lineWidth=3; ctx.lineCap='round';
    bones.forEach(([a,b])=>{ctx.beginPath();ctx.moveTo(...joints[a]);ctx.lineTo(...joints[b]);ctx.stroke();});
    ctx.fillStyle='#6FBBEE';
    Object.values(joints).forEach(([x,y])=>{ctx.beginPath();ctx.arc(x,y,4,0,7);ctx.fill();});
    startSkeletonLoop._raf=requestAnimationFrame(draw);
  }
  draw();
}
/* ---------- 스쿼트 실시간 자세 판정 (MediaPipe Pose, 실제 웹캠) ---------- */
// calStartCamera ~ calComputeProfile과 같은 방식으로 loadMediaPipe()를 재사용해 별도의
// PoseLandmarker(VIDEO 모드) 인스턴스를 만들고, cam-video에 대해 detectForVideo 루프를 돈다.
let exPoseLandmarker=null;
let exRAF=null;
let exLastVideoTime=-1;
let exRepPhase='up';       // 'up'(서있음) | 'down'(스쿼트 진행중) 2단계 히스테리시스 상태머신
let exMinAngleThisRep=null;
let exTorsoStandingAngle=null; // 이번 렙이 'up'이었을 때 마지막으로 측정된 허리(상체) 각도 — 사람마다 다른 기준 자세를 보정하기 위한 개인 기준선
let exMinTorsoAngleThisRep=null; // 이번 렙 동안 허리가 가장 많이 숙여졌을 때의 각도
let exMediaRecorder=null;
let exRecordedChunks=[];
// 정렬(ready) 단계 상태
let exAlignedSince=null;      // 모든 정렬 조건을 처음으로 만족한 시각(performance.now())
let exLastGuideSpeakTs=0;     // 마지막으로 안내 음성을 말한 시각(반복 스팸 방지)
let exFinalCountdownActive=false;

function exAngleAt(a,b,c){
  const v1x=a.x-b.x, v1y=a.y-b.y, v2x=c.x-b.x, v2y=c.y-b.y;
  const m1=Math.hypot(v1x,v1y), m2=Math.hypot(v2x,v2y);
  if(!m1||!m2) return null;
  let cos=(v1x*v2x+v1y*v2y)/(m1*m2);
  cos=Math.max(-1,Math.min(1,cos));
  return Math.acos(cos)*180/Math.PI;
}
function exKneeAngle(landmarks){
  const idx=CAL_KEYPOINT_IDX;
  const need=[idx.lhip,idx.rhip,idx.lknee,idx.rknee,idx.lank,idx.rank];
  if(need.some(i=>!landmarks[i] || (landmarks[i].visibility??1)<CAL_VIS_THRESHOLD)) return null;
  const l=exAngleAt(landmarks[idx.lhip],landmarks[idx.lknee],landmarks[idx.lank]);
  const r=exAngleAt(landmarks[idx.rhip],landmarks[idx.rknee],landmarks[idx.rank]);
  if(l==null && r==null) return null;
  if(l==null) return r;
  if(r==null) return l;
  return (l+r)/2;
}
// 허리(상체) 각도: 어깨-엉덩이-무릎 사이 각도로, 상체가 얼마나 앞으로 숙여졌는지의 근사치.
// 척추 굴곡 자체를 재는 건 아니지만(landmark가 어깨·엉덩이·무릎뿐이라), 렙 시작 시점(서있는
// 자세) 각도를 개인 기준선으로 잡고 거기서 얼마나 더 숙여졌는지를 보는 상대적 방식이라
// 사람마다 다른 체형·가동범위 차이는 어느 정도 상쇄된다.
function exTorsoAngle(landmarks){
  const idx=CAL_KEYPOINT_IDX;
  const need=[idx.lsh,idx.rsh,idx.lhip,idx.rhip,idx.lknee,idx.rknee];
  if(need.some(i=>!landmarks[i] || (landmarks[i].visibility??1)<CAL_VIS_THRESHOLD)) return null;
  const l=exAngleAt(landmarks[idx.lsh],landmarks[idx.lhip],landmarks[idx.lknee]);
  const r=exAngleAt(landmarks[idx.rsh],landmarks[idx.rhip],landmarks[idx.rknee]);
  if(l==null && r==null) return null;
  if(l==null) return r;
  if(r==null) return l;
  return (l+r)/2;
}
// 저장된 내 체형 캘리브레이션 실루엣을 캠 화면 위에 고정 오버레이해서 자리 잡을 때 맞춰 서는
// 기준으로 쓴다. 얇은 뼈대선(해골 모양)이라 잘 안 보인다는 피드백에 흰색 캡슐+원으로 채운
// 실루엣으로 바꿨었는데, 두께가 실제 체형보다 두꺼워 "뚱뚱해 보인다"는 피드백이 다시 있어
// 두께 배율을 슬림하게 낮추고, 회원가입 때 입력한 키·몸무게(BMI)로 두께를 보정한다.
function exDrawCalibrationGhost(ctx,w,h){
  const profile=state.user.calibration;
  if(!profile || !profile.landmarks) return;
  const pts=profile.landmarks;
  const shoulderPx = pts.lsh&&pts.rsh ? Math.hypot((pts.lsh.x-pts.rsh.x)*w,(pts.lsh.y-pts.rsh.y)*h) : Math.min(w,h)*0.22;
  const bi=profile.bodyInfo||{};
  const {widthFactor} = bodyShapeFactorsFromBmi(bi.bmi, bi.heightCm);
  const limbWidth = Math.max(10, shoulderPx*0.16*widthFactor);
  const headR = Math.max(14, shoulderPx*0.28*widthFactor);

  ctx.save();
  ctx.globalAlpha=0.55;
  ctx.fillStyle='#FFFFFF';
  ctx.strokeStyle='#FFFFFF';
  ctx.lineCap='round'; ctx.lineJoin='round';

  // 팔다리: 두꺼운 선(캡슐)으로 채워서 뭉실하게
  const limbBones=[['lsh','lelbow'],['lelbow','lwrist'],['rsh','relbow'],['relbow','rwrist'],
                    ['lhip','lknee'],['lknee','lank'],['rhip','rknee'],['rknee','rank']];
  ctx.lineWidth=limbWidth;
  limbBones.forEach(([a,b])=>{
    if(!pts[a]||!pts[b]) return;
    ctx.beginPath(); ctx.moveTo(pts[a].x*w, pts[a].y*h); ctx.lineTo(pts[b].x*w, pts[b].y*h); ctx.stroke();
  });

  // 몸통: 어깨-엉덩이 사각형을 채움
  if(pts.lsh&&pts.rsh&&pts.lhip&&pts.rhip){
    ctx.beginPath();
    ctx.moveTo(pts.lsh.x*w, pts.lsh.y*h);
    ctx.lineTo(pts.rsh.x*w, pts.rsh.y*h);
    ctx.lineTo(pts.rhip.x*w, pts.rhip.y*h);
    ctx.lineTo(pts.lhip.x*w, pts.lhip.y*h);
    ctx.closePath(); ctx.fill();
  }

  // 관절 부위를 원으로 채워 이음매를 매끄럽게 이어붙인다
  const jointR = limbWidth*0.5;
  ['lsh','rsh','lelbow','relbow','lwrist','rwrist','lhip','rhip','lknee','rknee','lank','rank'].forEach(key=>{
    const p=pts[key]; if(!p) return;
    ctx.beginPath(); ctx.arc(p.x*w, p.y*h, jointR, 0, Math.PI*2); ctx.fill();
  });

  // 머리: 눈사람 윗덩이처럼 큰 원 하나
  if(pts.nose){
    ctx.beginPath(); ctx.arc(pts.nose.x*w, pts.nose.y*h, headR, 0, Math.PI*2); ctx.fill();
  }

  ctx.restore();
}
// 실제 측정(recording)이 시작되면 서있는 고스트 대신 "앉은(스쿼트 최저점) 자세" 고스트를
// 보여준다 — 정확도 판정 자체가 무릎이 목표 각도(SQUAT_REFERENCE.bottomKneeAngle)까지
// 굽혀졌는지를 보는 것이라, 서있는 자세보다 이쪽이 실제로 맞춰야 할 목표에 훨씬 가깝다.
// 실제 캘리브레이션 landmark를 IK로 구부리는 대신(작은 오차에도 실루엣이 뒤틀려 보일 위험),
// 발 위치·몸 크기·기울어진 방향만 캘리브레이션에서 그대로 가져오고 나머지 관절은 "허벅지가
// 바닥과 수평이 되는" 전형적인 스쿼트 최저점 비율로 배치하는 방식으로 안정적으로 그린다.
function exDrawSquatBottomGhost(ctx,w,h){
  const profile=state.user.calibration;
  if(!profile || !profile.landmarks) return;
  const pts=profile.landmarks;
  if(!pts.lank||!pts.rank||!pts.lhip||!pts.rhip||!pts.lsh||!pts.rsh||!pts.nose) return;
  const footY=(pts.lank.y+pts.rank.y)/2*h;
  const footCX=(pts.lank.x+pts.rank.x)/2*w;
  const bodyH=Math.max(20, footY-pts.nose.y*h); // 코~발목 세로 길이(px) — 서있는 캘리브레이션 기준 스케일
  const shoulderPx=Math.hypot((pts.lsh.x-pts.rsh.x)*w,(pts.lsh.y-pts.rsh.y)*h);
  const bi=profile.bodyInfo||{};
  const {widthFactor}=bodyShapeFactorsFromBmi(bi.bmi, bi.heightCm);
  const limbWidth=Math.max(10, shoulderPx*0.16*widthFactor);
  const headR=Math.max(14, shoulderPx*0.28*widthFactor);
  const jointR=limbWidth*0.5;

  // 상체가 기울어지는 방향은 서있을 때 어깨중심 대비 엉덩이중심의 좌우 위치를 그대로 따른다
  // (사람마다 카메라 앞에서 도는 방향이 다를 수 있어, 캘리브레이션에서 실제로 쓴 방향을 재사용).
  const hipCX0=(pts.lhip.x+pts.rhip.x)/2*w, shCX0=(pts.lsh.x+pts.rsh.x)/2*w;
  const leanSign = (shCX0-hipCX0)>=0 ? 1 : -1;

  const footHalfW=shoulderPx*0.42, kneeHalfW=shoulderPx*0.46, hipHalfW=shoulderPx*0.34, shoulderHalfW=shoulderPx*0.5;
  const kneeY=footY-bodyH*0.22;
  const hipY=footY-bodyH*0.30; // 무릎보다 살짝 높은 정도 — "허벅지가 바닥과 수평" 스쿼트 최저점 기준
  const shoulderY=hipY-bodyH*0.30;
  const shoulderCX=footCX+leanSign*bodyH*0.05;
  const headCY=shoulderY-bodyH*0.11;
  const handY=shoulderY+bodyH*0.20;
  const handHalfW=shoulderPx*0.55;

  ctx.save();
  ctx.globalAlpha=0.55;
  ctx.fillStyle='#FFFFFF';
  ctx.strokeStyle='#FFFFFF';
  ctx.lineCap='round'; ctx.lineJoin='round';
  ctx.lineWidth=limbWidth;

  [-1,1].forEach(side=>{ // 다리: 발 → 무릎(앞으로) → 엉덩이(낮게)
    ctx.beginPath();
    ctx.moveTo(footCX+side*footHalfW, footY);
    ctx.lineTo(footCX+side*kneeHalfW, kneeY);
    ctx.lineTo(footCX+side*hipHalfW*0.7, hipY);
    ctx.stroke();
  });
  [-1,1].forEach(side=>{ // 팔: 어깨 → 균형을 잡기 위해 앞으로 뻗은 손
    ctx.beginPath();
    ctx.moveTo(shoulderCX+side*shoulderHalfW, shoulderY);
    ctx.lineTo(shoulderCX+leanSign*bodyH*0.18+side*handHalfW*0.5, handY);
    ctx.stroke();
  });
  ctx.beginPath(); // 몸통: 앞으로 기운 사각형
  ctx.moveTo(shoulderCX-shoulderHalfW, shoulderY);
  ctx.lineTo(shoulderCX+shoulderHalfW, shoulderY);
  ctx.lineTo(footCX+hipHalfW*0.7, hipY);
  ctx.lineTo(footCX-hipHalfW*0.7, hipY);
  ctx.closePath(); ctx.fill();

  [[footCX-footHalfW,footY],[footCX+footHalfW,footY],
   [footCX-kneeHalfW,kneeY],[footCX+kneeHalfW,kneeY],
   [footCX-hipHalfW*0.7,hipY],[footCX+hipHalfW*0.7,hipY],
   [shoulderCX-shoulderHalfW,shoulderY],[shoulderCX+shoulderHalfW,shoulderY]]
   .forEach(([x,y])=>{ ctx.beginPath(); ctx.arc(x,y,jointR,0,Math.PI*2); ctx.fill(); });

  ctx.beginPath(); ctx.arc(shoulderCX, headCY, headR, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}
// 촬영 시작 직후 'ready' 단계에서 매 프레임 호출: 튜토리얼 촬영 각도(카메라 12시, 몸 2시 방향)와
// 비슷한 조건으로 설 때까지 사람이 뭘 고쳐야 하는지 하나씩 안내한다. 우선순위대로 검사해서
// 가장 먼저 걸리는 문제 하나만 반환 — 한 번에 여러 지적을 쏟아내면 오히려 헷갈리기 때문.
function exCheckAlignment(landmarks){
  const idx=CAL_KEYPOINT_IDX;
  const need=[idx.nose,idx.lsh,idx.rsh,idx.lhip,idx.rhip,idx.lknee,idx.rknee,idx.lank,idx.rank];
  if(need.some(i=>!landmarks[i] || (landmarks[i].visibility??1)<CAL_VIS_THRESHOLD)){
    return {ok:false, msg:'화면에 머리부터 발끝까지 전신이 다 나오게 서주세요'};
  }
  const topY=landmarks[idx.nose].y;
  const botY=(landmarks[idx.lank].y+landmarks[idx.rank].y)/2;
  const bodyHeightRatio=botY-topY;
  if(bodyHeightRatio>CAL_DIST_MAX) return {ok:false, msg:'카메라에서 한 걸음 뒤로 물러나주세요'};
  if(bodyHeightRatio<CAL_DIST_MIN) return {ok:false, msg:'카메라 쪽으로 조금 더 다가와주세요'};

  const hipCenterX=(landmarks[idx.lhip].x+landmarks[idx.rhip].x)/2;
  if(Math.abs(hipCenterX-0.5)>CAL_CENTER_TOL) return {ok:false, msg:'화면 중앙으로 자리를 옮겨주세요'};

  // (2시 방향 회전 자동 체크는 뺐다 — 어깨너비 축소 비율만으로는 "왼쪽으로 돌았는지 오른쪽으로
  // 돌았는지"를 구분할 수 없어서, 반대 방향으로 서도 통과되는 문제가 있었다. 방향은 위쪽 안내
  // 문구로만 알려주고, 자동 판정은 거리·중앙·다리너비·허리자세만 본다.)
  const shoulderW=Math.hypot(landmarks[idx.lsh].x-landmarks[idx.rsh].x, landmarks[idx.lsh].y-landmarks[idx.rsh].y);
  const ankleDist=Math.hypot(landmarks[idx.lank].x-landmarks[idx.rank].x, landmarks[idx.lank].y-landmarks[idx.rank].y);
  if(ankleDist < shoulderW*0.7) return {ok:false, msg:'다리를 어깨너비로 벌려주세요'};

  const torsoAngle=exTorsoAngle(landmarks);
  if(torsoAngle!=null && torsoAngle<TORSO_STANDING_MIN_ANGLE) return {ok:false, msg:'허리를 곧게 펴고 서주세요'};

  return {ok:true, msg:'좋아요! 이 자세를 유지해주세요', torsoAngle};
}
const GRADE_VOICE_LINES = { PERFECT:'퍼펙트!', GREAT:'그레이트!', GOOD:'굿!' };
// 무릎 각도(깊이)와 허리(상체) 각도를 함께 본다. 허리가 기준보다 많이 숙여졌으면(부상 위험)
// 무릎 각도가 아무리 좋아도 안전을 우선해 MISS로 처리하고 교정 멘트를 준다.
function exGradeRep(bottomAngle, torsoDrop){
  if(torsoDrop!=null && torsoDrop>TORSO_LEAN_WARN_DEG){
    return {
      grade:'MISS', angle:Math.round(bottomAngle),
      reason:`허리가 서있을 때보다 ${Math.round(torsoDrop)}° 더 숙여짐(부상 위험, ${TORSO_LEAN_WARN_DEG}° 이내로 유지 필요)`,
      failedJoint:'torso', voice:'허리가 너무 숙여졌어요, 가슴을 펴주세요',
    };
  }
  const ref=SQUAT_REFERENCE;
  const diff=Math.abs(bottomAngle-ref.bottomKneeAngle);
  const angle=Math.round(bottomAngle);
  let grade = diff<=ref.perfectTol ? 'PERFECT' : diff<=ref.greatTol ? 'GREAT' : diff<=ref.goodTol ? 'GOOD' : 'MISS';
  if(grade!=='MISS') return {grade, angle, voice:GRADE_VOICE_LINES[grade]};
  const tooShallow = bottomAngle>ref.bottomKneeAngle; // 무릎이 목표보다 덜 굽혀짐(각도가 큼)
  const reason = tooShallow
    ? `무릎 각도 부족(${angle}°, 기준 ${Math.round(ref.bottomKneeAngle)}° 이하)`
    : `너무 깊게 앉음(${angle}°, 기준 ${Math.round(ref.bottomKneeAngle)}° 근처)`;
  const voice = tooShallow ? '무릎을 더 굽혀주세요' : '너무 깊이 앉았어요';
  return {grade, angle, reason, failedJoint:'knee', voice};
}
// 브라우저 내장 TTS로 판정 멘트를 읽어준다. 빠르게 연속 판정될 때 이전 멘트가 밀리지 않도록
// 새로 말하기 전에 진행 중인 발화를 취소한다.
function speakFeedback(text){
  if(!('speechSynthesis' in window) || !text) return;
  window.speechSynthesis.cancel();
  const utter=new SpeechSynthesisUtterance(text);
  utter.lang='ko-KR';
  utter.rate=1.05;
  window.speechSynthesis.speak(utter);
}
function exFlashGrade(grade){
  const el=document.getElementById('cam-grade-flash');
  if(!el) return;
  el.textContent=grade;
  el.style.color=gradeColor(grade);
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(exFlashGrade._tid);
  exFlashGrade._tid=setTimeout(()=>el.classList.remove('show'),900);
}
// 한 렙(스쿼트 1회)이 끝났을 때: 판정하고 실시간 통계·플래시를 갱신한 뒤, 목표 횟수에
// 도달하면 촬영을 자동 종료한다.
function exRegisterRep(bottomAngle, torsoDrop){
  const result=exGradeRep(bottomAngle, torsoDrop);
  result.atSeconds=state.exercise.seconds; // 리플레이 화면에서 이 렙 순간의 촬영 영상 프레임을 다시 찾기 위한 타임스탬프
  state.exercise.liveReps.push(result);
  const rEl=document.getElementById('live-reps'); if(rEl) rEl.textContent=`${state.exercise.liveReps.length} / ${EXERCISE_REP_TARGET}`;
  const weight={PERFECT:100,GREAT:85,GOOD:70,MISS:0};
  const acc=Math.round(state.exercise.liveReps.reduce((s,r)=>s+weight[r.grade],0)/state.exercise.liveReps.length);
  const aEl=document.getElementById('live-acc'); if(aEl) aEl.textContent=acc+'%';
  exFlashGrade(result.grade);
  speakFeedback(result.voice);
  // 크루대전 중이면 일반 미션 카운터 대신 대전 스코어보드를 갱신한다. 여기서 render()를 부르면
  // 이 콜백을 부른 포즈 인식 루프 자체가 물고 있는 cam-video/cam-canvas가 통째로 새로
  // 그려지며 스트림 연결이 끊기므로, DOM을 직접 패치하는 updateBattleUI()만 쓴다.
  if(state.crewBattle){
    const pts=BATTLE_GRADE_POINTS[result.grade] ?? 0;
    state.crewBattle.myScore+=pts;
    state.crewBattle.myGradeCounts[result.grade]=(state.crewBattle.myGradeCounts[result.grade]||0)+1;
    updateBattleUI('me', pts);
    checkBattleEnd();
    return;
  }
  if(state.exercise.liveReps.length>=EXERCISE_REP_TARGET) toggleRecording();
}
async function exStartPoseLoop(){
  const canvas=document.getElementById('cam-canvas');
  const stage=document.getElementById('cam-stage');
  const video=document.getElementById('cam-video');
  if(!canvas || !stage || !video) return;
  function resize(){canvas.width=stage.clientWidth; canvas.height=stage.clientHeight;}
  resize();
  if(!exPoseLandmarker){
    const {PoseLandmarker, FilesetResolver} = await loadMediaPipe();
    const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
    exPoseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions:{
        modelAssetPath:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
        delegate:'GPU',
      },
      runningMode:'VIDEO', numPoses:1,
    });
  }
  exRepPhase='up'; exMinAngleThisRep=null; exLastVideoTime=-1;
  exTorsoStandingAngle=null; exMinTorsoAngleThisRep=null;
  const ctx=canvas.getContext('2d');
  function loop(){
    if(!document.getElementById('cam-canvas')) return; // 화면 이동 시 자연 종료
    exRAF=requestAnimationFrame(loop);
    if(video.readyState<2 || video.currentTime===exLastVideoTime) return;
    exLastVideoTime=video.currentTime;
    const res=exPoseLandmarker.detectForVideo(video, performance.now());
    ctx.clearRect(0,0,canvas.width,canvas.height);
    // 자리 잡을 때(대기·정렬 단계)는 서있는 캘리브레이션 고스트를, 실제 측정이 시작되면
    // (recording) 무릎을 목표 각도까지 굽힌 "앉은 자세" 고스트로 바꿔서 계속 보여준다 —
    // 정확도 판정 자체가 이 각도를 재는 것이라, 무엇을 맞춰야 하는지 계속 보이는 게 낫다.
    if(state.exercise.camPhase==='recording') exDrawSquatBottomGhost(ctx, canvas.width, canvas.height);
    else exDrawCalibrationGhost(ctx, canvas.width, canvas.height);
    const landmarks=res.landmarks && res.landmarks[0];
    if(landmarks){
      ctx.strokeStyle='#6FBBEE'; ctx.lineWidth=3;
      CAL_CONNECTIONS.forEach(([a,b])=>{
        const pa=landmarks[a], pb=landmarks[b];
        if(!pa||!pb) return;
        ctx.beginPath(); ctx.moveTo(pa.x*canvas.width, pa.y*canvas.height); ctx.lineTo(pb.x*canvas.width, pb.y*canvas.height); ctx.stroke();
      });
      ctx.fillStyle='#6FBBEE';
      landmarks.forEach(p=>{
        if(p.visibility!==undefined && p.visibility<CAL_VIS_THRESHOLD) return;
        ctx.beginPath(); ctx.arc(p.x*canvas.width, p.y*canvas.height, 4, 0, Math.PI*2); ctx.fill();
      });

      if(state.exercise.camPhase==='recording'){
        const angle=exKneeAngle(landmarks);
        const torsoAngle=exTorsoAngle(landmarks);
        if(angle!=null){
          const standing=SQUAT_REFERENCE.standingKneeAngle;
          if(exRepPhase==='up'){
            if(torsoAngle!=null) exTorsoStandingAngle=torsoAngle; // 서있는 동안 계속 갱신 → 렙 시작 직전 값이 개인 기준선이 됨
            if(angle < standing-20){
              exRepPhase='down';
              exMinAngleThisRep=angle;
              exMinTorsoAngleThisRep=torsoAngle;
            }
          } else {
            if(angle<exMinAngleThisRep) exMinAngleThisRep=angle;
            if(torsoAngle!=null && (exMinTorsoAngleThisRep==null || torsoAngle<exMinTorsoAngleThisRep)) exMinTorsoAngleThisRep=torsoAngle;
            if(angle > standing-10){
              const torsoDrop = (exTorsoStandingAngle!=null && exMinTorsoAngleThisRep!=null)
                ? exTorsoStandingAngle-exMinTorsoAngleThisRep : null;
              exRegisterRep(exMinAngleThisRep, torsoDrop);
              exRepPhase='up'; exMinAngleThisRep=null; exMinTorsoAngleThisRep=null;
            }
          }
        }
      } else if(state.exercise.camPhase==='ready' && !exFinalCountdownActive){
        // 카운트다운이 이미 시작된 뒤엔 다시 검사·안내하지 않는다 — 안 그러면 "5,4,3..." 발화 중간에
        // 미세한 흔들림 때문에 교정 멘트가 끼어들어 카운트다운이 끊길 수 있다.
        const result=exCheckAlignment(landmarks);
        const msgEl=document.getElementById('cam-ready-msg');
        if(result.ok){
          if(msgEl) msgEl.textContent=result.msg;
          if(exAlignedSince==null){
            exAlignedSince=performance.now();
            showReadyRing(true);
            speakFeedback('자세를 보정중입니다');
          }
          const heldMs=performance.now()-exAlignedSince;
          setReadyRingPct(heldMs/CAM_ALIGN_HOLD_MS);
          if(!exFinalCountdownActive && heldMs>=CAM_ALIGN_HOLD_MS){
            exFinalCountdownActive=true;
            showReadyRing(false);
            speakFeedback('스쿼트를 시작합니다');
            startFinalCountdown();
          }
        } else {
          exAlignedSince=null;
          showReadyRing(false);
          setReadyRingPct(0);
          if(msgEl) msgEl.textContent=result.msg;
          const now=performance.now();
          if(now-exLastGuideSpeakTs>CAM_GUIDE_SPEAK_INTERVAL_MS){
            exLastGuideSpeakTs=now;
            speakFeedback(result.msg);
          }
        }
      }
    }
  }
  loop();
}

// "촬영 시작"을 눌러도 곧바로 판정하지 않는다. exStartPoseLoop의 'ready' 분기(exCheckAlignment)가
// 매 프레임 거리·중앙정렬·방향(2시)·다리너비·허리자세를 확인하면서 음성으로 안내하고, 그 조건이
// CAM_ALIGN_HOLD_MS 이상 계속 유지되면(원형 게이지가 다 차면) startFinalCountdown()이 3초
// 음성 카운트다운을 한 뒤 beginRecording()으로 넘어간다. (준비 안 된 상태에서 바로 판정을
// 시작하면 첫 렙이 무조건 MISS로 잘못 찍히는 문제 때문에 추가)
function toggleRecording(){
  const isSquat = state.exercise.picked==='squat';
  if(state.exercise.camPhase==='idle'){
    // "촬영 시작"을 누른 순간부터는 버튼·안내 카드를 더 볼 일이 없으니, 모바일에서 무릎
    // 각도까지 잘 보이도록 웹캠 화면을 한 단계 더 키운다(모바일 전용, style.css 참고).
    const stage=document.getElementById('cam-stage');
    if(stage) stage.classList.add('cam-grown');
    if(isSquat) startAlignmentGuide();
    else beginRecording();
    return;
  }
  if(state.exercise.camPhase!=='recording') return; // 'ready' 중엔 버튼이 비활성화돼 있어 여기 안 옴
  stopRecording();
}
function startAlignmentGuide(){
  const btn=document.getElementById('cam-toggle');
  const statusEl=document.getElementById('cam-status');
  const overlay=document.getElementById('cam-ready-overlay');
  const countEl=document.getElementById('cam-ready-count');
  const msgEl=document.getElementById('cam-ready-msg');
  state.exercise.camPhase='ready';
  exAlignedSince=null; exLastGuideSpeakTs=0; exFinalCountdownActive=false;
  if(btn){ btn.disabled=true; btn.textContent='준비중...'; btn.style.opacity='.5'; btn.style.cursor='not-allowed'; }
  if(statusEl) statusEl.textContent='준비중';
  if(overlay) overlay.classList.add('show');
  if(countEl) countEl.textContent='';
  if(msgEl) msgEl.textContent='화면 속 스켈레톤에 맞춰 자리를 잡아주세요';
  showReadyRing(false);
  setReadyRingPct(0);
  speakFeedback('카메라 각도와 거리에 맞춰 자리를 잡아주세요');
}
// 자세 보정(원형 게이지)이 끝난 뒤 호출: "3,2,1,스타트!"를 화면·음성으로 동시에 보여주고
// beginRecording()으로 넘어간다. 아라비아 숫자를 그대로 읽히면 TTS 엔진에 따라 발음이
// 흔들릴 수 있어 한글 숫자로 읽는다.
const CAM_COUNTDOWN_WORDS = ['삼','이','일'];
function startFinalCountdown(){
  const msgEl=document.getElementById('cam-ready-msg');
  if(msgEl) msgEl.textContent='자세가 완벽해요! 이대로 유지해주세요';
  let left=CAM_FINAL_COUNTDOWN_SECONDS;
  const tick=()=>{
    if(!document.getElementById('cam-ready-overlay')) return; // 화면 이동 시 자연 종료
    const countEl=document.getElementById('cam-ready-count');
    if(left>0){
      if(countEl) countEl.textContent=left;
      speakFeedback(CAM_COUNTDOWN_WORDS[CAM_FINAL_COUNTDOWN_SECONDS-left] || String(left));
      left--;
      setTimeout(tick,1000);
    } else {
      if(countEl) countEl.textContent='스타트!';
      speakFeedback('스타트!');
      const overlay=document.getElementById('cam-ready-overlay'); if(overlay) overlay.classList.remove('show');
      const btn=document.getElementById('cam-toggle');
      if(btn){ btn.disabled=false; btn.style.opacity='1'; btn.style.cursor='pointer'; }
      beginRecording();
    }
  };
  tick();
}
function beginRecording(){
  const btn=document.getElementById('cam-toggle');
  const statusEl=document.getElementById('cam-status');
  const timerEl=document.getElementById('cam-timer');
  const isSquat = state.exercise.picked==='squat';
  state.exercise.camPhase='recording';
  state.exercise.seconds=0;
  state.exercise.liveReps=[];
  exRepPhase='up'; exMinAngleThisRep=null; exTorsoStandingAngle=null; exMinTorsoAngleThisRep=null; // 준비 시간 동안 잘못 쌓였을 수 있는 렙 상태 초기화
  if(btn) btn.textContent='촬영 종료';
  if(statusEl) statusEl.textContent='촬영중';
  let reps=0, accBase=82;
  if(isSquat && state.exercise.camStream && window.MediaRecorder){
    exRecordedChunks=[];
    try{
      exMediaRecorder=new MediaRecorder(state.exercise.camStream);
      exMediaRecorder.ondataavailable=e=>{ if(e.data && e.data.size>0) exRecordedChunks.push(e.data); };
      exMediaRecorder.start();
    }catch(err){ console.error('MediaRecorder 시작 실패', err); exMediaRecorder=null; }
  }
  clearInterval(state.exercise.timerId);
  state.exercise.timerId=setInterval(()=>{
    state.exercise.seconds++;
    const m=String(Math.floor(state.exercise.seconds/60)).padStart(2,'0');
    const s=String(state.exercise.seconds%60).padStart(2,'0');
    if(timerEl) timerEl.textContent=`${m}:${s}`;
    if(!isSquat && state.exercise.seconds%3===0){
      reps++;
      const rEl=document.getElementById('live-reps'); if(rEl) rEl.textContent=reps;
      const acc=Math.min(99, accBase + Math.round(Math.random()*14-4));
      const aEl=document.getElementById('live-acc'); if(aEl) aEl.textContent=acc+'%';
    }
  },1000);
}
function stopRecording(){
  const isSquat = state.exercise.picked==='squat';
  clearInterval(state.exercise.timerId);
  const finish=()=>{
    state.exercise.camPhase='idle';
    if(state.exercise.camStream){state.exercise.camStream.getTracks().forEach(t=>t.stop()); state.exercise.camStream=null;}
    // 리플레이 팝업으로 바뀐 뒤에도 웹캠 촬영 화면(cam-canvas)이 그대로 DOM에 남아있어서
    // (자연 종료 조건이던 "cam-canvas가 사라짐"이 더 이상 발생하지 않는다), 실시간 포즈
    // 인식 루프를 명시적으로 멈추지 않으면 화면 뒤에서 계속 빈 프레임을 돌게 된다.
    cancelAnimationFrame(exRAF);
    generateResult();
    // 예전엔 별도의 "리플레이 분석" 단계(step 3)로 넘어갔지만, 지금은 웹캠 촬영 화면에 그대로
    // 남은 채로 결과를 팝업으로 띄운다 — 단계(step)는 그대로 2(웹캠 촬영)를 유지한다.
    state.exercise.replayOpen=true;
    render();
  };
  if(isSquat && exMediaRecorder && exMediaRecorder.state!=='inactive'){
    exMediaRecorder.onstop=()=>{
      if(state.exercise.result && state.exercise.result.myVideoUrl) URL.revokeObjectURL(state.exercise.result.myVideoUrl);
      state.exercise._pendingVideoUrl = exRecordedChunks.length ? URL.createObjectURL(new Blob(exRecordedChunks,{type:'video/webm'})) : null;
      finish();
    };
    exMediaRecorder.stop();
  } else {
    finish();
  }
}
function generateResult(){
  if(state.exercise.picked==='squat' && state.exercise.liveReps.length>0){
    const reps=state.exercise.liveReps.map((r,i)=>({idx:i+1, grade:r.grade, angle:r.angle, atSeconds:r.atSeconds, failedJoint:r.failedJoint||null}));
    const missCount=reps.filter(r=>r.grade==='MISS').length;
    const total=reps.length;
    const valid=total-missCount;
    const weight={PERFECT:100,GREAT:85,GOOD:70,MISS:0};
    const acc=Math.round(reps.reduce((s,r)=>s+weight[r.grade],0)/total);
    const score=valid*10 + acc*3;
    const dur=Math.max(state.exercise.seconds,1);
    const ex=EXS.find(e=>e.id==='squat');
    // 리플레이 비교에 쓸 렙 하나를 고른다: 문제가 있었던 렙(MISS)을 우선하고, 없으면 첫 렙으로.
    const compareRep = reps.find(r=>r.grade==='MISS') || reps[0] || null;
    state.exercise.result={ex:ex.name, dur, total, valid, missCount, acc, score, reps, compareRep, myVideoUrl: state.exercise._pendingVideoUrl||null};
    state.exercise._pendingVideoUrl=null;
    return;
  }
  const dur=Math.max(state.exercise.seconds,9);
  const total=Math.max(6, Math.round(dur/3));
  const reps=[];
  let missCount=0;
  for(let i=0;i<total;i++){
    const roll=Math.random();
    let grade, angle;
    if(roll<0.06){grade='MISS'; angle=Math.round(60+Math.random()*15); missCount++;}
    else if(roll<0.4){grade='PERFECT'; angle=Math.round(88+Math.random()*6);}
    else if(roll<0.75){grade='GREAT'; angle=Math.round(80+Math.random()*8);}
    else {grade='GOOD'; angle=Math.round(72+Math.random()*8);}
    reps.push({idx:i+1,grade,angle});
  }
  const valid=total-missCount;
  const acc=Math.round((reps.reduce((s,r)=>s+(r.grade==='PERFECT'?100:r.grade==='GREAT'?85:r.grade==='GOOD'?70:0),0))/total);
  const score=valid*10 + acc*3;
  const ex=EXS.find(e=>e.id===state.exercise.picked)||EXS[0];
  state.exercise.result={ex:ex.name, dur, total, valid, missCount, acc, score, reps};
}

/* ---------- 리플레이 화면: 내 영상 vs 레퍼런스 정자세 스켈레톤 비교 ---------- */
let exImageLandmarker=null; // 정지 프레임 1장씩 분석하는 용도(IMAGE 모드) — 실시간 루프의 VIDEO 모드 인스턴스와 별개
async function loadImageLandmarker(){
  if(exImageLandmarker) return exImageLandmarker;
  const {PoseLandmarker, FilesetResolver} = await loadMediaPipe();
  const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
  exImageLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions:{
      modelAssetPath:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
      delegate:'GPU',
    },
    runningMode:'IMAGE', numPoses:1,
  });
  return exImageLandmarker;
}
// 판정에서 문제가 된 관절(무릎/허리) 쪽 뼈대만 빨갛게, 나머지는 기본색으로 그린다.
const REP_HIGHLIGHT_BONES = {
  knee: [[23,25],[25,27],[24,26],[26,28]],
  torso: [[11,23],[12,24]],
};
function replayDrawSkeleton(ctx, w, h, landmarks, highlightBones){
  const highlightSet=new Set((highlightBones||[]).map(b=>b.join('-')));
  ctx.lineCap='round';
  CAL_CONNECTIONS.forEach(([a,b])=>{
    const pa=landmarks[a], pb=landmarks[b];
    if(!pa||!pb) return;
    const isBad=highlightSet.has(a+'-'+b)||highlightSet.has(b+'-'+a);
    ctx.strokeStyle=isBad?'#E5645A':'#6FBBEE';
    ctx.lineWidth=isBad?5:3;
    ctx.beginPath(); ctx.moveTo(pa.x*w,pa.y*h); ctx.lineTo(pb.x*w,pb.y*h); ctx.stroke();
  });
  ctx.fillStyle='#fff';
  landmarks.forEach(p=>{
    if(p.visibility!==undefined && p.visibility<CAL_VIS_THRESHOLD) return;
    ctx.beginPath(); ctx.arc(p.x*w,p.y*h,4,0,Math.PI*2); ctx.fill();
  });
}
// 내 영상 쪽 실시간 추적용 인스턴스(VIDEO 모드) — exPoseLandmarker(실시간 촬영용)와는 별개 인스턴스.
let replayMyLandmarker=null;
let replayRAF=null;
let replayLastVideoTime=-1;
async function loadReplayVideoLandmarker(){
  if(replayMyLandmarker) return replayMyLandmarker;
  const {PoseLandmarker, FilesetResolver} = await loadMediaPipe();
  const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
  replayMyLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions:{
      modelAssetPath:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
      delegate:'GPU',
    },
    runningMode:'VIDEO', numPoses:1,
  });
  return replayMyLandmarker;
}
// 촬영이 끝나고 리플레이 화면에 들어오면: 내 촬영 영상은 재생되는 동안(또는 스크럽할 때마다)
// 계속 스켈레톤이 프레임을 따라가도록 매 프레임 추적한다(레퍼런스 GIF 쪽은 스켈레톤 없이
// 원본만 보여준다). 문제가 있었던 렙 시점 근처(±0.4초)에서는 걸렸던 관절(무릎/허리)만
// 빨간 선으로 표시한다.
async function setupReplayComparison(){
  const r=state.exercise.result;
  if(!r || !r.myVideoUrl) return;
  cancelAnimationFrame(replayRAF);

  const video=document.getElementById('replay-my-video');
  const myCanvas=document.getElementById('replay-my-canvas');
  const myStatus=document.getElementById('replay-my-status');
  if(video && myCanvas){
    let landmarker;
    try{ landmarker=await loadReplayVideoLandmarker(); }catch(err){ console.error('리플레이 자세 분석 로딩 실패', err); return; }
    if(!document.getElementById('replay-my-canvas')) return; // 로딩 중 화면 이동했을 수 있음
    replayLastVideoTime=-1;
    const resizeMy=()=>{ myCanvas.width=video.videoWidth||myCanvas.clientWidth; myCanvas.height=video.videoHeight||myCanvas.clientHeight; };
    resizeMy();
    video.addEventListener('loadedmetadata', resizeMy);

    function loopMy(){
      if(!document.getElementById('replay-my-canvas')) return; // 화면 이동 시 자연 종료
      replayRAF=requestAnimationFrame(loopMy);
      if(video.readyState<2 || video.currentTime===replayLastVideoTime) return;
      replayLastVideoTime=video.currentTime;
      const res=landmarker.detectForVideo(video, performance.now());
      const ctx=myCanvas.getContext('2d');
      ctx.clearRect(0,0,myCanvas.width,myCanvas.height);
      const landmarks=res.landmarks && res.landmarks[0];
      if(!landmarks){ if(myStatus) myStatus.textContent='자세가 인식되지 않는 구간이에요'; return; }
      const nearRep = r.compareRep && Math.abs(video.currentTime-(r.compareRep.atSeconds||0))<0.4;
      const highlight = (nearRep && r.compareRep.failedJoint) ? (REP_HIGHLIGHT_BONES[r.compareRep.failedJoint]||[]) : [];
      replayDrawSkeleton(ctx, myCanvas.width, myCanvas.height, landmarks, highlight);
      if(myStatus){
        myStatus.textContent = nearRep
          ? (r.compareRep.failedJoint
              ? `#${r.compareRep.idx}번 자세 · ${r.compareRep.grade} — 빨간 선이 기준과 어긋난 관절이에요`
              : `#${r.compareRep.idx}번 자세 · ${r.compareRep.grade} — 기준과 잘 맞았어요`)
          : '영상을 재생하면 스켈레톤이 계속 따라갑니다';
      }
    }
    loopMy();
    if(r.compareRep){ // 처음 들어왔을 때 문제 됐던 지점으로 자동으로 이동해서 보여준다
      const seekTo=Math.max(0, (r.compareRep.atSeconds||0)-0.15);
      try{ video.currentTime=video.duration ? Math.min(seekTo, video.duration) : seekTo; }catch(e){}
    }
  }

  // 레퍼런스 쪽은 스켈레톤 오버레이 없이 GIF 원본만 보여준다 — "정답"인 원본 영상 그대로 보는 게
  // 더 명확하다는 피드백에 따라 뺐다. (내 촬영 영상 쪽만 스켈레톤/빨간 표시로 비교해준다.)
}

// 예전엔 "리플레이 분석"이 웹캠 촬영 다음의 별도 단계(step)였지만, 촬영이 끝나면 카메라
// 화면 위에 팝업으로 바로 띄우는 방식으로 바뀌었다(stopRecording→finish 참고). 촬영을 마친
// 그 화면 그대로 결과를 이어서 보여주는 게 더 자연스럽다는 판단.
function openReplayPopup(){ state.exercise.replayOpen=true; render(); }
function closeReplayPopup(){ state.exercise.replayOpen=false; render(); }
function renderReplayPopup(){
  const r=state.exercise.result;
  if(!r) return '';
  return `
  <div class="confirm-backdrop">
    <div class="confirm-box" style="max-width:760px;max-height:88vh;overflow-y:auto;text-align:left;">
      <div class="flex-between" style="margin-bottom:4px;">
        <h3 style="margin:0;">리플레이 자세 분석</h3>
        <button class="btn btn-ghost btn-sm" onclick="closeReplayPopup()">닫기</button>
      </div>
      ${r.myVideoUrl ? `
  <div class="grid grid-2" style="margin-bottom:8px;">
    <div>
      <p class="section-label">레퍼런스 정자세</p>
      <div class="cam-stage" style="aspect-ratio:1/1;">
        <img src="Bodyweight_Squats.gif" alt="레퍼런스 스쿼트" style="width:100%;height:100%;object-fit:cover;">
      </div>
    </div>
    <div>
      <p class="section-label">내 촬영 영상</p>
      <div class="cam-stage" style="aspect-ratio:1/1;">
        <video id="replay-my-video" src="${r.myVideoUrl}" controls style="width:100%;height:100%;object-fit:cover;"></video>
        <canvas id="replay-my-canvas" class="cam-overlay-canvas" style="pointer-events:none;"></canvas>
      </div>
      <p class="hint" id="replay-my-status" style="margin-top:6px;">자세 비교 분석 중...</p>
    </div>
  </div>
  <p class="hint" style="margin-bottom:20px;">빨간 선으로 표시된 관절이 기준과 어긋난 부분이에요. 영상을 재생하면 그 시점 스켈레톤은 사라지니, 다시 보려면 새로고침해주세요.</p>` : ''}
  <div class="grid grid-2">
    <div class="card">
      <p class="section-label">${r.ex} · 리플레이 분석 결과</p>
      <div class="stat-row">
        <div class="stat-box"><div class="num mono">${r.total}</div><div class="lbl">총 횟수</div></div>
        <div class="stat-box"><div class="num mono" style="color:var(--accent)">${r.valid}</div><div class="lbl">유효 횟수</div></div>
        <div class="stat-box"><div class="num mono" style="color:var(--danger)">${r.missCount}</div><div class="lbl">MISS</div></div>
        <div class="stat-box"><div class="num mono">${r.acc}%</div><div class="lbl">정확도</div></div>
      </div>
      <p class="section-label">관절 각도 오차 구간</p>
      <div class="progress" style="height:14px;margin-bottom:6px;">
        <span style="width:${r.acc}%;background:${r.acc>85?'var(--accent)':r.acc>70?'var(--gold)':'var(--danger)'}"></span>
      </div>
      <p class="desc">촬영 시간 ${Math.floor(r.dur/60)}분 ${r.dur%60}초 · 평균 정확도 ${r.acc}%</p>
    </div>
    <div class="card">
      <p class="section-label">반복별 판정 (${r.reps.length}회)</p>
      <div class="rep-list">
        ${r.reps.map(rp=>`
          <div class="rep-row">
            <span class="idx">#${rp.idx}</span>
            ${gradePill(rp.grade)}
            <div class="bar-track"><span style="width:${rp.angle}%;background:${gradeColor(rp.grade)}"></span></div>
            <span class="angle">${rp.angle}°</span>
          </div>`).join('')}
      </div>
    </div>
  </div>
      <div style="margin-top:20px;display:flex;gap:8px;align-items:center;">
        ${renderRetakeButton()}
        <button class="btn btn-primary" onclick="saveReplayResult()">결과 저장하기</button>
      </div>
    </div>
  </div>`;
}
function saveReplayResult(){
  state.exercise.replayOpen=false;
  goExStep(3);
}
const FREE_RETAKES = 2;
function renderRetakeButton(){
  const freeLeft = state.exercise.retakesUsed < FREE_RETAKES;
  const freeRemain = FREE_RETAKES - state.exercise.retakesUsed;
  const tickets = state.user.retakeTickets||0;
  const canRetake = freeLeft || tickets>0;
  const label = freeLeft ? `다시 촬영 (무료 ${freeRemain}회 남음)` : (tickets>0 ? `다시 촬영 (티켓 사용 · 보유 ${tickets}장)` : '다시 촬영 (티켓 필요)');
  return `<button class="btn btn-ghost" ${canRetake?'':'disabled style="opacity:.5;cursor:not-allowed;"'} onclick="retakeExercise()">${label}</button>`;
}
function retakeExercise(){
  const ex = state.exercise;
  if(ex.retakesUsed < FREE_RETAKES){
    ex.retakesUsed++;
    toast(`무료 재촬영을 사용합니다 (남은 무료 횟수 ${FREE_RETAKES-ex.retakesUsed}회)`);
  } else if(state.user.retakeTickets>0){
    state.user.retakeTickets--;
    ex.retakesUsed++;
    toast(`다시찍기 티켓을 사용합니다 (남은 티켓 ${state.user.retakeTickets}장)`);
  } else {
    toast('무료 재촬영을 모두 사용했습니다. 포인트 상점에서 다시찍기 티켓을 구매해주세요');
    return;
  }
  if(ex.result && ex.result.myVideoUrl) URL.revokeObjectURL(ex.result.myVideoUrl);
  ex.result = null;
  ex.liveReps = [];
  ex.replayOpen = false;
  goExStep(2);
}

function renderExStepSave(){
  const r=state.exercise.result;
  if(!r) return `<div class="empty-note">저장할 결과가 없습니다.</div>`;
  return `
  <div class="card" style="max-width:520px;">
    <p class="section-label">획득 요약</p>
    <h3 style="font-size:20px;">${r.ex} 세션 완료 ${gradePill(r.acc>90?'PERFECT':r.acc>78?'GREAT':r.acc>60?'GOOD':'MISS')}</h3>
    <div class="stat-row">
      <div class="stat-box"><div class="num mono" style="color:var(--gold)">+${r.score}</div><div class="lbl">획득 점수</div></div>
      <div class="stat-box"><div class="num mono" style="color:var(--gold)">+${Math.round(r.score*0.4)}</div><div class="lbl">포인트</div></div>
      <div class="stat-box"><div class="num mono">${r.acc}%</div><div class="lbl">정확도</div></div>
    </div>
    ${state.guestMode ? `
    <p class="hint" style="margin-bottom:10px;">게스트 모드에서는 기록이 저장되지 않아요. 로그인하면 방금 결과부터 정식으로 기록·포인트 적립이 시작돼요.</p>
    <button class="btn btn-primary btn-block" onclick="goto('login')">로그인하고 기록 저장하기</button>
    <button class="btn btn-ghost btn-block" style="margin-top:8px;" onclick="resetExerciseWizard()">나중에 할게요</button>
    ` : `<button class="btn btn-primary btn-block" onclick="saveExerciseResult()">기록 저장</button>`}
  </div>`;
}
// [백엔드 연동 필요 구간] saveExerciseResult() — 위 섹션 헤더 주석의 파이프라인이
// 실제로 이어지는 지점입니다.
function saveExerciseResult(){
  const r=state.exercise.result;
  const pts=Math.round(r.score*0.4);
  state.user.points += pts;
  state.user.setsUsedToday=(state.user.setsUsedToday||0)+1; // 오늘 가능한 운동세트 한도에서 1세트 소모
  const gc={PERFECT:0,GREAT:0,GOOD:0,MISS:0};
  r.reps.forEach(rp=>gc[rp.grade]++);
  state.history.unshift({date:'오늘', ex:r.ex, reps:r.valid, acc:r.acc, score:r.score, grade:r.acc>90?'PERFECT':r.acc>78?'GREAT':r.acc>60?'GOOD':'MISS', gc});
  // 일간/주간/월간 미션이 공유하는 누적 카운터 갱신 (스쿼트 세션 기준)
  if(r.ex==='스쿼트'){
    const c=state.missions.counters;
    c.reps += r.valid;
    c.perfect += gc.PERFECT;
    c.sessions += 1;
    if(gc.MISS===0) c.missFreeSession += 1;
    if(r.acc>=90) c.accSession += 1;
  }
  // 크루 단체미션: 오늘의 크루미션 종목과 같은 운동을 완료하면 그만큼 크루 종합 점수에 더해진다
  // (크루원 각자의 운동이 곧 크루 미션 진행도가 되는 방식 — 별도 개인 배분 없음).
  if(state.crew.created && r.ex===state.crew.groupMission.ex){
    const gm=state.crew.groupMission;
    gm.progress = Math.min(gm.target, gm.progress + r.valid);
  }
  toast(`저장 완료! +${pts}P 획득`);
  if(r.myVideoUrl) URL.revokeObjectURL(r.myVideoUrl);
  state.exercise={step:0, picked:null, camPhase:'idle', camStream:null, timerId:null, seconds:0, result:null, retakesUsed:0, liveReps:[], replayOpen:false};
  render();
}

/* ========================================================================
   2. 미션·포인트
   ======================================================================== */
// (FR-MS-001) claimMission()에서 보상을 지급하는 지점부터 서버 연동이 필요합니다.
//   세션 저장(saveExerciseResult) > Java 미션 API > DB 연결 > SQL UPDATE(미션 진행 카운터)
//   보상 수령(claimMission) > Java 미션 API > DB 연결 > SQL UPDATE(포인트 잔액, 수령 여부)
// 미션 카테고리는 폐지했다 — 운동 탭 종목선택 화면에 이미 진행 중인 미션이 리스트로 보이고
// (renderTutorialMissionList), 보상 수령은 마이페이지 "미션 달성 현황" 탭(renderMissionProgress)
// 에서 하므로 별도 메뉴가 중복이었다.
