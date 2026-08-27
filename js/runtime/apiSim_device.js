/**
 * API Sim: system.device
 * Application-facing API for device information.
 * Delegates to DeviceFeatureDisplay.
 */
const ApiSimDevice = (() => {
  function getInfo(callbacks) {
    if (!callbacks) return;
    var info = DeviceFeatureDisplay.getDeviceInfo();
    if (typeof callbacks.success === 'function') callbacks.success(Object.assign({}, info));
    if (typeof callbacks.complete === 'function') callbacks.complete();
  }

  return { getInfo };
})();
