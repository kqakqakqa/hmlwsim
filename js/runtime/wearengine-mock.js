/**
 * WearEngine Mock - Simulates watch-phone communication
 */
const WearEngineMock = (() => {
  let _registered = false;
  let _peerDevice = null;
  let _pairAppName = '';
  let _pairAppFingerprint = '';
  let _msgSubscribers = [];
  let _incomingMessages = [];

  function init() {
    _peerDevice = {
      mOsType: 1, // 1=Android, 2=iOS
      mOsName: 'Android',
      mDeviceName: 'Simulated Phone',
    };
    _registered = true;
  }

  function setPackageName(params) {
    _pairAppName = params.appName;
    if (params.complete) params.complete();
  }

  function setFingerprint(params) {
    _pairAppFingerprint = params.appCert;
    if (params.complete) params.complete();
  }

  function getPeerDevice(callbacks) {
    if (_peerDevice) {
      callbacks.success && callbacks.success(_peerDevice);
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
    // Simulate sending message
    console.log('[WearEngine] sendMsg:', params.message);
    _incomingMessages.push({
      time: new Date().toISOString(),
      source: 'sent',
      type: 'message',
      content: params.message,
      isSuccess: true,
    });

    if (params.success) params.success();
    if (params.complete) params.complete();

    // Notify subscribers
    _msgSubscribers.forEach(cb => {
      cb({ isRegister: false, isFileType: false, message: params.message });
    });
  }

  function subscribeMsg(callbacks) {
    _msgSubscribers.push(callbacks.success);
    // Send registration confirmation
    callbacks.success && callbacks.success({ isRegister: true });

    // Deliver any pending incoming messages
    while (_incomingMessages.length > 0) {
      const msg = _incomingMessages.shift();
      callbacks.success && callbacks.success({
        isRegister: false,
        isFileType: msg.type === 'file',
        message: msg.content,
        file: msg.type === 'file' ? msg.content : undefined,
      });
    }
  }

  function unsubscribeMsg() {
    _msgSubscribers = [];
  }

  /**
   * Simulate receiving a message from the "phone"
   */
  function simulateIncomingMessage(text) {
    _incomingMessages.push({
      time: new Date().toISOString(),
      source: 'received',
      type: 'message',
      content: text,
      isSuccess: true,
    });

    // Notify active subscribers
    _msgSubscribers.forEach(cb => {
      cb({ isRegister: false, isFileType: false, message: text });
    });
  }

  /**
   * Simulate receiving a file
   */
  function simulateIncomingFile(filename) {
    _incomingMessages.push({
      time: new Date().toISOString(),
      source: 'received',
      type: 'file',
      content: filename,
      isSuccess: true,
    });

    _msgSubscribers.forEach(cb => {
      cb({ isRegister: false, isFileType: true, file: filename });
    });
  }

  function reset() {
    _registered = false;
    _peerDevice = null;
    _pairAppName = '';
    _pairAppFingerprint = '';
    _msgSubscribers = [];
    _incomingMessages = [];
  }

  return {
    init, setPackageName, setFingerprint, getPeerDevice, detect,
    getWearEngineVersion, sendMsg, subscribeMsg, unsubscribeMsg,
    simulateIncomingMessage, simulateIncomingFile, reset,
  };
})();
