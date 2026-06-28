/**
 * API Sim: system.fetch
 * Application-facing API for network requests.
 * Delegates to DeviceFeatureNetwork.
 */
const ApiSimFetch = (() => {
  async function fetch(params) {
    try {
      const result = await DeviceFeatureNetwork.request(params.url, params);
      if (params.success) params.success(result);
    } catch (e) {
      if (params.fail) params.fail(e.message, -1);
    }
    if (params.complete) params.complete();
  }

  return { fetch };
})();
