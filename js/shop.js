// shop.js — '포인트 상점' 카테고리: 아이템 목록/구매/미리보기.

function renderShop(){
  return `
  <div class="view-head"><h1>포인트 상점</h1></div>
  ${renderMissionShop()}`;
}
const SHOP_CATEGORIES=['전체','의상','배경','기타'];
// '의상'/'배경' 아이템만 캐릭터 외형에 실제로 반영되는 슬롯이라 '착용해보기' 미리보기를 지원한다
// (닉네임 컬러 이펙트 같은 '기타' 아이템은 캐릭터 그림에 영향이 없어 미리볼 게 없다).
function renderMissionShop(){
  const f=state.shopFilter||'전체';
  const items=state.shopItems.map((it,idx)=>({it,idx})).filter(({it})=>f==='전체'||it.category===f);
  return `
  <p class="hint" style="margin-bottom:14px;">아이템마다 적용되는 능력치가 다릅니다. 구매 전 효과를 확인하세요.</p>
  <div class="subtabs">
    ${SHOP_CATEGORIES.map(c=>`<div class="tab ${f===c?'active':''}" onclick="setShopFilter('${c}')">${c}</div>`).join('')}
  </div>
  <div class="grid grid-3">
    ${items.map(({it,idx})=>`
      <div class="card">
        <div class="feed-media" style="height:88px;">${it.name}</div>
        <div class="flex-between" style="margin-top:10px;">
          <h3 style="margin:0;">${it.name}</h3>
        </div>
        <span class="pill ${it.effect.startsWith('능력치 없음')?'pill-muted':'pill-accent'}" style="margin-top:8px;">효과 · ${it.effect}</span>
        ${it.consumable?`<p class="desc" style="margin-top:4px;color:var(--accent);">보유 수량: ${it.name==='닉네임 변경권'?(state.user.nicknameTickets||0):state.user.retakeTickets}장</p>`:''}
        <p class="desc" style="margin-top:8px;">${it.effectDesc}</p>
        <div class="flex-between" style="margin-top:6px;gap:8px;">
          <span class="shop-price">P ${it.price}</span>
          <div style="display:flex;gap:6px;">
            ${(it.category==='의상'||it.category==='배경')?`<button class="btn btn-sm btn-secondary" onclick="${state.guestMode ? "goto('login')" : `openItemPreview(${idx})`}">착용해보기</button>`:''}
            <button class="btn btn-sm ${(it.owned && !it.consumable)?'btn-ghost':'btn-primary'}" ${(it.owned && !it.consumable)?'disabled style="opacity:.5;"':''} onclick="${state.guestMode ? "goto('login')" : `buyItem(${idx})`}">${(it.owned && !it.consumable)?'보유중':'구매하기'}</button>
          </div>
        </div>
      </div>`).join('')}
  </div>`;
}
function setShopFilter(c){ state.shopFilter=c; render(); }
function openItemPreview(idx){ state.itemPreview={open:true, idx}; render(); }
function closeItemPreview(){ state.itemPreview={open:false, idx:null}; render(); }
function renderItemPreviewModal(){
  const it=state.shopItems[state.itemPreview.idx];
  return `
  <div class="confirm-backdrop" onclick="if(event.target===this) closeItemPreview()">
    <div class="confirm-box" style="text-align:center;">
      <h3>${it.name} 착용 예시</h3>
      <canvas id="item-preview-canvas" style="width:144px;height:176px;margin:10px auto;display:block;border-radius:10px;image-rendering:pixelated;"></canvas>
      <p class="desc">${it.effectDesc}</p>
      <div class="confirm-actions" style="justify-content:center;">
        <button class="btn btn-secondary" onclick="closeItemPreview()">닫기</button>
      </div>
    </div>
  </div>`;
}
function drawItemPreviewCanvas(){
  const canvas=document.getElementById('item-preview-canvas');
  const it=state.shopItems[state.itemPreview.idx];
  if(!canvas || !it) return;
  drawPixelCharacter(canvas, {...getEquipState(), [it.slot]:true}, state.user.gender);
}
function buyItem(idx){
  const it=state.shopItems[idx];
  if(it.owned && !it.consumable){toast('이미 보유한 아이템입니다'); return;}
  if(state.user.points<it.price){toast('포인트가 부족합니다'); return;}
  state.user.points -= it.price;
  if(it.consumable){
    if(it.name==='닉네임 변경권'){
      state.user.nicknameTickets = (state.user.nicknameTickets||0) + 1;
      toast(`${it.name} 구매 완료 (보유 ${state.user.nicknameTickets}장)`);
    } else if(it.name==='세트 추가권'){
      state.user.extraSets = (state.user.extraSets||0) + 3;
      toast(`${it.name} 구매 완료 (오늘 가능한 운동세트 +3)`);
    } else {
      state.user.retakeTickets = (state.user.retakeTickets||0) + 1;
      toast(`${it.name} 구매 완료 (보유 ${state.user.retakeTickets}장)`);
    }
  } else {
    it.owned=true;
    toast(`${it.name} 구매 완료`);
  }
  render();
}

/* ========================================================================
   3. 홈크루
   ======================================================================== */
// (FR-CR-001~005) 크루 생성/가입/배분/강퇴/공지/가입승인은 모두 아래 파이프라인이 필요한 구간입니다.
//   크루 생성(createCrew) / 가입(joinCrew) > Java 크루 API > DB 연결 > SQL INSERT(크루 테이블, 크루원 테이블)
//   단체 미션 배분(setCrewMissionEx 등) > Java 크루 API > DB 연결 > SQL UPDATE(미션 배분 테이블)
//   가입 요청 승인(approveJoinRequest) > Java 크루 API > DB 연결 > SQL INSERT(크루원) + DELETE(가입요청)
//   크루원 강퇴(kickMember) > Java 크루 API > DB 연결 > SQL DELETE(크루원 테이블)
//   크루공지 작성(postCrewNotice, 팀장 전용) > Java 크루 API(권한 확인) > DB 연결 > SQL INSERT(공지 테이블)
//   크루채팅 전송(sendCrewChat) > WebSocket(크루 ID 채널 브로드캐스트) > DB 연결 > SQL INSERT(채팅 메시지)
//   크루대전 파티 초대/수락(sendPartyInvites~acceptPartyInvite) > WebSocket(대상 사용자 알림) > DB 연결 > SQL INSERT/UPDATE(파티초대)
