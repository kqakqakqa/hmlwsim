/**
 * API Sim: system.battery
 * Application-facing API for battery status.
 * Delegates to DeviceFeatureBattery.
 */
const ApiSimBattery = (() => {
  function getStatus(callbacks) {
    const status = DeviceFeatureBattery.getStatus();
    callbacks.success && callbacks.success(status);
    callbacks.complete && callbacks.complete();
  }

  return { getStatus };
})();
