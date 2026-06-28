/**
 * API Registry - Maps requireNative module names to apiSim instances.
 * Central lookup for the Sandbox to inject application-facing APIs.
 */
const ApiRegistry = (() => {
  const _map = {
    'system.router':     ApiSimRouter,
    'system.battery':    ApiSimBattery,
    'system.device':     ApiSimDevice,
    'system.file':       ApiSimFile,
    'system.storage':    ApiSimStorage,
    'system.brightness': ApiSimBrightness,
    'system.vibrator':   ApiSimVibrator,
    'system.sensor':     ApiSimSensor,
    'system.fetch':      ApiSimFetch,
    'system.wearengine': ApiSimWearengine,
    'system.app':        ApiSimApp,
  };

  /**
   * Resolve a module name to its apiSim instance
   * @param {string} moduleName - e.g. 'system.router'
   * @returns {Object} The apiSim instance, or empty object if not found
   */
  function resolve(moduleName) {
    return _map[moduleName] || {};
  }

  /**
   * Get the full mapping (for Sandbox createContext)
   */
  function getAll() {
    return _map;
  }

  return { resolve, getAll };
})();
