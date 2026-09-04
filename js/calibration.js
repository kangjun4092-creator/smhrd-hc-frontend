// calibration.js — 웹캠 체형 캘리브레이션(MediaPipe Pose). 회원가입 중, 또는 운동 시작 전 필요 시 모달로 열립니다.

const CAL_REQUIRED_HOLD_MS = 2000;
const CAL_VIS_THRESHOLD = 0.55;
const CAL_DIST_MIN = 0.45;
const CAL_DIST_MAX = 0.85;
const CAL_CENTER_TOL = 0.16;
const CAL_KEYPOINT_IDX = {
  nose:0, lsh:11, rsh:12, lelbow:13, relbow:14, lwrist:15, rwrist:16,
  lhip:23, rhip:24, lknee:25, rknee:26, lank:27, rank:28,
};
const CAL_CONNECTIONS = [
  [11,12],[11,13],[13,15],[12,14],[14,16],
  [11,23],[12,24],[23,24],
  [23,25],[25,27],[27,29],[27,31],
  [24,26],[26,28],[28,30],[28,32],
];

let calMediaPipeMod = null;   // 동적 import로 로드한 MediaPipe 모듈 (한 번만 로드)
let calPoseLandmarker = null; // PoseLandmarker 인스턴스
let calVideoStream = null;    // getUserMedia 스트림
let calRunning = false;       // 캘리브레이션 루프 실행 여부
let calRAF = null;            // requestAnimationFrame id
let calLastVideoTime = -1;
let calHoldStart = null;      // 정렬 유지 시작 시각
let calFrameCount = 0, calFpsTs = 0;

function openCalibrationModal(){
  state.signup.calModalOpen = true;
  state.signup.calStage = state.signup.calProfile ? 'done' : 'idle';
  state.signup.calError = '';
  render();
}
function closeCalibrationModal(){
  calStopCamera();
  state.signup.calModalOpen = false;
  render();
}
function calRetake(){
  state.signup.calProfile = null;
  state.signup.calStage = 'idle';
  state.signup.calError = '';
  render();
}
// [백엔드 연동 필요 구간] calApply() 지점: 계산된 관절 좌표·체형 프로필(JSON)을 실제로 남기려면
//   calApply() 호출(여기) > Java 서버 캘리브레이션 저장 API > DB 연결 > SQL INSERT(캘리브레이션 테이블, 또는 JSON 컬럼)
function calApply(){
  state.signup.calibrated = true;
  state.signup.calModalOpen = false;
  toast('체형 보정이 저장되었습니다');
  // 이미 앱 화면(screen==='app')에 들어와 있는 상태 — 실제 로그인 사용자든 게스트든 — 라면
  // 여기서 바로 보정값을 반영해서, 곧장 튜토리얼로 넘어가게 한다.
  if(state.screen==='app'){
    state.user.calibration = state.signup.calProfile;
    if(state.menu==='exercise' && state.exercise.step===0 && state.exercise.picked){
      goExStep(1);
      return;
    }
  }
  render();
}

function calClamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

