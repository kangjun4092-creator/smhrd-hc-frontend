// support.js — '고객센터' 카테고리: 문의 등록/조회.

function renderSupport(){
  const s=state.support;
  const list = s.filter==='all' ? s.tickets : s.tickets.filter(t=>t.status===s.filter);
  return `
  <div class="view-head"><h1>고객센터</h1><p>불편사항접수 게시판 — Error 신고 및 추후 추가사항 의견을 접수하고 처리 현황을 확인합니다.</p></div>
  <div class="flex-between" style="margin-bottom:14px;">
    <div class="filter-bar" style="margin:0;">
      ${['all','접수','처리중','답변완료'].map(f=>`
        <button class="btn btn-sm ${s.filter===f?'btn-primary':'btn-secondary'}" onclick="setSupportFilter('${f}')">${f==='all'?'전체':f}</button>`).join('')}
    </div>
    <button class="btn btn-primary btn-sm" onclick="${(state.guestMode && !s.composerOpen) ? "goto('login')" : 'toggleComposer()'}">${s.composerOpen?'접기':'불편사항 접수하기'}</button>
  </div>

  ${s.composerOpen ? `
  <div class="card" style="max-width:560px;margin-bottom:20px;">
    <p class="section-label">새 불편사항 접수</p>
    <div class="field"><label for="sp-type">유형</label>
      <select id="sp-type"><option>Error</option><option>기능제안</option><option>기타</option></select>
    </div>
    <div class="field"><label for="sp-title">제목</label><input id="sp-title" placeholder="어떤 문제인지 한 줄로 요약해주세요"></div>
    <div class="field"><label for="sp-body">내용</label><textarea id="sp-body" rows="4" placeholder="언제, 어떤 화면에서, 어떤 문제가 발생했는지 알려주세요"></textarea></div>
    <button class="btn btn-primary" onclick="submitTicket()">접수하기</button>
  </div>` : ''}

  <div class="grid grid-2">
    ${list.length===0 ? `<div class="empty-note">해당하는 접수 내역이 없습니다.</div>` : list.map(t=>`
      <div class="card">
        <div class="flex-between">
          <span class="pill ${t.type==='Error'?'pill-danger':t.type==='기능제안'?'pill-accent':'pill-muted'}">${t.type}</span>
          <span class="pill ${t.status==='답변완료'?'pill-accent':t.status==='처리중'?'pill-gold':'pill-muted'}">${t.status}</span>
        </div>
        <h3 style="margin-top:10px;">${t.title}</h3>
        <p class="desc">${t.body}</p>
        <p class="hint" style="margin-bottom:${t.reply?'10px':'0'};">접수일 ${t.date}</p>
        ${t.reply ? `
        <div style="background:var(--surface-2);border-radius:10px;padding:10px 12px;">
          <p class="hint" style="margin:0 0 4px;color:var(--accent);font-weight:700;">운영팀 답변</p>
          <p class="desc" style="margin:0;">${t.reply}</p>
        </div>` : ''}
      </div>`).join('')}
  </div>`;
}
function setSupportFilter(f){state.support.filter=f; render();}
function toggleComposer(){state.support.composerOpen=!state.support.composerOpen; render();}
function submitTicket(){
  const type=document.getElementById('sp-type').value;
  const title=document.getElementById('sp-title').value.trim();
  const body=document.getElementById('sp-body').value.trim();
  if(!title || !body){toast('제목과 내용을 입력해주세요'); return;}
  state.support.tickets.unshift({id:Date.now(), type, title, body, status:'접수', date:'오늘', reply:''});
  state.support.composerOpen=false;
  state.support.filter='all';
  toast('불편사항이 접수되었습니다');
  render();
}

/* ========================================================================
   5. 설정
   ======================================================================== */
// (FR-ST-001) 계정 정보 수정, 공개범위 설정, 회원탈퇴는 각각 DB에 실제로 반영돼야 하는 지점입니다.
//   프로필 저장(saveAccount) > Java 계정 API > DB 연결 > SQL UPDATE(계정 테이블)
//   공개범위 저장(renderSetPrivacy 안의 토글/셀렉트) > Java 계정 API > DB 연결 > SQL UPDATE(공개범위 컬럼)
//   회원 탈퇴(doWithdraw) > Java 계정 API > DB 연결 > SQL DELETE(계정 및 연관 테이블 — 운동기록/포인트/크루 등)
// 카메라·알림 설정(renderSetCamera)은 기기/브라우저 설정에 가까워 로컬 저장(localStorage)만으로도
// 충분하며, 반드시 서버까지 갈 필요는 없습니다.
