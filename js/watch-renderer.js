/**
 * Watch Renderer - Renders compiled HTML+CSS into the watch viewport
 */
const WatchRenderer = (() => {
  let _watchFrame = null;
  let _watchContent = null;
  let _shadowRoot = null;
  let _cssRules = [];
  let _currentPage = null;
  let _pageData = {};
  let _refs = {};
  let _eventHandlers = {};
  let _rotationHandlers = [];
  let _swipeHandlers = [];
  let _imageSrcResolver = null;

  function init() {
    _watchFrame = document.getElementById('watch-frame');
    _watchContent = document.getElementById('watch-content');
    _shadowRoot = _watchContent.attachShadow({ mode: 'open' });
  }

  /**
   * Configure watch display
   */
  function configure(width, height, isCircle) {
    if (!_watchFrame) return;
    _watchFrame.style.width = width + 'px';
    _watchFrame.style.height = height + 'px';
    _watchFrame.className = isCircle ? 'circle' : 'rect';
  }

  /**
   * Render a page: compile HML, inject CSS, bind events
   */
  function renderPage(pageConfig, pageData, cssContent, appModules) {
    _currentPage = pageConfig;
    _pageData = pageData || {};
    _refs = {};
    _eventHandlers = {};

    // Compile HML to HTML
    const html = HMLCompiler.compile(pageConfig.hml, _pageData, pageConfig.path);

    // Process CSS
    const baseStyles = CSSAdapter.getWatchBaseStyles();
    const processedCSS = CSSAdapter.process(cssContent || '');

    // Build off-DOM then swap atomically to avoid flash
    const frag = document.createDocumentFragment();
    const s1 = document.createElement('style');
    s1.textContent = baseStyles;
    frag.appendChild(s1);
    const s2 = document.createElement('style');
    s2.textContent = processedCSS;
    frag.appendChild(s2);
    const container = document.createElement('div');
    container.className = 'page-container';
    container.innerHTML = html;
    frag.appendChild(container);

    // Atomic swap: clear + append in one frame
    while (_shadowRoot.firstChild) _shadowRoot.removeChild(_shadowRoot.firstChild);
    _shadowRoot.appendChild(frag);

    // Fix image src: resolve .bin to .png/.jpg/.bmp if available
    _fixImageSources();
    _fixSwiperIndex();

    // Bind events
    bindEvents();

    // Bind refs
    bindRefs();
    if (pageData) {
      pageData.$refs = _refs;
    }
  }

  /**
   * Render from a compiled ViewModel: inject DOM tree + stylesheet
   * @param {Object} viewModel - The ViewModel instance
   * @param {string} extraCss - Optional extra CSS content from separate .css files
   */
  function renderViewModel(viewModel, extraCss) {
    _currentPage = null;
    _pageData = viewModel._data || {};
    _refs = {};
    _eventHandlers = {};

    const baseStyles = CSSAdapter.getWatchBaseStyles();
    const vmStyles = viewModel.getStyleSheet ? viewModel.getStyleSheet() : '';
    // Process extra CSS through the CSSAdapter to normalize OHOS quirks
    const processedExtra = extraCss ? CSSAdapter.process(extraCss) : '';

    // Render the DOM tree
    let rootEl;
    try {
      rootEl = viewModel.render();
    } catch (e) {
      console.error('[WatchRenderer] ViewModel render error:', e);
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
    if (processedExtra) {
      const s3 = document.createElement('style');
      s3.textContent = processedExtra;
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
   * Update data bindings (re-render with new data)
   */
  function updateData(newData) {
    if (!_currentPage) return;
    Object.assign(_pageData, newData);

    const html = HMLCompiler.compile(_currentPage.hml, _pageData, _currentPage.path);
    const container = _shadowRoot.querySelector('.page-container');
    if (container) {
      // Use replaceChildren for atomic swap to avoid flash
      const temp = document.createElement('div');
      temp.innerHTML = html;
      while (container.firstChild) container.removeChild(container.firstChild);
      while (temp.firstChild) container.appendChild(temp.firstChild);
      _fixImageSources();
      bindEvents();
      bindRefs();
    }
  }

  /**
   * Set a function to resolve image src paths (e.g., .bin → .png/.jpg/.bmp)
   * @param {Function} resolver - Function that takes a src string and returns a resolved src
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
        requestAnimationFrame(() => {
          sw.scrollTo({ left: idx * sw.clientWidth, behavior: 'auto' });
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

      // Add rotation support for list refs
      if (el.tagName === 'LIST') {
        el.rotation = (opts) => {
          if (opts.focus) {
            _refs[refName]._rotationFocused = true;
          } else {
            _refs[refName]._rotationFocused = false;
          }
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
    _currentPage = null;
    _pageData = {};
    _refs = {};
    _eventHandlers = {};
    _rotationHandlers = [];
  }

  return {
    init, configure, renderPage, renderViewModel, updateData, registerHandler, getRef,
    onRotation, triggerRotation, clear, setImageSrcResolver,
  };
})();
