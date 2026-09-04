// crew.js — '홈크루' 카테고리: 생성/가입/공지/멤버관리/채팅/크루대전(5vs5).

const CREW_MISSION_EX_OPTIONS = EXS.map(e=>e.name);
// 팀장일 때만 '크루원관리' 탭이 추가로 붙는다 (가입요청 승인·강퇴는 팀장 전용 화면으로 분리).
function getCrewPageTabs(){
  const tabs=['크루 메인','크루채팅','크루공지','오늘의 단체 미션','크루원 정보'];
  if(getMyCrewRole()==='팀장') tabs.push('크루원관리');
  return tabs;
}
// 크루를 만들 때 반드시 하나 고르는 컨셉 태그. 가입 목록 카드와 크루 내부(view-head)에
// 계속 노출해서, 이 크루가 어떤 성향인지 한눈에 알 수 있게 한다.
const CREW_CONCEPTS=['다이어트','크루랭킹','친목','근육강화','건강유지'];
const CREW_EXP_PER_LEVEL=2000; // 크루 레벨업에 필요한 경험치량 (레벨마다 동일하게 고정)
function setCrewConcept(c){ state.crew.concept=c; render(); }
// 우리동네 크루 가입하기 목록. 검색·지역 필터·페이지네이션 데모를 위해 여러 지역에 걸쳐 구성했다.
const JOINABLE_CREWS=[
  {name:'역삼동 러너스', level:11, score:4820, leader:'써니핏', regionCity:'서울시', regionGu:'강남구', regionDong:'역삼동', desc:'매일 아침 6시 인증 러닝 크루입니다.', concept:'건강유지'},
  {name:'삼성동 스쿼트클럽', level:6, score:2400, leader:'헬스왕', regionCity:'서울시', regionGu:'강남구', regionDong:'삼성동', desc:'스쿼트 하나만 파는 크루예요.', concept:'근육강화'},
  {name:'합정 플랭커즈', level:9, score:3990, leader:'런닝수달', regionCity:'서울시', regionGu:'마포구', regionDong:'합정동', desc:'플랭크 최강자를 가립니다.', concept:'근육강화'},
  {name:'망원 버피팀', level:7, score:2950, leader:'버피장인', regionCity:'서울시', regionGu:'마포구', regionDong:'망원동', desc:'버피로 체지방 태우는 크루.', concept:'다이어트'},
  {name:'성수 스쿼트단', level:8, score:3650, leader:'단백질맨', regionCity:'서울시', regionGu:'성동구', regionDong:'성수동', desc:'단백질 챙겨먹고 스쿼트하는 사람들.', concept:'근육강화'},
  {name:'해운대 러너스', level:10, score:4100, leader:'바다사나이', regionCity:'부산시', regionGu:'해운대구', regionDong:'우동', desc:'해변 따라 뛰는 부산 크루.', concept:'건강유지'},
  {name:'중동 조깅클럽', level:5, score:1800, leader:'조깅요정', regionCity:'부산시', regionGu:'해운대구', regionDong:'중동', desc:'가볍게 조깅부터 시작해요.', concept:'친목'},
  {name:'봉명 홈트팀', level:4, score:1300, leader:'대전홈트', regionCity:'대전시', regionGu:'유성구', regionDong:'봉명동', desc:'대전 유성구 홈트 초보 모임.', concept:'친목'},
  {name:'오룡 파워워커즈', level:9, score:3800, leader:'파워워커', regionCity:'전남광주통합특별시', regionGu:'북구', regionDong:'오룡동', desc:'빠르게 걷기부터 파워워킹까지.', concept:'다이어트'},
  {name:'상무 헬스메이트', level:8, score:3400, leader:'헬스메이트', regionCity:'전남광주통합특별시', regionGu:'서구', regionDong:'상무동', desc:'헬스 초보 환영하는 크루.', concept:'친목'},
  {name:'역삼 런지크루', level:6, score:2200, leader:'런지킹', regionCity:'서울시', regionGu:'강남구', regionDong:'역삼동', desc:'런지 100개 챌린지 진행중.', concept:'크루랭킹'},
  {name:'오룡 조깅단', level:5, score:1900, leader:'조깅단장', regionCity:'전남광주통합특별시', regionGu:'북구', regionDong:'오룡동', desc:'주말마다 함께 조깅해요.', concept:'친목'},
];
function renderCrew(){
  const i=state.subtabs.crew;
  if(!state.crew.created){
    // 크루가 아직 없을 때는 "우리동네 크루 가입하기"를 기본 화면으로 보여주고(가입이 더 흔한
    // 시작점이라), 크루를 새로 만들고 싶은 사람만 오른쪽 위 버튼으로 생성 화면을 연다.
    const creating = i===1;
    return `
    <div class="view-head flex-between">
      <div>
        <h1>홈크루</h1>
        <p>${creating ? '새 크루를 만들어보세요' : '우리동네 크루에 가입해보세요'}</p>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="${(!creating && state.guestMode) ? "goto('login')" : `setSub('crew',${creating?0:1})`}">${creating?'← 가입하기로 돌아가기':'크루 생성'}</button>
    </div>
    ${creating?renderCrewCreate():renderCrewJoin()}`;
  }
  const tabs=getCrewPageTabs();
  const activeTab=tabs[i]||tabs[0];
  return `
  <div class="view-head"><h1>${state.crew.name} ${state.crew.concept?`<span class="pill pill-accent" style="vertical-align:middle;">#${state.crew.concept}</span>`:''}</h1><p>크루 메인 → 크루채팅 → 크루공지 → 오늘의 단체 미션 → 크루원 정보</p></div>
  <div class="subtabs">
    ${tabs.map((t,idx)=>`<div class="tab ${i===idx?'active':''}" onclick="setSub('crew',${idx})">${t}</div>`).join('')}
  </div>
  ${activeTab==='크루 메인'?renderCrewOverview()
    :activeTab==='크루채팅'?renderCrewChat()
    :activeTab==='크루공지'?renderCrewNotice()
    :activeTab==='오늘의 단체 미션'?renderCrewAssign()
    :activeTab==='크루원 정보'?renderCrewMembers()
    :renderCrewManage()}`;
}
function renderCrewCreate(){
  return `
  <div class="card" style="max-width:480px;">
    <p class="section-label">새 크루 만들기 (포인트 100 소모)</p>
    <div class="field">
      <label>활동 지역</label>
      <div class="hint" style="padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:var(--surface-2);">${state.user.region} <span style="color:var(--ink-faint);">(캘리브레이션 시 등록된 활동 지역)</span></div>
    </div>
    <div class="field"><label for="cr-name">크루 이름</label><input id="cr-name" placeholder="예: 역삼동 스쿼트단"></div>
    <div class="field"><label for="cr-desc">크루 소개</label><textarea id="cr-desc" rows="3" placeholder="어떤 크루인지 소개해주세요"></textarea></div>
    <div class="field">
      <label>크루 컨셉 (하나 선택, 필수)</label>
      <div style="display:flex;flex-wrap:wrap;gap:8px;">
        ${CREW_CONCEPTS.map(c=>`<button type="button" class="btn btn-sm ${state.crew.concept===c?'btn-primary':'btn-secondary'}" onclick="setCrewConcept('${c}')">#${c}</button>`).join('')}
      </div>
    </div>
    <button class="btn btn-primary btn-block" onclick="createCrew()">100P로 크루 생성</button>
  </div>`;
}
function createCrew(){
  if(state.user.points<100){toast('포인트가 부족합니다'); return;}
  if(!state.crew.concept){toast('크루 컨셉을 하나 선택해주세요'); return;}
  const name=document.getElementById('cr-name').value.trim() || '역삼동 스쿼트단';
  const desc=document.getElementById('cr-desc').value.trim() || '함께 성장하는 홈트 크루입니다.';
  // (#8) 중복된 크루명 방지 — 실제로는 DB에 SQL SELECT로 존재 여부를 물어야 한다.
  if(JOINABLE_CREWS.some(c=>c.name===name)){ toast('이미 사용중인 크루 이름입니다'); return; }
  state.user.points -= 100;
  state.crew.created=true;
  state.crew.name=name;
  state.crew.desc=desc;
  state.crew.region=state.user.region;
  state.crew.level=1;
  state.crew.exp=120;
  state.crew.members=[
    {n:'나', role:'팀장', level:state.user.level, score:totalScore()},
    {n:'써니핏', role:'팀원', level:8, score:3200},
    {n:'런닝수달', role:'팀원', level:9, score:3800},
    {n:'단백질맨', role:'팀원', level:6, score:2100},
  ];
  state.subtabs.crew=0;
  toast('크루가 생성되었습니다');
  render();
}
const CREW_JOIN_PAGE_SIZE=8;
function renderCrewJoin(){
  const s=state.crew;
  const cities=Object.keys(REGION_DATA);
  const fCity = s.joinCity && REGION_DATA[s.joinCity] ? s.joinCity : null;
  const gus = fCity ? Object.keys(REGION_DATA[fCity]) : [];
  const fGu = fCity && s.joinGu && REGION_DATA[fCity][s.joinGu] ? s.joinGu : null;
  const dongs = fGu ? REGION_DATA[fCity][fGu] : [];
  const fDong = fGu && s.joinDong && dongs.includes(s.joinDong) ? s.joinDong : null;

  const list = JOINABLE_CREWS.filter(c=>{
    if(s.joinSearch && !c.name.includes(s.joinSearch)) return false;
    if(fCity && c.regionCity!==fCity) return false;
    if(fGu && c.regionGu!==fGu) return false;
    if(fDong && c.regionDong!==fDong) return false;
    if(s.joinConcept && c.concept!==s.joinConcept) return false;
    return true;
  });
  const totalPages=Math.max(1, Math.ceil(list.length/CREW_JOIN_PAGE_SIZE));
  const page=Math.min(s.joinPage||1, totalPages);
  const pageItems=list.slice((page-1)*CREW_JOIN_PAGE_SIZE, page*CREW_JOIN_PAGE_SIZE);

  return `
  <div class="field" style="max-width:360px;"><label for="crew-search-input">크루명 검색</label><input id="crew-search-input" placeholder="크루 이름으로 검색" value="${s.joinSearch||''}"
    oninput="if(!this.dataset.composing) setCrewJoinSearch(this.value)"
    oncompositionstart="this.dataset.composing='1'"
    oncompositionend="this.dataset.composing=''; setCrewJoinSearch(this.value)"></div>
  <div class="filter-bar">
    <select onchange="setCrewJoinCity(this.value)">
      <option value="">시 전체</option>
      ${cities.map(c=>`<option ${c===fCity?'selected':''}>${c}</option>`).join('')}
    </select>
    <select onchange="setCrewJoinGu(this.value)" ${fCity?'':'disabled'}>
      <option value="">구 전체</option>
      ${gus.map(g=>`<option ${g===fGu?'selected':''}>${g}</option>`).join('')}
    </select>
    <select onchange="setCrewJoinDong(this.value)" ${fGu?'':'disabled'}>
      <option value="">동 전체</option>
      ${dongs.map(d=>`<option ${d===fDong?'selected':''}>${d}</option>`).join('')}
    </select>
  </div>
  <div class="field" style="margin-top:8px;">
    <label>크루 컨셉 <span class="hint" style="margin:0;">(선택, 필수 아님)</span></label>
    <div style="display:flex;flex-wrap:wrap;gap:8px;">
      <button type="button" class="btn btn-sm ${!s.joinConcept?'btn-primary':'btn-secondary'}" onclick="setCrewJoinConcept('')">전체</button>
      ${CREW_CONCEPTS.map(c=>`<button type="button" class="btn btn-sm ${s.joinConcept===c?'btn-primary':'btn-secondary'}" onclick="setCrewJoinConcept('${c}')">#${c}</button>`).join('')}
    </div>
  </div>
  <div class="grid grid-3">
    ${pageItems.length ? pageItems.map(c=>`
      <div class="card">
        <div class="flex-between"><h3 style="margin:0;">${c.name}</h3><span class="pill pill-gold">Lv.${c.level}</span></div>
        <span class="pill pill-accent" style="margin-top:6px;">#${c.concept}</span>
        <p class="desc" style="margin-top:8px;">${c.desc}</p>
        <p class="hint" style="margin:0 0 4px;">${c.regionCity} ${c.regionGu} ${c.regionDong}</p>
        <p class="hint" style="margin:0 0 10px;">크루장 · ${c.leader}</p>
        <button class="btn btn-primary btn-block" style="margin-top:0;" onclick="${state.guestMode ? "goto('login')" : `joinCrew('${c.name}')`}">가입요청하기</button>
      </div>`).join('') : '<div class="empty-note" style="grid-column:1/-1;">조건에 맞는 크루가 없어요.</div>'}
  </div>
  ${totalPages>1?`
  <div class="flex-between" style="margin-top:16px;justify-content:center;gap:14px;">
    <button class="btn btn-sm btn-ghost" ${page<=1?'disabled style="opacity:.4;cursor:not-allowed;"':''} onclick="setCrewJoinPage(${page-1})">이전</button>
    <span class="hint" style="margin:0;">${page} / ${totalPages} 페이지</span>
    <button class="btn btn-sm btn-ghost" ${page>=totalPages?'disabled style="opacity:.4;cursor:not-allowed;"':''} onclick="setCrewJoinPage(${page+1})">다음</button>
  </div>`:''}`;
}
function setCrewJoinSearch(v){
  state.crew.joinSearch=v; state.crew.joinPage=1; render();
  setTimeout(()=>{ const el=document.getElementById('crew-search-input'); if(el){ el.focus(); el.selectionStart=el.selectionEnd=el.value.length; } },0);
}
function setCrewJoinCity(v){ state.crew.joinCity=v||null; state.crew.joinGu=null; state.crew.joinDong=null; state.crew.joinPage=1; render(); }
function setCrewJoinGu(v){ state.crew.joinGu=v||null; state.crew.joinDong=null; state.crew.joinPage=1; render(); }
function setCrewJoinDong(v){ state.crew.joinDong=v||null; state.crew.joinPage=1; render(); }
function setCrewJoinConcept(v){ state.crew.joinConcept=v||null; state.crew.joinPage=1; render(); }
function setCrewJoinPage(p){ state.crew.joinPage=p; render(); }
function joinCrew(name){
  const c=JOINABLE_CREWS.find(c=>c.name===name);
  if(!c) return;
  state.crew.created=true;
  state.crew.name=c.name;
  state.crew.desc=c.desc;
  state.crew.concept=c.concept;
  state.crew.region=`${c.regionCity} ${c.regionGu} ${c.regionDong}`;
  state.crew.level=c.level;
  state.crew.exp=Math.round(c.score*0.3);
  state.crew.members=[
    {n:c.leader, role:'팀장', level:c.level, score:c.score},
    {n:'나', role:'팀원', level:state.user.level, score:totalScore()},
  ];
  state.subtabs.crew=0;
  toast(`${c.name}에 가입했습니다`);
  render();
}
function getMyCrewRole(){
  const me=state.crew.members.find(m=>m.n==='나');
  return me?me.role:'팀원';
}
function toggleMyCrewRole(){
  const me=state.crew.members.find(m=>m.n==='나');
  if(!me) return;
  me.role = me.role==='팀장' ? '팀원' : '팀장';
  toast(`내 역할이 '${me.role}'(으)로 바뀌었습니다 (테스트용 전환)`);
  state.subtabs.crew=0;
  render();
}
// 크루원 레벨 비율에 맞춰 전체 목표 횟수를 개인별 목표로 나눈다. (#9)
function getCrewMissionTargets(){
  const totalLevel = state.crew.members.reduce((s,m)=>s+m.level,0)||1;
  const gm=state.crew.groupMission;
  return state.crew.members.map(m=>({
    ...m,
    target: Math.max(5, Math.round(gm.totalTarget * (m.level/totalLevel))),
  }));
}
// 실제로는 오늘 촬영한 운동 기록과 연동돼야 할 진행률이지만, 이 프로토타입에는 그 연결이
// 없으므로 이름을 시드로 한 결정론적 값으로 흉내낸다.
function getCrewMemberProgress(name, target){
  const seed=hashStr(name+state.crew.groupMission.ex+state.crew.groupMission.period);
  return Math.round(target * ((seed%70)+15)/100);
}
function renderCrewOverview(){
  const members=state.crew.members;
  const contribTotal=members.reduce((s,m)=>s+m.score,0)||1;
  const ranked=[...members].sort((a,b)=>b.score-a.score).map((m,i)=>({...m, rank:i+1, pct:Math.round(m.score/contribTotal*100)}));
  const dongRank=getMyDongCrewRank();
  const gm=state.crew.groupMission;
  const targets=getCrewMissionTargets();
  const mine=targets.find(m=>m.n==='나');
  const myPct=mine?Math.min(100, Math.round(getCrewMemberProgress('나',mine.target)/mine.target*100)):0;
  const expInLevel = (state.crew.exp||0) % CREW_EXP_PER_LEVEL;
  const party=state.crewParty;
  const partyStatus = !party.invites
    ? '아직 대전 파티가 없어요.'
    : party.ready
      ? '✅ 파티 완료! 대전을 시작할 수 있어요.'
      : `파티 신청 중 · ${party.invites.filter(x=>x.status==='accepted').length}/${party.invites.length}명 수락`;
  return `
  <div class="grid grid-2" style="align-items:start;">
    <div class="card">
      <p class="section-label">크루 레벨 · 누적 경험치</p>
      <div class="stat-row">
        <div class="stat-box"><div class="num mono">Lv.${state.crew.level}</div><div class="lbl">크루 레벨</div></div>
        <div class="stat-box"><div class="num mono">${(state.crew.exp||0).toLocaleString()}</div><div class="lbl">누적 경험치</div></div>
        <div class="stat-box"><div class="num mono">#${dongRank.rank}</div><div class="lbl">${dongRank.dong} 순위</div></div>
      </div>
      <p class="hint" style="margin:10px 0 4px;">레벨업까지 <b class="mono" style="color:var(--ink);">${expInLevel.toLocaleString()} / ${CREW_EXP_PER_LEVEL.toLocaleString()}</b></p>
      <div class="progress" style="height:8px;margin:0;"><span style="width:${Math.round(expInLevel/CREW_EXP_PER_LEVEL*100)}%"></span></div>
    </div>
    <div class="card">
      <p class="section-label">크루 미션 누적점수</p>
      ${ranked.map(m=>`
        <div class="rep-row">
          <span class="rank-num ${m.rank===1?'top':''}" style="min-width:24px;height:22px;">${m.rank}</span>
          <span class="user-avatar" style="width:22px;height:22px;font-size:10px;flex:none;background:${avatarColor(m.rank-1)}">${avatarInitial(m.n)}</span>
          <span style="width:64px;">${m.n}${m.n==='나'?' <span class="pill pill-accent">나</span>':''}</span>
          <div class="bar-track"><span style="width:${m.pct}%;background:var(--accent)"></span></div>
          <span class="angle mono">${m.score.toLocaleString()}점</span>
        </div>`).join('')}
    </div>
  </div>
  <div class="card" style="margin-top:14px;">
    <p class="section-label">내게 배분된 미션</p>
    <div class="flex-between"><h3 style="margin:0;">${mine?(mine.assignedEx||gm.ex):gm.ex}</h3><span class="pill pill-accent">${gm.period==='daily'?'일일':'주간'}</span></div>
    <p class="desc" style="margin:8px 0;">목표 ${mine?mine.target:'-'}회</p>
    <div class="progress" style="margin:6px 0;"><span style="width:${myPct}%"></span></div>
    <p class="hint" style="margin:0;">진행률 ${myPct}% · 자세한 배분 현황은 '오늘의 단체 미션' 탭에서 확인하세요.</p>
  </div>
  <div class="card" style="margin-top:14px;max-width:520px;">
    <div class="flex-between">
      <div>
        <p class="section-label" style="margin:0 0 4px;">5vs5 크루대전</p>
        <p class="desc" style="margin:0 0 4px;">비슷한 레벨의 크루와 실시간으로 스쿼트 점수 채우기 대결을 해보세요.</p>
        <p class="hint" style="margin:0;">${partyStatus} ${party.invites?`<button class="btn btn-ghost btn-sm" style="padding:2px 8px;" onclick="openPartyStatus()">파티 현황 보기</button>`:''}</p>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;flex:none;">
        <button class="btn btn-secondary btn-sm" onclick="openPartyInvite()">크루대전파티맺기</button>
        <button class="btn btn-primary btn-sm" ${party.ready?'':'disabled style="opacity:.45;cursor:not-allowed;"'} onclick="startCrewBattle()">대전 시작</button>
      </div>
    </div>
  </div>`;
}

/* ---------- 크루채팅 ----------
   실제 서비스라면 WebSocket으로 다른 크루원의 진짜 메시지를 실시간으로 받아야 하지만,
   이 프로토타입은 혼자 쓰는 목업이라 "내가 보내면 잠시 뒤 크루원 중 한 명이 랜덤 문구로
   답장하는" 형태로 흉내낸다. 매 메시지마다 render()를 다시 부르면 스크롤 위치·입력창이
   날아가므로, updateBattleUI()와 같은 방식으로 채팅 로그 DOM에만 말풍선을 append한다. */
const CREW_CHAT_AUTO_REPLIES=['오늘도 화이팅!','저도 방금 시작했어요','다들 페이스 좋으시네요 👍','조금 이따 같이 인증해요','오늘 미션 거의 다 채웠어요!'];
function renderCrewChat(){
  const msgs=state.crew.chat.messages;
  return `
  <div class="chat-wrap" style="max-width:560px;">
    <div class="chat-log" id="crew-chat-log">
      ${msgs.map(m=>`
        <div class="bubble ${m.mine?'me':'them'}">
          ${m.mine?'':`<div class="who">${m.who}</div>`}${m.text}
        </div>`).join('')}
    </div>
    <div class="chat-input">
      <input id="crew-chat-input" placeholder="크루원에게 메시지 보내기" onkeydown="if(event.key==='Enter'){ event.preventDefault(); sendCrewChat(); }">
      <button class="btn btn-primary btn-sm" onclick="sendCrewChat()">전송</button>
    </div>
  </div>`;
}
function scrollCrewChatToBottom(){
  const log=document.getElementById('crew-chat-log');
  if(log) log.scrollTop=log.scrollHeight;
}
function appendChatBubble(m){
  const log=document.getElementById('crew-chat-log');
  if(!log) return;
  const div=document.createElement('div');
  div.className='bubble '+(m.mine?'me':'them');
  div.innerHTML=(m.mine?'':`<div class="who">${m.who}</div>`)+m.text;
  log.appendChild(div);
  scrollCrewChatToBottom();
}
function sendCrewChat(){
  const el=document.getElementById('crew-chat-input');
  if(!el) return;
  const text=el.value.trim();
  if(!text) return;
  const msg={who:'나', mine:true, text, time:''};
  state.crew.chat.messages.push(msg);
  appendChatBubble(msg);
  el.value='';
  const others=state.crew.members.filter(x=>x.n!=='나');
  if(others.length){
    setTimeout(()=>{
      // 그 사이에 다른 탭으로 이동했으면 답장을 건너뛴다(엉뚱한 화면 DOM을 건드리지 않기 위해).
      if(!(state.screen==='app' && state.menu==='crew' && getCrewPageTabs()[state.subtabs.crew]==='크루채팅')) return;
      const who=others[Math.floor(Math.random()*others.length)].n;
      const reply=CREW_CHAT_AUTO_REPLIES[Math.floor(Math.random()*CREW_CHAT_AUTO_REPLIES.length)];
      const rm={who, mine:false, text:reply, time:''};
      state.crew.chat.messages.push(rm);
      appendChatBubble(rm);
    }, 900+Math.random()*1300);
  }
}

/* ---------- 5vs5 크루대전 파티맺기 ----------
   크루장·크루원 모두 대전을 시작하려면 먼저 "파티"를 맺어야 한다. 데려갈 크루원을
   체크박스로 골라 신청하면(선택은 필수 아님 — 아무도 안 고르면 바로 파티 완료 처리)
   각 크루원에게 초대가 가고, 10초 안에 수락해야 파티에 합류한다. 실제 서비스라면
   상대방이 진짜 알림을 받고 직접 수락 버튼을 눌러야 하지만, 이 프로토타입은 혼자 쓰는
   목업이라 2~8초 사이 랜덤 시점에 자동으로 수락한 것처럼 흉내낸다. 초대 전원이
   수락/시간초과로 결론나면 "대전 시작" 버튼이 눌리게 활성화된다. */
function openPartyInvite(){
  if(state.crewBattle) return;
  state.crewParty.open=true;
  state.crewParty.selected=[];
  render();
}
function closePartyInvite(){ state.crewParty.open=false; render(); }
function togglePartyPick(name){
  const sel=state.crewParty.selected;
  const idx=sel.indexOf(name);
  if(idx>=0) sel.splice(idx,1); else sel.push(name);
  render();
}
function sendPartyInvites(){
  const picked=[...state.crewParty.selected];
  state.crewParty.open=false;
  if(!picked.length){
    state.crewParty.invites=[];
    state.crewParty.ready=true;
    toast('파티원 없이 바로 대전을 시작할 수 있어요');
    render();
    return;
  }
  state.crewParty.invites=picked.map(n=>({n, status:'pending', timeLeft:10}));
  state.crewParty.ready=false;
  state.crewParty.statusOpen=true;
  toast('파티 신청을 보냈어요 · 10초 안에 수락하면 파티에 합류해요');
  state.crewParty.invites.forEach(inv=>{
    setTimeout(()=>acceptPartyInvite(inv.n), 2000+Math.random()*6000);
  });
  startPartyTicker();
  render();
}
function acceptPartyInvite(name){
  const p=state.crewParty;
  if(!p.invites) return;
  const inv=p.invites.find(x=>x.n===name);
  if(!inv || inv.status!=='pending') return;
  inv.status='accepted';
  toast(`🔔 ${name}님이 파티 신청을 수락했어요`);
  updatePartyStatusModal();
  checkPartyReady();
}
// 실시간 카운트다운·수락 상태는 render()를 다시 타지 않고 상태창 DOM만 직접 패치한다
// (크루채팅과 마찬가지로, 매초 전체를 다시 그리면 다른 화면에서 입력 중이던 값이 날아간다).
function updatePartyStatusModal(){
  const p=state.crewParty;
  if(!p.invites) return;
  p.invites.forEach((inv,i)=>{
    const el=document.querySelector(`#party-inv-${i} .party-inv-status`);
    if(el) el.textContent = inv.status==='accepted'?'✅ 수락':inv.status==='expired'?'⏱ 시간초과':`대기중 (${inv.timeLeft}초)`;
  });
  const summary=document.getElementById('party-status-summary');
  if(summary) summary.textContent=`${p.invites.filter(x=>x.status==='accepted').length}/${p.invites.length}명 수락`;
  const startBtn=document.getElementById('party-status-start-btn');
  if(startBtn) startBtn.style.display = p.ready ? 'inline-flex' : 'none';
}
function startPartyTicker(){
  clearInterval(state.crewParty.tickId);
  state.crewParty.tickId=setInterval(()=>{
    const p=state.crewParty;
    if(!p.invites){ clearInterval(p.tickId); return; }
    let expired=false;
    p.invites.forEach(inv=>{
      if(inv.status==='pending'){
        inv.timeLeft=Math.max(0, inv.timeLeft-1);
        if(inv.timeLeft===0){ inv.status='expired'; expired=true; }
      }
    });
    updatePartyStatusModal();
    if(expired) checkPartyReady();
  }, 1000);
}
function checkPartyReady(){
  const p=state.crewParty;
  if(!p.invites || !p.invites.every(x=>x.status!=='pending')) return;
  if(p.ready) return;
  p.ready=true;
  clearInterval(p.tickId);
  toast('파티가 완성됐어요! 이제 대전을 시작할 수 있어요');
  if(state.screen==='app' && state.menu==='crew') render();
  else updatePartyStatusModal();
}
function openPartyStatus(){ state.crewParty.statusOpen=true; render(); }
function closePartyStatus(){ state.crewParty.statusOpen=false; render(); }
function renderPartyInviteModal(){
  const others=state.crew.members.filter(m=>m.n!=='나');
  const sel=state.crewParty.selected;
  return `
  <div class="confirm-backdrop" onclick="if(event.target===this) closePartyInvite()">
    <div class="confirm-box" style="max-width:340px;">
      <h3 style="margin:0 0 4px;">대전 파티원 선택</h3>
      <p class="hint" style="margin:0 0 12px;">함께 데려갈 크루원을 골라 파티를 신청하세요. 아무도 선택하지 않아도 바로 대전을 시작할 수 있어요.</p>
      <div style="display:flex;flex-direction:column;gap:8px;max-height:220px;overflow-y:auto;">
        ${others.length? others.map(m=>`
          <label style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--line);border-radius:8px;cursor:pointer;">
            <input type="checkbox" ${sel.includes(m.n)?'checked':''} onchange="togglePartyPick('${m.n}')">
            <span style="flex:1;">${m.n}</span><span class="pill ${m.role==='팀장'?'pill-gold':'pill-muted'}">${m.role}</span>
          </label>`).join('') : '<p class="hint" style="margin:0;">초대할 다른 크루원이 없어요.</p>'}
      </div>
      <div class="confirm-actions" style="margin-top:14px;">
        <button class="btn btn-ghost btn-sm" onclick="closePartyInvite()">취소</button>
        <button class="btn btn-primary btn-sm" onclick="sendPartyInvites()">파티 신청 보내기</button>
      </div>
    </div>
  </div>`;
}
function renderPartyStatusModal(){
  const p=state.crewParty;
  return `
  <div class="confirm-backdrop" onclick="if(event.target===this) closePartyStatus()">
    <div class="confirm-box" style="max-width:340px;">
      <h3 style="margin:0 0 4px;">대전 파티 현황</h3>
      <p class="hint" id="party-status-summary" style="margin:0 0 12px;">${p.invites?`${p.invites.filter(x=>x.status==='accepted').length}/${p.invites.length}명 수락`:'파티원 없이 진행'}</p>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${(p.invites||[]).map((inv,i)=>`
          <div id="party-inv-${i}" class="flex-between" style="padding:8px 10px;border:1px solid var(--line);border-radius:8px;">
            <span>${inv.n}</span>
            <span class="party-inv-status hint" style="margin:0;">${inv.status==='accepted'?'✅ 수락':inv.status==='expired'?'⏱ 시간초과':`대기중 (${inv.timeLeft}초)`}</span>
          </div>`).join('')}
      </div>
      <div class="confirm-actions" style="margin-top:14px;">
        <button class="btn btn-ghost btn-sm" onclick="closePartyStatus()">닫기</button>
        <button id="party-status-start-btn" class="btn btn-primary btn-sm" style="display:${p.ready?'inline-flex':'none'};" onclick="closePartyStatus(); startCrewBattle();">대전 시작하기</button>
      </div>
    </div>
  </div>`;
}

