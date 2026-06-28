/**
 * API Sim: system.router
 * Application-facing API for page navigation.
 * Delegates to DeviceFeaturePageNav.
 */
const ApiSimRouter = (() => {
  function push(params) {
    console.log('[router.push]', params.uri);
    const cb = DeviceFeaturePageNav.getNavigateCallback();
    if (cb) cb({ uri: params.uri, params: params.params || {} });
  }

  function replace(params) {
    console.log('[router.replace]', params.uri);
    const cb = DeviceFeaturePageNav.getNavigateCallback();
    if (cb) cb({ uri: params.uri, params: params.params || {} });
  }

  function back() {
    console.log('[router.back]');
    const cb = DeviceFeaturePageNav.getNavigateCallback();
    if (cb) cb(null);
  }

  function clear() {
    console.log('[router.clear]');
  }

  function getLength() {
    return 1;
  }

  return { push, replace, back, clear, getLength };
})();