// 키/몸무게 입력값 → BMI. 가이드 실루엣 보정 및 저장되는 bodyInfo에 함께 쓰인다.
// 성별은 캘리브레이션 화면의 남성/여성 토글(setCalGender)에서 선택한 값을 그대로 담아,
// 이후 캐릭터 생성 시 남성/여성 캐릭터를 구분하는 기준으로 재사용한다.
function calGetBodyInfo(){
  const hEl = document.getElementById('cal-height-input');
  const wEl = document.getElementById('cal-weight-input');
  const heightCm = hEl ? (parseFloat(hEl.value) || null) : null;
  const weightKg = wEl ? (parseFloat(wEl.value) || null) : null;
  const bmi = heightCm && weightKg ? weightKg / ((heightCm/100) ** 2) : null;
  return { heightCm, weightKg, bmi: bmi ? +bmi.toFixed(1) : null, gender: state.signup.gender || 'male' };
}
// 성별 토글은 캘리브레이션 촬영이 진행 중일 수 있어 render()로 화면 전체를 다시 그리지 않고,
// 버튼 두 개의 active 클래스만 직접 바꾼다 (render()를 부르면 video 엘리먼트가 새로 만들어져
// 이미 연결된 카메라 스트림이 끊긴다).
function setCalGender(g){
  state.signup.gender=g;
  document.querySelectorAll('.cal-gender-tab').forEach(el=>{
    el.classList.toggle('active', el.dataset.gender===g);
  });
}
function calBmiCategory(bmi){
  if(bmi==null) return '';
  if(bmi<18.5) return '저체중';
  if(bmi<23) return '표준';
  if(bmi<25) return '과체중';
  return '비만';
}
function calUpdateBmiLabel(){
  const lbl=document.getElementById('cal-bmi-label');
  if(!lbl) return;
  const {heightCm,weightKg,bmi}=calGetBodyInfo();
  if(!heightCm || !weightKg){ lbl.textContent='체형 정보를 입력하면 가이드 실루엣이 내 체형에 맞게 조정돼요.'; return; }
  lbl.textContent = `BMI ${bmi.toFixed(1)} · ${calBmiCategory(bmi)} 기준으로 실루엣을 보정했어요.`;
}
// BMI가 높을수록 실루엣 폭을 넓게, 키가 클수록 하체 비중을 늘려 힙 위치를 살짝 올려준다.
// (회원가입 캘리브레이션 화면·운동 촬영 고스트 양쪽에서 재사용하도록 DOM 의존 없이 값만 받는다.)
function bodyShapeFactorsFromBmi(bmi, heightCm){
  const widthFactor = bmi ? calClamp(0.85 + (bmi-21)*0.012, 0.82, 1.25) : 1;
  const legShift = heightCm ? calClamp((heightCm-165)*0.0006, -0.03, 0.03) : 0;
  return { widthFactor, legShift };
}
function calGetBodyShapeFactors(){
  const {heightCm,bmi}=calGetBodyInfo();
  return bodyShapeFactorsFromBmi(bmi, heightCm);
}

async function loadMediaPipe(){
  if(calMediaPipeMod) return calMediaPipeMod;
  calMediaPipeMod = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14');
  return calMediaPipeMod;
}

async function calStartCamera(){
  const btn=document.getElementById('cal-start-btn');
  if(btn){ btn.disabled=true; btn.textContent='준비 중...'; }
  state.signup.calError='';
  try{
    const {PoseLandmarker, FilesetResolver} = await loadMediaPipe();
    const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
    calPoseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions:{
        modelAssetPath:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
        delegate:'GPU',
      },
      runningMode:'VIDEO', numPoses:1,
    });
    const stream = await navigator.mediaDevices.getUserMedia({video:{width:960,height:720,facingMode:'user'}, audio:false});
    calVideoStream = stream;
    const video=document.getElementById('cal-video');
    video.srcObject=stream;
    await new Promise(res=>{ video.onloadedmetadata=res; });
    video.play();
    const canvas=document.getElementById('cal-canvas');
    canvas.width=video.videoWidth;
    canvas.height=video.videoHeight;
    calRunning=true;
    calHoldStart=null;
    state.signup.calStage='running';
    if(btn) btn.style.display='none';
    calLoop();
  }catch(err){
    console.error(err);
    state.signup.calError = '카메라를 시작할 수 없습니다: '+err.message+' (권한 허용 여부, https 또는 localhost 환경인지 확인해주세요)';
    state.signup.calStage='error';
    render();
  }
}

function calStopCamera(){
  calRunning=false;
  if(calRAF) cancelAnimationFrame(calRAF);
  calRAF=null;
  if(calVideoStream){ calVideoStream.getTracks().forEach(t=>t.stop()); calVideoStream=null; }
}

function calSetCheck(id, ok){
  const el=document.getElementById(id);
  if(!el) return;
  el.classList.toggle('ok', ok===true);
  el.classList.toggle('bad', ok===false);
}

