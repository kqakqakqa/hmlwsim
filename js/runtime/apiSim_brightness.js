/**
 * API Sim: system.brightness
 * Application-facing API for brightness control.
 * Delegates to DeviceFeatureDisplay.
 */
const ApiSimBrightness = (() => {
  function getMode(callbacks) {
    const mode = DeviceFeatureDisplay.getBrightnessMode();
    callbacks.success && callbacks.success({ mode: mode });
    callbacks.complete && callbacks.complete();
  }

  function setMode(callbacks) {
    if (callbacks && callbacks.mode !== undefined) {
      DeviceFeatureDisplay.setBrightnessMode(callbacks.mode);
    }
    callbacks.success && callbacks.success();
    callbacks.complete && callbacks.complete();
  }

  function setKeepScreenOn(callbacks) {
    // Stub - no-op in simulator
    if (callbacks && callbacks.success) callbacks.success();
    if (callbacks && callbacks.complete) callbacks.complete();
  }

  return { getMode, setMode, setKeepScreenOn };
})();
