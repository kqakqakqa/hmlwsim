/**
 * Touch Simulator - Touch/click event forwarding
 */
const TouchSim = (() => {
  let _enabled = false;

  function init() {
    const watchContent = document.getElementById('watch-content');
    if (!watchContent) return;

    const root = watchContent.shadowRoot || watchContent;

    root.addEventListener('click', (e) => {
      if (!_enabled) return;
      const target = e.target;
      if (target && target !== root) {
        target.style.transition = 'background-color 0.1s';
        const origBg = target.style.backgroundColor;
        target.style.backgroundColor = 'rgba(255,255,255,0.1)';
        setTimeout(() => {
          target.style.backgroundColor = origBg || '';
        }, 100);
      }
    });
  }

  function enable() { _enabled = true; }
  function disable() { _enabled = false; }

  return { init, enable, disable };
})();
