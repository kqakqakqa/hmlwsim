/**
 * Sensor Panel - UI controls for simulating device sensors
 */
const SensorPanel = (() => {
  let _batterySlider = null;
  let _batteryValue = null;
  let _useSystemBattery = null;
  let _shapeSelect = null;
  let _widthInput = null;
  let _heightInput = null;
  let _onConfigChange = null;
  let _systemBatteryInterval = null;
  let _sensorHeartRateSlider = null;
  let _sensorHeartRateValue = null;
  let _sensorHeartRateInvalid = null;
  let _sensorStepCount = null;
  let _sensorStepValue = null;
  let _sensorBodyStateToggle = null;

  function init(callbacks) {
    _onConfigChange = callbacks.onConfigChange;

    _batterySlider = document.getElementById('battery-slider');
    _batteryValue = document.getElementById('battery-value');
    _useSystemBattery = document.getElementById('use-system-battery');
    _shapeSelect = document.getElementById('shape-select');
    _widthInput = document.getElementById('width-input');
    _heightInput = document.getElementById('height-input');
    _sensorHeartRateSlider = document.getElementById('sensor-heart-rate');
    _sensorHeartRateValue = document.getElementById('sensor-heart-rate-value');
    _sensorHeartRateInvalid = document.getElementById('sensor-heart-rate-invalid');
    _sensorStepCount = document.getElementById('sensor-step-count');
    _sensorStepValue = document.getElementById('sensor-step-value');
    _sensorBodyStateToggle = document.getElementById('sensor-on-body');

    setupSensorControls();

    if (_useSystemBattery) {
      _useSystemBattery.addEventListener('change', () => {
        const useSystem = _useSystemBattery.checked;
        if (_batterySlider) _batterySlider.disabled = useSystem;
        if (useSystem) {
          startSystemBattery();
        } else {
          stopSystemBattery();
        }
      });
    }

    if (_batterySlider) {
      _batterySlider.addEventListener('input', () => {
        const val = parseInt(_batterySlider.value);
        if (_batteryValue) _batteryValue.textContent = val + '%';
        DeviceFeatureBattery.setBatteryLevel(val / 100);
        if (_onConfigChange) _onConfigChange(getConfig());
      });
    }

    if (_shapeSelect) {
      _shapeSelect.addEventListener('change', () => {
        if (_onConfigChange) _onConfigChange(getConfig());
      });
    }

    if (_widthInput && _heightInput) {
      _widthInput.addEventListener('change', () => {
        if (_onConfigChange) _onConfigChange(getConfig());
      });
      _heightInput.addEventListener('change', () => {
        if (_onConfigChange) _onConfigChange(getConfig());
      });
    }

    startSystemBattery();
  }

  function setupSensorControls() {
    ['accelerometer', 'gyroscope', 'compass', 'barometer'].forEach(type => {
      const toggle = document.getElementById('sensor-' + type);
      if (!toggle) return;
      DeviceFeatureSensor.setMode(type, toggle.checked);
      toggle.addEventListener('change', () => DeviceFeatureSensor.setMode(type, toggle.checked));
    });

    if (_sensorStepCount) {
      const updateSteps = () => {
        const value = Math.max(0, parseInt(_sensorStepCount.value, 10) || 0);
        if (_sensorStepValue) _sensorStepValue.textContent = value;
        DeviceFeatureSensor.setValue('stepCounter', { steps: value });
      };
      _sensorStepCount.addEventListener('input', updateSteps);
      updateSteps();
    }

    if (_sensorHeartRateSlider) {
      const updateHeartRate = () => {
        const invalid = _sensorHeartRateInvalid && _sensorHeartRateInvalid.checked;
        const value = invalid ? 255 : parseInt(_sensorHeartRateSlider.value, 10);
        if (_sensorHeartRateValue) _sensorHeartRateValue.textContent = invalid ? '255' : value + ' bpm';
        _sensorHeartRateSlider.disabled = invalid;
        DeviceFeatureSensor.setValue('heartRate', { heartRate: value });
      };
      _sensorHeartRateSlider.addEventListener('input', updateHeartRate);
      if (_sensorHeartRateInvalid) _sensorHeartRateInvalid.addEventListener('change', updateHeartRate);
      updateHeartRate();
    }

    if (_sensorBodyStateToggle) {
      _sensorBodyStateToggle.addEventListener('change', () => {
        DeviceFeatureSensor.setValue('onBodyState', { value: _sensorBodyStateToggle.checked });
      });
      DeviceFeatureSensor.setValue('onBodyState', { value: _sensorBodyStateToggle.checked });
    }
  }

  function startSystemBattery() {
    if (!navigator.getBattery) return;
    navigator.getBattery().then(battery => {
      updateSystemBattery(battery);
      battery.addEventListener('levelchange', () => updateSystemBattery(battery));
      battery.addEventListener('chargingchange', () => updateSystemBattery(battery));
    });
    _systemBatteryInterval = setInterval(() => {
      if (!_useSystemBattery || !_useSystemBattery.checked) return;
      navigator.getBattery().then(battery => updateSystemBattery(battery));
    }, 1000);
  }

  function stopSystemBattery() {
    if (_systemBatteryInterval) {
      clearInterval(_systemBatteryInterval);
      _systemBatteryInterval = null;
    }
  }

  function updateSystemBattery(battery) {
    if (!_useSystemBattery || !_useSystemBattery.checked) return;
    const level = battery.level;
    DeviceFeatureBattery.setBatteryLevel(level);
    const pct = Math.round(level * 100);
    if (_batterySlider) _batterySlider.value = pct;
    if (_batteryValue) _batteryValue.textContent = pct + '%';
    if (_onConfigChange) _onConfigChange(getConfig());
  }

  function getConfig() {
    return {
      batteryLevel: _batterySlider ? parseInt(_batterySlider.value) / 100 : 0.85,
      isCircle: _shapeSelect ? _shapeSelect.value === 'circle' : true,
      width: _widthInput ? parseInt(_widthInput.value) || 466 : 466,
      height: _heightInput ? parseInt(_heightInput.value) || 466 : 466,
    };
  }

  function setConfig(config) {
    if (config.batteryLevel !== undefined && _batterySlider) {
      _batterySlider.value = Math.round(config.batteryLevel * 100);
      if (_batteryValue) _batteryValue.textContent = Math.round(config.batteryLevel * 100) + '%';
    }
    if (config.isCircle !== undefined && _shapeSelect) {
      _shapeSelect.value = config.isCircle ? 'circle' : 'rect';
    }
    if (config.width !== undefined && _widthInput) {
      _widthInput.value = config.width;
    }
    if (config.height !== undefined && _heightInput) {
      _heightInput.value = config.height;
    }
  }

  /**
   * Apply a device preset
   */
  function applyPreset(name) {
    const presets = {
      'gt2-42': { width: 390, height: 390, isCircle: true },
      'gt2-46': { width: 454, height: 454, isCircle: true },
      'gt3': { width: 466, height: 466, isCircle: true },
      'fit2': { width: 336, height: 480, isCircle: false },
      'fit3': { width: 408, height: 480, isCircle: false },
      'watchd': { width: 280, height: 456, isCircle: false },
    };
    const preset = presets[name];
    if (preset) {
      setConfig(preset);
      if (_onConfigChange) _onConfigChange(getConfig());
    }
  }

  return { init, getConfig, setConfig, applyPreset };
})();
