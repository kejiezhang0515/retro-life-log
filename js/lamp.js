// 彩蛋:檯燈 toggle。每次重新載入預設關燈,不使用 localStorage。
(function () {
  const b = document.getElementById('hs-lamp');
  const glow = document.getElementById('lamp-glow');
  let on = false;
  function apply() { glow.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }
  apply();
  b.addEventListener('click', () => { on = !on; apply(); });
})();
