/**
 * Device Feature: Touch
 * Simulates touch/click event forwarding + swipe gesture detection.
 * No corresponding apiSim — pure input device feature, events dispatched via CustomEvent.
 */
const DeviceFeatureTouch = (() => {
  let _enabled = false;

  let _gesture = null;
  let _suppressClick = false;
  let _watchContent = null;

  const LONG_PRESS_DELAY = 500;
  const MOVE_THRESHOLD = 10;
  const SWIPE_THRESHOLD = 60;

  // 点击、长按和 touch 均使用手表屏幕坐标，而不是浏览器窗口坐标。
  function coordinates(e, target) {
    const screen = _watchContent.getBoundingClientRect();
    const bounds = target.getBoundingClientRect();
    const device = DeviceFeatureDisplay.getDeviceInfo();
    const scaleX = device.windowWidth / screen.width;
    const scaleY = device.windowHeight / screen.height;
    return {
      globalX: (e.clientX - screen.left) * scaleX,
      globalY: (e.clientY - screen.top) * scaleY,
      localX: (e.clientX - bounds.left) * scaleX,
      localY: (e.clientY - bounds.top) * scaleY,
    };
  }

  function emit(type, gesture, extra = {}) {
    if (!gesture.target.isConnected) return;
    const event = new CustomEvent(type, { bubbles: true, cancelable: true });
    Object.assign(event, coordinates(gesture.last, gesture.target), extra);
    gesture.target.dispatchEvent(event);
  }

  function cancel() {
    const gesture = _gesture;
    if (!gesture) return;
    _gesture = null;
    _suppressClick = true;
    clearTimeout(gesture.timer);
    if (gesture.touchStarted) emit('touchcancel', gesture);
    if (gesture.longPressed && !gesture.longPressReleased) emit('longpressrelease', gesture);
  }

  function update(gesture, e) {
    gesture.last = { clientX: e.clientX, clientY: e.clientY };
    const point = coordinates(e, gesture.target);
    if (Math.hypot(point.globalX - gesture.start.globalX, point.globalY - gesture.start.globalY) > MOVE_THRESHOLD) {
      gesture.moved = true;
      clearTimeout(gesture.timer);
      // 仅确认拖动后补发 touchstart，静止点击和长按不启动 touch 生命周期。
      if (!gesture.touchStarted) {
        gesture.touchStarted = true;
        // 长按转为拖动时立即释放长按，松手时不再重复释放。
        if (gesture.longPressed) {
          gesture.longPressReleased = true;
          emit('longpressrelease', gesture);
        }
        emit('touchstart', gesture);
      }
    }
  }
  const TAN_15 = Math.tan(15 * Math.PI / 180);

  function init() {
    const watchContent = document.getElementById('watch-content');
    if (!watchContent) return;

    _watchContent = watchContent;
    const root = watchContent.shadowRoot || watchContent;
    watchContent.style.touchAction = 'none';

    root.addEventListener('pointerdown', (e) => {
      if (!_enabled || _gesture || !e.isPrimary || e.button !== 0) return;
      _suppressClick = false;
      const gesture = {
        target: e.target,
        pointerId: e.pointerId,
        start: coordinates(e, e.target),
        last: { clientX: e.clientX, clientY: e.clientY },
        moved: false,
        touchStarted: false,
        longPressed: false,
      };
      _gesture = gesture;
      gesture.timer = setTimeout(() => {
        if (_gesture !== gesture || !gesture.target.isConnected) return;
        gesture.longPressed = true;
        emit('longpress', gesture);
      }, LONG_PRESS_DELAY);
    }, { capture: true, passive: true });

    window.addEventListener('pointermove', (e) => {
      const gesture = _gesture;
      if (!gesture || e.pointerId !== gesture.pointerId) return;
      if (!gesture.target.isConnected) { cancel(); return; }
      update(gesture, e);
      if (gesture.touchStarted) emit('touchmove', gesture);
    }, { capture: true, passive: true });

    window.addEventListener('pointerup', (e) => {
      const gesture = _gesture;
      if (!gesture || e.pointerId !== gesture.pointerId) return;
      update(gesture, e);
      _gesture = null;
      clearTimeout(gesture.timer);
      _suppressClick = gesture.moved || gesture.longPressed;
      if (gesture.touchStarted) emit('touchend', gesture);
      if (gesture.longPressed && !gesture.longPressReleased) emit('longpressrelease', gesture);

      const point = coordinates(e, gesture.target);
      const dx = point.globalX - gesture.start.globalX;
      const dy = point.globalY - gesture.start.globalY;
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

      emit('swipe', gesture, { direction, distance: dominant, dx, dy });
    }, { capture: true, passive: true });

    window.addEventListener('pointercancel', (e) => {
      if (!_gesture || e.pointerId !== _gesture.pointerId) return;
      update(_gesture, e);
      cancel();
    }, { capture: true, passive: true });
    window.addEventListener('blur', cancel);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancel();
    });

    // 保留原生控件点击，但拖动或长按后不能再误触发 click。
    root.addEventListener('click', (e) => {
      if (!_enabled || (_suppressClick && e.detail > 0)) {
        _suppressClick = false;
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      Object.assign(e, coordinates(e, e.target));
    }, true);
    root.addEventListener('dblclick', (e) => {
      if (!_enabled || _suppressClick) return;
      emit('doubleclick', {
        target: e.target,
        last: { clientX: e.clientX, clientY: e.clientY },
      });
    }, true);
    root.addEventListener('contextmenu', (e) => e.preventDefault());
    root.addEventListener('dragstart', (e) => e.preventDefault());
    root.addEventListener('touchstart', (e) => {
      if (e.isTrusted) e.stopImmediatePropagation();
    }, true);
    root.addEventListener('touchmove', (e) => {
      if (e.isTrusted) e.stopImmediatePropagation();
    }, true);
    root.addEventListener('touchend', (e) => {
      if (e.isTrusted) e.stopImmediatePropagation();
    }, true);
    root.addEventListener('touchcancel', (e) => {
      if (e.isTrusted) e.stopImmediatePropagation();
    }, true);
  }

  function enable() { _enabled = true; }
  function disable() {
    _enabled = false;
    _suppressClick = true;
    if (_gesture) clearTimeout(_gesture.timer);
    _gesture = null;
  }

  return { init, enable, disable };
})();
