/**
 * Device Feature: Network
 * Performs requests through the browser network stack.
 */
const DeviceFeatureNetwork = (() => {
  /**
   * Perform a network request
   * @param {string} url
   * @param {Object} options - fetch options
   * @returns {Promise<{data: string, code: number}>}
   */
  async function request(url, options) {
    options = options || {};
    // Keep CORS and network errors governed by the browser.
    const response = await window.fetch(url, {
      method: options.method || 'GET',
      headers: options.header,
      body: options.data,
    });
    return {
      data: await response.text(),
      code: response.status,
    };
  }

  return { request };
})();
