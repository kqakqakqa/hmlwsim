/**
 * Component View: qrcode
 * 二维码矩阵交给 qrcode-generator（index.html 从 CDN 加载，全局名 qrcode），
 * 这里只负责按矩阵画到 canvas 上。
 */
const ComponentViewQrcode = (() => {
  const MIN_SIZE = 200;     // 文档规定的二维码最小边长
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

    // 文档：宽高不一致时取较小值做边长，最终居中显示；最小 200px，
    // 所以比 200px 小的组件会被裁掉四周（真机同款行为）。
    const side = Math.max(MIN_SIZE, Math.min(width, height));
    const left = (width - side) / 2;
    const top = (height - side) / 2;
    const count = matrix.getModuleCount();
    const moduleSize = side / count;

    ctx.fillStyle = getComputedStyle(el).color;
    const circle = String(state.attrs.type || '') === CIRCLE;

    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (!matrix.isDark(row, col)) continue;
        if (circle) {
          ctx.beginPath();
          ctx.arc(left + (col + 0.5) * moduleSize, top + (row + 0.5) * moduleSize, moduleSize / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // 模块边界取整到整像素，否则相邻模块之间会出现发丝缝。
          const x = Math.round(left + col * moduleSize);
          const y = Math.round(top + row * moduleSize);
          ctx.fillRect(x, y, Math.round(left + (col + 1) * moduleSize) - x, Math.round(top + (row + 1) * moduleSize) - y);
        }
      }
    }
  }

  return { attrs: ['value', 'type'], paint };
})();

ComponentView.register('qrcode', ComponentViewQrcode);
