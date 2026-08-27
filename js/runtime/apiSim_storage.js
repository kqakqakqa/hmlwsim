/**
 * API Sim: system.storage
 * Application-facing API for key-value storage.
 * Converts keys to internal://app/kvstore/ paths, delegates to DeviceFeatureVirtualFS.
 */
const ApiSimStorage = (() => {
  const KV_PREFIX = 'internal://app/kvstore/';

  function get(params) {
    DeviceFeatureVirtualFS.readText(KV_PREFIX + params.key, {
      success(res) { params.success && params.success(res.text); },
      fail() { params.success && params.success(params.default || ''); },
      complete: params.complete,
    });
  }

  function set(params) {
    var callbacks = params || {};
    DeviceFeatureVirtualFS.writeText(KV_PREFIX + callbacks.key, callbacks.value, false, {
      success: callbacks.success,
      complete: callbacks.complete,
    });
  }

  function delete_(params) {
    DeviceFeatureVirtualFS.deleteFile(KV_PREFIX + params.key, {
      success: params.success,
      complete: params.complete,
    });
  }

  return { get, set, delete: delete_ };
})();
