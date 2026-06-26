/**
 * Sensor Panel - UI controls for simulating device sensors
 */
const SensorPanel = (() => {
  let _batterySlider = null;
  let _batteryValue = null;
  let _shapeSelect = null;
  let _widthInput = null;
  let _heightInput = null;
  let _onConfigChange = null;

  function init(callbacks) {
    _onConfigChange = callbacks.onConfigChange;

    _batterySlider = document.getElementById('battery-slider');
    _batteryValue = document.getElementById('battery-value');
    _shapeSelect = document.getElementById('shape-select');
    _widthInput = document.getElementById('width-input');
    _heightInput = document.getElementById('height-input');

    if (_batterySlider) {
      _batterySlider.addEventListener('input', () => {
        const val = parseInt(_batterySlider.value);
        if (_batteryValue) _batteryValue.textContent = val + '%';
        SystemAPIs.setBatteryLevel(val / 100);
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
