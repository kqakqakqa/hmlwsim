/**
 * API Sim: system.brightness
 * Application-facing API for brightness control.
 * Delegates to DeviceFeatureDisplay.
 */
const ApiSimBrightness = (() => {
  function getMode(callbacks) {
    if (!callbacks) return;
    var mode = DeviceFeatureDisplay.getBrightnessMode();
    if (typeof callbacks.success === 'function') callbacks.success({ mode: mode });
    if (typeof callbacks.complete === 'function') callbacks.complete();
  }

  function setMode(callbacks) {
    if (callbacks && callbacks.mode !== undefined) {
      DeviceFeatureDisplay.setBrightnessMode(callbacks.mode);
    }
    if (callbacks && typeof callbacks.success === 'function') callbacks.success();
    if (callbacks && typeof callbacks.complete === 'function') callbacks.complete();
  }

  function setKeepScreenOn(callbacks) {
    // Stub - no-op in simulator
    if (callbacks && typeof callbacks.success === 'function') callbacks.success();
    if (callbacks && typeof callbacks.complete === 'function') callbacks.complete();
  }

  return { getMode, setMode, setKeepScreenOn };
})();
