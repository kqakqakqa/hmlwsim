/**
 * System APIs - Mock implementations of HarmonyOS system modules
 */
const SystemAPIs = (() => {
  let _deviceInfo = { windowWidth: 466, windowHeight: 466, screenShape: 'circle' };
  let _batteryLevel = 0.85;
  let _routerCallback = null;
  let _currentPage = null;

  function setDeviceInfo(info) {
    _deviceInfo = info;
  }

  function setBatteryLevel(level) {
    _batteryLevel = level;
  }

  function onNavigate(callback) {
    _routerCallback = callback;
  }

  function getCurrentPage() {
    return _currentPage;
  }

  // system.router
  const router = {
    push(params) {
      console.log('[router.push]', params.uri);
      _currentPage = { uri: params.uri, params: params.params || {} };
      if (_routerCallback) _routerCallback(_currentPage);
    },
    replace(params) {
      console.log('[router.replace]', params.uri);
      _currentPage = { uri: params.uri, params: params.params || {} };
      if (_routerCallback) _routerCallback(_currentPage);
    },
    back() {
      console.log('[router.back]');
      _currentPage = null;
      if (_routerCallback) _routerCallback(null);
    },
    clear() {
      console.log('[router.clear]');
    },
    getLength() {
      return 1;
    },
  };

  // system.battery
  const battery = {
    getStatus(callbacks) {
      callbacks.success && callbacks.success({ level: _batteryLevel, charging: false });
      callbacks.complete && callbacks.complete();
    },
  };

  // system.device
  const device = {
    getInfo(callbacks) {
      callbacks.success && callbacks.success({ ..._deviceInfo });
      callbacks.complete && callbacks.complete();
    },
  };

  // system.file
  const file = {
    readText(params) {
      VirtualFS.readText(params.uri, {
        success: params.success,
        fail: params.fail,
        complete: params.complete,
      });
    },
    writeText(params) {
      VirtualFS.writeText(params.uri, params.text, params.append, {
        success: params.success,
        fail: params.fail,
        complete: params.complete,
      });
    },
    list(params) {
      VirtualFS.list(params.uri, {
        success: params.success,
        fail: params.fail,
        complete: params.complete,
      });
    },
    mkdir(params) {
      VirtualFS.mkdir(params.uri, {
        success: params.success,
        fail: params.fail,
        complete: params.complete,
      });
    },
    delete(params) {
      VirtualFS.deleteFile(params.uri, {
        success: params.success,
        fail: params.fail,
        complete: params.complete,
      });
    },
    move(params) {
      VirtualFS.move(params.srcUri, params.dstUri, {
        success: params.success,
        fail: params.fail,
        complete: params.complete,
      });
    },
    copy(params) {
      VirtualFS.copy(params.srcUri, params.dstUri, {
        success: params.success,
        fail: params.fail,
        complete: params.complete,
      });
    },
    getInfo(params) {
      VirtualFS.getInfo(params.uri, {
        success: params.success,
        fail: params.fail,
        complete: params.complete,
      });
    },
  };

  // system.storage — backed by internal://app/kvstore/ via VirtualFS
  const storage = {
    get(params) {
      VirtualFS.readText('internal://app/kvstore/' + params.key, {
        success(res) { params.success && params.success(res.text); },
        fail() { params.success && params.success(params.default || ''); },
        complete: params.complete,
      });
    },
    set(params) {
      VirtualFS.writeText('internal://app/kvstore/' + params.key, params.value, false, {
        success: params.success,
        complete: params.complete,
      });
    },
    delete(params) {
      VirtualFS.deleteFile('internal://app/kvstore/' + params.key, {
        success: params.success,
        complete: params.complete,
      });
    },
  };

  // system.brightness
  const brightness = {
    getMode(callbacks) {
      callbacks.success && callbacks.success({ mode: 1 });
      callbacks.complete && callbacks.complete();
    },
    setMode() { },
    setKeepScreenOn() { },
  };

  // system.vibrator
  const vibrator = {
    start(callbacks) {
      // Visual feedback in simulator
      const frame = document.getElementById('watch-frame');
      if (frame) {
        frame.style.boxShadow = '0 0 20px rgba(233,69,96,0.5)';
        setTimeout(() => { frame.style.boxShadow = ''; }, 200);
      }
      callbacks.success && callbacks.success();
      callbacks.complete && callbacks.complete();
    },
    stop() { },
  };

  // system.sensor (stub)
  const sensor = {
    subscribe() { },
    unsubscribe() { },
  };

  // system.fetch (stub)
  const fetch = {
    fetch() { },
  };

  return {
    router, battery, device, file, storage, brightness, vibrator, sensor, fetch,
    setDeviceInfo, setBatteryLevel, onNavigate, getCurrentPage,
  };
})();
