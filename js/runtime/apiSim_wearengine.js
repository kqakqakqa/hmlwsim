/**
 * API Sim: system.wearengine
 * Application-facing API for WearEngine (watch-phone communication).
 * Handles protocol-level concerns; delegates connection/messaging to DeviceFeaturePhoneLink.
 */
const ApiSimWearengine = (() => {
  let _pairAppName = '';
  let _pairAppFingerprint = '';

  function setPackageName(params) {
    _pairAppName = params.appName;
    if (params && typeof params.complete === 'function') params.complete();
  }

  function setFingerprint(params) {
    _pairAppFingerprint = params.appCert;
    if (params && typeof params.complete === 'function') params.complete();
  }

  function getPeerDevice(callbacks) {
    if (!callbacks) return;
    var peer = DeviceFeaturePhoneLink.getPeerDevice();
    if (peer) {
      if (typeof callbacks.success === 'function') callbacks.success(peer);
    } else {
      if (typeof callbacks.fail === 'function') callbacks.fail('No peer device', -1);
    }
    if (typeof callbacks.complete === 'function') callbacks.complete();
  }

  function detect(callbacks) {
    if (!callbacks) return;
    // Always report as installed in simulator
    if (_pairAppName) {
      if (typeof callbacks.success === 'function') callbacks.success();
    } else {
      if (typeof callbacks.fail === 'function') callbacks.fail('No app configured', -1);
    }
    if (typeof callbacks.complete === 'function') callbacks.complete();
  }

  function getWearEngineVersion(callbacks) {
    var version = 'Infinity.Infinity';
    if (callbacks && typeof callbacks.complete === 'function') callbacks.complete(version);
    if (callbacks && typeof callbacks.success === 'function') callbacks.success(version);
  }

  function sendMsg(params) {
    console.log('[Wearengine] sendMsg:', params.message);
    DeviceFeaturePhoneLink.sendToPhone(params.message);
    if (params && typeof params.success === 'function') params.success();
    if (params && typeof params.complete === 'function') params.complete();
  }

  function subscribeMsg(callbacks) {
    if (!callbacks) return;
    if (typeof callbacks.success === 'function') callbacks.success({ isRegister: true });

    // Subscribe and deliver pending messages
    var pending = DeviceFeaturePhoneLink.subscribeMessages((msg) => {
      if (typeof callbacks.success === 'function') callbacks.success(msg);
    });

    // Deliver any pending messages
    pending.forEach(msg => {
      if (typeof callbacks.success === 'function') callbacks.success(msg);
    });
  }

  function unsubscribeMsg() {
    DeviceFeaturePhoneLink.unsubscribeMessages();
  }

  return {
    setPackageName, setFingerprint, getPeerDevice, detect,
    getWearEngineVersion, sendMsg, subscribeMsg, unsubscribeMsg,
  };
})();
