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
    setupResetButton();
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

  function setupResetButton() {
    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', resetApp);
    }
  }

  function resetApp() {
    const appData = _appData;
    if (!appData) {
      log('No app loaded to refresh.', 'warn');
      return;
    }

    log('Refreshing: ' + appData.bundleName, 'info');

    // First destroy current page (page lifecycle before app lifecycle)
    destroyCurrentPage();

    // Then call app onDestroy
    if (_appExports && _appExports.onDestroy) {
      try { _appExports.onDestroy(); } catch (e) { console.error('[App] onDestroy error:', e); }
    }

    // Reset Sandbox (also clears image src resolver)
    Sandbox.reset();

    // Re-register image src resolver
    const imageResolver = (src) => {
      const normalized = src.replace(/^\//, '');

      // Try 1: exact match in modules
      let data = appData.modules[normalized];
      if (data) {
        const ext = (normalized.match(/\.(\w+)$/) || [])[1] || 'png';
        const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'bmp' ? 'image/bmp' : 'image/png';
        const blob = data instanceof ArrayBuffer
          ? new Blob([data], { type: mimeType })
          : new Blob([data], { type: mimeType });
        return URL.createObjectURL(blob);
      }

      // Try 2: .bin → .png/.jpg/.bmp
      if (normalized.match(/\.bin$/i)) {
        const basePath = normalized.replace(/\.bin$/i, '');
        const extensions = ['.png', '.jpg', '.jpeg', '.bmp'];
        for (const ext of extensions) {
          const imgPath = basePath + ext;
          data = appData.modules[imgPath];
          if (data) {
            const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.bmp' ? 'image/bmp' : 'image/png';
            const blob = data instanceof ArrayBuffer
              ? new Blob([data], { type: mimeType })
              : new Blob([data], { type: mimeType });
            return URL.createObjectURL(blob);
          }
        }

        // Try 2b: parse .bin directly
        data = appData.modules[normalized];
        if (data && data.byteLength > 0) {
          const ab = data instanceof ArrayBuffer ? data : data.buffer;
          const parsed = parseBinImage(ab);
          if (parsed) return parsed;
        }
      }

      // Try 3: resources/ prefix
      const resourcePaths = ['base/media/', 'rawfile/'];
      for (const prefix of resourcePaths) {
        const resourceKey = prefix + normalized.replace(/^common\//, '');
        data = appData.resources?.[resourceKey];
        if (data) {
          const ext = (normalized.match(/\.(\w+)$/) || [])[1] || 'png';
          const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'bmp' ? 'image/bmp' : 'image/png';
          const blob = data instanceof ArrayBuffer
            ? new Blob([data], { type: mimeType })
            : new Blob([data], { type: mimeType });
          return URL.createObjectURL(blob);
        }
      }

      return src;
    };
    Sandbox.setImageSrcResolver(imageResolver);
    WatchRenderer.setImageSrcResolver(imageResolver);

    // Clear VirtualFS
    VirtualFS.clear();

    // Clear page history
    _pageHistory = [];
    _currentPage = null;
    _appExports = null;

    // Re-initialize VirtualFS with app data
    if (appData.files) {
      for (const [path, data] of Object.entries(appData.files)) {
        VirtualFS.writeFile(path, data);
      }
    }

    // Re-execute app.js
    if (appData.appJs) {
      _appExports = Sandbox.initApp(appData.appJs, appData);
      const appErr = Sandbox.getLastError();
      if (appErr) log('App Sandbox error: ' + appErr.message, 'error');

      // Register router callback BEFORE onCreate so router.replace() in onCreate works
      let _navigatedFromOnCreate = false;
      SystemAPIs.onNavigate(async (pageInfo) => {
        if (!pageInfo) { WatchRenderer.clear(); return; }
        _navigatedFromOnCreate = true;
        await navigateTo(pageInfo.uri, pageInfo.params);
      });

      if (_appExports && _appExports.onCreate) _appExports.onCreate();

      if (!_navigatedFromOnCreate) {
        navigateTo('pages/index/index', {});
      }
    } else {
      SystemAPIs.onNavigate(async (pageInfo) => {
        if (!pageInfo) { WatchRenderer.clear(); return; }
        await navigateTo(pageInfo.uri, pageInfo.params);
      });
      navigateTo('pages/index/index', {});
    }

    log('App refreshed.', 'info');
  }

  async function loadAppFile(file) {
    log('Loading: ' + file.name, 'info');
    try {
      // First destroy current page (page lifecycle before app lifecycle)
      destroyCurrentPage();

      // Then call app onDestroy
      if (_appExports && _appExports.onDestroy) {
        try { _appExports.onDestroy(); } catch (e) { console.error('[App] onDestroy error:', e); }
      }

      const appData = await Unpacker.loadFromFile(file);
      _appData = appData;

      // Register image src resolver: resolve src paths to blob URLs from app modules
      const imageResolver = (src) => {
        // Normalize: remove leading slash
        const normalized = src.replace(/^\//, '');

        // Try 1: exact match in modules (e.g. /common/folder-48px.png → common/folder-48px.png)
        let data = appData.modules[normalized];
        if (data) {
          const ext = (normalized.match(/\.(\w+)$/) || [])[1] || 'png';
          const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'bmp' ? 'image/bmp' : 'image/png';
          const blob = data instanceof ArrayBuffer
            ? new Blob([data], { type: mimeType })
            : new Blob([data], { type: mimeType });
          return URL.createObjectURL(blob);
        }

        // Try 2: .bin → .png/.jpg/.bmp (compiled apps where compiler renamed .png to .bin)
        if (normalized.match(/\.bin$/i)) {
          const basePath = normalized.replace(/\.bin$/i, '');
          const extensions = ['.png', '.jpg', '.jpeg', '.bmp'];
          for (const ext of extensions) {
            const imgPath = basePath + ext;
            data = appData.modules[imgPath];
            if (data) {
              const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.bmp' ? 'image/bmp' : 'image/png';
              const blob = data instanceof ArrayBuffer
                ? new Blob([data], { type: mimeType })
                : new Blob([data], { type: mimeType });
              return URL.createObjectURL(blob);
            }
          }

          // Try 2b: parse .bin directly (Huawei ace-loader lite-image2bin format)
          data = appData.modules[normalized];
          if (data && data.byteLength > 0) {
            const ab = data instanceof ArrayBuffer ? data : data.buffer;
            const parsed = parseBinImage(ab);
            if (parsed) return parsed;
          }
        }

        // Try 3: try matching with resources/ prefix
        const resourcePaths = ['base/media/', 'rawfile/'];
        for (const prefix of resourcePaths) {
          const resourceKey = prefix + normalized.replace(/^common\//, '');
          data = appData.resources?.[resourceKey];
          if (data) {
            const ext = (normalized.match(/\.(\w+)$/) || [])[1] || 'png';
            const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'bmp' ? 'image/bmp' : 'image/png';
            const blob = data instanceof ArrayBuffer
              ? new Blob([data], { type: mimeType })
              : new Blob([data], { type: mimeType });
            return URL.createObjectURL(blob);
          }
        }

        // Fallback: return original path (will likely not load, but no crash)
        return src;
      };
      Sandbox.setImageSrcResolver(imageResolver);
      WatchRenderer.setImageSrcResolver(imageResolver);

      log('Bundle: ' + appData.bundleName, 'info');
      log('Version: ' + appData.version + ' | Device: ' + appData.deviceType, 'info');
      log('Pages: ' + appData.pages.join(', '), 'info');
      log('HAP files: ' + (appData.hapFiles || []).length, 'info');
      const jsModules = Object.keys(appData.modules).filter(k => k.endsWith('.js'));
      log('JS modules: ' + jsModules.join(', '), 'info');
      if (appData._configRaw) log('Config: ' + appData._configRaw, 'info');
    const hapFiles = appData.hapFiles || [];
    const jsFiles = hapFiles.filter(f => f.endsWith('.js') && !f.endsWith('.bc'));
    const cssFiles = hapFiles.filter(f => f.endsWith('.css'));
    log('HAP .js files: ' + jsFiles.join(', '), 'info');
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

        // Register router callback BEFORE onCreate so router.replace() in onCreate works
        let _navigatedFromOnCreate = false;
        SystemAPIs.onNavigate(async (pageInfo) => {
          if (!pageInfo) { WatchRenderer.clear(); return; }
          _navigatedFromOnCreate = true;
          await navigateTo(pageInfo.uri, pageInfo.params);
        });

        if (_appExports && _appExports.onCreate) _appExports.onCreate();

        // If onCreate already navigated away, skip the default index page
        if (!_navigatedFromOnCreate) {
          await navigateTo('pages/index/index', {});
        }
      } else {
        SystemAPIs.onNavigate(async (pageInfo) => {
          if (!pageInfo) { WatchRenderer.clear(); return; }
          await navigateTo(pageInfo.uri, pageInfo.params);
        });
        await navigateTo('pages/index/index', {});
      }
    } catch (e) {
      log('Error loading app: ' + e.message, 'error');
      console.error(e);
    }
  }

  /**
   * Destroy current page: call onHide → onDestroy, cleanup reactive
   */
  function destroyCurrentPage() {
    if (!_currentPage) return;
    const { exports: pageExports, data: pageData } = _currentPage;

    if (pageExports && pageExports.onHide) {
      try { pageExports.onHide.call(pageData); } catch (e) { console.error('[App] onHide error:', e); }
    }
    if (pageExports && pageExports.onDestroy) {
      try { pageExports.onDestroy.call(pageData); } catch (e) { console.error('[App] onDestroy error:', e); }
    }

    Sandbox.cleanupReactive();
    _currentPage = null;
  }

  /**
   * Navigate to a page.
   * Flow: destroy current page → load module → call onInit → render → call onReady → call onShow
   */
  async function navigateTo(pageUri, params) {
    log('Navigate: ' + pageUri, 'info');

    // Destroy current page before navigating to new one
    destroyCurrentPage();

    const pagePath = pageUri.replace(/^\//, '');
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

    log('Page exports type: ' + typeof pageExports + ' keys: ' + (pageExports ? Object.keys(pageExports).join(', ') : 'null'), 'info');

    // Render via ViewModel (compiled HarmonyOS bundle)
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

    // Load any separate .css file alongside the compiled ViewModel
    const compiledCssKey = pagePath + '.css';
    var compiledCssContent = _appData.modules[compiledCssKey] || '';
    if (compiledCssContent) {
      const importRegex = /@import\s+["']([^"']+)["'];?/g;
      let importMatch;
      while ((importMatch = importRegex.exec(compiledCssContent))) {
        const resolvedPath = resolveRelativePath(pagePath, importMatch[1]);
        const importedCSS = _appData.modules[resolvedPath] || '';
        compiledCssContent = compiledCssContent.replace(importMatch[0], importedCSS);
      }
    }

    WatchRenderer.renderViewModel(pageExports, compiledCssContent);
    registerPageHandlers(pageExports, pageExports._data);

    if (pageExports.onReady) {
      try { pageExports.onReady.call(pageExports._data); } catch (e) { console.error('[App] onReady error:', e); }
    }
    if (pageExports.onShow) {
      try { pageExports.onShow.call(pageExports._data); } catch (e) { console.error('[App] onShow error:', e); }
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



  /**
   * Parse a Huawei .bin image (from ace-loader lite-image2bin) into a data URL.
   * Format: [4B magic=0x100][4B packed width|height][BGRA pixels]
   * @returns {string|null} data:image/png URL or null if parse fails
   */
  function parseBinImage(arrayBuffer) {
    try {
      const dv = new DataView(arrayBuffer);
      if (dv.byteLength < 8) return null;
      const magic = dv.getUint32(0, true);
      if (magic !== 256) return null;
      const packed = dv.getUint32(4, true);
      const width = (packed >> 16) & 0xFFFF;
      const height = packed & 0xFFFF;
      if (width <= 0 || height <= 0 || width > 4096 || height > 4096) return null;
      const pixelBytes = width * height * 4;
      if (dv.byteLength < 8 + pixelBytes) return null;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      const imgData = ctx.createImageData(width, height);
      const dst = imgData.data;
      let off = 8;
      for (let i = 0; i < dst.length; i += 4) {
        dst[i]     = dv.getUint8(off + 2, true);
        dst[i + 1] = dv.getUint8(off + 1, true);
        dst[i + 2] = dv.getUint8(off, true);
        dst[i + 3] = dv.getUint8(off + 3, true);
        off += 4;
      }
      ctx.putImageData(imgData, 0, 0);
      return canvas.toDataURL('image/png');
    } catch (e) {
      console.warn('[App] Failed to parse .bin image:', e);
      return null;
    }
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
