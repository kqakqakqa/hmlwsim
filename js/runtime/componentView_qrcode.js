/**
 * Component View: qrcode
 * 二维码矩阵交给 qrcode-generator（index.html 从 CDN 加载，全局名 qrcode），
 * 这里只负责按矩阵画到 canvas 上。
 */
const ComponentViewQrcode = (() => {
  const QUIET_ZONE = 5;     // 二维码四周的静区宽度，单位是模块数
  const MAX_LENGTH = 256;   // value 长度上限
  const CIRCLE = 'circle';

  // qrcode-generator 默认按 charCodeAt & 0xff 取字节，中文会被截断成乱码。
  // 它自己带了 UTF-8 版本（stringToBytesFuncs['UTF-8']）只是没启用，
  // 这里切过去，就不用额外再加载 qrcode_UTF8.js 了。
  function ensureUtf8Encoding() {
    const utf8 = qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs['UTF-8'];
    if (utf8 && qrcode.stringToBytes !== utf8) qrcode.stringToBytes = utf8;
  }

  // 内容没变就不重新编码，避免百分比重绘时白算一遍。
  function ensureMatrix(state) {
    const value = state.attrs.value === undefined || state.attrs.value === null
      ? ''
      : String(state.attrs.value).substring(0, MAX_LENGTH);
    if (state.matrixValue === value) return state.matrix;
    state.matrixValue = value;
    state.matrix = null;
    if (!value || typeof qrcode === 'undefined') return null;
    ensureUtf8Encoding();
    try {
      // typeNumber 传 0 让库自己选最小版本，纠错等级用 L（容量最大）。
      const matrix = qrcode(0, 'L');
      matrix.addData(value);
      matrix.make();
      state.matrix = matrix;
    } catch (e) {
      console.error('[Qrcode] encode failed:', e);
    }
    return state.matrix;
  }

  function paint(el, ctx, width, height, state) {
    const matrix = ensureMatrix(state);
    if (!matrix) return;

    // 二维码大小完全跟随组件内容区：宽高不一致时取较小值做边长并居中，
    // 组件给多大就画多大，不会再画出框外，也没有额外的最小边长限制。
    const side = Math.min(width, height);
    const left = (width - side) / 2;
    const top = (height - side) / 2;
    const count = matrix.getModuleCount();
    // 边长按「矩阵模块数 + 两侧静区」等分，静区算在组件框内部，
    // 所以含白边在内仍然正好铺满框，不会撑破。
    const moduleSize = side / (count + QUIET_ZONE * 2);
    // 码体相对整块方形区域的内缩量，5 格白边就落在这段空白里。
    const originX = left + QUIET_ZONE * moduleSize;
    const originY = top + QUIET_ZONE * moduleSize;

    ctx.fillStyle = getComputedStyle(el).color;
    const circle = String(state.attrs.type || '') === CIRCLE;

    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (!matrix.isDark(row, col)) continue;
        if (circle) {
          ctx.beginPath();
          ctx.arc(originX + (col + 0.5) * moduleSize, originY + (row + 0.5) * moduleSize, moduleSize / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // 模块边界取整到整像素，否则相邻模块之间会出现发丝缝。
          const x = Math.round(originX + col * moduleSize);
          const y = Math.round(originY + row * moduleSize);
          ctx.fillRect(x, y, Math.round(originX + (col + 1) * moduleSize) - x, Math.round(originY + (row + 1) * moduleSize) - y);
        }
      }
    }
  }

  return { attrs: ['value', 'type'], paint };
})();

ComponentView.register('qrcode', ComponentViewQrcode);
