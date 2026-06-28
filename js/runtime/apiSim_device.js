/**
 * API Sim: system.device
 * Application-facing API for device information.
 * Delegates to DeviceFeatureDisplay.
 */
const ApiSimDevice = (() => {
  function getInfo(callbacks) {
    const info = DeviceFeatureDisplay.getDeviceInfo();
    callbacks.success && callbacks.success({ ...info });
    callbacks.complete && callbacks.complete();
  }

  return { getInfo };
})();
