/**
 * Main App - Orchestrates the simulator
 * Slimmed down: UI setup + app loading only.
 * Page navigation delegated to DeviceFeaturePageNav.
 * Display delegated to DeviceFeatureDisplay.
 */
const App = (() => {
  let _appData = null;

  function init() {
    DeviceFeatureDisplay.init();
    DeviceFeatureCrown.init();
    DeviceFeatureTouch.init();
    DeviceFeatureVirtualFS.init();
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
        DeviceFeatureDisplay.configure(config.width, config.height, config.isCircle);
      },
    });
    SensorPanel.setConfig({ width: 466, height: 466, isCircle: true, batteryLevel: 0.85 });
    DeviceFeatureDisplay.configure(466, 466, true);
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
        DeviceFeaturePhoneLink.receiveFromPhone(text);
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
      DeviceFeatureCrown.setInverted(toggle.checked);
      toggle.addEventListener('change', () => {
        DeviceFeatureCrown.setInverted(toggle.checked);
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

    // Destroy current page and call app onDestroy
    DeviceFeaturePageNav.clear();
    DeviceFeatureAppLifecycle.callOnDestroy();

    // Reset Sandbox (also clears image src resolver)
    Sandbox.reset();

    // Re-register image src resolver
    setupImageResolver(appData);

    // Clear and re-initialize VirtualFS
    DeviceFeatureVirtualFS.clear();

    // Re-initialize VirtualFS with app data
    if (appData.files) {
      for (const [path, data] of Object.entries(appData.files)) {
        DeviceFeatureVirtualFS.writeFile(path, data);
      }
    }

    // Re-execute app.js
    if (appData.appJs) {
      const appExports = Sandbox.initApp(appData.appJs, appData);
      DeviceFeatureAppLifecycle.setAppExports(appExports);
      const appErr = Sandbox.getLastError();
      if (appErr) log('App Sandbox error: ' + appErr.message, 'error');

      // Register router callback BEFORE onCreate so router.replace() in onCreate works
      let _navigatedFromOnCreate = false;
      DeviceFeaturePageNav.onNavigate(async (pageInfo) => {
        if (!pageInfo) { DeviceFeatureDisplay.clear(); return; }
        _navigatedFromOnCreate = true;
        await DeviceFeaturePageNav.navigateTo(pageInfo.uri, pageInfo.params);
      });

      DeviceFeatureAppLifecycle.callOnCreate();

      if (!_navigatedFromOnCreate) {
        DeviceFeaturePageNav.navigateTo('pages/index/index', {});
      }
    } else {
      DeviceFeaturePageNav.onNavigate(async (pageInfo) => {
        if (!pageInfo) { DeviceFeatureDisplay.clear(); return; }
        await DeviceFeaturePageNav.navigateTo(pageInfo.uri, pageInfo.params);
      });
      DeviceFeaturePageNav.navigateTo('pages/index/index', {});
    }

    log('App refreshed.', 'info');
  }

  function setupImageResolver(appData) {
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

      return src;
    };
    Sandbox.setImageSrcResolver(imageResolver);
    DeviceFeatureDisplay.setImageSrcResolver(imageResolver);
  }

  async function loadAppFile(file) {
    log('Loading: ' + file.name, 'info');
    try {
      // Destroy current page and app lifecycle
      DeviceFeaturePageNav.clear();
      DeviceFeatureAppLifecycle.callOnDestroy();

      const appData = await Unpacker.loadFromFile(file);
      _appData = appData;

      // Register image src resolver
      setupImageResolver(appData);

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

      DeviceFeatureVirtualFS.clear();
      DeviceFeaturePageNav.clear();

      if (appData.appJs) {
        const appExports = Sandbox.initApp(appData.appJs, appData);
        DeviceFeatureAppLifecycle.setAppExports(appExports);
        log('App exports type: ' + typeof appExports + ' keys: ' + (appExports ? Object.keys(appExports).join(', ') : 'null'), 'info');
        const appErr = Sandbox.getLastError();
        if (appErr) log('App Sandbox error: ' + appErr.message, 'error');

        // Register router callback BEFORE onCreate so router.replace() in onCreate works
        let _navigatedFromOnCreate = false;
        DeviceFeaturePageNav.onNavigate(async (pageInfo) => {
          if (!pageInfo) { DeviceFeatureDisplay.clear(); return; }
          _navigatedFromOnCreate = true;
          await DeviceFeaturePageNav.navigateTo(pageInfo.uri, pageInfo.params);
        });

        DeviceFeatureAppLifecycle.callOnCreate();

        // If onCreate already navigated away, skip the default index page
        if (!_navigatedFromOnCreate) {
          await DeviceFeaturePageNav.navigateTo('pages/index/index', {});
        }
      } else {
        DeviceFeaturePageNav.onNavigate(async (pageInfo) => {
          if (!pageInfo) { DeviceFeatureDisplay.clear(); return; }
          await DeviceFeaturePageNav.navigateTo(pageInfo.uri, pageInfo.params);
        });
        await DeviceFeaturePageNav.navigateTo('pages/index/index', {});
      }
    } catch (e) {
      log('Error loading app: ' + e.message, 'error');
      console.error(e);
    }
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
