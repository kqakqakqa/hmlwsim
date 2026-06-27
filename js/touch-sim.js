/**
 * Touch Simulator - Touch/click event forwarding + swipe gesture detection
 */
const TouchSim = (() => {
  let _enabled = false;

  let _startX = 0;
  let _startY = 0;
  let _startTarget = null;
  let _tracking = false;

  const SWIPE_THRESHOLD = 60;
  const TAN_15 = Math.tan(15 * Math.PI / 180);

  function init() {
    const watchContent = document.getElementById('watch-content');
    if (!watchContent) return;

    const root = watchContent.shadowRoot || watchContent;

    root.addEventListener('pointerdown', (e) => {
      _tracking = true;
      _startX = e.clientX;
      _startY = e.clientY;
      _startTarget = e.target;
    }, { passive: true });

    root.addEventListener('pointerup', (e) => {
      if (!_tracking) return;
      _tracking = false;

      const dx = e.clientX - _startX;
      const dy = e.clientY - _startY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      const dominant = Math.max(absDx, absDy);

      if (dominant < SWIPE_THRESHOLD) return;

      let isSwipe = false;
      if (absDx >= absDy) {
        isSwipe = absDy / absDx < TAN_15;
      } else {
        isSwipe = absDx / absDy < TAN_15;
      }

      if (!isSwipe) return;

      const direction = absDx >= absDy
        ? (dx > 0 ? 'right' : 'left')
        : (dy > 0 ? 'down' : 'up');

      const swipeEvent = new CustomEvent('swipe', {
        bubbles: true,
        cancelable: true
      });
      swipeEvent.direction = direction;
      swipeEvent.distance = dominant;
      swipeEvent.dx = dx;
      swipeEvent.dy = dy;
      _startTarget.dispatchEvent(swipeEvent);
    }, { passive: true });

    root.addEventListener('pointercancel', () => {
      _tracking = false;
    }, { passive: true });
  }

  function enable() { _enabled = true; }
  function disable() { _enabled = false; }

  return { init, enable, disable };
})();
