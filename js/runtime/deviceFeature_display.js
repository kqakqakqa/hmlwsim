/**
 * Device Feature: Display
 * Manages watch display rendering (shape, resolution, brightness).
 * Renders compiled HarmonyOS ViewModel into Shadow DOM.
 * Migrated from watch-renderer.js — display is a device feature.
 */
const DeviceFeatureDisplay = (() => {
  let _watchFrame = null;
  let _watchContent = null;
  let _shadowRoot = null;
  let _cssRules = [];
  let _pageData = {};
  let _refs = {};
  let _eventHandlers = {};
  let _rotationHandlers = [];
  let _swipeHandlers = [];
  let _imageSrcResolver = null;

  // Device info state
  let _windowWidth = 466;
  let _windowHeight = 466;
  let _screenShape = 'circle';
  let _brightnessMode = 1;

  function init() {
    _watchFrame = document.getElementById('watch-frame');
    _watchContent = document.getElementById('watch-content');
    _shadowRoot = _watchContent.attachShadow({ mode: 'open' });
  }

  /**
   * Configure watch display dimensions and shape
   */
  function configure(width, height, isCircle) {
    _windowWidth = width;
    _windowHeight = height;
    _screenShape = isCircle ? 'circle' : 'rect';
    if (!_watchFrame) return;
    _watchFrame.style.width = width + 'px';
    _watchFrame.style.height = height + 'px';
    _watchFrame.className = isCircle ? 'circle' : 'rect';
  }

  /**
   * Get device info (for apiSim_device)
   */
  function getDeviceInfo() {
    const lang = navigator.language;
    const parts = lang.split('-');
    return {
      brand: 'kqakqakqa',
      manufacturer: 'kqakqakqa',
      model: 'hmlwsim',
      product: 'hmlwsim',
      language: parts[0],
      region: parts[1],
      windowWidth: _windowWidth,
      windowHeight: _windowHeight,
      screenShape: _screenShape,
      screenDensity: Math.round((window.devicePixelRatio || 1) * 96),
      apiVersion: Infinity,
      deviceType: 'liteWearable',
    };
  }

  /**
   * Brightness management (for apiSim_brightness)
   */
  function getBrightnessMode() {
    return _brightnessMode;
  }

  function setBrightnessMode(mode) {
    _brightnessMode = mode;
  }

  /**
   * Render from a compiled ViewModel: inject DOM tree + stylesheet
   * @param {Object} viewModel - The ViewModel instance
   * @param {string} extraCss - Optional extra CSS content from separate .css files
   */
  function renderViewModel(viewModel, extraCss) {
    _pageData = viewModel._data || {};
    _refs = {};
    _eventHandlers = {};

    const baseStyles = CSSAdapter.getWatchBaseStyles();
    const vmStyles = viewModel.getStyleSheet ? viewModel.getStyleSheet() : '';

    // Render the DOM tree
    let rootEl;
    try {
      rootEl = viewModel.render();
    } catch (e) {
      console.error('[DeviceFeatureDisplay] ViewModel render error:', e);
      rootEl = document.createElement('div');
    }

    // Build off-DOM then swap atomically to avoid flash
    const frag = document.createDocumentFragment();
    const s1 = document.createElement('style');
    s1.textContent = baseStyles;
    frag.appendChild(s1);
    const s2 = document.createElement('style');
    s2.textContent = vmStyles;
    frag.appendChild(s2);
    if (extraCss) {
      const s3 = document.createElement('style');
      s3.textContent = extraCss;
      frag.appendChild(s3);
    }
    const container = document.createElement('div');
    container.className = 'page-container';
    frag.appendChild(container);

    // Atomic swap
    while (_shadowRoot.firstChild) _shadowRoot.removeChild(_shadowRoot.firstChild);
    _shadowRoot.appendChild(frag);
    if (container && rootEl) {
      container.appendChild(rootEl);
    }

    _fixImageSources();
    _fixSwiperIndex();

    // Bind refs and sync to ViewModel data
    bindRefs();
    if (viewModel._data) {
      viewModel._data.$refs = _refs;
    }
  }

  /**
   * Set a function to resolve image src paths (e.g., .bin → .png/.jpg/.bmp)
   */
  function setImageSrcResolver(resolver) {
    _imageSrcResolver = resolver;
  }

  /**
   * Fix all <img> src attributes in the shadow DOM, resolving .bin to image files
   */
  function _fixImageSources() {
    if (!_imageSrcResolver) return;
    const imgs = _shadowRoot.querySelectorAll('img');
    imgs.forEach(img => {
      const src = img.getAttribute('src');
      if (src) {
        const resolved = _imageSrcResolver(src);
        if (resolved !== src) {
          img.setAttribute('src', resolved);
        }
      }
    });
  }

  function _fixSwiperIndex() {
    const swipers = _shadowRoot.querySelectorAll('swiper');
    swipers.forEach(sw => {
      const idx = parseInt(sw.getAttribute('index'), 10);
      if (!isNaN(idx) && idx > 0) {
        const isVertical = sw.getAttribute('vertical') === 'true';
        requestAnimationFrame(() => {
          if (isVertical) {
            sw.scrollTo({ top: idx * sw.clientHeight, behavior: 'auto' });
          } else {
            sw.scrollTo({ left: idx * sw.clientWidth, behavior: 'auto' });
          }
        });
      }
    });
  }

  /**
   * Bind click/touch events from HML on:click attributes
   */
  function bindEvents() {
    const elements = _shadowRoot.querySelectorAll('[data-event-click]');
    elements.forEach(el => {
      const handlerName = el.getAttribute('data-event-click');
      el.style.cursor = 'pointer';
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (_eventHandlers[handlerName]) {
          _eventHandlers[handlerName](e);
        }
      });
    });
  }

  /**
   * Bind ref elements for direct DOM access
   */
  function bindRefs() {
    const refElements = _shadowRoot.querySelectorAll('[data-ref]');
    refElements.forEach(el => {
      const refName = el.getAttribute('data-ref');
      _refs[refName] = el;

      // Add rotation support for list and slider refs
      if (el.tagName === 'LIST' || el.tagName === 'SLIDER') {
        el.rotation = (opts) => {
          el._rotationFocused = !!opts.focus;
        };
      }
    });
  }

  /**
   * Register event handler for the current page
   */
  function registerHandler(name, fn) {
    _eventHandlers[name] = fn;
  }

  /**
   * Get ref element
   */
  function getRef(name) {
    return _refs[name] || null;
  }

  /**
   * Register rotation handler
   */
  function onRotation(handler) {
    _rotationHandlers.push(handler);
    return () => {
      _rotationHandlers = _rotationHandlers.filter(h => h !== handler);
    };
  }

  /**
   * Trigger rotation event
   */
  function triggerRotation(delta) {
    _rotationHandlers.forEach(h => h(delta));
  }

  /**
   * Clear the watch display
   */
  function clear() {
    Sandbox.cleanupReactive();
    if (_shadowRoot) {
      while (_shadowRoot.firstChild) _shadowRoot.removeChild(_shadowRoot.firstChild);
    }
    _pageData = {};
    _refs = {};
    _eventHandlers = {};
    _rotationHandlers = [];
  }

  return {
    init, configure, renderViewModel, registerHandler, getRef,
    onRotation, triggerRotation, clear, setImageSrcResolver,
    getDeviceInfo, getBrightnessMode, setBrightnessMode,
  };
})();