function calEvaluate(landmarks){
  const idx={nose:0,lsh:11,rsh:12,lhip:23,rhip:24,lank:27,rank:28};
  const need=[idx.nose,idx.lsh,idx.rsh,idx.lhip,idx.rhip,idx.lank,idx.rank];
  const bodyOk = need.every(i=>landmarks[i] && (landmarks[i].visibility ?? 1) >= CAL_VIS_THRESHOLD);
  let distOk=false, centerOk=false, bodyHeightRatio=null;
  if(bodyOk){
    const topY=landmarks[idx.nose].y;
    const botY=(landmarks[idx.lank].y+landmarks[idx.rank].y)/2;
    bodyHeightRatio=botY-topY;
    distOk = bodyHeightRatio>=CAL_DIST_MIN && bodyHeightRatio<=CAL_DIST_MAX;
    const hipCenterX=(landmarks[idx.lhip].x+landmarks[idx.rhip].x)/2;
    centerOk = Math.abs(hipCenterX-0.5) <= CAL_CENTER_TOL;
  }
  return { bodyOk, distOk, centerOk, all: bodyOk&&distOk&&centerOk, bodyHeightRatio };
}

// 키·몸무게(BMI) 입력값에 맞춰 크기·비율을 잡은 뒤, 얇은 점선 뼈대가 아니라 두꺼운 흰색
// 캡슐+원으로 채운 실루엣을 그린다(운동 촬영 화면의 고스트와 같은 스타일). 정렬이 되면 흰색은
// 그대로 두고 테두리 색만 파랗게 바꿔서 "채워진 흰색"이라는 느낌은 유지한다.
function calDrawGuideSilhouette(ctx, w, h, aligned){
  const totalH = ((CAL_DIST_MIN+CAL_DIST_MAX)/2) * h;
  const topY = 0.32*h; // 발끝이 화면 아래쪽에 거의 닿도록 실루엣 전체를 아래로 내림 (크기는 그대로, 위치만 이동)
  const cx = 0.5*w;
  const {widthFactor, legShift} = calGetBodyShapeFactors();

  const headR = totalH*0.085*widthFactor;
  const headCY = topY+headR;
  const shoulderY = topY+totalH*0.20;
  const hipY = topY+totalH*(0.52-legShift);
  const kneeY = topY+totalH*(0.76-legShift*0.6);
  const footY = topY+totalH;
  const handY = shoulderY+totalH*0.30;

  const shoulderHalfW = totalH*0.16*widthFactor;
  const hipHalfW = totalH*0.11*widthFactor;
  const handHalfW = totalH*0.30;
  const kneeHalfW = totalH*0.09*widthFactor;
  const footHalfW = totalH*0.11*widthFactor;
  const limbWidth = Math.max(10, totalH*0.05*widthFactor);

  ctx.save();
  ctx.globalAlpha = aligned ? 0.85 : 0.6;
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = aligned ? '#6FBBEE' : '#FFFFFF';
  ctx.lineCap='round'; ctx.lineJoin='round';
  // 사용자 옷 색·배경 밝기와 상관없이 실루엣이 잘 보이도록 어두운 그림자를 깔아 대비를 높인다.
  ctx.shadowColor = 'rgba(0,0,0,0.75)';
  ctx.shadowBlur = 7;

  ctx.lineWidth = limbWidth;
  [-1,1].forEach(side=>{ // 팔: 어깨→손 곡선을 두꺼운 캡슐로
    ctx.beginPath();
    ctx.moveTo(cx+side*shoulderHalfW, shoulderY);
    ctx.quadraticCurveTo(cx+side*handHalfW*0.9, (shoulderY+handY)/2, cx+side*handHalfW, handY);
    ctx.stroke();
  });
  [-1,1].forEach(side=>{ // 다리: 엉덩이→무릎→발
    ctx.beginPath();
    ctx.moveTo(cx+side*hipHalfW*0.7, hipY);
    ctx.lineTo(cx+side*kneeHalfW, kneeY);
    ctx.lineTo(cx+side*footHalfW, footY);
    ctx.stroke();
  });

  ctx.beginPath(); // 몸통: 채운 사각형
  ctx.moveTo(cx-shoulderHalfW, shoulderY);
  ctx.lineTo(cx-hipHalfW, hipY);
  ctx.lineTo(cx+hipHalfW, hipY);
  ctx.lineTo(cx+shoulderHalfW, shoulderY);
  ctx.closePath(); ctx.fill();

  const jointR = limbWidth*0.5; // 관절 이음매를 원으로 채워 캡슐 연결부를 매끄럽게
  [[cx-shoulderHalfW,shoulderY],[cx+shoulderHalfW,shoulderY],
   [cx-hipHalfW*0.7,hipY],[cx+hipHalfW*0.7,hipY],
   [cx-kneeHalfW,kneeY],[cx+kneeHalfW,kneeY],
   [cx-footHalfW,footY],[cx+footHalfW,footY],
   [cx-handHalfW,handY],[cx+handHalfW,handY]].forEach(([x,y])=>{
    ctx.beginPath(); ctx.arc(x,y,jointR,0,Math.PI*2); ctx.fill();
  });

  ctx.beginPath(); ctx.arc(cx, headCY, headR, 0, Math.PI*2); ctx.fill(); // 머리

  ctx.globalAlpha=1;
  ctx.fillStyle = aligned ? '#6FBBEE' : '#FFFFFF';
  ctx.font = `700 ${Math.max(12, w*0.018)}px 'Pretendard', 'Malgun Gothic', sans-serif`;
  ctx.textAlign='center';
  // 캔버스가 CSS로 좌우 반전(셀카뷰)되어 있어 텍스트만 한 번 더 반전시켜 상쇄한다.
  ctx.translate(w,0);
  ctx.scale(-1,1);
  ctx.fillText(aligned ? '정렬 완료' : '이 실루엣 안에 맞춰 서주세요', cx, Math.max(18, topY-10));
  ctx.restore();
}

