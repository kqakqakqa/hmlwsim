/**
 * API Sim: system.app
 * Application-facing API for app lifecycle.
 * Delegates to DeviceFeatureAppLifecycle.
 */
const ApiSimApp = (() => {
  function getInfo() {
    return DeviceFeatureAppLifecycle.getAppInfo();
  }

  function terminate() {
    DeviceFeatureAppLifecycle.terminate();
  }

  return { getInfo, terminate };
})();
