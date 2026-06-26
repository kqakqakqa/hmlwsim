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

    // Build full HTML
    const fullHTML = `
      <style>${baseStyles}</style>
      <style>${processedCSS}</style>
      <div class="page-container">${html}</div>
    `;

    // Inject into shadow DOM (isolated from simulator styles)
    _shadowRoot.innerHTML = fullHTML;

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
   */
  function renderViewModel(viewModel) {
    _currentPage = null;
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
      console.error('[WatchRenderer] ViewModel render error:', e);
      rootEl = document.createElement('div');
    }

    // Build full HTML with styles
    _shadowRoot.innerHTML = `
      <style>${baseStyles}</style>
      <style>${vmStyles}</style>
      <div class="page-container"></div>
    `;

    const container = _shadowRoot.querySelector('.page-container');
    if (container && rootEl) {
      container.appendChild(rootEl);
    }

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
      container.innerHTML = html;
      bindEvents();
      bindRefs();
    }
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
      _shadowRoot.innerHTML = '';
    }
    _currentPage = null;
    _pageData = {};
    _refs = {};
    _eventHandlers = {};
    _rotationHandlers = [];
  }

  return {
    init, configure, renderPage, renderViewModel, updateData, registerHandler, getRef,
    onRotation, triggerRotation, clear,
  };
})();