/* ========================================================================
   5vs5 크루대전
   ------------------------------------------------------------------------
   비슷한 레벨의 상대 크루와 "먼저 스쿼트 N개 채우기" 실시간 대결. 내 개수는 실제
   웹캠·MediaPipe 판정(exRegisterRep)에서 그대로 받아오고, 나머지 4명의 크루원과
   상대팀은 프로토타입이라 일정 주기로 자동 증가시켜 흉내낸다(실제로는 각자의 서버
   집계가 필요한 지점). 실시간 갱신은 render()를 다시 타지 않고 updateBattleUI()가
   DOM을 직접 패치한다 — 이유는 render() 훅 주석과 exRegisterRep() 참고.
   ======================================================================== */
const BATTLE_FILLER_NAMES=['헬린이','스쿼트왕','런닝러버','플랭크신','다이어터'];
// 정확도 등급별 점수 — 크루대전은 반복 횟수가 아니라 이 점수 합산으로 승패를 가린다.
// GOOD은 따로 언급되지 않아 GREAT과 동일하게 취급한다(둘 다 "유효한 반복"이라는 의미로).
const BATTLE_GRADE_POINTS={PERFECT:2, GREAT:1, GOOD:1, MISS:0};
// 팀원·상대팀은 실제 판정이 없으니, 매 틱마다 이 분포에서 등급을 하나 뽑아 점수를 흉내낸다.
const BATTLE_TICK_GRADES=['PERFECT','PERFECT','GREAT','GREAT','GREAT','GOOD','GOOD','MISS'];
function randomBattleGrade(){ return BATTLE_TICK_GRADES[Math.floor(Math.random()*BATTLE_TICK_GRADES.length)]; }
function startCrewBattle(){
  if(!state.crewParty.ready){
    toast('먼저 크루대전파티를 맺어야 대전을 시작할 수 있어요');
    openPartyInvite();
    return;
  }
  const myLevel=state.crew.level||1;
  const candidates=JOINABLE_CREWS.filter(c=>c.name!==state.crew.name && Math.abs(c.level-myLevel)<=2);
  const pool=candidates.length?candidates:JOINABLE_CREWS.filter(c=>c.name!==state.crew.name);
  const opponent=pool[Math.floor(Math.random()*pool.length)] || JOINABLE_CREWS[0];

  // 파티에 합류(수락)한 크루원을 우선으로 데려가고, 남는 자리는 나머지 크루원 → 필러로 채운다.
  const partyMates=(state.crewParty.invites||[]).filter(x=>x.status==='accepted').map(x=>x.n);
  const restMates=state.crew.members.filter(m=>m.n!=='나').map(m=>m.n).filter(n=>!partyMates.includes(n));
  const realMates=[...partyMates, ...restMates];
  clearInterval(state.crewParty.tickId);
  state.crewParty={open:false, statusOpen:false, selected:[], invites:null, ready:false, tickId:null};
  const teammates=[];
  for(let i=0;i<4;i++){
    teammates.push({n:realMates[i]||BATTLE_FILLER_NAMES[i%BATTLE_FILLER_NAMES.length], score:0, dur:(1.6+Math.random()*0.9).toFixed(2), gender:i%2===0?'male':'female', gradeCounts:{PERFECT:0,GREAT:0,GOOD:0,MISS:0}});
  }
  // 상대팀도 5명(리더 1 + 필러 4) 개인별 점수를 따로 굴려야 결과 팝업에서 "누가 MVP인지"를
  // 보여줄 수 있다 — 예전엔 oppScore 합계만 있었다.
  const oppNamePool=[opponent.leader, ...BATTLE_FILLER_NAMES];
  const oppTeammates=[];
  for(let i=0;i<5;i++){
    oppTeammates.push({n:oppNamePool[i]||`상대팀원${i+1}`, score:0, gender:i%2===0?'female':'male', gradeCounts:{PERFECT:0,GREAT:0,GOOD:0,MISS:0}});
  }

  state.crewBattle={
    target: randInt(40,60), // 점수 목표 (PERFECT=2 / GREAT·GOOD=1 / MISS=0점 합산) — 테스트 편의상 낮춰둠
    opponent:{name:opponent.name, level:opponent.level},
    myScore:0, oppScore:0,
    myGradeCounts:{PERFECT:0, GREAT:0, GOOD:0, MISS:0}, // 결과 팝업에서 "나"의 개인 판정 비율용
    teammates, oppTeammates,
    tickId:null,
    result:null, // null | 'win' | 'lose'
  };
  state.exercise={step:0, picked:'squat', camPhase:'idle', camStream:null, timerId:null, seconds:0, result:null, retakesUsed:0, liveReps:[], replayOpen:false};
  state.menu='crewBattle';
  // 상대팀·팀원은 캘리브레이션 여부와 상관없이 바로 진행을 시작한다(이미 실시간으로 붙은
  // 대전이라는 느낌 + 캘리브레이션이 없어 모달이 뜨더라도 뒤에서 계속 점수가 올라가야 함).
  startBattleTicker();

  if(!state.user.calibration){
    toast('크루대전을 시작하려면 체형 캘리브레이션이 먼저 필요해요');
    openCalibrationModal();
    return;
  }
  render();
}
function startBattleTicker(){
  clearInterval(state.crewBattle.tickId);
  state.crewBattle.tickId=setInterval(()=>{
    const b=state.crewBattle;
    if(!b || b.result) return;
    const idx=Math.floor(Math.random()*b.teammates.length);
    const g1=randomBattleGrade();
    const pts1=BATTLE_GRADE_POINTS[g1];
    b.teammates[idx].score+=pts1;
    b.teammates[idx].gradeCounts[g1]=(b.teammates[idx].gradeCounts[g1]||0)+1;
    updateBattleUI('mate-'+idx, pts1);
    if(Math.random()<0.9){
      const oidx=Math.floor(Math.random()*b.oppTeammates.length);
      const g2=randomBattleGrade();
      const pts2=BATTLE_GRADE_POINTS[g2];
      b.oppTeammates[oidx].score+=pts2;
      b.oppScore+=pts2;
      b.oppTeammates[oidx].gradeCounts[g2]=(b.oppTeammates[oidx].gradeCounts[g2]||0)+1;
      updateBattleUI('opp', pts2);
    }
    checkBattleEnd();
  }, 1400);
}
// 실시간 구간 전용 DOM 패치 — render()를 부르지 않는 이유는 exRegisterRep()의 주석 참고.
function updateBattleUI(bumpedKey, delta){
  const b=state.crewBattle;
  if(!b) return;
  const teamTotal=b.myScore+b.teammates.reduce((s,t)=>s+t.score,0);
  const setText=(id,txt)=>{ const el=document.getElementById(id); if(el) el.textContent=txt; };
  setText('battle-team-total', teamTotal.toLocaleString());
  setText('battle-opp-total', b.oppScore.toLocaleString());
  const bar=document.getElementById('battle-progress'); if(bar) bar.style.width=Math.min(100,teamTotal/b.target*100)+'%';
  setText('battle-my-score', b.myScore);
  b.teammates.forEach((t,i)=> setText('battle-mate-score-'+i, t.score));
  if(bumpedKey) popBattleFx(bumpedKey, delta);
}
// MISS(0점)일 땐 "+0"이 뜨는 게 어색하니 실제로 점수가 오를 때만 팝업을 띄운다.
function popBattleFx(key, delta){
  if(!delta) return;
  const host=document.getElementById('battle-pop-'+key);
  if(!host) return;
  const el=document.createElement('span');
  el.className='battle-pop';
  el.textContent='+'+delta;
  host.appendChild(el);
  setTimeout(()=>el.remove(), 900);
}
function checkBattleEnd(){
  const b=state.crewBattle;
  if(!b || b.result) return;
  const teamTotal=b.myScore+b.teammates.reduce((s,t)=>s+t.score,0);
  if(teamTotal>=b.target){ b.result='win'; finishBattle(); }
  else if(b.oppScore>=b.target){ b.result='lose'; finishBattle(); }
}
// 대전이 실제로 끝나는 시점(카메라를 먼저 정리한 뒤)에만 render()를 부른다 — 이때는 더 이상
// 살아있는 포즈 인식 루프가 없으므로 화면을 통째로 다시 그려도 안전하다.
function finishBattle(){
  clearInterval(state.crewBattle.tickId);
  if(state.exercise.camStream){ state.exercise.camStream.getTracks().forEach(t=>t.stop()); state.exercise.camStream=null; }
  clearInterval(state.exercise.timerId);
  if(state.crewBattle.result==='win'){
    state.user.points += state.crewBattle.target;
    toast(`🎉 크루대전 승리! 크루 포인트 +${state.crewBattle.target}P 획득`);
  } else {
    toast('아쉽게 패배했어요');
  }
  render();
}
function exitCrewBattle(){
  if(state.crewBattle) clearInterval(state.crewBattle.tickId);
  if(state.exercise.camStream){ state.exercise.camStream.getTracks().forEach(t=>t.stop()); }
  clearInterval(state.exercise.timerId);
  state.crewBattle=null;
  state.exercise={step:0, picked:null, camPhase:'idle', camStream:null, timerId:null, seconds:0, result:null, retakesUsed:0, liveReps:[], replayOpen:false};
  state.menu='crew';
  state.subtabs.crew=0;
  render();
}
function drawBattleTeammates(){
  if(!state.crewBattle) return;
  state.crewBattle.teammates.forEach((t,i)=>{
    const c=document.getElementById('battle-char-'+i);
    if(c) drawPixelCharacter(c, {}, t.gender||(i%2===0?'male':'female'));
  });
}
// 결과 팝업의 "참여인원" 명단 — 나+팀원, 상대팀을 각각 점수 많은 순으로 정렬한다. teammates/
// oppTeammates 원본 객체를 그대로 펼쳐 쓰므로 각자의 gradeCounts(개인 판정 카운트)도 함께 딸려온다.
function battleMyRoster(b){
  return [{n:'나', score:b.myScore, gender:state.user.gender||'male', gradeCounts:b.myGradeCounts}, ...b.teammates]
    .sort((a,c)=>c.score-a.score);
}
function battleOppRoster(b){
  return [...b.oppTeammates].sort((a,c)=>c.score-a.score);
}
// MVP(1등)는 폰트를 헤딩용 서체(Jua)로 바꾸고 배지를 붙여서 나머지와 구분한다. 캐릭터 그림
// 대신 닉네임과 그 사람 본인의 판정 비율(PERFECT/GREAT/MISS)을 보여준다.
function renderBattleRoster(list){
  return `
  <div style="display:flex;flex-direction:column;gap:8px;">
    ${list.map((p,i)=>{
      const gc=p.gradeCounts||{PERFECT:0,GREAT:0,GOOD:0,MISS:0};
      const gcTotal=gc.PERFECT+gc.GREAT+gc.GOOD+gc.MISS;
      const pct=n=>gcTotal ? Math.round(n/gcTotal*100) : 0;
      return `
      <div style="padding:8px 10px;border:1.5px solid ${i===0?'var(--gold)':'var(--line)'};border-radius:10px;${i===0?'background:var(--surface-2);':''}">
        <div class="flex-between">
          <span style="${i===0?'font-family:var(--font-display);font-size:15px;':'font-size:13px;font-weight:700;'}white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.n}${i===0?' <span class="pill pill-gold" style="margin-left:2px;">MVP</span>':''}</span>
          <span class="mono" style="font-size:13px;color:var(--ink-dim);flex:none;">${p.score}점</span>
        </div>
        <p class="hint mono" style="margin:4px 0 0;">PERFECT <b style="color:var(--accent)">${pct(gc.PERFECT)}%</b> · GREAT <b style="color:var(--gold)">${pct(gc.GREAT+gc.GOOD)}%</b> · MISS <b style="color:var(--danger)">${pct(gc.MISS)}%</b></p>
      </div>`;
    }).join('')}
  </div>`;
}
function renderCrewBattle(){
  const b=state.crewBattle;
  if(!b) return '<div class="empty-note">대전 정보를 불러올 수 없습니다.</div>';
  const teamTotal=b.myScore+b.teammates.reduce((s,t)=>s+t.score,0);
  return `
  <div class="view-head flex-between">
    <h1 style="margin:0;">5vs5 크루대전</h1>
    <button class="btn btn-ghost btn-sm" onclick="exitCrewBattle()">나가기</button>
  </div>

  <div class="card" style="text-align:center;margin-bottom:16px;">
    <h2 style="margin:0 0 4px;font-size:22px;">${state.crew.name} <span style="color:var(--ink-faint);font-weight:400;font-size:16px;">vs</span> ${b.opponent.name} <span class="pill pill-muted">Lv.${b.opponent.level}</span></h2>
    <p style="margin:0 0 18px;font-size:16px;font-weight:700;color:var(--gold);">스쿼트 ${b.target}점 먼저 채우기</p>
    <div style="display:flex;align-items:center;justify-content:center;gap:28px;flex-wrap:wrap;">
      <div>
        <div id="battle-team-total" class="mono" style="font-size:44px;font-weight:700;color:var(--accent);">${teamTotal}</div>
        <div class="hint">${state.crew.name} (우리팀)</div>
      </div>
      <div style="font-size:20px;font-weight:700;color:var(--ink-faint);">VS</div>
      <div>
        <div id="battle-opp-total" class="mono" style="font-size:44px;font-weight:700;color:var(--coral);">${b.oppScore}</div>
        <div class="hint" style="position:relative;display:inline-block;">${b.opponent.name} <span id="battle-pop-opp" style="position:relative;display:inline-block;"></span></div>
      </div>
    </div>
    <div class="progress" style="margin-top:14px;height:10px;"><span id="battle-progress" style="width:${Math.min(100,teamTotal/b.target*100)}%"></span></div>
    <p class="hint" style="margin-top:6px;">목표 ${b.target}점을 먼저 채우는 팀이 승리해요 (PERFECT +2점 · GREAT/GOOD +1점 · MISS +0점)</p>
  </div>

  ${b.result ? `
  <div class="card" style="max-width:640px;margin:0 auto;">
    <h2 style="margin:0 0 6px;text-align:center;">${b.result==='win'?'🎉 우리 팀 승리!':'아쉽게 패배했어요'}</h2>
    <p class="desc" style="text-align:center;margin:0 0 4px;">최종 ${teamTotal}점 : ${b.oppScore}점</p>
    ${b.result==='win' ? `<p class="mono" style="font-weight:700;color:var(--gold);margin:0 0 14px;text-align:center;">크루 포인트 획득 +${b.target}P</p>` : '<div style="margin-bottom:14px;"></div>'}
    <div class="grid grid-2" style="align-items:start;">
      <div>
        <p class="section-label" style="margin:0 0 8px;">${state.crew.name} (우리팀)</p>
        ${renderBattleRoster(battleMyRoster(b))}
      </div>
      <div>
        <p class="section-label" style="margin:0 0 8px;">${b.opponent.name} (상대팀)</p>
        ${renderBattleRoster(battleOppRoster(b))}
      </div>
    </div>
    <button class="btn btn-primary btn-block" style="margin-top:20px;" onclick="exitCrewBattle()">크루로 돌아가기</button>
  </div>` : `
  <div class="grid cal-grid">
    <div>
      <div class="cam-stage" id="cam-stage" style="max-height:70vh;">
        <div class="cam-placeholder" id="cam-placeholder">카메라를 확인하는 중...<br>브라우저의 카메라 권한을 허용해주세요.</div>
        <video id="cam-video" autoplay playsinline muted style="display:none;"></video>
        <canvas class="cam-overlay-canvas" id="cam-canvas"></canvas>
        <div class="cam-badge"><span class="rec-dot"></span><span id="cam-status">대기중</span></div>
        <div class="cam-timer mono" id="cam-timer">00:00</div>
        <div id="cam-grade-flash" class="cam-grade-flash"></div>
        <div id="cam-ready-overlay" class="cam-ready-overlay">
          <div class="count" id="cam-ready-count"></div>
          <div class="msg" id="cam-ready-msg">화면 속 스켈레톤에 맞춰 자리를 잡아주세요</div>
        </div>
      </div>
      <div style="margin-top:14px;display:flex;gap:10px;align-items:center;">
        <button class="btn btn-primary" id="cam-toggle" onclick="toggleRecording()">촬영 시작</button>
        <span class="hint" style="margin:0;position:relative;">내 기록 <b id="battle-my-score" class="mono">${b.myScore}</b>점 <span id="battle-pop-me" style="position:relative;display:inline-block;"></span></span>
      </div>
    </div>
    <div class="card">
      <p class="section-label">우리 팀 (실시간 자동 진행)</p>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;">
        ${b.teammates.map((t,i)=>`
          <div style="text-align:center;">
            <div class="battle-char-wrap" style="animation-duration:${t.dur}s;">
              <canvas id="battle-char-${i}" width="90" height="110" style="width:70px;height:86px;image-rendering:pixelated;"></canvas>
            </div>
            <p style="margin:4px 0 0;font-size:12px;font-weight:700;">${t.n}</p>
            <p class="mono" style="margin:0;font-size:13px;color:var(--ink-dim);position:relative;display:inline-block;">
              <span id="battle-mate-score-${i}">${t.score}</span>점 <span id="battle-pop-mate-${i}" style="position:relative;display:inline-block;"></span>
            </p>
          </div>`).join('')}
      </div>
    </div>
  </div>`}`;
}