function calDraw(landmarks, checks){
  const canvas=document.getElementById('cal-canvas');
  if(!canvas) return;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  calDrawGuideSilhouette(ctx, canvas.width, canvas.height, !!(checks && checks.all));
  if(!landmarks) return;
  const w=canvas.width, h=canvas.height;
  ctx.lineWidth=3;
  ctx.strokeStyle = checks.all ? '#6FBBEE' : '#FF8A5E';
  CAL_CONNECTIONS.forEach(([a,b])=>{
    const pa=landmarks[a], pb=landmarks[b];
    if(!pa||!pb) return;
    ctx.beginPath(); ctx.moveTo(pa.x*w, pa.y*h); ctx.lineTo(pb.x*w, pb.y*h); ctx.stroke();
  });
  ctx.fillStyle = checks.all ? '#6FBBEE' : '#FF8A5E';
  landmarks.forEach(p=>{
    if(p.visibility!==undefined && p.visibility<CAL_VIS_THRESHOLD) return;
    ctx.beginPath(); ctx.arc(p.x*w, p.y*h, 4, 0, Math.PI*2); ctx.fill();
  });
}

function calSnapshotDataUrl(){
  const video=document.getElementById('cal-video');
  const snap=document.createElement('canvas');
  snap.width=video.videoWidth; snap.height=video.videoHeight;
  snap.getContext('2d').drawImage(video,0,0,snap.width,snap.height);
  return snap.toDataURL('image/jpeg',0.7);
}
function calComputeMetrics(pts){
  const shoulderWidth=Math.hypot(pts.lsh.x-pts.rsh.x, pts.lsh.y-pts.rsh.y);
  const hipWidth=Math.hypot(pts.lhip.x-pts.rhip.x, pts.lhip.y-pts.rhip.y);
  const torsoLen=Math.hypot(
    (pts.lsh.x+pts.rsh.x)/2-(pts.lhip.x+pts.rhip.x)/2,
    (pts.lsh.y+pts.rsh.y)/2-(pts.lhip.y+pts.rhip.y)/2
  );
  const bodyHeight=((pts.lank.y+pts.rank.y)/2)-pts.nose.y;
  return {
    shoulderWidth:+shoulderWidth.toFixed(4), hipWidth:+hipWidth.toFixed(4),
    torsoLength:+torsoLen.toFixed(4), bodyHeightRatio:+bodyHeight.toFixed(4),
  };
}
function calComputeProfile(landmarks){
  const canvas=document.getElementById('cal-canvas');
  const pts={};
  for(const [key,idx] of Object.entries(CAL_KEYPOINT_IDX)){
    pts[key]={x:+landmarks[idx].x.toFixed(4), y:+landmarks[idx].y.toFixed(4)};
  }
  return {
    createdAt:new Date().toISOString(),
    frameWidth:canvas.width, frameHeight:canvas.height,
    bodyInfo:calGetBodyInfo(),
    snapshot:calSnapshotDataUrl(),
    landmarks:pts,
    normalized:calComputeMetrics(pts),
  };
}

