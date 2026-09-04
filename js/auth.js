// auth.js — 회원가입/로그인/소셜로그인/아이디·비밀번호 찾기 화면과 로직.

function renderSignup(){
  return `
  <div class="center-shell">
    <div class="auth-card">
      <p class="auth-eyebrow">우리동네 홈트챌린지</p>
      <h1 class="auth-title">회원가입</h1>
      <p class="auth-sub">AI 자세 분석과 지역 랭킹으로 함께하는 홈트레이닝</p>

      <div class="field">
        <label for="su-id">아이디</label>
        <div class="field-row">
          <input id="su-id" type="text" placeholder="영문/숫자 4자 이상" style="flex:1;min-width:0;" value="${state.signup.id||''}" oninput="state.signup.id=this.value">
          <button type="button" class="btn btn-secondary btn-sm" style="flex:none;white-space:nowrap;" onclick="checkSignupIdDup()">중복확인</button>
        </div>
        <p class="hint" id="su-id-msg" style="display:none;"></p>
      </div>
      <div class="field-row">
        <div class="field">
          <label for="su-pw">비밀번호</label>
          <input id="su-pw" type="password" placeholder="••••••••" value="${state.signup.pw||''}" oninput="state.signup.pw=this.value;checkSignupPwMatch();">
        </div>
        <div class="field">
          <label for="su-pw2">비밀번호 확인</label>
          <input id="su-pw2" type="password" placeholder="••••••••" value="${state.signup.pw2||''}" oninput="state.signup.pw2=this.value;checkSignupPwMatch();">
          <p class="hint" id="su-pw2-msg" style="display:none;color:var(--danger);">비밀번호가 일치하지 않습니다</p>
        </div>
      </div>
      <div class="field">
        <label for="su-nick">닉네임</label>
        <div class="field-row">
          <input id="su-nick" type="text" placeholder="홈트에서 사용할 닉네임" style="flex:1;min-width:0;" value="${state.signup.nickname||''}" oninput="state.signup.nickname=this.value">
          <button type="button" class="btn btn-secondary btn-sm" style="flex:none;white-space:nowrap;" onclick="checkSignupNickDup()">중복확인</button>
        </div>
        <p class="hint" id="su-nick-msg" style="display:none;"></p>
      </div>
      <div class="field">
        <label for="su-ref">추천인 아이디 (선택)</label>
        <input id="su-ref" type="text" placeholder="추천인 아이디 입력 시 포인트 지급">
        <p class="hint">가입자와 추천인 모두에게 포인트가 지급됩니다.</p>
      </div>
      <div class="field">
        <label for="su-email">이메일</label>
        <input id="su-email" type="email" placeholder="example@email.com" value="${state.signup.email||''}" oninput="state.signup.email=this.value">
      </div>
      <div class="field">
        <label>활동 지역 (랭킹 산정 기준)</label>
        <div class="field-row">
          <select onchange="setSignupCity(this.value)" style="flex:1;min-width:0;">
            ${Object.keys(REGION_DATA).map(c=>`<option ${c===state.signup.regionCity?'selected':''}>${c}</option>`).join('')}
          </select>
          <select onchange="setSignupGu(this.value)" style="flex:1;min-width:0;">
            ${Object.keys(REGION_DATA[state.signup.regionCity]).map(g=>`<option ${g===state.signup.regionGu?'selected':''}>${g}</option>`).join('')}
          </select>
          <select onchange="setSignupDong(this.value)" style="flex:1;min-width:0;">
            ${REGION_DATA[state.signup.regionCity][state.signup.regionGu].map(d=>`<option ${d===state.signup.regionDong?'selected':''}>${d}</option>`).join('')}
          </select>
        </div>
        <p class="hint">랭킹은 동 단위로 집계됩니다.</p>
      </div>
      <div class="field">
        <label>카메라 캘리브레이션</label>
        <button class="btn btn-secondary btn-block" onclick="openCalibrationModal()">
          ${state.signup.calibrated ? '✓ 체형 보정 완료 (다시 촬영하려면 클릭)' : '카메라로 체형 보정하기'}
        </button>
        <p class="hint">
          ${state.signup.calibrated && state.signup.calProfile && state.signup.calProfile.bodyInfo && state.signup.calProfile.bodyInfo.bmi ? `BMI ${state.signup.calProfile.bodyInfo.bmi} 기준으로 저장됨 · ` : ''}실제 웹캠으로 촬영 각도·거리·신체 비율을 미리 보정해 자세 분석 정확도를 높입니다.
        </p>
      </div>

      <button class="btn btn-primary btn-block" style="margin-top:6px;" onclick="doSignup()">가입하고 시작하기</button>
      <p class="switch-line">이미 계정이 있으신가요? <button onclick="goto('login')">로그인</button></p>
    </div>
  </div>`;
}
function setSignupCity(v){
  state.signup.regionCity=v;
  const gus=Object.keys(REGION_DATA[v]);
  state.signup.regionGu=gus[0];
  state.signup.regionDong=REGION_DATA[v][gus[0]][0];
  render();
}
function setSignupGu(v){
  state.signup.regionGu=v;
  state.signup.regionDong=REGION_DATA[state.signup.regionCity][v][0];
  render();
}
function setSignupDong(v){ state.signup.regionDong=v; render(); }
// (#8) 아이디·닉네임 중복확인 버튼 — 실제로는 SQL SELECT ... WHERE id=? / nickname=? 로 대체된다.
function checkSignupIdDup(){
  const id=document.getElementById('su-id').value.trim();
  const msg=document.getElementById('su-id-msg');
  if(!id){ msg.style.color='var(--danger)'; msg.textContent='아이디를 입력해주세요'; msg.style.display='block'; return; }
  const dup=EXISTING_USERS.some(u=>u.id===id);
  msg.style.color = dup ? 'var(--danger)' : 'var(--accent)';
  msg.textContent = dup ? '이미 사용중인 아이디입니다' : '사용 가능한 아이디입니다';
  msg.style.display='block';
}
function checkSignupNickDup(){
  const nick=document.getElementById('su-nick').value.trim();
  const msg=document.getElementById('su-nick-msg');
  if(!nick){ msg.style.color='var(--danger)'; msg.textContent='닉네임을 입력해주세요'; msg.style.display='block'; return; }
  const dup=EXISTING_USERS.some(u=>u.nickname===nick);
  msg.style.color = dup ? 'var(--danger)' : 'var(--accent)';
  msg.textContent = dup ? '이미 사용중인 닉네임입니다' : '사용 가능한 닉네임입니다';
  msg.style.display='block';
}
function checkSignupPwMatch(){
  const pw=document.getElementById('su-pw').value;
  const pw2=document.getElementById('su-pw2').value;
  const msg=document.getElementById('su-pw2-msg');
  msg.style.display = (pw2 && pw!==pw2) ? 'block' : 'none';
}
// [백엔드 연동 필요 구간] 여기 doSignup()부터: 지금은 state.user에 값만 옮겨 담는
// 목업이지만, 실제 구현에서는 이 지점에서 아래 파이프라인이 필요합니다.
//   회원가입 폼 제출(여기) > Java 서버 회원가입 API(비밀번호 해싱 포함) > DB 연결 > SQL INSERT(계정 테이블)
function doSignup(){
  const id=document.getElementById('su-id').value.trim();
  const pw=document.getElementById('su-pw').value;
  const pw2=document.getElementById('su-pw2').value;
  const nick=document.getElementById('su-nick').value.trim() || '홈트초보';
  const email=document.getElementById('su-email').value.trim();
  // (#8) 아이디·닉네임 중복 확인 — 실제로는 SQL SELECT ... WHERE id=? / nickname=? 로 대체된다.
  if(!id){ toast('아이디를 입력해주세요'); return; }
  if(pw!==pw2){ toast('비밀번호가 일치하지 않습니다'); return; }
  if(EXISTING_USERS.some(u=>u.id===id)){ toast('이미 사용중인 아이디입니다'); return; }
  if(EXISTING_USERS.some(u=>u.nickname===nick)){ toast('이미 사용중인 닉네임입니다'); return; }
  const region=`${state.signup.regionCity} ${state.signup.regionGu} ${state.signup.regionDong}`;
  state.user.nickname = nick;
  state.user.email = email;
  state.user.gender = state.signup.gender || 'male';
  state.user.region = region;
  state.user.calibration = state.signup.calProfile || null;
  state.settings.account.nickname = state.user.nickname;
  state.settings.account.regionCity = state.signup.regionCity;
  state.settings.account.regionGu = state.signup.regionGu;
  state.settings.account.regionDong = state.signup.regionDong;
  EXISTING_USERS.push({id, nickname:nick, email});
  toast('회원가입이 완료되었습니다');
  goto('login');
}

