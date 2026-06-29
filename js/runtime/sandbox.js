/**
 * JS Sandbox - Executes app JavaScript in an isolated context
 * Handles HarmonyOS compiled bundles with _c() virtual DOM and ViewModel
 */
const Sandbox = (() => {
  let _imports = {};
  let _appExports = null;
  let _moduleCache = new Map();
  let _onAppTerminate = null;
  let _lastViewModel = null;
  let _lastError = null;
  let _imageSrcResolver = null;

  // Reactive dependency tracking system
  const _reactive = {
    _currentDeps: null,
    _subscriptions: new Map(),
    _cleanupFns: [],

    track(fn) {
      this._currentDeps = new Set();
      let value;
      try {
        value = fn();
      } catch (e) {
        console.error('[Reactive] track error:', e);
      }
      const deps = this._currentDeps;
      this._currentDeps = null;
      return { value, deps };
    },

    record(key) {
      if (this._currentDeps) this._currentDeps.add(key);
    },

    subscribe(deps, callback) {
      const keys = [];
      for (const key of deps) {
        if (!this._subscriptions.has(key)) this._subscriptions.set(key, new Set());
        this._subscriptions.get(key).add(callback);
        keys.push(key);
      }
      return () => {
        for (const key of keys) {
          const subs = this._subscriptions.get(key);
          if (subs) subs.delete(callback);
        }
      };
    },

    notify(key) {
      const subs = this._subscriptions.get(key);
      if (subs) subs.forEach(cb => cb());
    },

    removeKey(key) {
      this._subscriptions.delete(key);
    },

    addCleanup(fn) {
      this._cleanupFns.push(fn);
    },

    cleanup() {
      this._cleanupFns.forEach(fn => fn());
      this._cleanupFns.length = 0;
      this._subscriptions.clear();
    }
  };

  function setOnAppTerminate(cb) { _onAppTerminate = cb; }

  function setImageSrcResolver(resolver) { _imageSrcResolver = resolver; }

  function _resolveImageSrc(src) {
    // Check if the src can be resolved to an image file from app modules
    // (handles both .bin from compiled apps and .png/.jpg/.bmp from unsigned apps)
    if (typeof src === 'string' && _imageSrcResolver) {
      return _imageSrcResolver(src);
    }
    return src;
  }

  function _updateAttr(el, tag, key, val) {
    if (key === 'ref') {
      el.setAttribute('data-ref', String(val));
    } else if (key === 'show') {
      el.style.display = val ? '' : 'none';
    } else if (tag === 'text' && key === 'value') {
      el.textContent = String(val);
    } else if (tag === 'image' && key === 'src') {
      el.setAttribute('src', _resolveImageSrc(String(val)));
    } else if (tag === 'swiper' && key === 'index') {
      el.setAttribute('index', String(val));
      const idx = parseInt(val, 10);
      if (!isNaN(idx)) {
        const isVertical = el.getAttribute('vertical') === 'true';
        requestAnimationFrame(() => {
          if (isVertical) {
            el.scrollTo({ top: idx * el.clientHeight, behavior: 'smooth' });
          } else {
            el.scrollTo({ left: idx * el.clientWidth, behavior: 'smooth' });
          }
        });
      }
    } else if (tag === 'progress') {
      if (key === 'type') {
        el.setAttribute('type', String(val));
      } else if (key === 'percent' || key === 'value') {
        el.setAttribute('value', String(val));
        el.setAttribute('max', '100');
      }
    } else if (tag === 'input') {
      if (key === 'type') {
        el.setAttribute('type', String(val));
      } else if (key === 'checked') {
        el.checked = !!val;
      } else {
        el.setAttribute(key, String(val));
      }
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
      if (match6) {
        return val;
      }
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
    const parts = val.map(p => {
      if (!p) return '';
      if (typeof p === 'object' && p.type) {
        if (p.type === 'Color') return formatColor(p.value);
        return p.value;
      }
      return p;
    }).filter(Boolean);
    return parts.join(' ');
  }

  function applyStyles(el, styles) {
    if (!styles) return;
    for (const [key, val] of Object.entries(styles)) {
      if (key === 'boxShadow') {
        el.style['box-shadow'] = buildBoxShadow(val);
        continue;
      }
      if (key === 'boxShadowH' || key === 'boxShadowV' || key === 'boxShadowBlur' || key === 'boxShadowSpread' || key === 'boxShadowColor') {
        continue;
      }
      const cssProp = STYLE_PROP_MAP[key] || key;
      el.style[cssProp] = formatStyleValue(key, val);
    }
  }

  /**
   * HarmonyOS _c() - virtual DOM createElement
   * _c(tag, props, children) → DOM Element
   */
  function _c(tag, props, children) {
    props = props || {};
    children = children || [];

    const htmlTag = tag === 'image' ? 'img' : tag;
    const el = document.createElement(htmlTag);
    if (tag === 'image') el.setAttribute('draggable', 'false');

    // Apply static inline styles
    if (props.staticStyle) applyStyles(el, props.staticStyle);

    // Apply dynamic styles with reactive tracking
    if (props.dynamicStyle) {
      for (const [key, fn] of Object.entries(props.dynamicStyle)) {
        if (typeof fn === 'function') {
          const { value: val, deps } = _reactive.track(fn);
          const cssProp = STYLE_PROP_MAP[key] || key;
          if (val !== undefined && val !== null) {
            el.style[cssProp] = formatStyleValue(key, val);
          } else {
            // Style function failed on first call (e.g. data not ready yet).
            // Schedule a deferred retry so it can pick up values that were set
            // outside of the ViewModel's reactive Proxy (e.g. uiSizes.init()).
            requestAnimationFrame(() => {
              try {
                const retryVal = fn();
                if (retryVal !== undefined && retryVal !== null) {
                  el.style[cssProp] = formatStyleValue(key, retryVal);
                }
              } catch (_) { }
            });
          }
          if (deps.size > 0) {
            const unsub = _reactive.subscribe(deps, () => {
              try {
                const newVal = fn();
                if (newVal !== undefined && newVal !== null) {
                  el.style[cssProp] = formatStyleValue(key, newVal);
                }
              } catch (e) {
                console.warn('[DynamicStyle] update error for', tag, key, e);
              }
            });
            _reactive.addCleanup(unsub);
          }
        } else {
          const cssProp = STYLE_PROP_MAP[key] || fn;
          el.style[cssProp] = formatStyleValue(key, fn);
        }
      }
    }

    // Apply static CSS classes
    if (props.staticClass && Array.isArray(props.staticClass)) {
      props.staticClass.forEach(cls => el.classList.add(cls));
    } else if (typeof props.staticClass === 'string' && props.staticClass) {
      props.staticClass.split(/\s+/).filter(Boolean).forEach(cls => el.classList.add(cls));
    }

    // Apply dynamic CSS classes with reactive tracking
    if (props.dynamicClass) {
      const fn = props.dynamicClass;
      if (typeof fn === 'function') {
        const { value: clsResult, deps } = _reactive.track(fn);
        if (typeof clsResult === 'string' && clsResult) {
          clsResult.split(/\s+/).filter(Boolean).forEach(cls => el.classList.add(cls));
        } else if (typeof clsResult === 'object' && clsResult !== null) {
          for (const [cls, flag] of Object.entries(clsResult)) {
            if (flag) el.classList.add(cls);
          }
        }
        if (deps.size > 0) {
          const unsub = _reactive.subscribe(deps, () => {
            const oldClasses = el.className;
            el.className = '';
            if (props.staticClass) {
              if (Array.isArray(props.staticClass)) {
                props.staticClass.forEach(cls => el.classList.add(cls));
              } else {
                props.staticClass.split(/\s+/).filter(Boolean).forEach(cls => el.classList.add(cls));
              }
            }
            const newResult = fn();
            if (typeof newResult === 'string' && newResult) {
              newResult.split(/\s+/).filter(Boolean).forEach(cls => el.classList.add(cls));
            } else if (typeof newResult === 'object' && newResult !== null) {
              for (const [cls, flag] of Object.entries(newResult)) {
                if (flag) el.classList.add(cls);
              }
            }
          });
          _reactive.addCleanup(unsub);
        }
      } else {
        if (typeof clsResult === 'string' && clsResult) {
          clsResult.split(/\s+/).filter(Boolean).forEach(cls => el.classList.add(cls));
        } else if (typeof clsResult === 'object' && clsResult !== null) {
          for (const [cls, flag] of Object.entries(clsResult)) {
            if (flag) el.classList.add(cls);
          }
        }
      }
    }

    // Apply attributes with reactive tracking
    if (props.attrs) {
      for (const [key, val] of Object.entries(props.attrs)) {
        if (typeof val === 'function') {
          const { value: resolved, deps } = _reactive.track(val);
          _updateAttr(el, tag, key, resolved);
          if (deps.size > 0 && key !== 'ref') {
            const unsub = _reactive.subscribe(deps, () => {
              const newVal = val();
              _updateAttr(el, tag, key, newVal);
            });
            _reactive.addCleanup(unsub);
          }
        } else {
          _updateAttr(el, tag, key, val);
        }
      }
    }

    // Apply events from onBubbleEvents
    if (props.onBubbleEvents) {
      for (const [event, handler] of Object.entries(props.onBubbleEvents)) {
        if (typeof handler === 'function') {
          el.addEventListener(event, (e) => {
            handler.call(_lastViewModel ? _lastViewModel._data : {}, e);
          });
        }
      }
    }

    // Apply events from on:{event} attributes
    if (props.on) {
      for (const [event, handler] of Object.entries(props.on)) {
        if (typeof handler === 'function') {
          el.addEventListener(event, (e) => {
            handler.call(_lastViewModel ? _lastViewModel._data : {}, e);
          });
        }
      }
    }

    // catchBubbleEvents - stopPropagation
    if (props.catchBubbleEvents) {
      for (const [event, handler] of Object.entries(props.catchBubbleEvents)) {
        if (typeof handler === 'function') {
          el.addEventListener(event, (e) => {
            e.stopPropagation();
            handler.call(_lastViewModel ? _lastViewModel._data : {}, e);
          });
        }
      }
    }

    // onCaptureEvents - capture phase
    if (props.onCaptureEvents) {
      for (const [event, handler] of Object.entries(props.onCaptureEvents)) {
        if (typeof handler === 'function') {
          el.addEventListener(event, (e) => {
            handler.call(_lastViewModel ? _lastViewModel._data : {}, e);
          }, true);
        }
      }
    }

    // catchCaptureEvents - capture phase + stopPropagation
    if (props.catchCaptureEvents) {
      for (const [event, handler] of Object.entries(props.catchCaptureEvents)) {
        if (typeof handler === 'function') {
          el.addEventListener(event, (e) => {
            e.stopPropagation();
            handler.call(_lastViewModel ? _lastViewModel._data : {}, e);
          }, true);
        }
      }
    }

    // Append children
    if (Array.isArray(children)) {
      let lastSibling = null;
      children.forEach(child => {
        if (child === null || child === undefined) return;
        if (child && child._l) {
          child.mount(el, lastSibling);
          if (child.state.nodes.length > 0) {
            lastSibling = child.state.nodes[child.state.nodes.length - 1];
          }
        } else if (typeof child === 'string' || typeof child === 'number') {
          const t = document.createTextNode(String(child));
          el.appendChild(t);
          lastSibling = t;
        } else if (child instanceof Node) {
          el.appendChild(child);
          lastSibling = child;
        }
      });
    }

    return el;
  }

  /**
   * _i(condition, renderFn) - Conditional rendering (if/elif/else/show)
   * ace-loader compiles if/elif/else/show to _i() calls
   * Now supports reactive re-rendering when condition dependencies change.
   */
  function _i(condition, renderFn) {
    const getCondition = typeof condition === 'function' ? condition : () => condition;

    const { value: initialVal, deps } = _reactive.track(getCondition);

    const state = { nodes: [], parent: null, ref: null };

    function clearNodes() {
      for (const n of state.nodes) {
        if (n.parentNode) n.parentNode.removeChild(n);
      }
      state.nodes.length = 0;
    }

    function renderContent() {
      clearNodes();
      try {
        const node = renderFn();
        if (node !== null && node !== undefined) {
          if (node instanceof Node) {
            state.nodes.push(node);
          } else if (typeof node === 'string' || typeof node === 'number') {
            state.nodes.push(document.createTextNode(String(node)));
          }
        }
      } catch (e) {
        console.error('[Sandbox] _i render error:', e);
      }
      insertNodes();
    }

    function insertNodes() {
      if (!state.parent || state.nodes.length === 0) return;
      const frag = document.createDocumentFragment();
      state.nodes.forEach(n => frag.appendChild(n));
      if (state.ref && state.ref.parentNode === state.parent) {
        state.parent.insertBefore(frag, state.ref.nextSibling);
      } else {
        state.parent.insertBefore(frag, state.parent.firstChild);
      }
      if (state.nodes.length > 0) {
        state.ref = state.nodes[state.nodes.length - 1];
      }
    }

    function mount(parent, ref) {
      state.parent = parent;
      state.ref = ref;
      if (state.nodes.length > 0) {
        insertNodes();
      }
    }

    if (initialVal) {
      renderContent();
    }

    if (deps.size > 0) {
      let wasVisible = !!initialVal;
      const unsub = _reactive.subscribe(deps, () => {
        const newVal = !!getCondition();
        if (newVal === wasVisible) return;
        wasVisible = newVal;
        if (newVal) {
          renderContent();
        } else {
          clearNodes();
        }
      });
      _reactive.addCleanup(unsub);
    }

    return { _l: true, state, mount };
  }

  /**
   * Proxy an object so that property access/set goes through _reactive.
   * Used by _l to detect item-level changes inside for loops.
   */
  const _itemKeys = new WeakMap();
  let _itemKeySeq = 0;
  const _proxyCache = new WeakMap();

  function _proxyItem(item, onMutate) {
    if (item === null || typeof item !== 'object') return item;
    if (_proxyCache.has(item)) return _proxyCache.get(item);
    if (item.__itemKey) return item;

    if (!_itemKeys.has(item)) _itemKeys.set(item, '_i' + (_itemKeySeq++));
    const key = _itemKeys.get(item);

    const proxy = new Proxy(item, {
      set(target, prop, value) {
        if (prop === '__rp' || prop === '__itemKey') { target[prop] = value; return true; }
        const old = target[prop];
        target[prop] = value;
        if (old !== value) _reactive.notify(key);
        return true;
      },
      get(target, prop) {
        if (prop === '__rp') return true;
        if (prop === '__itemKey') return key;
        _reactive.record(key);
        return target[prop];
      }
    });

    _proxyCache.set(item, proxy);
    return proxy;
  }

  /**
   * _l(array, renderFn) - List rendering (for) with reactive updates
   * ace-loader compiles for="{{list}}" to _l(list, function(item, idx){ return _c(...) })
   *
   * Reactively re-renders when:
   *   - The array reference changes (tracked via reactive deps on the getter)
   *   - An item's property is reassigned (detected via shallow proxy on each item)
   *
   * Nodes are inserted directly into the parent without any wrapper element.
   * The parent and insertion reference are set later by _c when this result
   * is appended as a child.
   */
  function _l(array, renderFn) {
    const getArray = typeof array === 'function' ? array : () => array;

    const { value: arr, deps } = _reactive.track(getArray);

    const state = { nodes: [], parent: null, ref: null, itemKeys: new Set() };

    function insertAfterRef(frag) {
      if (!state.parent) return;
      if (state.ref && state.ref.parentNode === state.parent) {
        state.parent.insertBefore(frag, state.ref.nextSibling);
      } else {
        state.parent.insertBefore(frag, state.parent.firstChild);
      }
    }

    function mount(parent, ref) {
      state.parent = parent;
      state.ref = ref;
      if (state.nodes.length > 0) {
        const frag = document.createDocumentFragment();
        state.nodes.forEach(n => frag.appendChild(n));
        insertAfterRef(frag);
      }
    }

    function clearNodes() {
      for (const n of state.nodes) {
        if (n.parentNode) n.parentNode.removeChild(n);
      }
      state.nodes.length = 0;
    }

    function renderItems(items) {
      for (const k of state.itemKeys) _reactive.removeKey(k);
      state.itemKeys.clear();

      clearNodes();
      if (!items || !Array.isArray(items)) return;

      const frag = document.createDocumentFragment();
      items.forEach((item, idx) => {
        try {
          const reactiveItem = (item !== null && typeof item === 'object')
            ? _proxyItem(item)
            : item;
          if (typeof reactiveItem === 'object' && reactiveItem !== null && reactiveItem.__itemKey) {
            state.itemKeys.add(reactiveItem.__itemKey);
          }
          const node = renderFn(reactiveItem, idx);
          if (node !== null && node !== undefined) {
            if (node instanceof Node) {
              frag.appendChild(node);
              state.nodes.push(node);
            } else if (typeof node === 'string' || typeof node === 'number') {
              const textNode = document.createTextNode(String(node));
              frag.appendChild(textNode);
              state.nodes.push(textNode);
            }
          }
        } catch (e) {
          console.error('[Sandbox] _l item render error:', e);
        }
      });

      insertAfterRef(frag);
      if (state.nodes.length > 0) {
        state.ref = state.nodes[state.nodes.length - 1];
      }
    }

    renderItems(arr);

    if (deps.size > 0) {
      const unsub = _reactive.subscribe(deps, () => renderItems(getArray()));
      _reactive.addCleanup(unsub);
    }

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
        if (Array.isArray(target) && typeof prop === 'string' && /^\d+$/.test(prop) && val !== null && typeof val === 'object') {
          return _proxyItem(val);
        }
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

  /**
   * ViewModel - wraps HarmonyOS component definitions
   * Returns a callable function with all component properties attached
   */
  function ViewModel(definition) {
    definition = definition || {};
    const data = definition.data || {};
    const renderFn = definition.render || null;
    const styleSheet = definition.styleSheet || null;

    // The callable "instance" — HarmonyOS IIFE does `return r()` on the ViewModel result
    function vm() { return vm; }
    vm._data = data;
    vm._renderFn = renderFn;
    vm._styleSheet = styleSheet;
    vm._onUpdate = null;
    vm.data = new Proxy(data, {
      get: (target, prop) => {
        _reactive.record(prop);
        const val = target[prop];
        if (val !== null && typeof val === 'object' && !val.__rp) {
          return _wrapReactive(val, prop);
        }
        return val;
      },
      set: (target, prop, value) => {
        const old = target[prop];
        if (value !== null && typeof value === 'object' && !value.__rp) {
          value = _wrapReactive(value, prop);
        }
        target[prop] = value;
        if (old !== value || Array.isArray(value)) {
          _reactive.notify(prop);
        }
        return true;
      }
    });
    data.data = vm.data;

    // Copy all methods and non-data properties
    for (const [key, val] of Object.entries(definition)) {
      if (key !== 'data' && key !== 'render' && key !== 'styleSheet') {
        if (typeof val === 'function') {
          vm[key] = val.bind(vm.data);
          vm.data[key] = val.bind(vm.data);
        } else {
          vm[key] = val;
        }
      }
    }

    vm.render = function () {
      if (!vm._renderFn) return document.createElement('div');
      _lastViewModel = vm;
      try {
        const result = vm._renderFn.call(vm.data);
        if (result && result._l) {
          const frag = document.createDocumentFragment();
          result.state.nodes.forEach(n => frag.appendChild(n));
          return frag;
        }
        return result;
      } catch (e) {
        console.error('[ViewModel] render error:', e);
        return document.createElement('div');
      }
    };

    vm.getStyleSheet = function () {
      if (!styleSheet) return '';
      let css = '';

      const classSelectors = styleSheet.classSelectors || {};
      for (const [cls, styles] of Object.entries(classSelectors)) {
        css += `.${cls} { `;
        for (const [prop, val] of Object.entries(styles)) {
          if (prop === 'boxShadow') {
            css += `box-shadow: ${buildBoxShadow(val)}; `;
            continue;
          }
          if (prop === 'boxShadowH' || prop === 'boxShadowV' || prop === 'boxShadowBlur' || prop === 'boxShadowSpread' || prop === 'boxShadowColor') continue;
          const cssProp = STYLE_PROP_MAP[prop] || prop;
          css += `${cssProp}: ${formatStyleValue(prop, val)}; `;
        }
        css += '}\n';
      }

      const idSelectors = styleSheet.idSelectors || {};
      for (const [id, styles] of Object.entries(idSelectors)) {
        css += `#${id} { `;
        for (const [prop, val] of Object.entries(styles)) {
          if (prop === 'boxShadow') {
            css += `box-shadow: ${buildBoxShadow(val)}; `;
            continue;
          }
          if (prop === 'boxShadowH' || prop === 'boxShadowV' || prop === 'boxShadowBlur' || prop === 'boxShadowSpread' || prop === 'boxShadowColor') continue;
          const cssProp = STYLE_PROP_MAP[prop] || prop;
          css += `${cssProp}: ${formatStyleValue(prop, val)}; `;
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
              if (prop === 'boxShadow') {
                css += `box-shadow: ${buildBoxShadow(val)}; `;
                continue;
              }
              const cssProp = STYLE_PROP_MAP[prop] || prop;
              css += `${cssProp}: ${formatStyleValue(prop, val)}; `;
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

  function createContext(appData) {
    const ctx = {
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
      _c: _c,
      _i: _i,
      _l: _l,
      ViewModel: ViewModel,
      setTimeout: window.setTimeout.bind(window),
      setInterval: window.setInterval.bind(window),
      clearTimeout: window.clearTimeout.bind(window),
      clearInterval: window.clearInterval.bind(window),
      Promise: window.Promise,
      Math: window.Math, Date: window.Date, JSON: window.JSON,
      parseInt: window.parseInt, parseFloat: window.parseFloat, isNaN: window.isNaN,
      encodeURI: window.encodeURI,
      encodeURIComponent: window.encodeURIComponent,
      decodeURI: window.decodeURI,
      decodeURIComponent: window.decodeURIComponent,
      String: window.String, Number: window.Number, Boolean: window.Boolean,
      Array: window.Array, Object: window.Object, RegExp: window.RegExp,
      Error: window.Error,
    };
    return ctx;
  }

  function resolveImportPath(fromPath, importPath) {
    const fromParts = fromPath.split('/');
    fromParts.pop();
    for (const part of importPath.replace(/\.js$/, '').split('/')) {
      if (part === '..') fromParts.pop();
      else if (part !== '.') fromParts.push(part);
    }
    return fromParts.join('/');
  }

  const _globalKeys = [];

  function setGlobal(key, value) {
    window[key] = value;
    _globalKeys.push(key);
  }

  function setupGlobals(appData) {
    const ctx = createContext(appData);
    setGlobal('requireNative', ctx.requireNative);
    setGlobal('FeatureAbility', ApiSimWearengine);
    setGlobal('_c', ctx._c);
    setGlobal('_i', ctx._i);
    setGlobal('_l', ctx._l);
    setGlobal('ViewModel', ctx.ViewModel);
  }

  function cleanupGlobals() {
    for (const key of _globalKeys) {
      try { delete window[key]; } catch (_) { }
    }
    _globalKeys.length = 0;
  }

  function executeModule(code, moduleKey, appData) {
    if (_moduleCache.has(moduleKey)) return _moduleCache.get(moduleKey);

    let processedCode = code;
    processedCode = processedCode.replace(/\/\/# sourceMappingURL=.*$/gm, '');

    const isCompiledBundle = processedCode.trimStart().startsWith('(function(');

    if (!isCompiledBundle) {
      processedCode = processedCode.replace(
        /import\s+(\w+)\s+from\s+['"]([^'"]+)['"];/g,
        (_, v, p) => {
          if (p.startsWith('@system.') || p.startsWith('system.')) {
            const mod = p.startsWith('@') ? p.slice(1) : p;
            return `var ${v} = requireNative('${mod}');`;
          }
          return `var ${v} = __require('${p}');`;
        }
      );
      processedCode = processedCode.replace(
        /export\s+default\s+/,
        'window.__esm_result = '
      );
    }

    try {
      setupGlobals(appData);

      if (!isCompiledBundle) {
        setGlobal('__require', (importPath) => {
          const resolvedKey = resolveImportPath(moduleKey, importPath);
          return executeModule(null, resolvedKey, appData);
        });
      }

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
      app: ApiSimApp,
      battery: ApiSimBattery,
      brightness: ApiSimBrightness,
      device: ApiSimDevice,
      file: ApiSimFile,
      storage: ApiSimStorage,
      vibrator: ApiSimVibrator,
      wearengine: ApiSimWearengine,
    };
    const result = executeModule(appJsCode, 'app', appData);
    _appExports = result;
    if (result) {
      const appObj = result.data || result;
      if (typeof appObj.setImports === 'function') {
        appObj.setImports(_imports);
      }
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

  function getImports() { return _imports; }
  function getAppExports() { return _appExports; }
  function getLastViewModel() { return _lastViewModel; }

  function setViewModelUpdateCallback(cb) {
    if (_lastViewModel) _lastViewModel._onUpdate = cb;
  }

  function cleanupReactive() {
    _reactive.cleanup();
  }

  function reset() {
    _imports = {};
    _appExports = null;
    _moduleCache.clear();
    _onAppTerminate = null;
    _lastViewModel = null;
    _lastError = null;
    _imageSrcResolver = null;
    cleanupReactive();
  }

  return { initApp, initPage, getImports, getAppExports, setOnAppTerminate, setImageSrcResolver, getLastViewModel, setViewModelUpdateCallback, cleanupReactive, reset, getLastError: () => _lastError };
})();
