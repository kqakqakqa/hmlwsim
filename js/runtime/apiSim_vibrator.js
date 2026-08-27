/**
 * API Sim: system.vibrator
 * Application-facing API for vibration.
 * Delegates to DeviceFeatureVibrator.
 */
const ApiSimVibrator = (() => {
  function start(callbacks) {
    DeviceFeatureVibrator.vibrate();
    if (callbacks && typeof callbacks.success === 'function') callbacks.success();
    if (callbacks && typeof callbacks.complete === 'function') callbacks.complete();
  }

  function stop() {
    DeviceFeatureVibrator.stop();
  }

  return { start, stop };
})();