function calLoop(){
  if(!calRunning) return;
  calRAF=requestAnimationFrame(calLoop);
  const video=document.getElementById('cal-video');
  if(!video || video.currentTime===calLastVideoTime) return;
  calLastVideoTime=video.currentTime;

  const ts=performance.now();
  const res=calPoseLandmarker.detectForVideo(video, ts);

  calFrameCount++;
  if(ts-calFpsTs>1000){
    const fpsEl=document.getElementById('cal-fps-badge');
    if(fpsEl) fpsEl.textContent=`${calFrameCount} fps`;
    calFrameCount=0; calFpsTs=ts;
  }

  if(!res.landmarks || res.landmarks.length===0){
    calDraw(null, {all:false});
    calSetCheck('cal-check-body', false);
    calSetCheck('cal-check-dist', false);
    calSetCheck('cal-check-center', false);
    calHoldStart=null;
    const bar=document.getElementById('cal-hold-bar'); if(bar) bar.style.width='0%';
    const lbl=document.getElementById('cal-hold-label'); if(lbl) lbl.textContent='보정 유지 시간 (사람이 인식되지 않았습니다)';
    return;
  }

  const landmarks=res.landmarks[0];
  const checks=calEvaluate(landmarks);
  calDraw(landmarks, checks);
  calSetCheck('cal-check-body', checks.bodyOk);
  calSetCheck('cal-check-dist', checks.bodyOk ? checks.distOk : null);
  calSetCheck('cal-check-center', checks.bodyOk ? checks.centerOk : null);

  const bar=document.getElementById('cal-hold-bar');
  const lbl=document.getElementById('cal-hold-label');
  if(checks.all){
    if(!calHoldStart) calHoldStart=ts;
    const elapsed=ts-calHoldStart;
    const pct=Math.min(100,(elapsed/CAL_REQUIRED_HOLD_MS)*100);
    if(bar) bar.style.width=pct+'%';
    if(lbl) lbl.textContent=`보정 유지 시간 (${(elapsed/1000).toFixed(1)}s / ${(CAL_REQUIRED_HOLD_MS/1000).toFixed(1)}s)`;
    if(elapsed>=CAL_REQUIRED_HOLD_MS){
      const profile=calComputeProfile(landmarks);
      calStopCamera();
      state.signup.calProfile=profile;
      state.signup.calStage='done';
      render();
    }
  } else {
    calHoldStart=null;
    if(bar) bar.style.width='0%';
    const reasons=[];
    if(!checks.bodyOk) reasons.push('전신이 프레임에 보이지 않습니다');
    else{
      if(!checks.distOk) reasons.push(checks.bodyHeightRatio<CAL_DIST_MIN ? '카메라와 더 가까이 서주세요' : '카메라와 더 멀리 떨어져주세요');
      if(!checks.centerOk) reasons.push('화면 중앙으로 이동해주세요');
    }
    if(lbl) lbl.textContent='보정 유지 시간 ('+reasons.join(' · ')+')';
  }
}

function renderCalibrationModal(){
  const s=state.signup;
  const stage=s.calStage||'idle';
  return `
  <div class="confirm-backdrop">
    <div class="confirm-box" style="max-width:min(1080px,94vw);width:100%;">
      <h3>카메라 캘리브레이션</h3>
      <p style="color:var(--ink-dim);font-size:13px;line-height:1.55;margin:0 0 16px;">전신이 화면에 들어오도록 서서, 화면의 점선 실루엣에 맞춰 2초간 자세를 유지하면 자동으로 체형이 저장됩니다.</p>
      ${stage==='done' ? renderCalDone(s) : renderCalLive(s)}
    </div>
  </div>`;
}

