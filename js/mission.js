// mission.js — 일간 미션 카드/진행도/보상 수령. 서버(GET /api/missions/today)가 오늘의 미션 3개를
// 자동 생성해서 현재 진행도(current)까지 계산해 내려준다 — 운동 기록을 저장할 때마다 서버가
// 카운터를 갱신하므로(ExerciseService.saveResult → MissionService.recordSquatSession), 프론트는
// 받은 값을 그대로 표시하고 운동 완료 직후 다시 불러오기만 하면 된다.

const MISSION_PERIOD_LABEL={daily:'일간'};
// 미션 카드 하나. 진행도는 퍼센트가 아니라 실제 개수(cur/target)로 보여준다. 미션을 진행하는
// 동작(운동 시작)은 이제 운동 탭 종목선택 화면에 이 미션들이 직접 리스트로 보이므로(
// renderTutorialMissionList 참고) 여기엔 달성 후 "보상 받기"만 남는다.
function renderMissionCard(m){
  const cur=Math.min(m.current, m.target);
  const done=m.achieved;
  const claimed=m.claimed;
  return `
  <div class="card">
    <div class="flex-between"><span class="pill pill-muted">일간</span><span class="pill ${done?'pill-accent':'pill-muted'}">${claimed?'수령완료':done?'달성':'진행중'}</span></div>
    <h3 style="margin-top:8px;">${m.label}</h3>
    <div class="progress" style="margin:10px 0;"><span style="width:${Math.min(100,cur/m.target*100)}%"></span></div>
    <div class="flex-between">
      <p class="desc mono" style="margin:0;">${cur}/${m.target} <span style="color:var(--gold);font-weight:700;">· +${m.reward}P</span></p>
      ${done ? `<button class="btn btn-sm ${claimed?'btn-ghost':'btn-primary'}" ${claimed?'disabled style="opacity:.4;cursor:not-allowed;"':''} onclick="claimMission(${m.id})">${claimed?'수령완료':'보상 받기'}</button>` : ''}
    </div>
  </div>`;
}
// 일간 미션을 조회할 때 쓴다(미션 달성 현황 탭, 운동 종목선택·튜토리얼 옆 리스트 등).
function allMissions(){
  return state.missions.today;
}
function renderMissionProgress(){
  return `
  <div class="grid grid-2">
    ${allMissions().map(m=>renderMissionCard(m)).join('')}
  </div>`;
}
async function loadTodayMissions(){
  if(!state.token) return;
  try{
    const res = await fetch(`${API_BASE}/api/missions/today`, {
      headers: { 'Authorization': 'Bearer ' + state.token }
    });
    const body = await res.json();
    if(!body.success) return;
    state.missions.today = body.data.map(m => ({
      id: m.id, metric: m.metric, label: m.label, target: m.target,
      current: m.current, reward: m.reward, achieved: m.achieved, claimed: m.claimed,
    }));
    render();
  }catch(err){
    console.error('미션 불러오기 실패', err);
  }
}
async function claimMission(id){
  const m=allMissions().find(x=>x.id===id);
  if(!m || m.claimed || !m.achieved) return;
  try{
    const res = await fetch(`${API_BASE}/api/missions/${id}/claim`, {
      method:'POST',
      headers:{ 'Authorization':'Bearer '+state.token }
    });
    const body = await res.json();
    if(!body.success){ toast(body.message || '보상 수령에 실패했습니다'); return; }
    m.claimed = true;
    state.user.points += body.data.pointsAwarded;
    toast(`'${m.label}' 보상으로 +${body.data.pointsAwarded}P 받았습니다`);
    render();
  }catch(err){
    toast('서버에 연결할 수 없습니다');
  }
}
