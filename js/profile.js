// profile.js — '마이페이지' 카테고리 전체(캐릭터 꾸미기, 미션 달성 현황, 운동 히스토리, 계정관리).

const PROFILE_TABS=['프로필·캐릭터 꾸미기','미션 달성 현황','운동 히스토리','계정관리'];
function renderProfile(){
  const i=state.subtabs.profile;
  const body = i===0?renderMissionAvatar():
    i===1?renderMissionProgress():
    i===2?renderHistory():
    renderSetAccount();
  return `
  <div class="view-head"><h1>마이페이지</h1></div>
  <div class="subtabs subtabs-compact">
    ${PROFILE_TABS.map((t,idx)=>`<div class="tab ${i===idx?'active':''}" onclick="setSub('profile',${idx})">${t}</div>`).join('')}
  </div>
  ${renderGuestBlur(body, '로그인하면 내 캐릭터·미션·운동 기록·계정 정보를 확인할 수 있어요')}`;
}
const EXP_PER_LEVEL=1000;
function getProfileStats(){
  const gc={PERFECT:0,GREAT:0,GOOD:0,MISS:0};
  state.history.forEach(h=>{ if(h.gc) Object.keys(gc).forEach(k=>gc[k]+=h.gc[k]||0); });
  const gcTotal=Object.values(gc).reduce((a,b)=>a+b,0)||1;
  const exCounts={};
  state.history.forEach(h=>{ exCounts[h.ex]=(exCounts[h.ex]||0)+h.reps; });
  const activeEffects=state.shopItems
    .filter(it=>it.slot && it.owned && it.equipped && !it.effect.startsWith('능력치 없음'))
    .map(it=>`${it.name} · ${it.effect}`);
  return {
    total: totalScore(),
    expToNext: Math.round((100-state.user.exp)/100*EXP_PER_LEVEL),
    myRank: getRegionRanking(state.user.region.trim().split(/\s+/).pop()).find(r=>r.isMe).rank,
    perfectPct: Math.round(gc.PERFECT/gcTotal*100),
    greatPct: Math.round(gc.GREAT/gcTotal*100),
    missPct: Math.round(gc.MISS/gcTotal*100),
    gc, gcTotal: gc.PERFECT+gc.GREAT+gc.GOOD+gc.MISS, // 등급 비율 도넛차트(renderGradeDonut)용 원본 카운트
    exCounts: Object.entries(exCounts),
    activeEffects,
  };
}
// 퍼펙트/그레이트/굿/미스 비율을 도넛 차트 + 범례 표로 그린다(stroke-dasharray 트릭이라
// 외부 차트 라이브러리 없이 순수 SVG로 그려진다). segments의 value 합이 0이면(기록 없음)
// 빈 상태 문구만 보여준다.
function renderGradeDonut(segments, centerLabel){
  const total = segments.reduce((s,x)=>s+x.value,0);
  if(!total) return '<p class="empty-note">아직 운동 기록이 없어요.</p>';
  const size=140, strokeWidth=22, r=(size-strokeWidth)/2, C=2*Math.PI*r;
  let acc=0;
  const arcs = segments.filter(s=>s.value>0).map(s=>{
    const frac=s.value/total;
    const dash=frac*C, gap=C-dash;
    const offset=-acc*C;
    acc+=frac;
    return `<circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${strokeWidth}"
      stroke-dasharray="${dash} ${gap}" stroke-dashoffset="${offset}" transform="rotate(-90 ${size/2} ${size/2})"/>`;
  }).join('');
  return `
  <div style="display:flex;flex-direction:column;align-items:center;gap:14px;">
    <div style="position:relative;width:${size}px;height:${size}px;">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${arcs}</svg>
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;">
        <span class="hint" style="margin:0;">${centerLabel}</span>
        <span class="mono" style="font-size:22px;font-weight:700;color:var(--ink);">${total}</span>
      </div>
    </div>
    <div style="width:100%;display:flex;flex-direction:column;gap:6px;">
      ${segments.map(s=>`
        <div class="flex-between" style="font-size:12.5px;">
          <span style="display:flex;align-items:center;gap:6px;"><span style="width:10px;height:10px;border-radius:50%;background:${s.color};display:inline-block;flex:none;"></span>${s.label}</span>
          <span class="mono" style="color:var(--ink-dim);">${s.value} · ${Math.round(s.value/total*100)}%</span>
        </div>`).join('')}
    </div>
  </div>`;
}
// (FR-PF-001~003) renderMissionAvatar: 캐릭터·아이템 꾸미기 화면. 그리기 자체(drawPixelCharacter)는
// 캔버스로 그리는 순수 프론트엔드 로직이고, "저장이 필요한 동작"만 아래 두 함수에서 이어집니다.
//   자기소개 저장(saveProfileBio) > Java 프로필 API > DB 연결 > SQL UPDATE(계정 테이블 bio 컬럼)
//   아이템 착용/해제(toggleEquip) > Java 프로필 API > DB 연결 > SQL UPDATE(보유 아이템 테이블 equipped 여부)
function renderCosmeticCard(it){
  const idx = state.shopItems.indexOf(it);
  return `
  <div style="border:1px solid var(--line);border-radius:10px;padding:12px;">
    <img src="${itemIconDataURL(it.name)}" style="width:48px;height:48px;image-rendering:pixelated;border-radius:6px;display:block;margin:0 auto 8px;">
    <div class="flex-between"><b style="font-size:12.5px;">${it.name}</b>
      ${it.owned?(it.equipped?'<span class="pill pill-accent">착용중</span>':'<span class="pill pill-muted">보유</span>'):'<span class="pill pill-gold">'+it.price+'P</span>'}
    </div>
    <span class="pill ${it.effect.startsWith('능력치 없음')?'pill-muted':'pill-accent'}" style="margin-top:6px;">효과 · ${it.effect}</span>
    <p class="desc" style="margin-top:6px;font-size:11.5px;">${it.effectDesc}</p>
    <button class="btn btn-sm ${it.owned?'btn-ghost':'btn-secondary'}" style="margin-top:8px;width:100%;" onclick="${it.owned?`toggleEquip(${idx})`:`goToShopFor(${idx})`}">${it.owned?(it.equipped?'착용 해제':'착용하기'):'상점에서 구매'}</button>
  </div>`;
}
function goToShopFor(idx){
  setMenu('shop');
  toast(`${state.shopItems[idx].name}은(는) 포인트 상점에서 구매할 수 있어요`);
}
function renderMissionAvatar(){
  const cosmetics = state.shopItems.filter(it=>it.slot);
  const nickColor = getEquipState().nickname ? 'var(--gold)' : 'inherit';
  const stats = getProfileStats();
  return `
  <div class="grid grid-2">
    <div class="card" style="text-align:center;">
      <p class="section-label">내 캐릭터</p>
      <canvas id="avatar-char-canvas" style="width:144px;height:176px;margin:10px auto;display:block;border-radius:10px;image-rendering:pixelated;"></canvas>
      <h3 style="color:${nickColor};">${state.user.nickname || '홈트초보'}</h3>
      <span class="pill pill-gold">Lv.${state.user.level}</span>
      <div class="field" style="margin-top:14px;text-align:left;">
        <label for="profile-bio-input">자기소개</label>
        <textarea id="profile-bio-input" rows="3" maxlength="80" placeholder="나를 소개하는 한마디를 남겨보세요">${state.user.bio||''}</textarea>
        <button class="btn btn-sm btn-secondary" style="margin-top:6px;width:100%;" onclick="saveProfileBio()">자기소개 저장</button>
      </div>
      <div style="text-align:left;margin-top:18px;">
        <p class="section-label">누적 성과</p>
        <p class="desc mono" style="margin:0;">누적 점수 <b>${stats.total.toLocaleString()}</b> · 동네 랭킹 <b>#${stats.myRank}</b> · 레벨업까지 <b>${stats.expToNext.toLocaleString()}</b></p>
        <div class="progress" style="margin-top:10px;"><span style="width:${state.user.exp}%"></span></div>
        <p class="hint" style="margin-top:4px;">Lv.${state.user.level} 진행도 ${state.user.exp}%</p>
        <p class="section-label" style="margin-top:14px;">등급 비율 (전체 세션 기준)</p>
        <div style="margin-top:8px;">
          ${renderGradeDonut([
            {label:'PERFECT', value:stats.gc.PERFECT, color:gradeColor('PERFECT')},
            {label:'GREAT', value:stats.gc.GREAT, color:gradeColor('GREAT')},
            {label:'GOOD', value:stats.gc.GOOD, color:gradeColor('GOOD')},
            {label:'MISS', value:stats.gc.MISS, color:gradeColor('MISS')},
          ], '총 횟수')}
        </div>
        <p class="section-label" style="margin-top:14px;">운동 종류별 누적 횟수</p>
        <p class="desc mono" style="margin:0;">${stats.exCounts.length ? stats.exCounts.map(([ex,cnt])=>`${ex} ${cnt}회`).join(' · ') : '아직 기록이 없습니다.'}</p>
        <p class="section-label" style="margin-top:14px;">장착 아이템 보정 효과</p>
        ${stats.activeEffects.length ? stats.activeEffects.map(e=>`<span class="pill pill-accent" style="margin:0 6px 6px 0;display:inline-block;">${e}</span>`).join('') : '<p class="hint">착용 중인 능력치 아이템이 없습니다.</p>'}
      </div>
    </div>
    <div class="card">
      <p class="section-label">보유 아이템</p>
      <div class="grid" style="grid-template-columns:repeat(2,1fr);">
        ${cosmetics.filter(it=>it.owned).map(it=>renderCosmeticCard(it)).join('') || '<p class="empty-note" style="grid-column:1/-1;">아직 보유한 꾸미기 아이템이 없어요.</p>'}
      </div>
      <p class="hint" style="margin-top:14px;">보유 아이템을 착용/해제하면 캐릭터에 바로 반영됩니다. 새 아이템은 포인트 상점에서 구매할 수 있어요.</p>
    </div>
  </div>`;
}
function saveProfileBio(){
  const el=document.getElementById('profile-bio-input');
  if(!el) return;
  state.user.bio=el.value.trim();
  toast('자기소개를 저장했습니다');
  render();
}
function getEquipState(){
  const bySlot={};
  state.shopItems.forEach(it=>{ if(it.slot && it.owned && it.equipped) bySlot[it.slot]=true; });
  return bySlot;
}
function toggleEquip(idx){
  const it=state.shopItems[idx];
  if(!it.owned){ toast('포인트 상점에서 구매해주세요'); return; }
  // 같은 슬롯(예: 배경)에 아이템이 여러 개 생길 수 있어, 새로 착용할 때는 같은 슬롯의
  // 나머지 아이템을 먼저 해제해서 한 슬롯에 하나만 착용되도록 한다.
  if(!it.equipped && it.slot){
    state.shopItems.forEach(o=>{ if(o!==it && o.slot===it.slot) o.equipped=false; });
  }
  it.equipped=!it.equipped;
  toast(it.equipped?`${it.name} 착용했습니다`:`${it.name} 착용 해제했습니다`);
  render();
}
function drawAvatarCanvas(){
  const canvas=document.getElementById('avatar-char-canvas');
  if(!canvas) return;
  drawPixelCharacter(canvas, getEquipState(), state.user.gender);
}
// 상단바의 작은 프로필 캐릭터 미리보기. drawPixelCharacter가 내부적으로 캔버스 해상도를
// 144x176으로 고정하지만, CSS에서 36x36 원형으로 축소 표시한다.
function drawTopbarAvatar(){
  const canvas=document.getElementById('topbar-avatar-canvas');
  if(!canvas) return;
  // 게스트는 실제로 보유·장착한 아이템이 없는 계정이라, 장착 이펙트 없는 기본 아바타를 그린다.
  drawPixelCharacter(canvas, state.guestMode ? {} : getEquipState(), state.guestMode ? 'male' : state.user.gender);
}
// gender: 'male' | 'female' — 회원가입 캘리브레이션에서 고른 값(state.user.gender)을 그대로 받아
// 머리 모양만 구분한다. 로봇 스킨 아이템을 장착하면 성별과 무관하게 로봇 얼굴이 우선한다.
function drawPixelCharacter(canvas, equip, gender){
  const U=8, W=18, H=22;
  canvas.width=W*U; canvas.height=H*U;
  const ctx=canvas.getContext('2d');
  ctx.imageSmoothingEnabled=true;

  if(equip.background){
    const g=ctx.createLinearGradient(0,0,0,H*U);
    g.addColorStop(0,'#3b2f63'); g.addColorStop(0.55,'#c06b4f'); g.addColorStop(1,'#f0b35c');
    ctx.fillStyle=g; ctx.fillRect(0,0,W*U,H*U);
  } else {
    ctx.fillStyle='#241C12'; ctx.fillRect(0,0,W*U,H*U);
  }

  const sprite=CHAR_SPRITES[gender==='female'?'female':'male'];
  if(sprite){
    ctx.save();
    // '네온 트레이닝복'을 장착하면 실루엣 주위에 네온 림라이트를 추가로 씌운다 (원본 아트를
    // 다시 그리는 대신, 착용 여부를 알아볼 수 있는 신호로 그림자 발광을 사용).
    if(equip.outfit){ ctx.shadowColor='#3ED598'; ctx.shadowBlur=U*1.6; }
    // '로봇 코치' 스킨은 전용 아트가 없어서, 대신 캔버스 필터로 금속/청록 톤 보정을 준다.
    if(equip.skin){ ctx.filter='grayscale(0.6) sepia(0.35) hue-rotate(165deg) saturate(2.4)'; }
    const sw=sprite.naturalWidth||sprite.width, sh=sprite.naturalHeight||sprite.height;
    const scale=Math.min((W*U)/sw, (H*U)/sh);
    const dw=sw*scale, dh=sh*scale;
    ctx.drawImage(sprite, (W*U-dw)/2, H*U-dh, dw, dh);
    ctx.restore();
  }

  if(equip.crown){
    const xL=W*U*0.30, xR=W*U*0.70, baseY=U*1.5, topY=U*0.15, midY=U*0.85;
    ctx.fillStyle='#D9A226';
    ctx.beginPath();
    ctx.moveTo(xL, baseY);
    ctx.lineTo(xL, midY);
    ctx.lineTo(xL+(xR-xL)*0.2, topY);
    ctx.lineTo(xL+(xR-xL)*0.5, midY);
    ctx.lineTo(xL+(xR-xL)*0.8, topY);
    ctx.lineTo(xR, midY);
    ctx.lineTo(xR, baseY);
    ctx.closePath();
    ctx.fill();
  }

  if(equip.badge){
    ctx.strokeStyle='#D9A226'; ctx.lineWidth=U*0.6;
    ctx.strokeRect(ctx.lineWidth/2, ctx.lineWidth/2, W*U-ctx.lineWidth, H*U-ctx.lineWidth);
  }
}
const _itemIconCache={};
function itemIconDataURL(name){
  if(_itemIconCache[name]) return _itemIconCache[name];
  let seed=2166136261;
  for(let i=0;i<name.length;i++){ seed^=name.charCodeAt(i); seed=Math.imul(seed,16777619); }
  seed=seed>>>0;
  const rnd=()=>{ seed=(seed+0x6D2B79F5)|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
  const U=6, N=8;
  const c=document.createElement('canvas'); c.width=N*U; c.height=N*U;
  const ctx=c.getContext('2d'); ctx.imageSmoothingEnabled=false;
  const hue=Math.floor(rnd()*360);
  ctx.fillStyle=`hsl(${hue},40%,18%)`; ctx.fillRect(0,0,N*U,N*U);
  const fg1=`hsl(${hue},70%,55%)`, fg2=`hsl(${(hue+40)%360},80%,65%)`;
  for(let y=0;y<N;y++){
    for(let x=0;x<N/2;x++){
      if(rnd()<0.45){
        ctx.fillStyle=rnd()<0.5?fg1:fg2;
        ctx.fillRect(x*U,y*U,U,U);
        ctx.fillRect((N-1-x)*U,y*U,U,U);
      }
    }
  }
  const url=c.toDataURL();
  _itemIconCache[name]=url;
  return url;
}
// (FR-SH-001) 아래 buyItem()에서 실제 결제/포인트 차감이 필요합니다.
//   아이템 구매(buyItem) > Java 상점 API > DB 연결 > SQL UPDATE(포인트 잔액) + INSERT(보유 아이템 테이블)
//   — 포인트 차감과 아이템 지급은 하나의 트랜잭션으로 묶어야 중간 실패 시 포인트만 깎이는 사고를 막을 수 있습니다.
function groupHistoryByDate(){
  const map={};
  state.history.forEach(h=>{ (map[h.date]=map[h.date]||[]).push(h); });
  return Object.entries(map);
}
function getScoreBonusPct(){
  const badge=state.shopItems.find(it=>it.slot==='badge');
  if(!badge || !badge.owned || !badge.equipped) return 0;
  const m=badge.effect.match(/\+(\d+)/);
  return m ? +m[1] : 0;
}
function renderHistory(){
  const groups=groupHistoryByDate();
  const bonusPct=getScoreBonusPct();
  if(!groups.length) return `<div class="empty-note">아직 운동 기록이 없습니다.</div>`;
  return `
  <div style="display:flex;flex-direction:column;gap:16px;">
    ${groups.map(([date,entries])=>`
      <div class="card">
        <div class="flex-between" style="margin-bottom:10px;">
          <p class="section-label" style="margin:0;">${date}</p>
          <span class="pill pill-muted">${entries.length}개 종목</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${entries.map(h=>{
            const gc=h.gc||{PERFECT:0,GREAT:0,GOOD:0,MISS:0};
            const gcTotal=Object.values(gc).reduce((a,b)=>a+b,0)||1;
            const pct=k=>Math.round((gc[k]||0)/gcTotal*100);
            const bonus=Math.round(h.score*bonusPct/100);
            const finalScore=h.score+bonus;
            const basePts=Math.round(h.score*0.4);
            const ptsBonus=Math.round(basePts*bonusPct/100);
            const finalPts=basePts+ptsBonus;
            return `
            <div style="border:1px solid var(--line);border-radius:10px;padding:12px;">
              <b>${h.ex}</b>
              <p class="desc" style="margin:6px 0;">유효 횟수 ${h.reps}회 · 전체 정확도 ${h.acc}%</p>
              <p class="desc mono" style="margin:0;">PERFECT <b style="color:var(--accent)">${pct('PERFECT')}%</b> · GREAT <b style="color:var(--gold)">${pct('GREAT')}%</b> · GOOD <b>${pct('GOOD')}%</b></p>
              <p class="desc mono" style="margin-top:8px;">획득 점수 : ${h.score}${bonusPct>0?` + 아이템효과 ${bonusPct}% = ${finalScore}`:''}</p>
              <p class="desc mono" style="margin-top:2px;">획득 포인트 : ${basePts}${bonusPct>0?` + 아이템효과 ${bonusPct}% = ${finalPts}`:''}</p>
            </div>`;
          }).join('')}
        </div>
      </div>`).join('')}
  </div>`;
}
/* ========================================================================
   고객센터 · 불편사항접수
   ======================================================================== */
// (FR-CS-001) 티켓 접수/조회는 관리자용 API가 함께 필요한 구간입니다.
//   불편사항 접수(submitTicket) > Java 고객센터 API > DB 연결 > SQL INSERT(티켓 테이블)
//   운영팀 답변 등록도 같은 API에서 SQL UPDATE(티켓 테이블 reply, status 컬럼)로 처리하면 됩니다.
function renderSetAccount(){
  const a=state.settings.account;
  const cities=Object.keys(REGION_DATA);
  const city=REGION_DATA[a.regionCity]?a.regionCity:cities[0];
  const gus=Object.keys(REGION_DATA[city]);
  const gu=REGION_DATA[city][a.regionGu]?a.regionGu:gus[0];
  const dongs=REGION_DATA[city][gu];
  const dong=dongs.includes(a.regionDong)?a.regionDong:dongs[0];
  const canEditNick = (state.user.nicknameTickets||0) > 0;
  return `
  <div class="card" style="max-width:460px;">
    <p class="section-label">프로필</p>
    <div class="field">
      <label for="acc-nick">닉네임</label>
      <input id="acc-nick" value="${state.user.nickname}" ${canEditNick?'':'disabled'}>
      <p class="hint">${canEditNick ? `닉네임 변경권 보유중 · 저장 시 1장이 사용됩니다 (남은 수량 ${state.user.nicknameTickets}장)` : `닉네임 변경은 포인트 상점에서 '닉네임 변경권'을 구매한 뒤 가능합니다.`}</p>
      ${canEditNick?'':'<button class="btn btn-sm btn-secondary" style="margin-top:6px;" onclick="setMenu(\'shop\')">포인트 상점으로 이동</button>'}
    </div>
    <div class="field">
      <label>활동 지역</label>
      <div class="field-row">
        <select onchange="setAccountCity(this.value)" style="flex:1;min-width:0;">${cities.map(c=>`<option ${c===city?'selected':''}>${c}</option>`).join('')}</select>
        <select onchange="setAccountGu(this.value)" style="flex:1;min-width:0;">${gus.map(g=>`<option ${g===gu?'selected':''}>${g}</option>`).join('')}</select>
        <select onchange="setAccountDong(this.value)" style="flex:1;min-width:0;">${dongs.map(d=>`<option ${d===dong?'selected':''}>${d}</option>`).join('')}</select>
      </div>
    </div>
    <button class="btn btn-primary" onclick="saveAccount()">저장</button>
  </div>
  <div style="margin-top:20px;">${renderSetCalib()}</div>
  <div style="margin-top:20px;">${renderSetLogout()}</div>`;
}
function setAccountCity(v){ state.settings.account.regionCity=v; state.settings.account.regionGu=null; state.settings.account.regionDong=null; render(); }
function setAccountGu(v){ state.settings.account.regionGu=v; state.settings.account.regionDong=null; render(); }
function setAccountDong(v){ state.settings.account.regionDong=v; render(); }
function saveAccount(){
  const a=state.settings.account;
  let nickMsg='';
  const nickEl=document.getElementById('acc-nick');
  if(nickEl && !nickEl.disabled){
    const newNick=nickEl.value.trim();
    if(newNick && newNick!==state.user.nickname){
      if(EXISTING_USERS.some(u=>u.nickname===newNick)){ toast('이미 사용중인 닉네임입니다'); return; }
      state.user.nicknameTickets--;
      state.user.nickname=newNick;
      a.nickname=newNick;
      nickMsg = ` · 닉네임 변경 (남은 변경권 ${state.user.nicknameTickets}장)`;
    }
  }
  state.user.region = `${a.regionCity} ${a.regionGu} ${a.regionDong}`;
  toast(`프로필이 저장되었습니다${nickMsg}`);
  render();
}
function renderSetCalib(){
  return `
  <div class="card" style="max-width:460px;">
    <p class="section-label">카메라 캘리브레이션</p>
    <p class="desc">촬영 각도·거리·신체 비율을 다시 측정하여 분석 정확도를 갱신합니다.</p>
    <button class="btn btn-secondary btn-block" onclick="toast('체형 보정을 다시 진행했습니다')">캘리브레이션 다시 진행</button>
  </div>`;
}
function renderSetLogout(){
  return `
  <div class="grid grid-2">
    <div class="card">
      <p class="section-label">로그아웃</p>
      <p class="desc">현재 계정에서 로그아웃합니다.</p>
      <button class="btn btn-secondary" onclick="doLogout()">로그아웃</button>
    </div>
    <div class="card">
      <p class="section-label">회원 탈퇴</p>
      <p class="desc">모든 운동 기록과 포인트가 삭제되며 복구할 수 없습니다.</p>
      <button class="btn btn-danger" onclick="askConfirm('정말 탈퇴하시겠어요?','모든 운동 기록, 포인트, 홈크루 정보가 영구히 삭제됩니다.',doWithdraw,'탈퇴하기',true)">회원 탈퇴</button>
    </div>
  </div>`;
}
function doLogout(){state.screen='login'; render();}
function doWithdraw(){
  closeConfirm();
  toast('회원 탈퇴가 완료되었습니다');
  setTimeout(()=>{
    location.reload();
  },900);
}

/* ---------- confirm dialog ---------- */
