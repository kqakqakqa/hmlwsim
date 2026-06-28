/**
 * API Sim: system.file
 * Application-facing API for file operations.
 * Delegates to DeviceFeatureVirtualFS with parameter formatting.
 */
const ApiSimFile = (() => {
  function readText(params) {
    DeviceFeatureVirtualFS.readText(params.uri, {
      success: params.success,
      fail: params.fail,
      complete: params.complete,
    });
  }

  function writeText(params) {
    DeviceFeatureVirtualFS.writeText(params.uri, params.text, params.append, {
      success: params.success,
      fail: params.fail,
      complete: params.complete,
    });
  }

  function list(params) {
    DeviceFeatureVirtualFS.list(params.uri, {
      success: params.success,
      fail: params.fail,
      complete: params.complete,
    });
  }

  function mkdir(params) {
    DeviceFeatureVirtualFS.mkdir(params.uri, {
      success: params.success,
      fail: params.fail,
      complete: params.complete,
    });
  }

  function delete_(params) {
    DeviceFeatureVirtualFS.deleteFile(params.uri, {
      success: params.success,
      fail: params.fail,
      complete: params.complete,
    });
  }

  function move(params) {
    DeviceFeatureVirtualFS.move(params.srcUri, params.dstUri, {
      success: params.success,
      fail: params.fail,
      complete: params.complete,
    });
  }

  function copy(params) {
    DeviceFeatureVirtualFS.copy(params.srcUri, params.dstUri, {
      success: params.success,
      fail: params.fail,
      complete: params.complete,
    });
  }

  function getInfo(params) {
    DeviceFeatureVirtualFS.getInfo(params.uri, {
      success: params.success,
      fail: params.fail,
      complete: params.complete,
    });
  }

  return { readText, writeText, list, mkdir, delete: delete_, move, copy, getInfo };
})();