/* ---------- 회원가입 : 실제 웹캠 캘리브레이션 모달 (MediaPipe Pose) ---------- */
// (FR-AC-002) 이 구간(calStartCamera ~ calComputeProfile)은 브라우저 안에서 도는
// MediaPipe Pose(WASM) 계산이라 그대로 프론트엔드에 남습니다 — 백엔드가 필요 없는 부분.
//   웹캠 영상(JS) > MediaPipe Pose(WASM, 브라우저 내 실행) > 체형 프로필 계산(JS)
// 계산된 결과를 실제로 "저장"하는 시점(아래 calApply())부터만 서버 연동이 필요합니다.
function renderLogin(){
  return `
  <div class="center-shell">
    <div class="auth-card">
      <p class="auth-eyebrow">우리동네홈트챌린지</p>
      <h1 class="auth-title">로그인</h1>
      <p class="auth-sub">${state.user.nickname ? state.user.nickname+'님, 다시 오신 것을 환영해요' : '계정 정보를 입력해 주세요'}</p>
      <div class="field">
        <label for="li-id">아이디</label>
        <input id="li-id" type="text" placeholder="아이디" value="${state.user.nickname ? 'hometrainer01' : ''}">
      </div>
      <div class="field">
        <label for="li-pw">비밀번호</label>
        <input id="li-pw" type="password" placeholder="••••••••" value="${state.user.nickname ? '········' : ''}">
      </div>
      <div class="flex-between" style="margin:2px 0 4px;">
        <button class="btn btn-ghost btn-sm" style="padding-left:0;" onclick="openFindIdModal()">아이디 찾기</button>
        <button class="btn btn-ghost btn-sm" onclick="openFindPwModal()">비밀번호 찾기</button>
      </div>
      <button class="btn btn-primary btn-block" onclick="doLogin()">로그인</button>
      <div class="flex-between" style="margin:16px 0;gap:10px;">
        <div style="flex:1;height:1px;background:var(--line);"></div>
        <span class="hint" style="margin:0;">SNS 계정으로 로그인</span>
        <div style="flex:1;height:1px;background:var(--line);"></div>
      </div>
      <button class="btn btn-block" style="background:#FEE500;border-color:var(--outline);color:#241A00;margin-bottom:8px;" onclick="doSocialLogin('카카오')">카카오로 계속하기</button>
      <button class="btn btn-block" style="background:#03C75A;border-color:var(--outline);color:#fff;margin-bottom:8px;" onclick="doSocialLogin('네이버')">네이버로 계속하기</button>
      <button class="btn btn-secondary btn-block" onclick="doSocialLogin('구글')">Google로 계속하기</button>
      <p class="switch-line">아직 계정이 없으신가요? <button onclick="goto('signup')">회원가입</button></p>
    </div>
  </div>`;
}
// [백엔드 연동 필요 구간] doLogin() 지점:
//   로그인 폼 제출(여기) > Java 서버 로그인 API(비밀번호 검증, 세션/JWT 발급) > DB 연결 > SQL SELECT(계정 조회)
function doLogin(){
  if(!state.user.nickname){state.user.nickname='홈트초보';}
  state.guestMode=false;
  state.screen='app';
  state.menu='main';
  render();
}
// [백엔드 연동 필요 구간] doSocialLogin() — 실제로는 각 사(카카오/네이버/구글) OAuth 인가 코드를
// 받아 Java 서버로 넘기고 > 서버가 토큰 교환 + 사용자 조회/생성(DB 연결, SQL INSERT or SELECT)을
// 수행한 뒤 세션을 발급하는 흐름이 필요하다. 여기서는 버튼 클릭 시 바로 로그인된 것처럼 목업 처리.
function doSocialLogin(provider){
  if(!state.user.nickname){state.user.nickname='홈트초보';}
  toast(`${provider} 계정으로 로그인했습니다`);
  state.guestMode=false;
  state.screen='app';
  state.menu='main';
  render();
}

