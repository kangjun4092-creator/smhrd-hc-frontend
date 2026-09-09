document.addEventListener('click', e => {
  if (e.target && e.target.id === 'confirm-yes' && state.confirm) { state.confirm.onYes(); }
});

(async function initApp() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const providerState = params.get('state');
  if (code) {
    window.history.replaceState({}, '', window.location.pathname);
    if (providerState === 'google') await handleGoogleRedirect(code);
    else await handleKakaoRedirect(code);
  } else {
    // 새로고침하면 랜딩페이지로 돌아가던 문제 — state가 메모리에만 있어서 새로고침할 때마다
    // 초기값(screen:'intro')부터 다시 시작했던 것. 저장된 토큰이 있으면 그걸로 로그인 상태와
    // 마지막으로 보던 메뉴를 복원한다.
    const savedToken = loadSessionToken();
    if (savedToken) {
      state.token = savedToken;
      await loadMyProfile();
      await loadExerciseHistory();
      await loadMyCrew();
      if (state.user.id) { // loadMyProfile()은 토큰이 만료/무효해도 던지지 않고 조용히 실패한다
        state.guestMode = false;
        state.screen = 'app';
        state.menu = loadSessionMenu() || 'main';
      } else {
        clearSession(); // 만료된 토큰이면 지우고 랜딩페이지로 보낸다
      }
    }
  }
  render();
})();