function renderCalLive(s){
  return `
  <div class="grid cal-grid">
    <div>
      <div class="cam-stage" style="aspect-ratio:3/4;max-height:70vh;">
        <video id="cal-video" autoplay playsinline muted style="transform:scaleX(-1);width:100%;height:100%;object-fit:cover;"></video>
        <canvas class="cam-overlay-canvas" id="cal-canvas" style="transform:scaleX(-1);"></canvas>
        <div class="cam-badge"><span class="rec-dot"></span><span id="cal-fps-badge">대기중</span></div>
      </div>
      <button class="btn btn-primary btn-block" id="cal-start-btn" style="margin-top:12px;" onclick="calStartCamera()">카메라 시작</button>
      ${s.calError ? `<p class="hint" style="color:var(--danger);margin-top:8px;">${s.calError}</p>` : ''}
    </div>
    <div>
      <div class="check" id="cal-check-body"><span class="dot"></span>전신 인식 (머리~발목)</div>
      <div class="check" id="cal-check-dist" style="margin-top:8px;"><span class="dot"></span>적정 거리</div>
      <div class="check" id="cal-check-center" style="margin-top:8px;"><span class="dot"></span>중앙 정렬</div>
      <div style="margin-top:12px;">
        <div class="hint" id="cal-hold-label">보정 유지 시간</div>
        <div class="progress" style="margin-top:6px;"><span id="cal-hold-bar" style="width:0%"></span></div>
      </div>
      <div class="field" style="margin-top:16px;">
        <label>캐릭터 성별</label>
        <div class="subtabs" style="margin-bottom:0;">
          <div class="tab cal-gender-tab ${s.gender!=='female'?'active':''}" data-gender="male" onclick="setCalGender('male')">남성 캐릭터</div>
          <div class="tab cal-gender-tab ${s.gender==='female'?'active':''}" data-gender="female" onclick="setCalGender('female')">여성 캐릭터</div>
        </div>
      </div>
      <div class="field-row" style="margin-top:16px;">
        <div class="field"><label>키 (cm)</label><input type="number" id="cal-height-input" placeholder="예: 170" oninput="calUpdateBmiLabel()"></div>
        <div class="field"><label>몸무게 (kg)</label><input type="number" id="cal-weight-input" placeholder="예: 65" oninput="calUpdateBmiLabel()"></div>
      </div>
      <p class="hint" id="cal-bmi-label">체형 정보를 입력하면 가이드 실루엣이 내 체형에 맞게 조정돼요.</p>
      <button class="btn btn-ghost btn-block" style="margin-top:14px;" onclick="closeCalibrationModal()">닫기</button>
    </div>
  </div>`;
}

function renderCalDone(s){
  const p=s.calProfile;
  const bi=p.bodyInfo||{};
  return `
  <div class="grid cal-grid">
    <div>
      <div class="cam-stage" style="aspect-ratio:3/4;max-height:70vh;">
        <canvas id="cal-edit-canvas" style="width:100%;height:100%;display:block;cursor:grab;"></canvas>
      </div>
      <p class="hint" style="margin-top:8px;">보정 완료 · ${new Date(p.createdAt).toLocaleString()} · 점을 드래그하면 관절 위치를 바로 수정할 수 있어요.</p>
      <div id="cal-edit-point-list" style="display:flex;flex-direction:column;gap:5px;margin-top:10px;max-height:210px;overflow-y:auto;"></div>
    </div>
    <div>
      <div class="stat-row" style="margin:0 0 12px;">
        <div class="stat-box"><div class="num mono" id="cal-edit-m-shoulder">${p.normalized.shoulderWidth}</div><div class="lbl">어깨너비</div></div>
        <div class="stat-box"><div class="num mono" id="cal-edit-m-height">${p.normalized.bodyHeightRatio}</div><div class="lbl">신장비율</div></div>
        ${bi.bmi ? `<div class="stat-box"><div class="num mono">${bi.bmi}</div><div class="lbl">BMI</div></div>` : ''}
      </div>
      <button class="btn btn-primary btn-block" onclick="calApply()">이 보정값 적용하기</button>
      <button class="btn btn-secondary btn-block" style="margin-top:8px;" onclick="calRetake()">다시 촬영</button>
      <button class="btn btn-ghost btn-block" style="margin-top:8px;" onclick="closeCalibrationModal()">닫기</button>
    </div>
  </div>`;
}

