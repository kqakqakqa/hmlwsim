/**
 * Device Feature: Phone Link
 * Simulates watch-phone communication channel.
 * Manages connection state, message queue, and subscriber notifications.
 * External input (UI panel) drives simulateIncomingMessage/simulateIncomingFile.
 */
const DeviceFeaturePhoneLink = (() => {
  let _registered = false;
  let _peerDevice = null;
  let _msgSubscribers = [];
  let _incomingMessages = [];

  _peerDevice = {
    mOsType: 1, // 1=Android, 2=iOS
    mOsName: 'Android',
    mDeviceName: 'Simulated Phone',
  };
  _registered = true;

  /**
   * Get peer device info
   */
  function getPeerDevice() {
    return _peerDevice;
  }

  /**
   * Check if phone link is registered/connected
   */
  function isConnected() {
    return _registered && _peerDevice !== null;
  }

  /**
   * Send a message to the phone
   */
  function sendToPhone(message) {
    console.log('[PhoneLink] sendToPhone:', message);
    _incomingMessages.push({
      time: new Date().toISOString(),
      source: 'sent',
      type: 'message',
      content: message,
      isSuccess: true,
    });

    // Notify subscribers about sent messages too
    _msgSubscribers.forEach(cb => {
      cb({ isRegister: false, isFileType: false, message: message });
    });
  }

  /**
   * Receive a message from the phone (called from UI panel)
   */
  function receiveFromPhone(text) {
    _incomingMessages.push({
      time: new Date().toISOString(),
      source: 'received',
      type: 'message',
      content: text,
      isSuccess: true,
    });

    _msgSubscribers.forEach(cb => {
      cb({ isRegister: false, isFileType: false, message: text });
    });
  }

  /**
   * Receive a file from the phone (called from UI panel)
   */
  function receiveFileFromPhone(filename) {
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

  /**
   * Subscribe to incoming messages
   * @param {Function} callback - Called with message objects
   * @returns {Array} Pending messages delivered immediately
   */
  function subscribeMessages(callback) {
    _msgSubscribers.push(callback);

    // Deliver any pending incoming messages
    const pending = [];
    while (_incomingMessages.length > 0) {
      const msg = _incomingMessages.shift();
      const payload = {
        isRegister: false,
        isFileType: msg.type === 'file',
        message: msg.type !== 'file' ? msg.content : undefined,
        file: msg.type === 'file' ? msg.content : undefined,
      };
      pending.push(payload);
    }
    return pending;
  }

  /**
   * Unsubscribe all message listeners
   */
  function unsubscribeMessages() {
    _msgSubscribers = [];
  }

  /**
   * Reset all state
   */
  function reset() {
    _registered = false;
    _peerDevice = null;
    _msgSubscribers = [];
    _incomingMessages = [];
  }

  return {
    getPeerDevice, isConnected,
    sendToPhone, receiveFromPhone, receiveFileFromPhone,
    subscribeMessages, unsubscribeMessages, reset,
  };
})();
