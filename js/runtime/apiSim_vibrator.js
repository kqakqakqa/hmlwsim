/**
 * API Sim: system.vibrator
 * Application-facing API for vibration.
 * Delegates to DeviceFeatureVibrator.
 */
const ApiSimVibrator = (() => {
  function start(callbacks) {
    DeviceFeatureVibrator.vibrate();
    callbacks.success && callbacks.success();
    callbacks.complete && callbacks.complete();
  }

  function stop() {
    DeviceFeatureVibrator.stop();
  }

  return { start, stop };
})();
