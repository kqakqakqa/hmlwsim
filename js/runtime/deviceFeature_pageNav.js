/**
 * Device Feature: Page Navigation
 * Manages the page stack, navigation, and page lifecycle.
 * Extracted from app.js navigateTo/destroyCurrentPage logic.
 */
const DeviceFeaturePageNav = (() => {
  let _currentPage = null;
  let _pageHistory = [];
  let _navigateCallback = null; // Called by apiSim_router to trigger navigation
  let _appData = null;

  /**
   * Set app data reference (needed for module resolution)
   */
  function setAppData(appData) {
    _appData = appData;
  }

  /**
   * Register a callback that apiSim_router calls to trigger navigation
   * @param {Function} callback - Called with {uri, params} or null (for back)
   */
  function onNavigate(callback) {
    _navigateCallback = callback;
  }

  /**
   * Get the registered navigate callback (for wiring up from App)
   */
  function getNavigateCallback() {
    return _navigateCallback;
  }

  /**
   * Get current page info
   */
  function getCurrentPage() {
    return _currentPage;
  }

  /**
   * Destroy current page: call onHide → onDestroy, cleanup reactive
   */
  function destroyCurrentPage() {
    if (!_currentPage) return;
    const { exports: pageExports, data: pageData } = _currentPage;

    if (pageExports && pageExports.onHide) {
      try { pageExports.onHide.call(pageData); } catch (e) { console.error('[PageNav] onHide error:', e); }
    }
    if (pageExports && pageExports.onDestroy) {
      try { pageExports.onDestroy.call(pageData); } catch (e) { console.error('[PageNav] onDestroy error:', e); }
    }

    Sandbox.cleanupReactive();
    _currentPage = null;
  }

  /**
   * Resolve a relative import path from a base path
   */
  function resolveRelativePath(basePath, relativePath) {
    const baseParts = basePath.split('/');
    baseParts.pop();
    for (const part of relativePath.split('/')) {
      if (part === '..') baseParts.pop();
      else if (part !== '.') baseParts.push(part);
    }
    return baseParts.join('/');
  }

  function arrayBufferToText(ab) {
    return new TextDecoder().decode(ab);
  }

  function getHapFile(hapFiles, path) {
    const raw = hapFiles[path];
    if (!raw) return null;
    return raw instanceof ArrayBuffer ? arrayBufferToText(raw) : raw;
  }

  /**
   * Navigate to a page.
   * Flow: destroy current page → load module → call onInit → render → call onReady → call onShow
   */
  async function navigateTo(pageUri, params) {
    console.log('[PageNav] Navigate:', pageUri);

    // Destroy current page before navigating to new one
    destroyCurrentPage();

    const pagePath = pageUri.replace(/^\//, '');
    const jsKey = pagePath + '.js';

    let pageExports = null;
    // Try to find the module in _appData.modules or _appData.hapFiles
    if (_appData.modules[jsKey]) {
      pageExports = Sandbox.initPage(_appData.modules[jsKey], pagePath, _appData);
      const pageErr = Sandbox.getLastError();
      if (pageErr) console.error('[PageNav] Page Sandbox error:', pageErr.message);
    } else if (_appData.hapFiles) {
      const possiblePaths = [
        jsKey,
        'assets/js/default/' + jsKey,
        'assets/js/' + jsKey,
      ];
      for (const p of possiblePaths) {
        const code = getHapFile(_appData.hapFiles, p);
        if (code) {
          pageExports = Sandbox.initPage(code, pagePath, _appData);
          const pageErr = Sandbox.getLastError();
          if (pageErr) console.error('[PageNav] Page Sandbox error:', pageErr.message);
          break;
        }
      }
    }
    if (!pageExports) {
      const moduleKeys = Object.keys(_appData.modules).filter(k => k.endsWith('.js'));
      const hapKeys = _appData.hapFiles ? Object.keys(_appData.hapFiles).filter(k => k.endsWith('.js')) : [];
      console.error('[PageNav] Page not found:', pageUri, '(looking for', jsKey + ')');
      if (moduleKeys.length > 0) {
        console.error('[PageNav] Available JS modules:', moduleKeys.join(', '));
      }
      if (hapKeys.length > 0) {
        console.error('[PageNav] Available HAP JS files:', hapKeys.join(', '));
      }
      return;
    }

    // Store current page
    _currentPage = { uri: pageUri, path: pagePath, exports: pageExports, data: pageExports._data };
    _pageHistory.push(_currentPage);

    if (params) Object.assign(pageExports._data, params);

    if (pageExports.onInit) {
      try { pageExports.onInit.call(pageExports._data); } catch (e) { console.error('[PageNav] onInit error:', e); }
    }

    // If onInit triggered a navigation away (e.g. router.replace),
    // the nested navigateTo already rendered the new page — skip rendering this one
    const currentUri = _currentPage ? _currentPage.uri : null;
    if (currentUri !== pageUri) {
      return;
    }

    // Load any separate .css file alongside the compiled ViewModel
    const compiledCssKey = pagePath + '.css';
    var compiledCssContent = _appData.modules[compiledCssKey] || '';
    if (!compiledCssContent && _appData.hapFiles) {
      const possibleCssPaths = [
        compiledCssKey,
        'assets/js/default/' + compiledCssKey,
        'assets/js/' + compiledCssKey,
      ];
      for (const p of possibleCssPaths) {
        const css = getHapFile(_appData.hapFiles, p);
        if (css) {
          compiledCssContent = css;
          break;
        }
      }
    }
    if (compiledCssContent) {
      const importRegex = /@import\s+["']([^"']+)["'];?/g;
      let importMatch;
      while ((importMatch = importRegex.exec(compiledCssContent))) {
        const resolvedPath = resolveRelativePath(pagePath, importMatch[1]);
        var importedCSS = _appData.modules[resolvedPath] || '';
        if (!importedCSS && _appData.hapFiles) {
          const possibleImportPaths = [
            resolvedPath,
            'assets/js/default/' + resolvedPath,
            'assets/js/' + resolvedPath,
          ];
          for (const p of possibleImportPaths) {
            const css = getHapFile(_appData.hapFiles, p);
            if (css) {
              importedCSS = css;
              break;
            }
          }
        }
        compiledCssContent = compiledCssContent.replace(importMatch[0], importedCSS);
      }
    }

    DeviceFeatureDisplay.renderViewModel(pageExports, compiledCssContent);
    registerPageHandlers(pageExports, pageExports._data);

    if (pageExports.onReady) {
      try { pageExports.onReady.call(pageExports._data); } catch (e) { console.error('[PageNav] onReady error:', e); }
    }
    if (pageExports.onShow) {
      try { pageExports.onShow.call(pageExports._data); } catch (e) { console.error('[PageNav] onShow error:', e); }
    }

    DeviceFeatureCrown.enable();
    DeviceFeatureTouch.enable();
    DeviceFeatureCrown.onRotate((delta) => {
      const root = document.getElementById('watch-content');
      const sr = root && root.shadowRoot;
      if (!sr) return;
      sr.querySelectorAll('[data-ref]').forEach(el => {
        if (!el._rotationFocused) return;
        if (el.tagName === 'SLIDER') {
          const min = parseFloat(el.getAttribute('min')) || 0;
          const max = parseFloat(el.getAttribute('max')) || 100;
          const step = parseFloat(el.getAttribute('step')) || 1;
          let val = parseFloat(el.getAttribute('value')) || 0;
          val = Math.min(max, Math.max(min, val - delta * step));
          el.setAttribute('value', val);
          const changeEvent = new CustomEvent('change', { bubbles: true, cancelable: true });
          changeEvent.value = val;
          changeEvent.progress = val;
          el.dispatchEvent(changeEvent);
        } else if (el.tagName === 'LIST') {
          el.scrollTop -= delta * 30;
        }
      });
    });
  }

  function registerPageHandlers(pageExports, pageData) {
    if (!pageExports) return;
    for (const [key, value] of Object.entries(pageExports)) {
      if (typeof value === 'function' && !key.startsWith('_') && !key.startsWith('on') && key !== 'data') {
        DeviceFeatureDisplay.registerHandler(key, value.bind(pageData));
      }
    }
  }

  /**
   * Clear all navigation state
   */
  function clear() {
    destroyCurrentPage();
    _pageHistory = [];
    _currentPage = null;
  }

  return {
    setAppData, onNavigate, getNavigateCallback, getCurrentPage,
    destroyCurrentPage, navigateTo, clear,
  };
})();
