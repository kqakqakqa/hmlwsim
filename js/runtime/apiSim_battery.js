/**
 * API Sim: system.battery
 * Application-facing API for battery status.
 * Delegates to DeviceFeatureBattery.
 */
const ApiSimBattery = (() => {
  function getStatus(callbacks) {
    if (!callbacks) return;
    var status = DeviceFeatureBattery.getStatus();
    if (typeof callbacks.success === 'function') callbacks.success(status);
    if (typeof callbacks.complete === 'function') callbacks.complete(status);
  }

  return { getStatus };
})();
