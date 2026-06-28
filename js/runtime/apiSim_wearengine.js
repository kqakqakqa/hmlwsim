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
    if (params.complete) params.complete();
  }

  function setFingerprint(params) {
    _pairAppFingerprint = params.appCert;
    if (params.complete) params.complete();
  }

  function getPeerDevice(callbacks) {
    const peer = DeviceFeaturePhoneLink.getPeerDevice();
    if (peer) {
      callbacks.success && callbacks.success(peer);
    } else {
      callbacks.fail && callbacks.fail('No peer device', -1);
    }
    callbacks.complete && callbacks.complete();
  }

  function detect(callbacks) {
    // Always report as installed in simulator
    if (_pairAppName) {
      callbacks.success && callbacks.success();
    } else {
      callbacks.fail && callbacks.fail('No app configured', -1);
    }
    callbacks.complete && callbacks.complete();
  }

  function getWearEngineVersion(callbacks) {
    const version = 'Simulated WearEngine 3.0.0';
    callbacks.complete && callbacks.complete(version);
    callbacks.success && callbacks.success(version);
  }

  function sendMsg(params) {
    console.log('[Wearengine] sendMsg:', params.message);
    DeviceFeaturePhoneLink.sendToPhone(params.message);
    if (params.success) params.success();
    if (params.complete) params.complete();
  }

  function subscribeMsg(callbacks) {
    callbacks.success && callbacks.success({ isRegister: true });

    // Subscribe and deliver pending messages
    const pending = DeviceFeaturePhoneLink.subscribeMessages((msg) => {
      if (callbacks.success) callbacks.success(msg);
    });

    // Deliver any pending messages
    pending.forEach(msg => {
      if (callbacks.success) callbacks.success(msg);
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
