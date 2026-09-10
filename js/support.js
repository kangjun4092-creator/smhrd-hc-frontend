// support.js — '고객센터' 카테고리: 문의 등록/조회.

// 백엔드 SupportTicket.Status는 영문 enum(RECEIVED/IN_PROGRESS/ANSWERED)으로 내려오므로
// 화면에 쓰는 한글 라벨로 바꿔준다. type은 SupportService.parseType()이 'Error'/'기능제안'/
// 그 외(기타)를 그대로 받아들이므로 보낼 때는 변환이 필요 없고, 받을 때만 영문 enum을 되돌린다.
const SUPPORT_STATUS_LABEL = { RECEIVED:'접수', IN_PROGRESS:'처리중', ANSWERED:'답변완료' };
const SUPPORT_TYPE_LABEL = { ERROR:'Error', FEATURE_REQUEST:'기능제안', ETC:'기타' };

async function loadSupportTickets(){
  if(!state.token) return;
  try{
    const res = await fetch(`${API_BASE}/api/support/tickets/me`, {
      headers: { 'Authorization': 'Bearer ' + state.token }
    });
    const body = await res.json();
    if(!body.success) return;
    state.support.tickets = body.data.map(t => {
      const d = new Date(t.createdAt);
      return {
        id: t.id,
        type: SUPPORT_TYPE_LABEL[t.type] || t.type,
        title: t.title, body: t.body,
        status: SUPPORT_STATUS_LABEL[t.status] || t.status,
        date: `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`,
        reply: t.reply || '',
      };
    });
    render();
  }catch(err){
    console.error('문의 내역 불러오기 실패', err);
  }
}

// 관리자 전용: 모든 사용자의 문의 목록. 백엔드가 @PreAuthorize("hasRole('ADMIN')")로 막아두었으므로
// ADMIN이 아닌 토큰으로 호출하면 403이 오고 body.success가 false라 그냥 조용히 무시된다.
async function loadAllSupportTickets(){
  if(!state.token) return;
  try{
    const res = await fetch(`${API_BASE}/api/support/tickets`, {
      headers: { 'Authorization': 'Bearer ' + state.token }
    });
    const body = await res.json();
    if(!body.success) return;
    state.support.adminTickets = body.data.map(t => {
      const d = new Date(t.createdAt);
      return {
        id: t.id,
        author: t.authorNickname,
        type: SUPPORT_TYPE_LABEL[t.type] || t.type,
        title: t.title, body: t.body,
        status: SUPPORT_STATUS_LABEL[t.status] || t.status,
        date: `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`,
        reply: t.reply || '',
      };
    });
    render();
  }catch(err){
    console.error('전체 문의 목록 불러오기 실패', err);
  }
}
async function submitAdminReply(ticketId){
  const el = document.getElementById('admin-reply-'+ticketId);
  const reply = el ? el.value.trim() : '';
  if(!reply){ toast('답변 내용을 입력해주세요'); return; }
  try{
    const res = await fetch(`${API_BASE}/api/support/tickets/${ticketId}/reply`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + state.token },
      body: JSON.stringify({ reply })
    });
    const body = await res.json();
    if(!body.success){ toast(body.message || '답변 등록에 실패했습니다'); return; }
    toast('답변이 등록되었습니다');
    await loadAllSupportTickets();
  }catch(err){
    toast('서버에 연결할 수 없습니다 (백엔드가 켜져 있는지 확인해주세요)');
  }
}
async function markTicketInProgress(ticketId){
  try{
    const res = await fetch(`${API_BASE}/api/support/tickets/${ticketId}/start`, {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer ' + state.token }
    });
    const body = await res.json();
    if(!body.success){ toast(body.message || '상태 변경에 실패했습니다'); return; }
    toast('처리중으로 표시했습니다');
    await loadAllSupportTickets();
  }catch(err){
    toast('서버에 연결할 수 없습니다 (백엔드가 켜져 있는지 확인해주세요)');
  }
}

