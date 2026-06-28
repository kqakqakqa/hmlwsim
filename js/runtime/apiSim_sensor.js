/**
 * API Sim: system.sensor
 * Application-facing API for sensor subscriptions.
 * Delegates to DeviceFeatureSensor.
 */
const ApiSimSensor = (() => {
  function subscribe(callbacks) {
    const type = callbacks.type || 'default';
    DeviceFeatureSensor.subscribe(type, callbacks.callback || (() => {}));
    if (callbacks.success) callbacks.success();
    if (callbacks.complete) callbacks.complete();
  }

  function unsubscribe(callbacks) {
    const type = callbacks.type || 'default';
    DeviceFeatureSensor.unsubscribe(type);
    if (callbacks.success) callbacks.success();
    if (callbacks.complete) callbacks.complete();
  }

  return { subscribe, unsubscribe };
})();
