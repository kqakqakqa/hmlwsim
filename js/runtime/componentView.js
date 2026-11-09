/**
 * Component View
 * progress / qrcode / chart 在真机上由框架底层自绘（不是 HTML 元素），
 * 浏览器里没有对应实现，只能挂一张 canvas 自己画。
 *
 * 这里只负责三件通用的事：挂 canvas、等布局完成后触发首帧重绘、属性变化时重绘。
 * 画什么由各控件自己注册的 renderer 决定。
 */
const ComponentView = (() => {
  const _renderers = {};
  const _hosts = new Set();
  let _resizeObserver = null;

  function register(tag, renderer) {
    _renderers[tag] = renderer;
  }

  function has(tag) {
    return Object.prototype.hasOwnProperty.call(_renderers, tag);
  }

  // 页面重绘会整棵替换 DOM，旧宿主元素必须从 ResizeObserver 上摘下来，
  // 否则观察器和旧页面的节点会一直互相攥着。
  function pruneDetached() {
    for (const el of _hosts) {
      if (el.isConnected) continue;
      if (_resizeObserver) _resizeObserver.unobserve(el);
      _hosts.delete(el);
    }
  }

  function ensureResizeObserver() {
    if (_resizeObserver) return _resizeObserver;
    // 组件宽高来自应用 CSS（px 或百分比），只有布局完成后才知道，
    // 所以首帧也靠 ResizeObserver 触发，而不是挂载时同步绘制。
    _resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) paint(entry.target);
    });
    return _resizeObserver;
  }

  function attach(el, tag) {
    const renderer = _renderers[tag];
    if (!renderer) return el;
    pruneDetached();

    const canvas = document.createElement('canvas');
    canvas.setAttribute('data-simulator-view', tag);
    const state = {
      tag,
      renderer,
      canvas,
      ctx: canvas.getContext('2d'),
      attrs: {},
      pending: false,
    };
    el._componentView = state;
    // 宿主样式（display / overflow / color 默认值）由 css-adapter 按这个属性给出。
    el.setAttribute('data-simulator-view-host', tag);
    el.appendChild(canvas);

    if (renderer.init) renderer.init(el, state);
    _hosts.add(el);
    ensureResizeObserver().observe(el);
    return el;
  }

  // 属性变化（percent / value / datasets / options ...）只记录并重绘，
  // 具体语义由各控件的 paint 决定。返回 false 表示该属性与控件无关，调用方按普通属性处理。
  function setAttr(el, key, value) {
    const state = el._componentView;
    if (!state) return false;
    if (state.renderer.attrs && state.renderer.attrs.indexOf(key) < 0) return false;
    state.attrs[key] = value;
    schedulePaint(el);
    return true;
  }

  function paint(el) {
    const state = el._componentView;
    if (!state || !el.isConnected) return;
    state.pending = false;

    // 画布铺满宿主的内容区，所以直接用它自己的尺寸：clientWidth 含 padding，
    // 有 padding 的组件（比如带 padding 的弧形进度条）用宿主尺寸会算偏。
    const width = state.canvas.clientWidth;
    const height = state.canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    const pixelWidth = Math.max(1, Math.round(width * dpr));
    const pixelHeight = Math.max(1, Math.round(height * dpr));
    if (state.canvas.width !== pixelWidth || state.canvas.height !== pixelHeight) {
      state.canvas.width = pixelWidth;
      state.canvas.height = pixelHeight;
    }

    const ctx = state.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (width <= 0 || height <= 0) return;

    try {
      state.renderer.paint(el, ctx, width, height, state);
    } catch (e) {
      console.error('[ComponentView] paint failed:', state.tag, e);
    }
  }

  function schedulePaint(el) {
    const state = el._componentView;
    if (!state || state.pending) return;
    state.pending = true;
    requestAnimationFrame(() => {
      // 还没插进文档的元素先不动，插入后 ResizeObserver 会补上首帧。
      if (el.isConnected) paint(el);
      else state.pending = false;
    });
  }

  /**
   * 读控件专有样式值。
   * 真机把 start-angle / stroke-width / center-x 这些当成普通样式收，浏览器不认这些属性名，
   * 所以 sandbox 把它们映射成 --ohos-* 自定义属性写进 style，
   * 这样内联样式和 class 样式都能通过 getComputedStyle 读回来。
   */
  function readLength(cs, name, fallback) {
    const raw = cs.getPropertyValue(name).trim();
    if (!raw) return fallback;
    const value = parseFloat(raw);
    return isNaN(value) ? fallback : value;
  }

  return { register, has, attach, setAttr, paint, schedulePaint, readLength };
})();
