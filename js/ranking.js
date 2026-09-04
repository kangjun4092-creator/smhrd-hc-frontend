// ranking.js — '랭킹' 카테고리: 지역별/종목별/크루 랭킹.

const RANK_TABS=['지역별 랭킹','운동 종목별 랭킹','크루 랭킹'];
function renderRanking(){
  const i=state.subtabs.ranking;
  return `
  <div class="view-head"><h1>랭킹</h1><p>지역별 랭킹 → 운동 종목별 랭킹 → 크루 랭킹</p></div>
  <div class="subtabs">
    ${RANK_TABS.map((t,idx)=>`<div class="tab ${i===idx?'active':''}" onclick="setSub('ranking',${idx})">${t}</div>`).join('')}
  </div>
  ${i===0?renderRankRegion(): i===1?renderRankExercise(): renderCrewRegionRank()}`;
}
// (#7) 1~3등은 캐릭터를 올림픽 단상 형태로, 4등부터는 기존 리스트로 보여주는 공용 포디움 컴포넌트.
// rows는 이미 순위(rank)가 매겨진 배열이어야 하며, name/level/score 필드를 사용한다.
// (#2) 1~3위는 아바타 원이 아니라 실제 픽셀 캐릭터를 단상 위에 세운다. 랭킹에 오른 다른
// 사용자의 실제 장착 아이템·성별 데이터는 없으므로, 이름을 시드로 한 결정론적 값으로
// 캐릭터 외형(성별·의상 유무)만 살짝 다르게 흉내낸다.
function renderPodium(rows){
  const byRank=r=>rows.find(x=>x.rank===r);
  const first=byRank(1), second=byRank(2), third=byRank(3);
  const step=(r,cls,size)=>{
    if(!r) return '<div class="podium-step" style="visibility:hidden;"></div>';
    const cid=`podium-char-${cls}-${Math.abs(hashStr(r.name+cls))}`;
    return `
    <div class="podium-step ${cls}">
      <canvas class="podium-canvas" id="${cid}" data-seed="${r.name}" style="width:${size}px;height:${Math.round(size*1.22)}px;"></canvas>
      <div class="podium-name">${r.name}${r.isMe?' <span class="pill pill-accent">나</span>':''}</div>
      ${r.level!=null?`<div class="podium-lv mono">Lv.${r.level}</div>`:''}
      <div class="podium-score mono">${r.isMe?'내 점수 ':''}${r.score.toLocaleString()}</div>
      <div class="podium-stand">${r.rank}</div>
    </div>`;
  };
  return `<div class="podium">${step(second,'rank2',52)}${step(first,'rank1',66)}${step(third,'rank3',52)}</div>`;
}
// 화면에 존재하는 모든 포디움 캔버스를 그린다. (render() 끝에서 매번 호출 — 포디움이 없는
// 화면에서는 querySelectorAll 결과가 비어 있어 아무 일도 하지 않는다.)
function drawPodiumChars(){
  document.querySelectorAll('canvas.podium-canvas').forEach(canvas=>{
    const seed=canvas.dataset.seed||'x';
    const h=hashStr(seed);
    const equip={ outfit:h%2===0, crown:false, badge:false, background:false, skin:false };
    const gender=h%3===0?'female':'male';
    drawPixelCharacter(canvas, equip, gender);
  });
}
const PERSON_NAME_POOL=['런닝수달','써니핏','단백질맨','헬스왕','조깅요정','버피장인','파워워커','헬스메이트','런지킹','조깅단장','바다사나이','배드민턴킹'];
// 동(dong)을 시드로 결정론적인 이웃 랭킹을 만든다. 실제로는 SQL SELECT ... ORDER BY 점수로 대체될 자리.
function getDongPersonRanking(dong){
  const seed=hashStr(dong+'person');
  const names=[];
  let idx=seed;
  while(names.length<4){
    idx=(idx*48271+1)%2147483647;
    const nm=PERSON_NAME_POOL[idx%PERSON_NAME_POOL.length];
    if(!names.includes(nm)) names.push(nm);
  }
  return names.map((name,i)=>({ name, level:Math.max(1, 11-i*2-(seed%3)), score:5100-i*380-(seed%90) }));
}
function totalScore(){ return state.history.reduce((s,h)=>s+h.score,0); }
// (#16) 지역별 랭킹: 시/구/동 드롭다운으로 좁히고, 순위 집계는 동 기준을 유지한다.
function getRegionRanking(dong){
  const myDong = state.user.region.trim().split(/\s+/).pop();
  const neighbors = getDongPersonRanking(dong).map(n=>({...n, isMe:false}));
  const rows = dong===myDong
    ? [...neighbors.slice(0,3), {name:state.user.nickname||'홈트초보', score:totalScore(), level:state.user.level, isMe:true}]
    : neighbors;
  return rows.sort((a,b)=>b.score-a.score).map((r,i)=>({...r, rank:i+1}));
}
function renderRankRegion(){
  const f=state.rankFilter;
  const cities=Object.keys(REGION_DATA);
  const city=REGION_DATA[f.city]?f.city:cities[0];
  const gus=Object.keys(REGION_DATA[city]);
  const gu=REGION_DATA[city][f.gu]?f.gu:gus[0];
  const dongs=REGION_DATA[city][gu];
  const dong=dongs.includes(f.dong)?f.dong:dongs[0];
  const rows=getRegionRanking(dong);
  const rest=rows.filter(r=>r.rank>3);
  return `
  <div class="filter-bar">
    <select onchange="setRankCity(this.value)">${cities.map(c=>`<option ${c===city?'selected':''}>${c}</option>`).join('')}</select>
    <select onchange="setRankGu(this.value)">${gus.map(g=>`<option ${g===gu?'selected':''}>${g}</option>`).join('')}</select>
    <select onchange="setRankDong(this.value)">${dongs.map(d=>`<option ${d===dong?'selected':''}>${d}</option>`).join('')}</select>
  </div>
  ${renderPodium(rows)}
  ${rest.length?`
  <div class="table-wrap">
    <table>
      <thead><tr><th>순위</th><th>닉네임</th><th>레벨</th><th>누적 점수</th></tr></thead>
      <tbody>
        ${rest.map(r=>`
          <tr>
            <td><span class="rank-num">${r.rank}</span></td>
            <td><span class="name-cell"><span class="user-avatar" style="background:${avatarColor(r.rank-1)}">${avatarInitial(r.name)}</span>${r.name}${r.isMe?' <span class="pill pill-accent">나</span>':''}</span></td>
            <td class="mono">Lv.${r.level}</td>
            <td class="mono">${r.score.toLocaleString()}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>`:''}`;
}
function setRankCity(v){ state.rankFilter={city:v, gu:null, dong:null}; render(); }
function setRankGu(v){ state.rankFilter.gu=v; state.rankFilter.dong=null; render(); }
function setRankDong(v){ state.rankFilter.dong=v; render(); }

// (#17) 운동 종목별 랭킹: 시/구/동 + 운동종목 드롭다운. 점수는 해당 종목의 누적 점수를 의미한다.
function getExerciseRanking(dong, ex){
  const seed=hashStr(dong+ex);
  const names=[];
  let idx=seed;
  while(names.length<4){
    idx=(idx*48271+1)%2147483647;
    const nm=PERSON_NAME_POOL[idx%PERSON_NAME_POOL.length];
    if(!names.includes(nm)) names.push(nm);
  }
  const rows = names.map((name,i)=>({ name, level:Math.max(1, 10-i*2-(seed%3)), score:420-i*35-(seed%40) }));
  const myDong = state.user.region.trim().split(/\s+/).pop();
  if(dong===myDong){
    const myScore = state.history.filter(h=>h.ex===ex).reduce((s,h)=>s+h.score,0);
    rows[rows.length-1] = {name:state.user.nickname||'홈트초보', level:state.user.level, score:myScore, isMe:true};
  }
  return rows.sort((a,b)=>b.score-a.score).map((r,i)=>({...r, rank:i+1}));
}
function renderRankExercise(){
  const f=state.exRankFilter;
  const cities=Object.keys(REGION_DATA);
  const city=REGION_DATA[f.city]?f.city:cities[0];
  const gus=Object.keys(REGION_DATA[city]);
  const gu=REGION_DATA[city][f.gu]?f.gu:gus[0];
  const dongs=REGION_DATA[city][gu];
  const dong=dongs.includes(f.dong)?f.dong:dongs[0];
  const ex=EXS.some(e=>e.name===f.ex)?f.ex:EXS[0].name;
  const rows=getExerciseRanking(dong, ex);
  const rest=rows.filter(r=>r.rank>3);
  return `
  <div class="filter-bar">
    <select onchange="setExRankCity(this.value)">${cities.map(c=>`<option ${c===city?'selected':''}>${c}</option>`).join('')}</select>
    <select onchange="setExRankGu(this.value)">${gus.map(g=>`<option ${g===gu?'selected':''}>${g}</option>`).join('')}</select>
    <select onchange="setExRankDong(this.value)">${dongs.map(d=>`<option ${d===dong?'selected':''}>${d}</option>`).join('')}</select>
    <select onchange="setExRankEx(this.value)">${EXS.map(e=>`<option ${e.name===ex?'selected':''}>${e.name}</option>`).join('')}</select>
  </div>
  <p class="hint" style="margin:-6px 0 14px;">점수는 ${ex} 종목의 누적 점수 기준입니다.</p>
  ${renderPodium(rows)}
  ${rest.length?`
  <div class="table-wrap">
    <table>
      <thead><tr><th>순위</th><th>닉네임</th><th>${ex} 누적점수</th></tr></thead>
      <tbody>${rest.map(r=>`<tr><td><span class="rank-num">${r.rank}</span></td><td>${r.name}${r.isMe?' <span class="pill pill-accent">나</span>':''}</td><td class="mono">${r.score.toLocaleString()}</td></tr>`).join('')}</tbody>
    </table>
  </div>`:''}`;
}
function setExRankCity(v){ state.exRankFilter={...state.exRankFilter, city:v, gu:null, dong:null}; render(); }
function setExRankGu(v){ state.exRankFilter.gu=v; state.exRankFilter.dong=null; render(); }
function setExRankDong(v){ state.exRankFilter.dong=v; render(); }
function setExRankEx(v){ state.exRankFilter.ex=v; render(); }