function renderSupport(){
  const s=state.support;
  const isAdmin = state.user.role === 'ADMIN';
  const adminView = isAdmin && s.adminView;
  const source = adminView ? s.adminTickets : s.tickets;
  const list = s.filter==='all' ? source : source.filter(t=>t.status===s.filter);
  return `
  <div class="view-head"><h1>고객센터</h1></div>
  <div class="flex-between" style="margin-bottom:14px;">
    <div class="filter-bar" style="margin:0;">
      ${['all','접수','처리중','답변완료'].map(f=>`
        <button class="btn btn-sm ${s.filter===f?'btn-primary':'btn-secondary'}" onclick="setSupportFilter('${f}')">${f==='all'?'전체':f}</button>`).join('')}
    </div>
    <div style="display:flex;gap:8px;">
      ${isAdmin ? `<button class="btn btn-sm ${adminView?'btn-primary':'btn-secondary'}" onclick="toggleSupportAdminView()">${adminView?'내 문의 보기':'🛠 전체 문의 (관리자)'}</button>` : ''}
      ${!adminView ? `<button class="btn btn-primary btn-sm" onclick="${(state.guestMode && !s.composerOpen) ? "goto('login')" : 'toggleComposer()'}">${s.composerOpen?'접기':'불편사항 접수하기'}</button>` : ''}
    </div>
  </div>

  ${(!adminView && s.composerOpen) ? `
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
    ${list.length===0 ? `<div class="empty-note">해당하는 ${adminView?'문의':'접수'} 내역이 없습니다.</div>`
      : list.map(t => adminView ? renderAdminTicketCard(t) : renderMyTicketCard(t)).join('')}
  </div>`;
}
function renderMyTicketCard(t){
  return `
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
      </div>`;
}
// 관리자 전용 카드 — 작성자 닉네임과 답변 작성/수정 폼이 추가로 보인다.
function renderAdminTicketCard(t){
  return `
      <div class="card">
        <div class="flex-between">
          <span class="pill ${t.type==='Error'?'pill-danger':t.type==='기능제안'?'pill-accent':'pill-muted'}">${t.type}</span>
          <span class="pill ${t.status==='답변완료'?'pill-accent':t.status==='처리중'?'pill-gold':'pill-muted'}">${t.status}</span>
        </div>
        <h3 style="margin-top:10px;">${t.title}</h3>
        <p class="hint" style="margin:2px 0 8px;">작성자 ${t.author} · 접수일 ${t.date}</p>
        <p class="desc">${t.body}</p>
        ${t.status==='접수' ? `<button class="btn btn-secondary btn-sm" style="margin-top:10px;" onclick="markTicketInProgress(${t.id})">처리 시작 (처리중으로 표시)</button>` : ''}
        ${t.reply ? `
        <div style="background:var(--surface-2);border-radius:10px;padding:10px 12px;margin-top:10px;">
          <p class="hint" style="margin:0 0 4px;color:var(--accent);font-weight:700;">등록된 답변</p>
          <p class="desc" style="margin:0;">${t.reply}</p>
        </div>` : ''}
        <div class="field" style="margin-top:10px;">
          <label for="admin-reply-${t.id}">${t.reply ? '답변 수정' : '답변 작성'}</label>
          <textarea id="admin-reply-${t.id}" rows="3" placeholder="사용자에게 보여질 답변을 입력하세요">${t.reply||''}</textarea>
        </div>
        <button class="btn btn-primary btn-sm" onclick="submitAdminReply(${t.id})">${t.reply?'답변 수정하기':'답변 등록하기'}</button>
      </div>`;
}
function setSupportFilter(f){state.support.filter=f; render();}
function toggleComposer(){state.support.composerOpen=!state.support.composerOpen; render();}
function toggleSupportAdminView(){
  state.support.adminView = !state.support.adminView;
  if(state.support.adminView) loadAllSupportTickets();
  render();
}
async function submitTicket(){
  const type=document.getElementById('sp-type').value;
  const title=document.getElementById('sp-title').value.trim();
  const body=document.getElementById('sp-body').value.trim();
  if(!title || !body){toast('제목과 내용을 입력해주세요'); return;}
  try{
    const res = await fetch(`${API_BASE}/api/support/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + state.token },
      body: JSON.stringify({ type, title, body })
    });
    const resBody = await res.json();
    if(!resBody.success){ toast(resBody.message || '접수에 실패했습니다'); return; }
    state.support.composerOpen=false;
    state.support.filter='all';
    toast('불편사항이 접수되었습니다');
    await loadSupportTickets();
  }catch(err){
    toast('서버에 연결할 수 없습니다 (백엔드가 켜져 있는지 확인해주세요)');
  }
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
