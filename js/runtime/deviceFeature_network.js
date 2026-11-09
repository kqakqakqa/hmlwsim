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
      // 不少站点（如 passport.bilibili.com）的 WAF 会把 localhost 页面发来的请求直接 403。
      // Origin 由浏览器强制添加，前端去不掉；模拟器靠 --disable-web-security 启动才不会发。
      // Referer 是前端能控制的，这里统一不发，凑齐"无 Origin + 无 Referer"才通得过。
      referrerPolicy: 'no-referrer',
    });
    return {
      data: await response.text(),
      code: response.status,
    };
  }

  return { request };
})();
