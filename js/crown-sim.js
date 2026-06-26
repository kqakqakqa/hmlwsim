/**
 * Crown Simulator - Mouse wheel / drag → rotation events
 */
const CrownSim = (() => {
  let _enabled = false;
  let _sensitivity = 1;
  let _inverted = false;
  let _onRotate = null;
  let _crown = null;
  let _offset = 0;

  const _events = [];
  const _window = 250;

  function _recordEvent(delta) {
    const now = performance.now();
    _events.push({ t: now, d: delta });
    while (_events.length && _events[0].t < now - _window) _events.shift();
  }

  function _getVelocity() {
    if (_events.length === 0) return 0;
    const now = performance.now();
    const last = _events[_events.length - 1];
    const lastDir = Math.sign(last.d);
    if (lastDir === 0) return 0;
    let first = last;
    for (let i = _events.length - 2; i >= 0; i--) {
      if (Math.sign(_events[i].d) !== lastDir) break;
      first = _events[i];
    }
    const span = now - first.t;
    if (span === 0) return 0;
    let net = 0;
    for (let i = _events.length - 1; i >= 0; i--) {
      if (_events[i].t < first.t) break;
      net += _events[i].d;
    }
    return net / (span / 1000);
  }

  function _renderOffset() {
    if (!_crown) return;
    _crown.style.transform = `translateY(calc(-50% + ${_offset}px))`;
  }

  function _emit(delta) {
    if (_enabled && _onRotate) _onRotate(delta * _sensitivity);
    _recordEvent(delta);
  }

  function _update() {
    const now = performance.now();
    while (_events.length && _events[0].t < now - _window) _events.shift();
    const v = _getVelocity();
    _offset = Math.sign(v) * Math.log1p(Math.abs(v)) * 5;
    _renderOffset();
    requestAnimationFrame(_update);
  }

  function init() {
    const watchFrame = document.getElementById('watch-frame');
    if (!watchFrame) return;

    watchFrame.addEventListener('wheel', (e) => {
      if (!_enabled) return;
      e.preventDefault();
      let delta = e.deltaY > 0 ? 1 : -1;
      if (_inverted) delta = -delta;
      _emit(delta);
    }, { passive: false });

    _crown = document.getElementById('crown');
    if (_crown) {
      let dragging = false;
      let lastY = 0;

      _crown.addEventListener('mousedown', (e) => {
        dragging = true;
        lastY = e.clientY;
        _crown.classList.add('pressed');
        e.preventDefault();
      });

      document.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const dy = lastY - e.clientY;
        if (Math.abs(dy) > 3) {
          const delta = dy < 0 ? 1 : -1;
          _emit(delta);
          lastY = e.clientY;
        }
      });

      document.addEventListener('mouseup', () => {
        if (!dragging) return;
        dragging = false;
        _crown.classList.remove('pressed');
      });
    }

    requestAnimationFrame(_update);
  }

  function enable() { _enabled = true; }
  function disable() { _enabled = false; }
  function setSensitivity(val) { _sensitivity = val; }
  function setInverted(val) { _inverted = val; }

  function onRotate(handler) {
    _onRotate = handler;
  }

  return { init, enable, disable, setSensitivity, setInverted, onRotate };
})();
