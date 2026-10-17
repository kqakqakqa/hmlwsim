/**
 * Device Feature: Sensor
 * Simulates device sensors (heart rate, step count, accelerometer, etc.)
 * Initially a stub — extend with UI panel controls as needed.
 */
const DeviceFeatureSensor = (() => {
  const defaults = {
    accelerometer: { x: 0, y: 0, z: 0 },
    gyroscope: { x: 0, y: 0, z: 0 },
    compass: { x: 0, y: 0, z: 0 },
    stepCounter: { steps: 0 },
    barometer: { pressure: 0 },
    heartRate: { heartRate: 255 },
    onBodyState: { value: false },
  };
  const _sensors = new Map();
  const _settings = {
    accelerometer: true,
    gyroscope: true,
    compass: true,
    stepCounter: false,
    barometer: false,
    heartRate: false,
    onBodyState: false,
  };
  let _motionHandler = null;
  let _magnetometer = null;
  let _pressureSensor = null;

  function clone(value) {
    return Object.assign({}, value);
  }

  function ensure(type) {
    if (!_sensors.has(type)) {
      _sensors.set(type, { value: clone(defaults[type] || {}), subscribers: new Set() });
    }
    return _sensors.get(type);
  }

  function subscribe(type, callback) {
    const sensor = ensure(type);
    if (typeof callback !== 'function') return;
    sensor.subscribers.add(callback);
    callback(clone(sensor.value));
    startBrowserSensors();
  }

  function unsubscribe(type) {
    const sensor = _sensors.get(type);
    if (sensor) sensor.subscribers.clear();
    stopBrowserSensorsIfUnused();
  }

  function updateSensor(type, value) {
    const sensor = ensure(type);
    sensor.value = clone(value);
    sensor.subscribers.forEach(cb => {
      try { cb(clone(sensor.value)); } catch (e) { console.error('[Sensor] callback error:', e); }
    });
  }

  function getSensorValue(type) {
    return clone(ensure(type).value);
  }

  function setMode(type, useRealValue) {
    _settings[type] = !!useRealValue;
    if (!_settings[type] && defaults[type]) updateSensor(type, defaults[type]);
    stopBrowserSensorsIfUnused();
    startBrowserSensors();
  }

  function setValue(type, value) {
    _settings[type] = false;
    updateSensor(type, value);
  }

  function isModeEnabled(type) {
    return !!_settings[type];
  }

  function hasSubscribers(type) {
    const sensor = _sensors.get(type);
    return !!sensor && sensor.subscribers.size > 0;
  }

  function startBrowserSensors() {
    const needsMotion = (_settings.accelerometer || _settings.gyroscope) &&
      (hasSubscribers('accelerometer') || hasSubscribers('gyroscope'));
    const needsMagnetometer = _settings.compass && hasSubscribers('compass');
    const needsPressure = _settings.barometer && hasSubscribers('barometer');

    if (needsMotion && !_motionHandler && 'DeviceMotionEvent' in window) {
      _motionHandler = event => {
        if (_settings.accelerometer && event.acceleration) {
          updateSensor('accelerometer', {
            x: Number(event.acceleration.x) || 0,
            y: Number(event.acceleration.y) || 0,
            z: Number(event.acceleration.z) || 0,
          });
        }
        if (_settings.gyroscope && event.rotationRate) {
          updateSensor('gyroscope', {
            x: Number(event.rotationRate.alpha) || 0,
            y: Number(event.rotationRate.beta) || 0,
            z: Number(event.rotationRate.gamma) || 0,
          });
        }
      };
      window.addEventListener('devicemotion', _motionHandler);
    }
    if (needsMagnetometer && !_magnetometer && 'Magnetometer' in window) {
      try {
        _magnetometer = new Magnetometer({ frequency: 5 });
        _magnetometer.addEventListener('reading', () => updateSensor('compass', {
          x: Number(_magnetometer.x) || 0,
          y: Number(_magnetometer.y) || 0,
          z: Number(_magnetometer.z) || 0,
        }));
        _magnetometer.start();
      } catch (e) {
        updateSensor('compass', defaults.compass);
        console.warn('[Sensor] Magnetometer unavailable:', e.message);
        _magnetometer = null;
      }
    }
    if (needsPressure && !_pressureSensor && 'PressureSensor' in window) {
      try {
        _pressureSensor = new PressureSensor({ frequency: 1 });
        _pressureSensor.addEventListener('reading', () => updateSensor('barometer', {
          pressure: Number(_pressureSensor.pressure) || 0,
        }));
        _pressureSensor.start();
      } catch (e) {
        updateSensor('barometer', defaults.barometer);
        console.warn('[Sensor] PressureSensor unavailable:', e.message);
        _pressureSensor = null;
      }
    }
  }

  function stopBrowserSensorsIfUnused() {
    if ((!hasSubscribers('accelerometer') || !_settings.accelerometer) &&
      (!hasSubscribers('gyroscope') || !_settings.gyroscope) && _motionHandler) {
      window.removeEventListener('devicemotion', _motionHandler);
      _motionHandler = null;
    }
    if ((!hasSubscribers('compass') || !_settings.compass) && _magnetometer) {
      _magnetometer.stop();
      _magnetometer = null;
    }
    if ((!hasSubscribers('barometer') || !_settings.barometer) && _pressureSensor) {
      _pressureSensor.stop();
      _pressureSensor = null;
    }
  }

  return { subscribe, unsubscribe, updateSensor, getSensorValue, setMode, setValue, isModeEnabled };
})();
