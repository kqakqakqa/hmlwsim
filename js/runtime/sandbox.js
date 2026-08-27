/**
 * JS Sandbox - Factory pattern. Each create() returns a fresh instance.
 * Old instances are destroyed (timers cancelled, state cleared, DOM disconnected).
 */
function createSandbox() {
  let _imports = {};
  let _appExports = null;
  let _moduleCache = new Map();
  let _onAppTerminate = null;
  let _lastViewModel = null;
  let _lastError = null;
  let _imageSrcResolver = null;
  const _activeTimers = new Set();
  const _globalKeys = [];
  let _destroyed = false;

  const _reactive = {
    _currentDeps: null,
    _subscriptions: new Map(),
    _cleanupFns: [],

    track(fn) {
      this._currentDeps = new Set();
      let value;
      try { value = fn(); } catch (e) { console.error('[Reactive] track error:', e); }
      const deps = this._currentDeps;
      this._currentDeps = null;
      return { value, deps };
    },
    record(key) { if (this._currentDeps) this._currentDeps.add(key); },
    subscribe(deps, callback) {
      const keys = [];
      for (const key of deps) {
        if (!this._subscriptions.has(key)) this._subscriptions.set(key, new Set());
        this._subscriptions.get(key).add(callback);
        keys.push(key);
      }
      return () => { for (const key of keys) { const s = this._subscriptions.get(key); if (s) s.delete(callback); } };
    },
    notify(key) { const s = this._subscriptions.get(key); if (s) s.forEach(cb => cb()); },
    removeKey(key) { this._subscriptions.delete(key); },
    addCleanup(fn) { this._cleanupFns.push(fn); },
    cleanup() { this._cleanupFns.forEach(fn => fn()); this._cleanupFns.length = 0; this._subscriptions.clear(); }
  };

  function _cancelAllTimers() {
    for (const id of _activeTimers) {
      window.clearTimeout(id);
      window.clearInterval(id);
    }
    _activeTimers.clear();
  }

  function cleanupGlobals() {
    for (const key of _globalKeys) {
      try { delete window[key]; } catch (_) { }
    }
    _globalKeys.length = 0;
  }

  function cleanupReactive() { _reactive.cleanup(); }

  function destroy() {
    _destroyed = true;
    _cancelAllTimers();
    cleanupGlobals();
    cleanupReactive();
    _imports = {};
    _appExports = null;
    _moduleCache.clear();
    _onAppTerminate = null;
    _lastViewModel = null;
    _lastError = null;
    _imageSrcResolver = null;
  }

  function setOnAppTerminate(cb) { _onAppTerminate = cb; }
  function setImageSrcResolver(resolver) { _imageSrcResolver = resolver; }

  function _resolveImageSrc(src) {
    if (typeof src === 'string' && _imageSrcResolver) return _imageSrcResolver(src);
    return src;
  }

  function _updateAttr(el, tag, key, val) {
    if (key === 'ref') {
      el.setAttribute('data-ref', String(val));
    } else if (key === 'show') {
      el.style.display = val ? '' : 'none';
    } else if (tag === 'text' && key === 'value') {
      el.textContent = String(val);
    } else if (tag === 'marquee' && key === 'value') {
      if (el._marqueeContent) el._marqueeContent.textContent = String(val);
      else el.textContent = String(val);
      _updateMarquee(el);
    } else if (tag === 'image' && key === 'src') {
      el.setAttribute('src', _resolveImageSrc(String(val)));
    } else if (tag === 'swiper' && key === 'index') {
      el.setAttribute('index', String(val));
      const idx = parseInt(val, 10);
      if (!isNaN(idx)) {
        const isVertical = el.getAttribute('vertical') === 'true';
        requestAnimationFrame(() => {
          if (isVertical) el.scrollTo({ top: idx * el.clientHeight, behavior: 'smooth' });
          else el.scrollTo({ left: idx * el.clientWidth, behavior: 'smooth' });
        });
      }
    } else if (tag === 'progress') {
      if (key === 'type') el.setAttribute('type', String(val));
      else if (key === 'percent' || key === 'value') { el.setAttribute('value', String(val)); el.setAttribute('max', '100'); }
    } else if (tag === 'input') {
      if (key === 'type') el.setAttribute('type', String(val));
      else if (key === 'checked') el.checked = !!val;
      else el.setAttribute(key, String(val));
    } else {
      el.setAttribute(key, String(val));
    }
  }

  const STYLE_PROP_MAP = {
    width: 'width', height: 'height',
    maxWidth: 'max-width', maxHeight: 'max-height',
    minWidth: 'min-width', minHeight: 'min-height',
    aspectRatio: 'aspect-ratio',
    flexDirection: 'flex-direction', flexWrap: 'flex-wrap',
    justifyContent: 'justify-content', alignItems: 'align-items',
    alignContent: 'align-content', alignSelf: 'align-self',
    backgroundColor: 'background-color', background: 'background',
    backgroundImage: 'background-image', backgroundRepeat: 'background-repeat',
    backgroundSize: 'background-size', backgroundPosition: 'background-position',
    color: 'color', fontSize: 'font-size', fontWeight: 'font-weight',
    fontStyle: 'font-style', fontFamily: 'font-family',
    textAlign: 'text-align', textIndent: 'text-indent',
    textDecoration: 'text-decoration', textOverflow: 'text-overflow',
    lineHeight: 'line-height', letterSpacing: 'letter-spacing',
    whiteSpace: 'white-space', wordBreak: 'word-break',
    lines: '-webkit-line-clamp',
    minFontSize: 'min-font-size', maxFontSize: 'max-font-size',
    padding: 'padding', paddingLeft: 'padding-left', paddingRight: 'padding-right',
    paddingTop: 'padding-top', paddingBottom: 'padding-bottom',
    paddingStart: 'padding-inline-start', paddingEnd: 'padding-inline-end',
    margin: 'margin', marginLeft: 'margin-left', marginRight: 'margin-right',
    marginTop: 'margin-top', marginBottom: 'margin-bottom',
    marginStart: 'margin-inline-start', marginEnd: 'margin-inline-end',
    border: 'border',
    borderWidth: 'border-width', borderColor: 'border-color', borderStyle: 'border-style',
    borderTopWidth: 'border-top-width', borderTopColor: 'border-top-color', borderTopStyle: 'border-top-style',
    borderBottomWidth: 'border-bottom-width', borderBottomColor: 'border-bottom-color', borderBottomStyle: 'border-bottom-style',
    borderLeftWidth: 'border-left-width', borderLeftColor: 'border-left-color', borderLeftStyle: 'border-left-style',
    borderRightWidth: 'border-right-width', borderRightColor: 'border-right-color', borderRightStyle: 'border-right-style',
    borderTop: 'border-top', borderBottom: 'border-bottom',
    borderLeft: 'border-left', borderRight: 'border-right',
    borderRadius: 'border-radius',
    borderTopLeftRadius: 'border-top-left-radius', borderTopRightRadius: 'border-top-right-radius',
    borderBottomLeftRadius: 'border-bottom-left-radius', borderBottomRightRadius: 'border-bottom-right-radius',
    position: 'position', top: 'top', left: 'left', right: 'right', bottom: 'bottom',
    display: 'display', overflow: 'overflow', opacity: 'opacity',
    visibility: 'visibility', zIndex: 'z-index',
    flex: 'flex', flexGrow: 'flex-grow',
    flexShrink: 'flex-shrink', flexBasis: 'flex-basis',
    objectFit: 'object-fit', imageFill: 'image-fill',
    maskImage: '-webkit-mask-image', maskPosition: '-webkit-mask-position',
    maskSize: '-webkit-mask-size',
    filter: 'filter', backdropFilter: '-webkit-backdrop-filter',
    boxShadow: 'box-shadow',
    boxShadowH: '--bs-h', boxShadowV: '--bs-v',
    boxShadowBlur: '--bs-blur', boxShadowSpread: '--bs-spread', boxShadowColor: '--bs-color',
    transform: 'transform', transformOrigin: 'transform-origin',
    transitionProperty: 'transition-property', transitionDuration: 'transition-duration',
    transitionDelay: 'transition-delay', transitionTimingFunction: 'transition-timing-function',
    animationName: 'animation-name', animationDuration: 'animation-duration',
    animationDelay: 'animation-delay', animationTimingFunction: 'animation-timing-function',
    animationIterationCount: 'animation-iteration-count', animationFillMode: 'animation-fill-mode',
    animationPlayState: 'animation-play-state', animationDirection: 'animation-direction',
    gridTemplateColumns: 'grid-template-columns', gridTemplateRows: 'grid-template-rows',
    gridGap: 'grid-gap', gridColumnsGap: 'grid-column-gap', gridRowsGap: 'grid-row-gap',
    gridRowStart: 'grid-row-start', gridRowEnd: 'grid-row-end',
    gridColumnStart: 'grid-column-start', gridColumnEnd: 'grid-column-end',
    gridAutoFlow: 'grid-auto-flow',
    scrollbarColor: 'scrollbar-color', scrollbarWidth: 'scrollbar-width',
    overscrollEffect: 'overscroll-behavior',
  };

  const COLOR_PROPS = new Set([
    'color', 'backgroundColor', 'borderColor', 'borderTopColor', 'borderBottomColor',
    'borderLeftColor', 'borderRightColor', 'boxShadowColor', 'imageFill',
    'scrollbarColor', 'progressColor', 'indicatorColor', 'indicatorSelectedColor',
    'selectedColor', 'placeholderColor', 'caretColor', 'maskColor',
  ]);

  const UNITLESS_PROPS = new Set([
    'opacity', 'flex', 'flexGrow', 'flexShrink', 'zIndex',
    'animationIterationCount', 'lines', 'columns', 'columnSpan',
    'gridRowStart', 'gridRowEnd', 'gridColumnStart', 'gridColumnEnd',
    'displayIndex', 'flexWeight',
  ]);

  const STRING_PROPS = new Set([
    'animationName', 'animationDuration', 'animationDelay',
    'animationTimingFunction', 'animationFillMode', 'animationPlayState',
    'animationDirection', 'transitionProperty', 'transitionDuration',
    'transitionDelay', 'transitionTimingFunction', 'fontFamily',
    'transform', 'transformOrigin', 'backgroundImage',
    'filter', 'backdropFilter', 'maskImage',
  ]);

  function formatColor(val) {
    if (typeof val === 'number') {
      let alpha = (val >>> 24) & 0xFF;
      const red = (val >>> 16) & 0xFF;
      const green = (val >>> 8) & 0xFF;
      const blue = val & 0xFF;
      if (alpha === 0) alpha = 0xFF;
      if (alpha === 0xFF) {
        return '#' + red.toString(16).padStart(2, '0') + green.toString(16).padStart(2, '0') + blue.toString(16).padStart(2, '0');
      }
      return '#' + red.toString(16).padStart(2, '0') + green.toString(16).padStart(2, '0') + blue.toString(16).padStart(2, '0') + alpha.toString(16).padStart(2, '0');
    }
    if (typeof val === 'string') {
      const match8 = val.match(/^#([0-9a-fA-F]{8})$/);
      if (match8) {
        const hex = match8[1];
        const aa = hex.substring(0, 2);
        const rr = hex.substring(2, 4);
        const gg = hex.substring(4, 6);
        const bb = hex.substring(6, 8);
        if (aa === 'ff') return '#' + rr + gg + bb;
        return '#' + rr + gg + bb + aa;
      }
      const match6 = val.match(/^#([0-9a-fA-F]{6})$/);
      if (match6) return val;
    }
    return val;
  }

  function formatStyleValue(key, val) {
    if (val === undefined || val === null) return '';
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    if (COLOR_PROPS.has(key)) return formatColor(val);
    if (STRING_PROPS.has(key)) return String(val);
    if (key === 'animationIterationCount' && val === -1) return 'infinite';
    if (typeof val === 'number' && !UNITLESS_PROPS.has(key)) return val + 'px';
    return String(val);
  }

  function buildBoxShadow(val) {
    if (!val || !Array.isArray(val)) return '';
    return val.map(p => {
      if (!p) return '';
      if (typeof p === 'object' && p.type) {
        if (p.type === 'Color') return formatColor(p.value);
        return p.value;
      }
      return p;
    }).filter(Boolean).join(' ');
  }

  function applyStyles(el, styles) {
    if (!styles) return;
    for (const [key, val] of Object.entries(styles)) {
      if (key === 'boxShadow') { el.style['box-shadow'] = buildBoxShadow(val); continue; }
      if (key === 'boxShadowH' || key === 'boxShadowV' || key === 'boxShadowBlur' || key === 'boxShadowSpread' || key === 'boxShadowColor') continue;
      el.style[STYLE_PROP_MAP[key] || key] = formatStyleValue(key, val);
    }
  }

  function _updateMarquee(el) {
    const content = el._marqueeContent;
    if (!content) return;
    requestAnimationFrame(() => {
      const distance = Math.max(0, content.scrollWidth - el.clientWidth);
      el.style.setProperty('--marquee-translation', -distance + 'px');
      content.style.animationPlayState = distance > 0 ? 'running' : 'paused';
    });
  }

  function _c(tag, props, children) {
    props = props || {};
    children = children || [];
    const htmlTag = tag === 'image' ? 'img' : (tag === 'marquee' ? 'div' : tag);
    const el = document.createElement(htmlTag);
    if (tag === 'image') el.setAttribute('draggable', 'false');
    if (tag === 'marquee') {
      el.setAttribute('data-simulator-marquee', 'true');
      const content = document.createElement('span');
      content.className = 'marquee-content';
      el._marqueeContent = content;
      el.appendChild(content);
    }

    if (props.staticStyle) applyStyles(el, props.staticStyle);

    if (props.dynamicStyle) {
      for (const [key, fn] of Object.entries(props.dynamicStyle)) {
        if (typeof fn === 'function') {
          const { value: val, deps } = _reactive.track(fn);
          const cssProp = STYLE_PROP_MAP[key] || key;
          if (val !== undefined && val !== null) el.style[cssProp] = formatStyleValue(key, val);
          else requestAnimationFrame(() => { try { const v = fn(); if (v !== undefined && v !== null) el.style[cssProp] = formatStyleValue(key, v); } catch (_) { } });
          if (deps.size > 0) {
            _reactive.addCleanup(_reactive.subscribe(deps, () => { try { const v = fn(); if (v !== undefined && v !== null) el.style[cssProp] = formatStyleValue(key, v); } catch (e) { } }));
          }
        } else {
          el.style[STYLE_PROP_MAP[key] || fn] = formatStyleValue(key, fn);
        }
      }
    }

    if (props.staticClass && Array.isArray(props.staticClass)) props.staticClass.forEach(cls => el.classList.add(cls));
    else if (typeof props.staticClass === 'string' && props.staticClass) props.staticClass.split(/\s+/).filter(Boolean).forEach(cls => el.classList.add(cls));

    if (props.dynamicClass) {
      const fn = props.dynamicClass;
      if (typeof fn === 'function') {
        const { value: clsResult, deps } = _reactive.track(fn);
        if (typeof clsResult === 'string' && clsResult) clsResult.split(/\s+/).filter(Boolean).forEach(cls => el.classList.add(cls));
        else if (typeof clsResult === 'object' && clsResult !== null) for (const [cls, flag] of Object.entries(clsResult)) { if (flag) el.classList.add(cls); }
        if (deps.size > 0) {
          _reactive.addCleanup(_reactive.subscribe(deps, () => {
            el.className = '';
            if (props.staticClass) { if (Array.isArray(props.staticClass)) props.staticClass.forEach(cls => el.classList.add(cls)); else props.staticClass.split(/\s+/).filter(Boolean).forEach(cls => el.classList.add(cls)); }
            const r = fn();
            if (typeof r === 'string' && r) r.split(/\s+/).filter(Boolean).forEach(cls => el.classList.add(cls));
            else if (typeof r === 'object' && r !== null) for (const [c, f] of Object.entries(r)) { if (f) el.classList.add(c); }
          }));
        }
      }
    }

    if (props.attrs) {
      for (const [key, val] of Object.entries(props.attrs)) {
        if (typeof val === 'function') {
          const { value: resolved, deps } = _reactive.track(val);
          _updateAttr(el, tag, key, resolved);
          if (deps.size > 0 && key !== 'ref') _reactive.addCleanup(_reactive.subscribe(deps, () => _updateAttr(el, tag, key, val())));
        } else {
          _updateAttr(el, tag, key, val);
        }
      }
    }

    function bindEvent(obj, eventKey, phase) {
      if (!obj) return;
      for (const [event, handler] of Object.entries(obj)) {
        if (typeof handler === 'function') {
          el.addEventListener(event, (e) => {
            if (phase === 'stop' || phase === 'captureStop') e.stopPropagation();
            handler.call(_lastViewModel ? _lastViewModel._data : {}, e);
          }, phase === 'capture' || phase === 'captureStop');
        }
      }
    }
    bindEvent(props.onBubbleEvents, null, null);
    bindEvent(props.on, null, null);
    bindEvent(props.catchBubbleEvents, null, 'stop');
    bindEvent(props.onCaptureEvents, null, 'capture');
    bindEvent(props.catchCaptureEvents, null, 'captureStop');

    const childContainer = tag === 'marquee' ? el._marqueeContent : el;
    if (Array.isArray(children)) {
      let lastSibling = null;
      children.forEach(child => {
        if (child === null || child === undefined) return;
        if (child && child._l) { child.mount(childContainer, lastSibling); if (child.state.nodes.length > 0) lastSibling = child.state.nodes[child.state.nodes.length - 1]; }
        else if (typeof child === 'string' || typeof child === 'number') { const t = document.createTextNode(String(child)); childContainer.appendChild(t); lastSibling = t; }
        else if (child instanceof Node) { childContainer.appendChild(child); lastSibling = child; }
      });
    }
    if (tag === 'marquee') _updateMarquee(el);
    return el;
  }

  function _i(condition, renderFn) {
    const getCondition = typeof condition === 'function' ? condition : () => condition;
    const { value: initialVal, deps } = _reactive.track(getCondition);
    const state = { nodes: [], parent: null, ref: null };

    function clearNodes() { for (const n of state.nodes) { if (n.parentNode) n.parentNode.removeChild(n); } state.nodes.length = 0; }
    function insertNodes() {
      if (!state.parent || state.nodes.length === 0) return;
      const frag = document.createDocumentFragment();
      state.nodes.forEach(n => frag.appendChild(n));
      if (state.ref && state.ref.parentNode === state.parent) state.parent.insertBefore(frag, state.ref.nextSibling);
      else state.parent.insertBefore(frag, state.parent.firstChild);
      if (state.nodes.length > 0) state.ref = state.nodes[state.nodes.length - 1];
    }
    function renderContent() {
      clearNodes();
      try { const node = renderFn(); if (node !== null && node !== undefined) { if (node instanceof Node) state.nodes.push(node); else if (typeof node === 'string' || typeof node === 'number') state.nodes.push(document.createTextNode(String(node))); } } catch (e) { console.error('[Sandbox] _i render error:', e); }
      insertNodes();
    }
    function mount(parent, ref) { state.parent = parent; state.ref = ref; if (state.nodes.length > 0) insertNodes(); }

    if (initialVal) renderContent();
    if (deps.size > 0) {
      let wasVisible = !!initialVal;
      _reactive.addCleanup(_reactive.subscribe(deps, () => { const v = !!getCondition(); if (v === wasVisible) return; wasVisible = v; if (v) renderContent(); else clearNodes(); }));
    }
    return { _l: true, state, mount };
  }

  const _itemKeys = new WeakMap();
  let _itemKeySeq = 0;
  const _proxyCache = new WeakMap();

  function _proxyItem(item) {
    if (item === null || typeof item !== 'object') return item;
    if (_proxyCache.has(item)) return _proxyCache.get(item);
    if (item.__itemKey) return item;
    if (!_itemKeys.has(item)) _itemKeys.set(item, '_i' + (_itemKeySeq++));
    const key = _itemKeys.get(item);
    const proxy = new Proxy(item, {
      set(target, prop, value) { if (prop === '__rp' || prop === '__itemKey') { target[prop] = value; return true; } const old = target[prop]; target[prop] = value; if (old !== value) _reactive.notify(key); return true; },
      get(target, prop) { if (prop === '__rp') return true; if (prop === '__itemKey') return key; _reactive.record(key); return target[prop]; }
    });
    _proxyCache.set(item, proxy);
    return proxy;
  }

  function _l(array, renderFn) {
    const getArray = typeof array === 'function' ? array : () => array;
    const { value: arr, deps } = _reactive.track(getArray);
    const state = { nodes: [], parent: null, ref: null, itemKeys: new Set() };

    function insertAfterRef(frag) {
      if (!state.parent) return;
      if (state.ref && state.ref.parentNode === state.parent) state.parent.insertBefore(frag, state.ref.nextSibling);
      else state.parent.insertBefore(frag, state.parent.firstChild);
    }
    function mount(parent, ref) { state.parent = parent; state.ref = ref; if (state.nodes.length > 0) { const frag = document.createDocumentFragment(); state.nodes.forEach(n => frag.appendChild(n)); insertAfterRef(frag); } }
    function clearNodes() { for (const n of state.nodes) { if (n.parentNode) n.parentNode.removeChild(n); } state.nodes.length = 0; }
    function renderItems(items) {
      for (const k of state.itemKeys) _reactive.removeKey(k);
      state.itemKeys.clear();
      clearNodes();
      if (!items || !Array.isArray(items)) return;
      const frag = document.createDocumentFragment();
      items.forEach((item, idx) => {
        try {
          const reactiveItem = (item !== null && typeof item === 'object') ? _proxyItem(item) : item;
          if (typeof reactiveItem === 'object' && reactiveItem !== null && reactiveItem.__itemKey) state.itemKeys.add(reactiveItem.__itemKey);
          const node = renderFn(reactiveItem, idx);
          if (node !== null && node !== undefined) {
            if (node instanceof Node) { frag.appendChild(node); state.nodes.push(node); }
            else if (typeof node === 'string' || typeof node === 'number') { const t = document.createTextNode(String(node)); frag.appendChild(t); state.nodes.push(t); }
          }
        } catch (e) { console.error('[Sandbox] _l item render error:', e); }
      });
      insertAfterRef(frag);
      if (state.nodes.length > 0) state.ref = state.nodes[state.nodes.length - 1];
    }
    renderItems(arr);
    if (deps.size > 0) _reactive.addCleanup(_reactive.subscribe(deps, () => renderItems(getArray())));
    return { _l: true, state, mount };
  }

  function _wrapReactive(obj, notifyKey) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj.__rp) return obj;
    if (obj.__rpProxy) return obj.__rpProxy;
    const proxy = new Proxy(obj, {
      get(target, prop) {
        if (prop === '__rp') return true;
        if (prop === '__rpProxy') return proxy;
        _reactive.record(notifyKey);
        const val = target[prop];
        if (Array.isArray(target) && typeof prop === 'string' && /^\d+$/.test(prop) && val !== null && typeof val === 'object') return _proxyItem(val);
        return val;
      },
      set(target, prop, value) {
        if (prop === '__rp' || prop === '__rpProxy') { Object.defineProperty(target, prop, { value, enumerable: false, configurable: true, writable: true }); return true; }
        target[prop] = value;
        _reactive.notify(notifyKey);
        return true;
      }
    });
    Object.defineProperty(obj, '__rpProxy', { value: proxy, enumerable: false, configurable: true, writable: true });
    return proxy;
  }

  function ViewModel(definition) {
    definition = definition || {};
    const data = definition.data || {};
    const renderFn = definition.render || null;
    const styleSheet = definition.styleSheet || null;

    function vm() { return vm; }
    vm._data = data;
    vm._renderFn = renderFn;
    vm._styleSheet = styleSheet;
    vm._onUpdate = null;
    vm.data = new Proxy(data, {
      get: (target, prop) => { _reactive.record(prop); const val = target[prop]; if (val !== null && typeof val === 'object' && !val.__rp) return _wrapReactive(val, prop); return val; },
      set: (target, prop, value) => { const old = target[prop]; if (value !== null && typeof value === 'object' && !value.__rp) value = _wrapReactive(value, prop); target[prop] = value; if (old !== value || Array.isArray(value)) _reactive.notify(prop); return true; }
    });
    data.data = vm.data;

    for (const [key, val] of Object.entries(definition)) {
      if (key !== 'data' && key !== 'render' && key !== 'styleSheet') {
        if (typeof val === 'function') { vm[key] = val.bind(vm.data); vm.data[key] = val.bind(vm.data); }
        else vm[key] = val;
      }
    }

    vm.render = function () {
      if (!vm._renderFn) return document.createElement('div');
      _lastViewModel = vm;
      try {
        const result = vm._renderFn.call(vm.data);
        if (result && result._l) { const frag = document.createDocumentFragment(); result.state.nodes.forEach(n => frag.appendChild(n)); return frag; }
        return result;
      } catch (e) { console.error('[ViewModel] render error:', e); return document.createElement('div'); }
    };

    vm.getStyleSheet = function () {
      if (!styleSheet) return '';
      let css = '';
      const classSelectors = styleSheet.classSelectors || {};
      for (const [cls, styles] of Object.entries(classSelectors)) {
        css += `.${cls} { `;
        for (const [prop, val] of Object.entries(styles)) {
          if (prop === 'boxShadow') { css += `box-shadow: ${buildBoxShadow(val)}; `; continue; }
          if (prop === 'boxShadowH' || prop === 'boxShadowV' || prop === 'boxShadowBlur' || prop === 'boxShadowSpread' || prop === 'boxShadowColor') continue;
          css += `${STYLE_PROP_MAP[prop] || prop}: ${formatStyleValue(prop, val)}; `;
        }
        css += '}\n';
      }
      const idSelectors = styleSheet.idSelectors || {};
      for (const [id, styles] of Object.entries(idSelectors)) {
        css += `#${id} { `;
        for (const [prop, val] of Object.entries(styles)) {
          if (prop === 'boxShadow') { css += `box-shadow: ${buildBoxShadow(val)}; `; continue; }
          if (prop === 'boxShadowH' || prop === 'boxShadowV' || prop === 'boxShadowBlur' || prop === 'boxShadowSpread' || prop === 'boxShadowColor') continue;
          css += `${STYLE_PROP_MAP[prop] || prop}: ${formatStyleValue(prop, val)}; `;
        }
        css += '}\n';
      }
      const keyframes = styleSheet['@keyframes'] || {};
      for (const [name, steps] of Object.entries(keyframes)) {
        css += `@keyframes ${name} { `;
        if (Array.isArray(steps)) {
          steps.forEach(step => {
            const time = step.time !== undefined ? step.time + '%' : '0%';
            css += `${time} { `;
            for (const [prop, val] of Object.entries(step)) {
              if (prop === 'time') continue;
              if (prop === 'boxShadow') { css += `box-shadow: ${buildBoxShadow(val)}; `; continue; }
              css += `${STYLE_PROP_MAP[prop] || prop}: ${formatStyleValue(prop, val)}; `;
            }
            css += '} ';
          });
        }
        css += '}\n';
      }
      return css;
    };

    _lastViewModel = vm;
    return vm;
  }

  function _trackSetTimeout(fn, ms) {
    const id = window.setTimeout(() => { _activeTimers.delete(id); if (_destroyed) return; fn(); }, ms);
    _activeTimers.add(id);
    return id;
  }
  function _trackSetInterval(fn, ms) {
    const id = window.setInterval(() => { if (_destroyed) return; fn(); }, ms);
    _activeTimers.add(id);
    return id;
  }
  function _trackClearTimeout(id) { window.clearTimeout(id); _activeTimers.delete(id); }
  function _trackClearInterval(id) { window.clearInterval(id); _activeTimers.delete(id); }

  function createContext(appData) {
    return {
      console: {
        log: (...args) => console.log('[App]', ...args),
        info: (...args) => console.log('[App:info]', ...args),
        warn: (...args) => console.warn('[App:warn]', ...args),
        error: (...args) => console.error('[App:error]', ...args),
      },
      requireNative: (moduleName) => {
        if (moduleName === 'system.configuration') return {};
        return ApiRegistry.resolve(moduleName);
      },
      FeatureAbility: ApiSimWearengine,
      _c: _c, _i: _i, _l: _l,
      ViewModel: ViewModel,
      setTimeout: _trackSetTimeout, setInterval: _trackSetInterval,
      clearTimeout: _trackClearTimeout, clearInterval: _trackClearInterval,
      Promise: window.Promise,
      Math: window.Math, Date: window.Date, JSON: window.JSON,
      parseInt: window.parseInt, parseFloat: window.parseFloat, isNaN: window.isNaN,
      encodeURI: window.encodeURI, encodeURIComponent: window.encodeURIComponent,
      decodeURI: window.decodeURI, decodeURIComponent: window.decodeURIComponent,
      String: window.String, Number: window.Number, Boolean: window.Boolean,
      Array: window.Array, Object: window.Object, RegExp: window.RegExp,
      Error: window.Error,
    };
  }

  function resolveImportPath(fromPath, importPath) {
    if (importPath.startsWith('@system.') || importPath.startsWith('system.')) return importPath;
    const fromParts = fromPath.split('/');
    fromParts.pop();
    for (const part of importPath.replace(/\.js$/, '').split('/')) {
      if (part === '..') fromParts.pop();
      else if (part !== '.') fromParts.push(part);
    }
    return fromParts.join('/');
  }

  function setGlobal(key, value) { window[key] = value; _globalKeys.push(key); }

  function setupGlobals(appData) {
    const ctx = createContext(appData);
    setGlobal('requireNative', ctx.requireNative);
    setGlobal('FeatureAbility', ApiSimWearengine);
    setGlobal('_c', ctx._c);
    setGlobal('_i', ctx._i);
    setGlobal('_l', ctx._l);
    setGlobal('ViewModel', ctx.ViewModel);
  }

  function arrayBufferToText(ab) { return new TextDecoder().decode(ab); }

  function executeModule(code, moduleKey, appData) {
    if (_moduleCache.has(moduleKey)) return _moduleCache.get(moduleKey);
    if (!code && appData.hapFiles) {
      for (const p of [moduleKey, 'assets/js/default/' + moduleKey, 'assets/js/' + moduleKey]) {
        const raw = appData.hapFiles[p];
        if (raw) { code = raw instanceof ArrayBuffer ? arrayBufferToText(raw) : raw; break; }
      }
    }
    if (!code) { console.error(`[Sandbox] Module not found: ${moduleKey}`); const f = {}; _moduleCache.set(moduleKey, f); return f; }

    let processedCode = code.replace(/\/\/# sourceMappingURL=.*$/gm, '');
    const isCompiledBundle = processedCode.trimStart().startsWith('(function(');

    if (!isCompiledBundle) {
      processedCode = processedCode.replace(
        /import\s+(\w+)\s+from\s+['"]([^'"]+)['"];/g,
        (_, v, p) => {
          if (p.startsWith('@system.') || p.startsWith('system.')) { const mod = p.startsWith('@') ? p.slice(1) : p; return `var ${v} = requireNative('${mod}');`; }
          return `var ${v} = __require('${p}');`;
        }
      );
      processedCode = processedCode.replace(/export\s+default\s+/, 'window.__esm_result = ');
    }

    try {
      setupGlobals(appData);
      if (!isCompiledBundle) setGlobal('__require', (importPath) => executeModule(null, resolveImportPath(moduleKey, importPath), appData));
      const result = new Function('return ' + processedCode)();
      const finalResult = result !== undefined ? result : window.__esm_result;
      delete window.__esm_result;
      _moduleCache.set(moduleKey, finalResult);
      return finalResult;
    } catch (e) {
      _lastError = e;
      console.error(`[Sandbox] Error in module ${moduleKey}:`, e);
      const fallback = {};
      _moduleCache.set(moduleKey, fallback);
      return fallback;
    }
  }

  function initApp(appJsCode, appData) {
    _moduleCache.clear();
    DeviceFeatureAppLifecycle.setAppData(appData);
    DeviceFeaturePageNav.setAppData(appData);
    _imports = {
      app: ApiSimApp, battery: ApiSimBattery, brightness: ApiSimBrightness,
      device: ApiSimDevice, file: ApiSimFile, storage: ApiSimStorage,
      vibrator: ApiSimVibrator, wearengine: ApiSimWearengine,
    };
    const result = executeModule(appJsCode, 'app', appData);
    _appExports = result;
    if (result) {
      const appObj = result.data || result;
      if (typeof appObj.setImports === 'function') appObj.setImports(_imports);
      setGlobal('$app', appObj);
      const _origGetImports = window.$app.getImports ? window.$app.getImports.bind(window.$app) : null;
      window.$app.getImports = function () {
        const base = _origGetImports ? _origGetImports() : {};
        base.app = _imports.app;
        return base;
      };
    }
    return result;
  }

  function initPage(pageCode, pagePath, appData) {
    _moduleCache.delete(pagePath);
    return executeModule(pageCode, pagePath, appData);
  }

  function setViewModelUpdateCallback(cb) { if (_lastViewModel) _lastViewModel._onUpdate = cb; }

  return {
    initApp, initPage, setOnAppTerminate, setImageSrcResolver,
    setViewModelUpdateCallback, cleanupReactive, destroy,
    getImports: () => _imports,
    getAppExports: () => _appExports,
    getLastViewModel: () => _lastViewModel,
    getLastError: () => _lastError,
  };
}

var Sandbox = createSandbox();
