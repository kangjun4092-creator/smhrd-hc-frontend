// main.js — 로그인 후 첫 화면인 '메인' 카테고리(대시보드).

function mainTrendSeed(key){
  const d=new Date();
  return hashStr((state.user.nickname||'guest')+key+d.getFullYear()+d.getMonth()+d.getDate());
}
function getMainRankDelta(stats){
  const seed=mainTrendSeed('rank');
  const prevRank=Math.max(1, stats.myRank + ((seed%5)-2));
  return prevRank-stats.myRank; // 양수면 순위 숫자가 작아짐 = 상승
}
function getMainGradeDelta(stats){
  const mk=(key,cur)=>{
    const seed=mainTrendSeed(key);
    const prev=Math.max(0, Math.min(100, cur + ((seed%7)-3)));
    return cur-prev;
  };
  return { perfect: mk('perfect', stats.perfectPct), great: mk('great', stats.greatPct), miss: mk('miss', stats.missPct) };
}
function renderMainTrend(delta){
  if(!delta) return '<span class="hint mono" style="margin:0;">-</span>';
  return delta>0
    ? `<span class="mono" style="color:var(--sky);font-weight:700;">▲${Math.abs(delta)}</span>`
    : `<span class="mono" style="color:var(--danger);font-weight:700;">▼${Math.abs(delta)}</span>`;
}
// 다음 레벨에서 새로 구매 가능해지는 아이템 — shopItems의 levelReq 참고.
function getItemsUnlockedAtLevel(level){
  return state.shopItems.filter(it=>it.levelReq===level);
}
// [백엔드 연동 필요 구간] 연속출석 보상 — 실제로는 서버가 매일 로그인 여부를 집계해 streak를
// 올려줘야 하지만, 이 프로토타입은 로그인 이력이 없어 state.user.streak를 고정 데모값으로 둔다.
function claimStreakReward(){
  if(state.user.streak<10 || state.user.streakRewardClaimed) return;
  askConfirm(
    '연속출석 보상',
    `연속출석 ${state.user.streak}일째! 포인트 +300을 받으시겠어요?`,
    ()=>{
      closeConfirm();
      state.user.points += 300;
      state.user.streakRewardClaimed = true;
      toast('연속출석 보상으로 +300P를 받았어요!');
      render();
    },
    '포인트 받기'
  );
}
// 게스트 모드에서 "테스트 로그인한 회원과 화면이 똑같아 보인다"는 피드백에 따라, 개인 기록이
// 담긴 영역(메인 대시보드·프로필)은 실제 값을 그대로 보여주는 대신 흐리게 처리하고 로그인
// 유도 오버레이를 덮는다. 로그인 사용자는 innerHtml을 그대로 반환해 아무 영향이 없다.
function renderGuestBlur(innerHtml, message){
  if(!state.guestMode) return innerHtml;
  return `
  <div style="position:relative;">
    <div style="filter:blur(6px);opacity:.5;pointer-events:none;user-select:none;" aria-hidden="true">${innerHtml}</div>
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;padding:24px;">
      <div style="font-size:32px;">🔒</div>
      <p style="font-weight:700;font-size:15px;color:var(--ink);margin:0;max-width:32ch;">${message}</p>
      <button class="btn btn-primary" onclick="goto('login')">로그인하고 확인하기</button>
    </div>
  </div>`;
}
function renderMain(){
  const isGuest = state.guestMode;
  // 게스트가 메인 화면에 왔을 때 보여줄 고정 예시값 — 실제 계정 데이터(state.user/state.history)를
  // 그대로 보여주면 이미 로그인한 것처럼 보여서 혼란을 준다는 피드백에 따라, 진짜 내 기록이 아닌
  // "가입하면 이렇게 보여요" 예시로 명확히 구분되는 값을 쓴다. (함수 안에서 만드는 이유는
  // EXP_PER_LEVEL이 이 파일에서 나중에 선언되기 때문 — 최상위 const로 두면 로드 시점에 아직
  // 없는 값을 참조해 에러가 난다.)
  const GUEST_MAIN_SAMPLE = {
    recent: [
      {ex:'스쿼트', date:'예시', reps:24, acc:88, score:320},
      {ex:'런지', date:'예시', reps:15, acc:81, score:210},
    ],
    rank:'-', total:0, expToNext:EXP_PER_LEVEL, exp:0,
    perfectPct:0, greatPct:0, missPct:0,
  };
  const stats = isGuest ? null : getProfileStats();
  const rankDelta = isGuest ? 0 : getMainRankDelta(stats);
  const gradeDelta = isGuest ? {perfect:0,great:0,miss:0} : getMainGradeDelta(stats);
  const recent = isGuest ? GUEST_MAIN_SAMPLE.recent : state.history.slice(0,3);
  const nextLv = isGuest ? 1 : (state.user.level||1)+1;
  const unlockedNext = getItemsUnlockedAtLevel(nextLv);
  const setBonusAtNext=nextLv%5===0;

  const canClaimStreak = state.user.streak>=10 && !state.user.streakRewardClaimed;
  const streakActive = state.guestMode || canClaimStreak;
  const welcomeName = state.guestMode ? '게스트' : (state.user.nickname||'홈트초보');
  const streakHint = state.guestMode
    ? '로그인하면 연속출석 보상을 받을 수 있어요'
    : (state.user.streakRewardClaimed ? '✅ 이번 보상을 받았어요' : '10일 연속출석부터 포인트를 받을 수 있어요');
  const header = `
  <div class="view-head flex-between">
    <div><h1>${welcomeName}님 환영합니다.</h1><p>오늘도 우리 동네 이웃들과 함께 운동해봐요.</p></div>
    <div style="text-align:right;flex:none;">
      <p class="hint" style="margin:0 0 6px;">연속출석 <b style="color:var(--ink);font-size:15px;">${state.user.streak}</b>일째</p>
      <button class="btn btn-sm ${streakActive?'btn-primary':'btn-ghost'}" ${streakActive?'':'disabled style="opacity:.5;cursor:not-allowed;"'} onclick="${state.guestMode ? "goto('login')" : 'claimStreakReward()'}">포인트받기</button>
      <p class="hint" style="margin:4px 0 0;font-size:11px;">${streakHint}</p>
    </div>
  </div>`;

  const rankLabel = isGuest ? GUEST_MAIN_SAMPLE.rank : `#${stats.myRank}`;
  const totalScore = isGuest ? GUEST_MAIN_SAMPLE.total : stats.total;
  const expToNext = isGuest ? GUEST_MAIN_SAMPLE.expToNext : stats.expToNext;
  const expPct = isGuest ? GUEST_MAIN_SAMPLE.exp : state.user.exp;
  const perfectPct = isGuest ? GUEST_MAIN_SAMPLE.perfectPct : stats.perfectPct;
  const greatPct = isGuest ? GUEST_MAIN_SAMPLE.greatPct : stats.greatPct;
  const missPct = isGuest ? GUEST_MAIN_SAMPLE.missPct : stats.missPct;
  const regionLabel = isGuest ? '동네를 설정하면 순위가 표시돼요' : state.user.region;

  const stats_block = `
  <div class="card" style="margin-bottom:16px;">
    <div class="flex-between">
      <p class="section-label" style="margin:0;">최근 운동 히스토리${isGuest?' <span class="hint" style="margin:0;">(예시)</span>':''}</p>
      <button class="btn btn-ghost btn-sm" onclick="${state.guestMode ? "goto('login')" : "setMenu('profile');setSub('profile',2);"}">전체 보기 →</button>
    </div>
    ${recent.length ? `<div style="display:flex;flex-direction:column;gap:8px;margin-top:10px;">${recent.map(h=>`
      <div class="flex-between" style="border:1px solid var(--line);border-radius:10px;padding:10px 12px;">
        <div><b>${h.ex}</b><p class="hint" style="margin:2px 0 0;">${h.date} · 유효 ${h.reps}회 · 정확도 ${h.acc}%</p></div>
        <span class="mono" style="color:var(--gold);font-weight:700;">+${h.score}</span>
      </div>`).join('')}</div>` : '<p class="empty-note" style="margin-top:10px;">아직 운동 기록이 없어요. 운동을 시작해보세요!</p>'}
  </div>

  <div class="grid grid-2" style="align-items:start;margin-bottom:16px;">
    <div class="card">
      <p class="section-label">동네 랭킹</p>
      <div style="display:flex;align-items:baseline;gap:8px;">
        <span class="mono" style="font-size:30px;font-weight:700;">${rankLabel}</span>
        ${isGuest ? '' : renderMainTrend(rankDelta)}
      </div>
      <p class="hint" style="margin:4px 0 0;">${regionLabel}</p>
    </div>
    <div class="card">
      <p class="section-label">누적 성과</p>
      <p class="desc mono" style="margin:0;">누적 점수 <b>${totalScore.toLocaleString()}</b></p>
      <p class="desc mono" style="margin:2px 0 0;">레벨업까지 <b style="color:var(--gold);">${expToNext.toLocaleString()}</b>P 남았어요!</p>
      <div class="progress" style="margin-top:8px;"><span style="width:${expPct}%"></span></div>
    </div>
  </div>

  <div class="card" style="margin-bottom:16px;">
    <p class="section-label">누적 등급 비율 (전체 세션 기준)</p>
    <div style="display:flex;gap:22px;flex-wrap:wrap;margin-top:4px;">
      <span>PERFECT <b style="color:var(--accent)">${perfectPct}%</b> ${isGuest ? '' : renderMainTrend(gradeDelta.perfect)}</span>
      <span>GREAT <b style="color:var(--gold)">${greatPct}%</b> ${isGuest ? '' : renderMainTrend(gradeDelta.great)}</span>
      <span>MISS <b style="color:var(--danger)">${missPct}%</b> ${isGuest ? '' : renderMainTrend(gradeDelta.miss)}</span>
    </div>
  </div>

  <div class="card">
    <p class="section-label">다음 레벨업 (Lv.${nextLv}) 혜택</p>
    <p class="desc" style="margin:0 0 6px;">${setBonusAtNext ? `운동세트 +1 (하루 가능한 운동세트가 ${EXERCISE_DAILY_SETS_BASE + Math.floor(nextLv/5)}세트로 늘어나요)` : '경험치·포인트를 계속 모아 다음 혜택을 기다려보세요.'}</p>
    ${unlockedNext.length ? `
    <p class="hint" style="margin:0 0 4px;">Lv.${nextLv}에서 새로 구매 가능해지는 아이템</p>
    <p class="desc mono" style="margin:0;">${unlockedNext.map(it=>it.name).join(' · ')}</p>` : ''}
  </div>`;

  return header + stats_block;
}
