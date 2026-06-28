/**
 * Device Feature: Sensor
 * Simulates device sensors (heart rate, step count, accelerometer, etc.)
 * Initially a stub — extend with UI panel controls as needed.
 */
const DeviceFeatureSensor = (() => {
  // type → { value, subscribers: Set<Function> }
  const _sensors = new Map();

  /**
   * Subscribe to a sensor data stream
   * @param {string} type - Sensor type (e.g. 'heartRate', 'stepCount')
   * @param {Function} callback - Called with new value when sensor updates
   */
  function subscribe(type, callback) {
    if (!_sensors.has(type)) {
      _sensors.set(type, { value: null, subscribers: new Set() });
    }
    _sensors.get(type).subscribers.add(callback);
  }

  /**
   * Unsubscribe from a sensor data stream
   */
  function unsubscribe(type) {
    _sensors.delete(type);
  }

  /**
   * Update sensor value (called from UI panel)
   */
  function updateSensor(type, value) {
    if (!_sensors.has(type)) {
      _sensors.set(type, { value, subscribers: new Set() });
    }
    const sensor = _sensors.get(type);
    sensor.value = value;
    sensor.subscribers.forEach(cb => {
      try { cb(value); } catch (e) { console.error('[Sensor] callback error:', e); }
    });
  }

  /**
   * Get current sensor value
   */
  function getSensorValue(type) {
    const sensor = _sensors.get(type);
    return sensor ? sensor.value : null;
  }

  return { subscribe, unsubscribe, updateSensor, getSensorValue };
})();
