/**
 * Main App - Orchestrates the simulator
 */
const App = (() => {
  let _currentApp = null;
  let _currentPage = null;
  let _pageHistory = [];
  let _appExports = null;
  let _deviceConfig = { windowWidth: 466, windowHeight: 466, screenShape: 'circle' };
  let _appData = null;

  function init() {
    WatchRenderer.init();
    CrownSim.init();
    TouchSim.init();
    VirtualFS.init();
    setupDropZone();
    setupControls();
    setupWearenginePanel();
    setupPresets();
    setupQuickLoad();
    setupLocalSelectAll();
    setupInvertScroll();
    log('Simulator ready. Drag a .app file onto the watch or use quick load.', 'info');
  }

  function setupLocalSelectAll() {
    const panels = ['log-panel', 'we-log'];
    panels.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
          e.preventDefault();
          const range = document.createRange();
          range.selectNodeContents(el);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
      });
    });
  }

  function setupDropZone() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    ['dragenter', 'dragover'].forEach(evt => {
      document.body.addEventListener(evt, (e) => {
        e.preventDefault();
        if (dropZone) dropZone.classList.add('active');
      });
    });

    ['dragleave', 'drop'].forEach(evt => {
      document.body.addEventListener(evt, (e) => {
        e.preventDefault();
        if (dropZone) dropZone.classList.remove('active');
      });
    });

    document.body.addEventListener('drop', async (e) => {
      e.preventDefault();
      if (dropZone) dropZone.classList.remove('active');
      const files = e.dataTransfer.files;
      if (files.length > 0) await loadAppFile(files[0]);
    });

    if (fileInput) {
      fileInput.addEventListener('change', async (e) => {
        if (e.target.files.length > 0) await loadAppFile(e.target.files[0]);
      });
    }

    if (dropZone) {
      dropZone.addEventListener('click', () => fileInput.click());
    }
  }

  function setupControls() {
    SensorPanel.init({
      onConfigChange: (config) => {
        _deviceConfig = {
          windowWidth: config.width,
          windowHeight: config.height,
          screenShape: config.isCircle ? 'circle' : 'rect',
        };
        SystemAPIs.setDeviceInfo(_deviceConfig);
        WatchRenderer.configure(config.width, config.height, config.isCircle);
      },
    });
    SensorPanel.setConfig({ width: 466, height: 466, isCircle: true, batteryLevel: 0.85 });
    WatchRenderer.configure(466, 466, true);
  }

  function setupPresets() {
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => SensorPanel.applyPreset(btn.dataset.preset));
    });
  }

  function setupWearenginePanel() {
    const sendBtn = document.getElementById('we-send-btn');
    const input = document.getElementById('we-input');
    if (sendBtn && input) {
      sendBtn.addEventListener('click', () => {
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        WearEngineMock.simulateIncomingMessage(text);
        appendWeLog('received', text);
      });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendBtn.click(); });
    }
  }

  function appendWeLog(type, text) {
    const logDiv = document.getElementById('we-log');
    if (!logDiv) return;
    const entry = document.createElement('div');
    entry.className = type;
    entry.textContent = (type === 'sent' ? '\u2192 ' : '\u2190 ') + text;
    logDiv.appendChild(entry);
    logDiv.scrollTop = logDiv.scrollHeight;
  }

  function setupQuickLoad() {
    // No built-in apps - drag and drop your own .app files
  }

  function setupInvertScroll() {
    const toggle = document.getElementById('invert-scroll-toggle');
    if (toggle) {
      CrownSim.setInverted(toggle.checked);
      toggle.addEventListener('change', () => {
        CrownSim.setInverted(toggle.checked);
      });
    }
  }

  async function loadAppFile(file) {
    log('Loading: ' + file.name, 'info');
    try {
      const appData = await Unpacker.loadFromFile(file);
      _appData = appData;
      log('Bundle: ' + appData.bundleName, 'info');
      log('Version: ' + appData.version + ' | Device: ' + appData.deviceType, 'info');
      log('Pages: ' + appData.pages.join(', '), 'info');
      log('HAP files: ' + (appData.hapFiles || []).length, 'info');
      const jsModules = Object.keys(appData.modules).filter(k => k.endsWith('.js'));
      log('JS modules: ' + jsModules.join(', '), 'info');
      if (appData._configRaw) log('Config: ' + appData._configRaw, 'info');
      const hapFiles = appData.hapFiles || [];
      const jsFiles = hapFiles.filter(f => f.endsWith('.js') && !f.endsWith('.bc'));
      const hmlFiles = hapFiles.filter(f => f.endsWith('.hml'));
      const cssFiles = hapFiles.filter(f => f.endsWith('.css'));
      log('HAP .js files: ' + jsFiles.join(', '), 'info');
      log('HAP .hml files: ' + hmlFiles.join(', '), 'info');
      log('HAP .css files: ' + cssFiles.join(', '), 'info');
      log('Module keys: ' + Object.keys(appData.modules).join(', '), 'info');

      const infoDiv = document.getElementById('app-info');
      if (infoDiv) infoDiv.textContent = appData.bundleName + ' v' + appData.version;

      VirtualFS.clear();
      _pageHistory = [];

      if (appData.appJs) {
        _appExports = Sandbox.initApp(appData.appJs, appData);
        log('App exports type: ' + typeof _appExports + ' keys: ' + (_appExports ? Object.keys(_appExports).join(', ') : 'null'), 'info');
        const appErr = Sandbox.getLastError();
        if (appErr) log('App Sandbox error: ' + appErr.message, 'error');
        if (_appExports && _appExports.onCreate) _appExports.onCreate();
      }

      SystemAPIs.onNavigate(async (pageInfo) => {
        if (!pageInfo) { WatchRenderer.clear(); return; }
        await navigateTo(pageInfo.uri, pageInfo.params);
      });

      if (appData.pages.length > 0) {
        await navigateTo(appData.pages[0], {});
      }
    } catch (e) {
      log('Error loading app: ' + e.message, 'error');
      console.error(e);
    }
  }

  /**
   * Navigate to a page.
   * Flow: load module → call onInit (sets imports) → re-resolve data → render → call onShow
   */
  async function navigateTo(pageUri, params) {
    log('Navigate: ' + pageUri, 'info');

    const pagePath = pageUri;
    const jsKey = pagePath + '.js';

    let pageExports = null;
    if (_appData.modules[jsKey]) {
      pageExports = Sandbox.initPage(_appData.modules[jsKey], pagePath, _appData);
      const pageErr = Sandbox.getLastError();
      if (pageErr) log('Page Sandbox error: ' + pageErr.message + '\n' + (pageErr.stack || '').substring(0, 500), 'error');
    }
    if (!pageExports) {
      const moduleKeys = Object.keys(_appData.modules).filter(k => k.endsWith('.js'));
      log('Page not found: ' + pageUri + ' (looking for ' + jsKey + ')', 'error');
      if (moduleKeys.length > 0) {
        log('Available JS modules: ' + moduleKeys.join(', '), 'error');
      } else {
        log('No JS modules found in .app bundle.', 'error');
      }
      return;
    }

    // Detect compiled ViewModel (HarmonyOS compiled bundle)
    const isViewModel = pageExports && pageExports._renderFn;
    log('Page exports type: ' + typeof pageExports + ' keys: ' + (pageExports ? Object.keys(pageExports).join(', ') : 'null') + ' isViewModel: ' + isViewModel, 'info');
    if (pageExports && pageExports._renderFn) {
      log('_renderFn source: ' + pageExports._renderFn.toString().substring(0, 500), 'info');
    }
    if (_appData.modules[jsKey]) {
      log('Page JS source (first 2000 chars): ' + _appData.modules[jsKey].substring(0, 2000), 'info');
    }

    if (isViewModel) {
      // Compiled JS path: render via ViewModel
      log('Detected compiled ViewModel, rendering via DOM tree', 'info');

      _currentPage = { uri: pageUri, path: pagePath, exports: pageExports, data: pageExports._data };
      _pageHistory.push(_currentPage);

      if (params) Object.assign(pageExports._data, params);

      if (pageExports.onInit) {
        try { pageExports.onInit.call(pageExports._data); } catch (e) { console.error('[App] onInit error:', e); }
      }

      // If onInit triggered a navigation away (e.g. router.replace), 
      // the nested navigateTo already rendered the new page — skip rendering this one
      const currentUri = _currentPage ? _currentPage.uri : null;
      if (currentUri !== pageUri) {
        return;
      }

      WatchRenderer.renderViewModel(pageExports);
      registerPageHandlers(pageExports, pageExports._data);

      if (pageExports.onShow) {
        try { pageExports.onShow.call(pageExports._data); } catch (e) { console.error('[App] onShow error:', e); }
      }
    } else {
      // Source HML path: compile HML + CSS
      const hmlKey = pagePath + '.hml';
      const cssKey = pagePath + '.css';

      const pageData = {};
      if (pageExports.data) {
        if (typeof pageExports.data === 'function') {
          Object.assign(pageData, pageExports.data());
        } else {
          Object.assign(pageData, pageExports.data);
        }
      }
      if (params) Object.assign(pageData, params);
      pageData.$refs = {};
      pageData.data = pageData;

      for (const [key, val] of Object.entries(pageExports)) {
        if (key !== 'data' && typeof val === 'function') {
          pageData[key] = val.bind(pageData);
        }
      }

      if (pageExports.onInit) {
        try { pageExports.onInit.call(pageData); } catch (e) { console.error('[App] onInit error:', e); }
      }

      // If onInit triggered a navigation away, skip rendering this page
      const currentUriAfterInit = _currentPage ? _currentPage.uri : null;
      if (currentUriAfterInit !== pageUri) {
        return;
      }

      const freshExports = Sandbox.reInitPage(_appData.modules[jsKey], pagePath, _appData);
      if (freshExports && freshExports.data) {
        if (typeof freshExports.data === 'function') {
          Object.assign(pageData, freshExports.data());
        } else {
          for (const [key, val] of Object.entries(freshExports.data)) {
            if (val !== undefined && pageData[key] === undefined) {
              pageData[key] = val;
            }
          }
        }
      }
      if (params) Object.assign(pageData, params);

      const hmlContent = _appData.modules[hmlKey] || '<div></div>';
      let cssContent = _appData.modules[cssKey] || '';
      const importRegex = /@import\s+["']([^"']+)["'];?/g;
      let importMatch;
      while ((importMatch = importRegex.exec(cssContent))) {
        const resolvedPath = resolveRelativePath(pagePath, importMatch[1]);
        const importedCSS = _appData.modules[resolvedPath] || '';
        cssContent = cssContent.replace(importMatch[0], importedCSS);
      }

      _currentPage = { uri: pageUri, path: pagePath, exports: pageExports, data: pageData };
      _pageHistory.push(_currentPage);

      WatchRenderer.renderPage({ hml: hmlContent, path: pagePath }, pageData, cssContent, _appData.modules);
      registerPageHandlers(pageExports, pageData);

      if (pageExports.onShow) {
        try { pageExports.onShow.call(pageData); } catch (e) { console.error('[App] onShow error:', e); }
      }
    }

    CrownSim.enable();
    TouchSim.enable();
    CrownSim.onRotate((delta) => {
      const root = document.getElementById('watch-content');
      const sr = root && root.shadowRoot;
      if (!sr) return;
      sr.querySelectorAll('[data-ref]').forEach(el => {
        if (el._rotationFocused) {
          el.scrollTop -= delta * 30;
        }
      });
    });
  }

  function registerPageHandlers(pageExports, pageData) {
    if (!pageExports) return;
    for (const [key, value] of Object.entries(pageExports)) {
      if (typeof value === 'function' && !key.startsWith('_') && !key.startsWith('on') && key !== 'data') {
        WatchRenderer.registerHandler(key, value.bind(pageData));
      }
    }
  }

  function resolveRelativePath(basePath, relativePath) {
    const baseParts = basePath.split('/');
    baseParts.pop();
    for (const part of relativePath.split('/')) {
      if (part === '..') baseParts.pop();
      else if (part !== '.') baseParts.push(part);
    }
    return baseParts.join('/');
  }



  function log(text, type) {
    const logPanel = document.getElementById('log-panel');
    if (!logPanel) return;
    const entry = document.createElement('div');
    entry.className = 'log-entry ' + (type || 'info');
    entry.textContent = '[' + new Date().toLocaleTimeString() + '] ' + text;
    logPanel.appendChild(entry);
    logPanel.scrollTop = logPanel.scrollHeight;
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