/* ---------- 아이디/비밀번호 찾기 모달 ---------- */
function openFindIdModal(){ state.findIdModal={open:true, result:null}; render(); }
function closeFindIdModal(){ state.findIdModal.open=false; render(); }
// [백엔드 연동 필요 구간] submitFindId() — 이메일로 인증코드 발송 > 코드 검증 API 호출 > DB 연결 >
// SQL SELECT(이메일로 계정 조회)가 필요하다. 여기서는 목업으로 등록된 첫 계정을 바로 보여준다.
function submitFindId(){
  const email=document.getElementById('find-id-email').value.trim();
  if(!email){ toast('이메일을 입력해주세요'); return; }
  state.findIdModal.result = EXISTING_USERS[0].id;
  render();
}
function renderFindIdModal(){
  const m=state.findIdModal;
  return `
  <div class="confirm-backdrop" onclick="if(event.target===this)closeFindIdModal()">
    <div class="confirm-box" style="max-width:380px;">
      <h3>아이디 찾기</h3>
      ${m.result ? `
        <p style="color:var(--ink-dim);font-size:13px;line-height:1.6;margin:0 0 18px;">가입하신 아이디는 <b style="color:var(--ink);">${m.result}</b> 입니다.</p>
        <div class="confirm-actions"><button class="btn btn-primary btn-sm" onclick="closeFindIdModal()">확인</button></div>
      ` : `
        <p class="hint" style="margin:0 0 14px;">가입 시 등록한 이메일로 인증코드를 보내드립니다.</p>
        <div class="field"><label for="find-id-email">이메일</label><input id="find-id-email" type="email" placeholder="example@email.com"></div>
        <div class="confirm-actions"><button class="btn btn-ghost btn-sm" onclick="closeFindIdModal()">취소</button><button class="btn btn-primary btn-sm" onclick="submitFindId()">인증코드 받기</button></div>
      `}
    </div>
  </div>`;
}
function openFindPwModal(){ state.findPwModal={open:true, done:false}; render(); }
function closeFindPwModal(){ state.findPwModal.open=false; render(); }
// [백엔드 연동 필요 구간] submitFindPw() — 회원아이디+이메일로 본인 확인 > Java 계정 API > DB 연결 >
// SQL SELECT로 일치 여부 확인 후 임시 비밀번호 발급·이메일 발송이 필요하다. 여기서는 목업 처리.
function submitFindPw(){
  const id=document.getElementById('find-pw-id').value.trim();
  const email=document.getElementById('find-pw-email').value.trim();
  if(!id || !email){ toast('아이디와 이메일을 모두 입력해주세요'); return; }
  state.findPwModal.done = true;
  render();
}
function renderFindPwModal(){
  const m=state.findPwModal;
  return `
  <div class="confirm-backdrop" onclick="if(event.target===this)closeFindPwModal()">
    <div class="confirm-box" style="max-width:380px;">
      <h3>비밀번호 찾기</h3>
      ${m.done ? `
        <p style="color:var(--ink-dim);font-size:13px;line-height:1.6;margin:0 0 18px;">입력하신 이메일로 임시 비밀번호를 보내드렸습니다.</p>
        <div class="confirm-actions"><button class="btn btn-primary btn-sm" onclick="closeFindPwModal()">확인</button></div>
      ` : `
        <p class="hint" style="margin:0 0 14px;">회원아이디와 가입 시 등록한 이메일을 입력해주세요.</p>
        <div class="field"><label for="find-pw-id">회원아이디</label><input id="find-pw-id" placeholder="아이디"></div>
        <div class="field"><label for="find-pw-email">이메일</label><input id="find-pw-email" type="email" placeholder="example@email.com"></div>
        <div class="confirm-actions"><button class="btn btn-ghost btn-sm" onclick="closeFindPwModal()">취소</button><button class="btn btn-primary btn-sm" onclick="submitFindPw()">임시 비밀번호 받기</button></div>
      `}
    </div>
  </div>`;
}

