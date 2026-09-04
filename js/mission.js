// mission.js — 일간 미션 카드/진행도/보상 수령.

const MISSION_PERIOD_LABEL={daily:'일간'};
// 미션 카드 하나. 진행도는 퍼센트가 아니라 실제 개수(cur/target)로 보여준다. 미션을 진행하는
// 동작(운동 시작)은 이제 운동 탭 종목선택 화면에 이 미션들이 직접 리스트로 보이므로(
// renderTutorialMissionList 참고) 여기엔 달성 후 "보상 받기"만 남는다.
function renderMissionCard(m){
  const cur=Math.min(state.missions.counters[m.metric]||0, m.target);
  const done=cur>=m.target;
  const claimed=!!state.missions.claimed[m.id];
  return `
  <div class="card">
    <div class="flex-between"><span class="pill pill-muted">${MISSION_PERIOD_LABEL[m.period]}</span><span class="pill ${done?'pill-accent':'pill-muted'}">${claimed?'수령완료':done?'달성':'진행중'}</span></div>
    <h3 style="margin-top:8px;">${m.label}</h3>
    <div class="progress" style="margin:10px 0;"><span style="width:${Math.min(100,cur/m.target*100)}%"></span></div>
    <div class="flex-between">
      <p class="desc mono" style="margin:0;">${cur}/${m.target} <span style="color:var(--gold);font-weight:700;">· +${m.reward}P</span></p>
      ${done ? `<button class="btn btn-sm ${claimed?'btn-ghost':'btn-primary'}" ${claimed?'disabled style="opacity:.4;cursor:not-allowed;"':''} onclick="claimMission('${m.id}')">${claimed?'수령완료':'보상 받기'}</button>` : ''}
    </div>
  </div>`;
}
// 일간 미션을 조회할 때 쓴다(미션 달성 현황 탭, 운동 종목선택·튜토리얼 옆 리스트 등).
function allMissions(){
  return state.missions.list.daily;
}
function renderMissionProgress(){
  return `
  <div class="grid grid-2">
    ${allMissions().map(m=>renderMissionCard(m)).join('')}
  </div>`;
}
function claimMission(id){
  if(state.missions.claimed[id]) return;
  const m=allMissions().find(x=>x.id===id);
  if(!m) return;
  const cur=state.missions.counters[m.metric]||0;
  if(cur<m.target) return;
  state.missions.claimed[id]=true;
  state.user.points += m.reward;
  toast(`'${m.label}' 보상으로 +${m.reward}P 받았습니다`);
  render();
}
