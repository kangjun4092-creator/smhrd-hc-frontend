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
  }
  render();
})();
