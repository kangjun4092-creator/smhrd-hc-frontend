// bootstrap.js — 전역 클릭 리스너 등록 + render() 최초 호출. 반드시 모든 스크립트 중 가장 마지막에 로드되어야 합니다.

document.addEventListener('click', e=>{
  if(e.target && e.target.id==='confirm-yes' && state.confirm){ state.confirm.onYes(); }
});

render();
