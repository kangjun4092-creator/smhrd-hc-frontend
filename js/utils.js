// utils.js — 여러 화면이 공통으로 쓰는 유틸(토스트, 확인모달, 아바타 색상/스프라이트 로딩, 등급 색상, 해시).

const AVATAR_COLORS = ['#1B3A6B','#E8532B','#C98A00','#3E8FCF','#7A5CC9','#2AA9C9'];
function avatarColor(i){return AVATAR_COLORS[i % AVATAR_COLORS.length];}
function avatarInitial(name){return (name||'홈').trim().charAt(0) || 'H';}

// 프로필 캐릭터 픽셀아트 스프라이트. PNG 자체가 이미 검정 배경을 투명 처리해둔 컷아웃
// 이미지라, 배경 아이템(equip.background)을 씌워도 캐릭터 뒤로 비쳐 보인다.
// (주의) 원본 PNG는 검정 배경에 합성된 상태였는데, 그걸 브라우저에서 getImageData로 읽어
// 알파를 지우는 방식은 file:// 로 열었을 때 "canvas has been tainted by cross-origin data"
// 보안 오류로 막혀서 동작하지 않았다. 그래서 투명화는 스크립트 실행 전에 미리 처리해
// assets/avatar-*.png 자체를 투명 PNG로 만들어두고, 여기서는 단순히 그리기만 한다.
const CHAR_SPRITES = {male:null, female:null};
function loadCharSprite(gender, src){
  const img=new Image();
  img.onload=()=>{
    CHAR_SPRITES[gender]=img;
    drawAvatarCanvas(); drawTopbarAvatar(); drawPodiumChars();
  };
  img.src=src;
}
loadCharSprite('male','assets/avatar-male.png');
loadCharSprite('female','assets/avatar-female.png');

/* ========================================================================
   유틸
   ======================================================================== */
function toast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg;
  t.classList.add('show');
  clearTimeout(toast._tid);
  toast._tid=setTimeout(()=>t.classList.remove('show'),2200);
}
function askConfirm(title,desc,onYes,yesLabel='확인',danger=false){
  state.confirm={title,desc,onYes,yesLabel,danger};
  render();
}
function closeConfirm(){state.confirm=null;render();}

function gradeColor(g){
  if(g==='PERFECT') return 'var(--accent)';
  if(g==='GREAT') return 'var(--gold)';
  if(g==='GOOD') return '#4A7CFF';
  return 'var(--danger)';
}
function gradePill(g){
  const cls = g==='PERFECT'?'pill-accent':g==='GREAT'?'pill-gold':g==='GOOD'?'pill-muted':'pill-danger';
  return `<span class="pill ${cls}">${g}</span>`;
}

/* ========================================================================
   렌더 엔진 : 화면 라우팅
   ======================================================================== */
function hashStr(s){
  let h=2166136261;
  for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); }
  return h>>>0;
}
