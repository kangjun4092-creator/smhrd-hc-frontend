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
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:12px;text-align:center;padding:48px 24px 24px;">
      <div style="font-size:32px;">🔒</div>
      <p style="font-weight:700;font-size:15px;color:var(--ink);margin:0;max-width:32ch;">${message}</p>
      <button class="btn btn-primary" onclick="goto('login')">로그인하고 확인하기</button>
    </div>
  </div>`;
}
// 메인 대시보드의 캐릭터 미리보기 — topbar-avatar-canvas/avatar-char-canvas와 같은 방식(drawPixelCharacter)
// 이라 장착한 의상/배경이 그대로 반영된다. 게스트는 장착 아이템이 없으니 기본 외형으로 그린다.
function drawMainCharCanvas(){
  const canvas = document.getElementById('main-char-canvas');
  if(!canvas) return;
  drawPixelCharacter(canvas, state.guestMode ? {} : getEquipState(), state.guestMode ? 'male' : state.user.gender);
}
// 이번 달 전체를 진짜 달력처럼 보여준다. 정확히 어느 날짜에 출석했는지는 서버에 남아있지
// 않고 state.user.streak(연속 일수)만 있으므로, 오늘 이전 최대 streak일만큼을 거슬러 올라가며
// 체크된 것으로 보여주는 근사치다(월 경계를 넘는 연속출석이면 지난달 칸은 표시 못 함) — 실제
// 날짜별 출석 기록을 저장하게 되면 그걸로 교체하면 된다.
function renderAttendanceCalendar(){
  const DOW = ['월','화','수','목','금','토','일'];
  const jsToday = new Date();
  const year = jsToday.getFullYear(), month = jsToday.getMonth(), todayDate = jsToday.getDate();
  const streak = state.guestMode ? 0 : (state.user.streak||0);

  const firstDow = (new Date(year, month, 1).getDay()+6)%7; // 이번 달 1일이 무슨 요일인지(0=월)
  const daysInMonth = new Date(year, month+1, 0).getDate();

  const cells = [];
  for(let i=0;i<firstDow;i++) cells.push(null);
  for(let d=1;d<=daysInMonth;d++) cells.push(d);
  while(cells.length % 7 !== 0) cells.push(null); // 마지막 주도 7칸으로 맞춰서 요일 줄이 안 어긋나게

  const dowRow = DOW.map(l=>`<div class="att-dow-h">${l}</div>`).join('');
  const dayCells = cells.map(d=>{
    if(d==null) return `<div class="att-day empty"></div>`;
    const isToday = d===todayDate;
    const isChecked = d<todayDate && (todayDate-d)<=streak;
    const cls = isToday ? 'att-day today' : isChecked ? 'att-day checked' : 'att-day';
    return `<div class="${cls}">${d}</div>`;
  }).join('');

  return `
  <div style="margin:10px 0;">
    <p class="hint mono" style="margin:0 0 8px;font-weight:700;color:var(--ink);">${year}년 ${month+1}월</p>
    <div class="att-month-grid">${dowRow}${dayCells}</div>
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

  const canClaimStreak = state.user.streak>=10 && !state.user.streakRewardClaimed;
  const streakActive = state.guestMode || canClaimStreak;
  const welcomeName = state.guestMode ? '게스트' : (state.user.nickname||'홈트초보');
  const streakHint = state.guestMode
    ? '로그인하면 연속출석 보상을 받을 수 있어요'
    : (state.user.streakRewardClaimed ? '✅ 이번 보상을 받았어요' : '10일 연속출석부터 포인트를 받을 수 있어요');
  const header = `
  <div class="view-head">
    <h1>${welcomeName}님 환영합니다.</h1><p>오늘도 우리 동네 이웃들과 함께 운동해봐요.</p>
  </div>`;

  const rankLabel = isGuest ? GUEST_MAIN_SAMPLE.rank : `#${stats.myRank}`;
  const totalScore = isGuest ? GUEST_MAIN_SAMPLE.total : stats.total;
  const expToNext = isGuest ? GUEST_MAIN_SAMPLE.expToNext : stats.expToNext;
  const expPct = isGuest ? GUEST_MAIN_SAMPLE.exp : state.user.exp;
  const perfectPct = isGuest ? GUEST_MAIN_SAMPLE.perfectPct : stats.perfectPct;
  const greatPct = isGuest ? GUEST_MAIN_SAMPLE.greatPct : stats.greatPct;
  const missPct = isGuest ? GUEST_MAIN_SAMPLE.missPct : stats.missPct;
  const regionLabel = isGuest ? '동네를 설정하면 순위가 표시돼요' : state.user.region;

  // "한눈에 보기" 3열 — 왼쪽부터 캐릭터, 출석 캘린더, [동네랭킹·누적성과·크루 유도] 스택.
  // align-items:stretch라 세 열 다 제일 높은 출석 캘린더 칸 높이에 맞춰지고, 캐릭터 카드는
  // 자체적으로, 세번째 열은 flex:1로 세 카드가 그 높이를 고르게 나눠 가져서 빈 공간이 안 남는다.
  const glanceGrid = `
  <div class="grid glance-grid" style="align-items:stretch;">
    <div class="card" style="text-align:center;display:flex;flex-direction:column;">
      <p class="section-label" style="text-align:left;margin:0 0 8px;">나의 홈트 메이트</p>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;">
        <canvas id="main-char-canvas" style="width:132px;height:161px;margin:0 auto 12px;display:block;"></canvas>
        <p style="font-weight:700;margin:0;font-size:17px;">${welcomeName}</p>
        <p class="hint" style="margin:4px 0 0;font-size:13px;">Lv.${isGuest?0:state.user.level} · 꾸준함을 키우는 중</p>
      </div>
      <button class="btn btn-secondary btn-sm btn-block" onclick="${isGuest ? "goto('login')" : "setMenu('profile');setSub('profile',0);"}">캐릭터 꾸미기</button>
    </div>
    <div class="card" style="display:flex;flex-direction:column;">
      <div>
        <p class="section-label" style="margin:0;">오늘도 출석!</p>
        <p class="hint" style="margin:2px 0 0;">벌써 <b class="mono" style="color:var(--ink);">${isGuest?0:state.user.streak}</b>일째 함께하고 있어요.</p>
        ${renderAttendanceCalendar()}
      </div>
      <div style="margin-top:auto;">
        <button class="btn btn-sm ${streakActive?'btn-primary':'btn-ghost'} btn-block" ${streakActive?'':'disabled style="opacity:.5;cursor:not-allowed;"'} onclick="${state.guestMode ? "goto('login')" : 'claimStreakReward()'}">포인트받기</button>
        <p class="hint" style="margin:6px 0 0;font-size:11px;">${streakHint}</p>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:14px;">
      <div class="card" style="flex:1;display:flex;flex-direction:column;justify-content:center;">
        <p class="section-label">동네 랭킹</p>
        <div style="display:flex;align-items:baseline;gap:10px;">
          <span class="mono" style="font-size:42px;font-weight:700;">${rankLabel}</span>
          ${isGuest ? '' : renderMainTrend(rankDelta)}
        </div>
        <p class="hint" style="margin:6px 0 0;font-size:13px;">${regionLabel}</p>
      </div>
      <div class="card" style="flex:1;display:flex;flex-direction:column;justify-content:center;">
        <p class="section-label">누적 성과</p>
        <p class="desc mono" style="margin:0;font-size:15px;">누적 점수 <b style="font-size:20px;">${totalScore.toLocaleString()}</b></p>
        <p class="desc mono" style="margin:6px 0 0;font-size:14px;">레벨업까지 <b style="color:var(--gold);font-size:16px;">${expToNext.toLocaleString()}</b>P 남았어요!</p>
        <div class="progress" style="height:10px;margin-top:10px;"><span style="width:${expPct}%"></span></div>
      </div>
      <div class="card" style="background:var(--ink);border-color:var(--ink);flex:1;display:flex;flex-direction:column;justify-content:center;">
        <p class="section-label" style="color:var(--gold);margin:0 0 8px;">BETTER TOGETHER</p>
        <h3 style="margin:0 0 6px;color:#fff;font-size:19px;">혼자보다, 함께</h3>
        <p class="desc" style="color:rgba(255,255,255,.72);margin:0 0 12px;font-size:13px;">${state.crew.created ? '오늘도 우리 크루와 함께해요.' : '우리 동네 운동 친구들과 함께해요.'}</p>
        <button class="btn btn-primary btn-sm btn-block" onclick="setMenu('crew')">${state.crew.created ? '우리 크루 페이지 →' : '크루 찾기 →'}</button>
      </div>
    </div>
  </div>`;
  const highlightBlock = `
  <div style="margin-bottom:16px;">${renderGuestBlur(glanceGrid, '로그인하면 내 캐릭터·출석·랭킹을 볼 수 있어요')}</div>`;

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

  <div class="card">
    <p class="section-label">누적 등급 비율 (전체 세션 기준)</p>
    <div style="display:flex;gap:22px;flex-wrap:wrap;margin-top:4px;">
      <span>PERFECT <b style="color:var(--accent)">${perfectPct}%</b> ${isGuest ? '' : renderMainTrend(gradeDelta.perfect)}</span>
      <span>GREAT <b style="color:var(--gold)">${greatPct}%</b> ${isGuest ? '' : renderMainTrend(gradeDelta.great)}</span>
      <span>MISS <b style="color:var(--danger)">${missPct}%</b> ${isGuest ? '' : renderMainTrend(gradeDelta.miss)}</span>
    </div>
  </div>`;

  return header + highlightBlock + stats_block;
}