/* ---------- 크루공지: 팀장만 작성 가능 ---------- */
function renderCrewNotice(){
  const isLeader=getMyCrewRole()==='팀장';
  return `
  ${isLeader?`
  <div class="card" style="max-width:520px;margin-bottom:16px;">
    <p class="section-label">공지 작성</p>
    <div class="field"><label for="notice-title">제목</label><input id="notice-title" placeholder="예: 우리 크루 단톡방 안내"></div>
    <div class="field"><label for="notice-body">내용</label><textarea id="notice-body" rows="3" placeholder="크루원에게 전달할 내용을 입력하세요 (예: 카카오톡 오픈채팅 '123' 검색)"></textarea></div>
    <button class="btn btn-primary" onclick="postCrewNotice()">공지 등록</button>
  </div>`:''}
  <div style="display:flex;flex-direction:column;gap:10px;">
    ${state.crew.notices.length ? [...state.crew.notices].reverse().map(n=>`
      <div class="card">
        <div class="flex-between"><h3 style="margin:0;">${n.title}</h3><span class="hint" style="margin:0;">${n.date}</span></div>
        <p class="desc" style="margin-top:8px;white-space:pre-wrap;">${n.body}</p>
        <p class="hint" style="margin:0;">작성자 · ${n.who}</p>
      </div>`).join('') : '<div class="empty-note">아직 등록된 공지가 없어요.</div>'}
  </div>`;
}
function postCrewNotice(){
  if(getMyCrewRole()!=='팀장'){ toast('공지 작성 권한이 없습니다'); return; }
  const title=document.getElementById('notice-title').value.trim();
  const body=document.getElementById('notice-body').value.trim();
  if(!title || !body){ toast('제목과 내용을 입력해주세요'); return; }
  state.crew.notices.push({who:state.user.nickname||'팀장', title, body, date:'오늘'});
  toast('공지를 등록했습니다');
  render();
}
/* ---------- 오늘의 단체 미션: 종목 1개 + 총목표를 레벨 비례로 개인 배분 ---------- */
function renderCrewAssign(){
  const isLeader=getMyCrewRole()==='팀장';
  const gm=state.crew.groupMission;
  const targets=getCrewMissionTargets();
  return `
  <div class="card" style="max-width:560px;margin-bottom:16px;">
    <p class="section-label">${gm.period==='daily'?'크루 일일미션':'크루 주간미션'}</p>
    <div class="filter-bar">
      ${['daily','weekly'].map(p=>`<button class="btn btn-sm ${gm.period===p?'btn-primary':'btn-secondary'}" ${isLeader?`onclick="setCrewMissionPeriod('${p}')"`:'disabled style="opacity:.6;"'}>${p==='daily'?'일일':'주간'}</button>`).join('')}
    </div>
    <p class="desc">종목 <b style="color:var(--ink);">${gm.ex}</b> · 팀 전체 목표 <b style="color:var(--ink);">${gm.totalTarget}회</b> — 크루원 레벨에 맞춰 개인 목표가 자동으로 조정됩니다.</p>
    ${isLeader?`
    <div class="field"><label for="cm-ex-select">종목 선택</label><select id="cm-ex-select" onchange="setCrewMissionEx(this.value)">${CREW_MISSION_EX_OPTIONS.map(e=>`<option ${e===gm.ex?'selected':''}>${e}</option>`).join('')}</select></div>`:''}
  </div>
  <p class="section-label">배분 현황</p>
  <div class="table-wrap">
    <table>
      <thead><tr><th>팀원</th><th>역할</th><th>배분된 종목</th><th>진행률</th></tr></thead>
      <tbody>
        ${targets.map(m=>{
          const done=getCrewMemberProgress(m.n, m.target);
          const pct=Math.min(100, Math.round(done/m.target*100));
          const ex=m.assignedEx||gm.ex;
          return `
          <tr>
            <td>${m.n}${m.n==='나'?' <span class="pill pill-accent">나</span>':''}</td>
            <td><span class="pill ${m.role==='팀장'?'pill-gold':'pill-muted'}">${m.role}</span></td>
            <td>${isLeader
              ? `<select onchange="setMemberMissionEx('${m.n}', this.value)" style="width:auto;padding:5px 8px;font-size:12px;border-radius:8px;border:1px solid var(--line);background:var(--surface);color:var(--ink);">${CREW_MISSION_EX_OPTIONS.map(e=>`<option ${ex===e?'selected':''}>${e}</option>`).join('')}</select>`
              : `<span class="pill pill-accent">${ex}</span>`}</td>
            <td style="min-width:130px;">
              <div class="bar-track"><span style="width:${pct}%;background:${pct>=100?'var(--accent)':'var(--gold)'}"></span></div>
              <span class="hint" style="margin:3px 0 0;">${pct}%${pct>=100?' · 완료':''}</span>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>
  <p class="hint" style="margin-top:10px;">테스트용 — <button class="btn btn-sm btn-ghost" onclick="toggleMyCrewRole()">내 역할(${getMyCrewRole()}) 전환해보기</button></p>`;
}
function setCrewMissionPeriod(p){
  if(getMyCrewRole()!=='팀장'){ toast('미션 설정 권한이 없습니다'); return; }
  state.crew.groupMission.period=p; render();
}
function setCrewMissionEx(v){
  if(getMyCrewRole()!=='팀장'){ toast('미션 설정 권한이 없습니다'); return; }
  state.crew.groupMission.ex=v; render();
}
function setMemberMissionEx(name, ex){
  if(getMyCrewRole()!=='팀장'){ toast('배분 변경 권한이 없습니다'); return; }
  const m=state.crew.members.find(m=>m.n===name);
  if(m){ m.assignedEx=ex; toast(`${name}님의 배분 종목을 ${ex}(으)로 변경했습니다`); }
  render();
}
/* ---------- 크루원 정보: 조회 전용 (강퇴 기능은 크루원관리 탭으로 이동) ---------- */
function renderCrewMembers(){
  return `
  <div class="table-wrap">
    <table>
      <thead><tr><th>이름</th><th>역할</th><th>레벨</th></tr></thead>
      <tbody>
        ${state.crew.members.map(m=>`
          <tr>
            <td>${m.n}${m.n==='나'?' <span class="pill pill-accent">나</span>':''}</td>
            <td><span class="pill ${m.role==='팀장'?'pill-gold':'pill-muted'}">${m.role}</span></td>
            <td class="mono">Lv.${m.level}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}
/* ---------- 크루원관리: 팀장 전용 — 크루 소개 수정 + 가입요청 승인 + 강퇴 ---------- */
function renderCrewManage(){
  if(getMyCrewRole()!=='팀장'){ return '<div class="empty-note">팀장만 접근할 수 있는 메뉴입니다.</div>'; }
  const reqs=state.crew.joinRequests;
  return `
  <div class="card" style="max-width:520px;margin-bottom:20px;">
    <p class="section-label">크루 소개 수정</p>
    <div class="field"><textarea id="crew-desc-edit" rows="3">${state.crew.desc}</textarea></div>
    <button class="btn btn-secondary" onclick="updateCrewDesc()">소개 저장</button>
  </div>
  <p class="section-label">가입 요청 (${reqs.length})</p>
  <div class="grid grid-2" style="margin-bottom:24px;">
    ${reqs.length ? reqs.map((r,idx)=>`
      <div class="card">
        <div class="flex-between"><h3 style="margin:0;">${r.n}</h3><span class="pill pill-gold">Lv.${r.level}</span></div>
        <p class="desc" style="margin-top:8px;">${r.msg}</p>
        <p class="hint">누적 점수 ${r.score.toLocaleString()}점</p>
        <div class="flex-between" style="margin-top:10px;gap:8px;">
          <button class="btn btn-sm btn-secondary" style="flex:1;" onclick="rejectJoinRequest(${idx})">거절</button>
          <button class="btn btn-sm btn-primary" style="flex:1;" onclick="approveJoinRequest(${idx})">승인</button>
        </div>
      </div>`).join('') : '<div class="empty-note" style="grid-column:1/-1;">대기중인 가입 요청이 없어요.</div>'}
  </div>
  <p class="section-label">크루원 강퇴</p>
  <div class="table-wrap">
    <table>
      <thead><tr><th>이름</th><th>역할</th><th>레벨</th><th>관리</th></tr></thead>
      <tbody>
        ${state.crew.members.map(m=>`
          <tr>
            <td>${m.n}${m.n==='나'?' <span class="pill pill-accent">나</span>':''}</td>
            <td><span class="pill ${m.role==='팀장'?'pill-gold':'pill-muted'}">${m.role}</span></td>
            <td class="mono">Lv.${m.level}</td>
            <td>${m.n!=='나'?`<button class="btn btn-sm btn-danger" onclick="kickMember('${m.n}')">강퇴</button>`:''}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}
function updateCrewDesc(){
  const v=document.getElementById('crew-desc-edit').value.trim();
  if(!v){ toast('소개글을 입력해주세요'); return; }
  state.crew.desc=v;
  toast('크루 소개를 저장했습니다');
  render();
}
function approveJoinRequest(idx){
  const r=state.crew.joinRequests[idx];
  if(!r) return;
  state.crew.members.push({n:r.n, role:'팀원', level:r.level, score:r.score});
  state.crew.joinRequests.splice(idx,1);
  toast(`${r.n}님의 가입을 승인했습니다`);
  render();
}
function rejectJoinRequest(idx){
  const r=state.crew.joinRequests[idx];
  if(!r) return;
  state.crew.joinRequests.splice(idx,1);
  toast(`${r.n}님의 가입 요청을 거절했습니다`);
  render();
}
function kickMember(name){
  if(getMyCrewRole()!=='팀장'){ toast('강퇴 권한이 없습니다'); return; }
  state.crew.members=state.crew.members.filter(m=>m.n!==name);
  toast(`${name}님을 크루에서 강퇴했습니다`);
  render();
}

/* ---------- 크루 랭킹: 시/구/동 드롭다운 랭킹 + 시/구 드롭다운 지도 (#18, #19) ---------- */
const CREW_NAME_POOL=['역삼동 러너스','합정 플랭커즈','성수 스쿼트단','오룡 파워워커즈','상무 헬스메이트','망원 버피팀','잠실 런지크루','봉선 조깅단'];
function getDongCrewRanking(dong){
  const seed=hashStr(dong);
  const names=[];
  let idx=seed;
  while(names.length<3){
    idx=(idx*48271+1)%2147483647;
    const name=CREW_NAME_POOL[idx%CREW_NAME_POOL.length];
    if(!names.includes(name)) names.push(name);
  }
  return names.map((name,i)=>({
    rank:i+1, name,
    level:Math.max(1, 12-i*2-(seed%3)),
    score:5200-i*430-(seed%100),
  }));
}
function getMyCrewDong(){
  const region=state.crew.region || state.user.region || '';
  return region.trim().split(/\s+/).pop();
}
function getMyDongCrewRank(){
  const dong=getMyCrewDong();
  const myScore=state.crew.members.reduce((s,m)=>s+m.score,0);
  const others=getDongCrewRanking(dong).filter(c=>c.name!==state.crew.name);
  const rows=[...others, {name:state.crew.name, score:myScore}].sort((a,b)=>b.score-a.score);
  return { dong, rank: rows.findIndex(r=>r.name===state.crew.name)+1 };
}
function renderCrewRegionRank(){
  const cities=Object.keys(REGION_DATA);
  const rankCity=REGION_DATA[state.crew.rankCity]?state.crew.rankCity:cities[0];
  const rankGus=Object.keys(REGION_DATA[rankCity]);
  const rankGu=REGION_DATA[rankCity][state.crew.rankGu]?state.crew.rankGu:rankGus[0];
  const dongs=REGION_DATA[rankCity][rankGu];
  const rankDong=dongs.includes(state.crew.rankDong)?state.crew.rankDong:dongs[0];
  const rows=getDongCrewRanking(rankDong);
  const mapCity=REGION_DATA[state.crew.mapCity]?state.crew.mapCity:cities[0];
  const mapGus=Object.keys(REGION_DATA[mapCity]);
  const mapGu=REGION_DATA[mapCity][state.crew.mapGu]?state.crew.mapGu:mapGus[0];
  return `
  <div class="grid grid-2" style="align-items:start;">
    <div>
      <p class="section-label">동네별 크루 랭킹</p>
      <div class="filter-bar">
        <select onchange="setCrewRankCity(this.value)">
          ${cities.map(c=>`<option ${c===rankCity?'selected':''}>${c}</option>`).join('')}
        </select>
        <select onchange="setCrewRankGu(this.value)">
          ${rankGus.map(g=>`<option ${g===rankGu?'selected':''}>${g}</option>`).join('')}
        </select>
        <select onchange="setCrewRankDong(this.value)">
          ${dongs.map(d=>`<option ${d===rankDong?'selected':''}>${d}</option>`).join('')}
        </select>
      </div>
      ${renderPodium(rows)}
    </div>
    <div>
      <p class="section-label">동네별 1위 크루 지도</p>
      <div class="filter-bar">
        <select onchange="setCrewMapCity(this.value)">
          ${cities.map(c=>`<option ${c===mapCity?'selected':''}>${c}</option>`).join('')}
        </select>
        <select onchange="setCrewMapGu(this.value)">
          ${mapGus.map(g=>`<option ${g===mapGu?'selected':''}>${g}</option>`).join('')}
        </select>
      </div>
      ${renderCrewMap(mapCity, mapGu)}
    </div>
  </div>`;
}
function renderCrewMap(city, gu){
  const dongs=REGION_DATA[city][gu];
  return `
  <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;">
    ${dongs.map(d=>{
      const top=getDongCrewRanking(d)[0];
      return `
      <div style="border:1px solid var(--line);border-radius:12px;padding:14px;background:var(--surface-2);">
        <div class="flex-between"><b style="font-size:13px;">${d}</b><span class="pill pill-gold">1위</span></div>
        <p class="desc" style="margin:6px 0 0;">${top.name}</p>
        <p class="hint" style="margin-top:2px;">Lv.${top.level} · ${top.score.toLocaleString()}점</p>
      </div>`;
    }).join('')}
  </div>`;
}
function setCrewRankCity(v){ state.crew.rankCity=v; state.crew.rankGu=null; state.crew.rankDong=null; render(); }
function setCrewRankGu(v){ state.crew.rankGu=v; state.crew.rankDong=null; render(); }
function setCrewRankDong(v){ state.crew.rankDong=v; render(); }
function setCrewMapCity(v){ state.crew.mapCity=v; state.crew.mapGu=null; render(); }
function setCrewMapGu(v){ state.crew.mapGu=v; render(); }

/* ========================================================================
   4. 랭킹
   ======================================================================== */
// (FR-RK-001~002) 지금은 getRegionRanking()/getDongCrewRanking()처럼 화면에서 정렬만 흉내내고
// 있지만, 실제로는 순위를 매기는 연산 자체를 DB에 맡기는 편이 안전합니다.
//   랭킹 조회(지역/종목/크루) > Java 랭킹 API > DB 연결 > SQL SELECT ... ORDER BY 점수 DESC (필요 시 캐싱)