/* ---------- 캘리브레이션 완료 후 관절 포인트 직접 편집 (calibrationeditor.html 로직을 모달 내로 이식) ---------- */
// (FR-AC-003) 이 구간(calSetupEditCanvas ~ calEditEndDrag)은 캔버스 위에서 점을 드래그해
// 좌표만 수정하는 순수 프론트엔드 로직입니다 — 별도 백엔드 호출 없이, 위 calApply()가
// 실행될 때 수정된 좌표까지 함께 저장 API로 넘어가면 됩니다.
const CAL_EDIT_POINTS=[
  {key:'nose', label:'코(머리)', color:'#6FBBEE'},
  {key:'lsh', label:'왼쪽 어깨', color:'#F0B93A'}, {key:'rsh', label:'오른쪽 어깨', color:'#F0B93A'},
  {key:'lelbow', label:'왼쪽 팔꿈치', color:'#C88CFF'}, {key:'relbow', label:'오른쪽 팔꿈치', color:'#C88CFF'},
  {key:'lwrist', label:'왼쪽 손목', color:'#8CD0FF'}, {key:'rwrist', label:'오른쪽 손목', color:'#8CD0FF'},
  {key:'lhip', label:'왼쪽 골반', color:'#FF8A5E'}, {key:'rhip', label:'오른쪽 골반', color:'#FF8A5E'},
  {key:'lknee', label:'왼쪽 무릎', color:'#4A7CFF'}, {key:'rknee', label:'오른쪽 무릎', color:'#4A7CFF'},
  {key:'lank', label:'왼쪽 발목', color:'#E5645A'}, {key:'rank', label:'오른쪽 발목', color:'#E5645A'},
];
const CAL_EDIT_BONES=[
  ['lsh','rsh'],['lsh','lhip'],['rsh','rhip'],['lhip','rhip'],
  ['lsh','lelbow'],['lelbow','lwrist'],['rsh','relbow'],['relbow','rwrist'],
  ['lhip','lknee'],['lknee','lank'],['rhip','rknee'],['rknee','rank'],
];
let calEditImg=null, calEditImgSrc=null, calEditSelectedKey=null, calEditDragKey=null;

function calSetupEditCanvas(){
  const canvas=document.getElementById('cal-edit-canvas');
  const profile=state.signup.calProfile;
  if(!canvas || !profile) return;
  canvas.width=profile.frameWidth||640;
  canvas.height=profile.frameHeight||480;

  if(calEditImgSrc!==profile.snapshot){
    calEditImg=new Image();
    calEditImgSrc=profile.snapshot;
    calEditImg.onload=calEditRender;
    calEditImg.src=profile.snapshot;
  } else {
    calEditRender();
  }

  canvas.onmousedown=calEditStartDrag;
  canvas.onmousemove=calEditMoveDrag;
  window.onmouseup=calEditEndDrag;
  canvas.ontouchstart=calEditStartDrag;
  canvas.ontouchmove=calEditMoveDrag;
  window.ontouchend=calEditEndDrag;
}
function calEditRender(){
  const canvas=document.getElementById('cal-edit-canvas');
  const profile=state.signup.calProfile;
  if(!canvas || !profile) return;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(calEditImg && calEditImg.complete) ctx.drawImage(calEditImg,0,0,canvas.width,canvas.height);

  const pts=profile.landmarks;
  ctx.strokeStyle='rgba(111,187,238,0.75)'; ctx.lineWidth=3;
  CAL_EDIT_BONES.forEach(([a,b])=>{
    if(!pts[a]||!pts[b]) return;
    ctx.beginPath();
    ctx.moveTo(pts[a].x*canvas.width, pts[a].y*canvas.height);
    ctx.lineTo(pts[b].x*canvas.width, pts[b].y*canvas.height);
    ctx.stroke();
  });
  CAL_EDIT_POINTS.forEach(({key,color})=>{
    const p=pts[key]; if(!p) return;
    const isSel=key===calEditSelectedKey;
    ctx.beginPath();
    ctx.arc(p.x*canvas.width, p.y*canvas.height, isSel?10:7, 0, Math.PI*2);
    ctx.fillStyle=color; ctx.fill();
    if(isSel){ ctx.lineWidth=2; ctx.strokeStyle='#fff'; ctx.stroke(); }
  });
  calEditUpdatePointList();
}
function calEditUpdatePointList(){
  const list=document.getElementById('cal-edit-point-list');
  const profile=state.signup.calProfile;
  if(!list || !profile) return;
  const pts=profile.landmarks;
  list.innerHTML=CAL_EDIT_POINTS.map(({key,label,color})=>{
    const p=pts[key]; if(!p) return '';
    const sel=key===calEditSelectedKey;
    return `<div onclick="calEditSelectPoint('${key}')" style="display:flex;align-items:center;gap:8px;font-size:12px;padding:7px 10px;border-radius:8px;background:var(--surface-2);cursor:pointer;border:1px solid ${sel?'var(--accent)':'transparent'};color:${sel?'var(--accent)':'inherit'};">
      <span style="width:9px;height:9px;border-radius:50%;background:${color};flex:none;"></span>${label}
      <span class="mono" style="margin-left:auto;font-size:11px;color:var(--ink-faint);">${p.x.toFixed(3)}, ${p.y.toFixed(3)}</span>
    </div>`;
  }).join('');
  const m=profile.normalized;
  const shEl=document.getElementById('cal-edit-m-shoulder'); if(shEl) shEl.textContent=m.shoulderWidth;
  const htEl=document.getElementById('cal-edit-m-height'); if(htEl) htEl.textContent=m.bodyHeightRatio;
}
function calEditSelectPoint(key){ calEditSelectedKey=key; calEditRender(); }
function calEditCanvasPos(evt){
  const canvas=document.getElementById('cal-edit-canvas');
  const rect=canvas.getBoundingClientRect();
  const scaleX=canvas.width/rect.width, scaleY=canvas.height/rect.height;
  const clientX=evt.touches?evt.touches[0].clientX:evt.clientX;
  const clientY=evt.touches?evt.touches[0].clientY:evt.clientY;
  return { x:(clientX-rect.left)*scaleX, y:(clientY-rect.top)*scaleY };
}
function calEditHitTest(mx,my){
  const canvas=document.getElementById('cal-edit-canvas');
  const pts=state.signup.calProfile.landmarks;
  let best=null, bestDist=18;
  CAL_EDIT_POINTS.forEach(({key})=>{
    const p=pts[key]; if(!p) return;
    const d=Math.hypot(p.x*canvas.width-mx, p.y*canvas.height-my);
    if(d<bestDist){ bestDist=d; best=key; }
  });
  return best;
}
function calEditStartDrag(evt){
  const {x,y}=calEditCanvasPos(evt);
  const hit=calEditHitTest(x,y);
  if(hit){ calEditDragKey=hit; calEditSelectedKey=hit; calEditRender(); evt.preventDefault(); }
}
function calEditMoveDrag(evt){
  if(!calEditDragKey) return;
  const canvas=document.getElementById('cal-edit-canvas');
  const {x,y}=calEditCanvasPos(evt);
  const nx=Math.min(1,Math.max(0,x/canvas.width));
  const ny=Math.min(1,Math.max(0,y/canvas.height));
  const profile=state.signup.calProfile;
  profile.landmarks[calEditDragKey]={x:+nx.toFixed(4), y:+ny.toFixed(4)};
  profile.normalized=calComputeMetrics(profile.landmarks);
  calEditRender();
  evt.preventDefault();
}
function calEditEndDrag(){ calEditDragKey=null; }

/* ---------- 로그인 ---------- */
// renderLogin: 입력 폼 렌더링만 담당하는 프론트엔드 로직. 실제 인증 처리는 아래 doLogin() 지점 참고.
