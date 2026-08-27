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
    setupRestartButton();
    setupResetButton();
    setupScreenshot();
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

  function setupRestartButton() {
    const btn = document.getElementById('restart-btn');
    if (btn) {
      btn.addEventListener('click', restartApp);
    }
  }

  function setupResetButton() {
    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', resetApp);
    }
  }

  function setupScreenshot() {
    const btn = document.getElementById('screenshot-btn');
    if (btn) {
      btn.addEventListener('click', takeScreenshot);
    }
  }

  function takeScreenshot() {
    const watchFrame = document.getElementById('watch-frame');
    if (!watchFrame) {
      log('Nothing to capture.', 'warn');
      return;
    }
    if (typeof html2canvas === 'undefined') {
      log('Libraries still loading, please wait...', 'warn');
      return;
    }

    html2canvas(watchFrame, {
      scale: 2,
      backgroundColor: null,
      useCORS: true,
      logging: false,
    }).then(canvas => {
      const link = document.createElement('a');
      link.download = 'screenshot_' + Date.now() + '.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      log('Screenshot saved.', 'info');
    }).catch(err => {
      log('Screenshot failed: ' + err.message, 'error');
    });
  }

  function restartApp() {
    const appData = _appData;
    if (!appData) {
      log('No app loaded to restart.', 'warn');
      return;
    }

    log('Restarting: ' + appData.bundleName, 'info');

    // Phase 1: Destroy current page and call app onDestroy
    DeviceFeaturePageNav.clear();
    DeviceFeatureAppLifecycle.callOnDestroy();

    // Phase 2: Destroy old sandbox entirely, create fresh one
    Sandbox.destroy();
    Sandbox = createSandbox();

    // Phase 3: Clear display — simulate app closing (black screen)
    DeviceFeatureDisplay.clear();

    // Phase 4: After brief pause, re-launch the app
    setTimeout(function() {
      // Re-register image src resolver
      setupImageResolver(appData);

      // NOTE: VirtualFS is intentionally NOT cleared — filesystem persists across restart

      // Re-execute app.js
      if (appData.appJs) {
        var appExports = Sandbox.initApp(appData.appJs, appData);
        DeviceFeatureAppLifecycle.setAppExports(appExports);
        var appErr = Sandbox.getLastError();
        if (appErr) log('App Sandbox error: ' + appErr.message, 'error');

        var _navigatedFromOnCreate = false;
        DeviceFeaturePageNav.onNavigate(async function(pageInfo) {
          if (!pageInfo) { DeviceFeatureDisplay.clear(); return; }
          _navigatedFromOnCreate = true;
          await DeviceFeaturePageNav.navigateTo(pageInfo.uri, pageInfo.params);
        });

        DeviceFeatureAppLifecycle.callOnCreate();

        if (!_navigatedFromOnCreate) {
          DeviceFeaturePageNav.navigateTo('pages/index/index', {});
        }
      } else {
        DeviceFeaturePageNav.onNavigate(async function(pageInfo) {
          if (!pageInfo) { DeviceFeatureDisplay.clear(); return; }
          await DeviceFeaturePageNav.navigateTo(pageInfo.uri, pageInfo.params);
        });
        DeviceFeaturePageNav.navigateTo('pages/index/index', {});
      }

      log('App restarted.', 'info');
    }, 300);
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

    // Destroy old sandbox entirely, create fresh one
    Sandbox.destroy();
    Sandbox = createSandbox();

    // Re-register image src resolver
    setupImageResolver(appData);

    // Clear and re-initialize VirtualFS
    DeviceFeatureVirtualFS.clear();
    DeviceFeatureVirtualFS.setBundleName(appData.bundleName);

    // Re-import HAP files to /user/ace/run/[bundleName]/
    DeviceFeatureVirtualFS.importFiles(appData.hapFiles, appData.bundleName);

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
    function makeBlobUrl(data, mimeType) {
      const blob = data instanceof ArrayBuffer
        ? new Blob([data], { type: mimeType })
        : new Blob([data], { type: mimeType });
      return URL.createObjectURL(blob);
    }

    function guessMimeType(ext) {
      ext = (ext || '').toLowerCase();
      if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
      if (ext === 'bmp') return 'image/bmp';
      if (ext === 'gif') return 'image/gif';
      if (ext === 'webp') return 'image/webp';
      return 'image/png';
    }

    function tryParseBin(data) {
      if (!data || data.byteLength <= 0) return null;
      const ab = data instanceof ArrayBuffer ? data : data.buffer;
      return parseBinImage(ab);
    }

    function tryData(data, ext) {
      if (!data) return null;
      // ArrayBuffer - binary data
      if (data instanceof ArrayBuffer) {
        const parsed = parseBinImage(data);
        if (parsed) return parsed;
        const mimeType = guessMimeType(ext);
        const blob = new Blob([data], { type: mimeType });
        return URL.createObjectURL(blob);
      }
      // Base64 string
      if (typeof data === 'string' && data.length > 0 && !data.startsWith('data:')) {
        if (/^[A-Za-z0-9+/=]+$/.test(data) && data.length > 100) {
          try {
            const binary = atob(data);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
              bytes[i] = binary.charCodeAt(i);
            }
            const ab = bytes.buffer;
            const parsed = parseBinImage(ab);
            if (parsed) return parsed;
            const mimeType = guessMimeType(ext);
            const blob = new Blob([ab], { type: mimeType });
            return URL.createObjectURL(blob);
          } catch (e) {}
        }
        return null;
      }
      return tryParseBin(data) || makeBlobUrl(data, guessMimeType(ext));
    }

    function findSameBase(store, dir, baseName, preferredKey) {
      const candidates = [];
      for (const key of Object.keys(store)) {
        if (dir && !key.startsWith(dir)) continue;
        const fileName = dir ? key.substring(dir.length) : key;
        const nameNoExt = fileName.replace(/\.[^.]+$/, '');
        if (nameNoExt === baseName) candidates.push(key);
      }
      const preferred = candidates.find(k => k === preferredKey);
      return preferred || candidates[0] || null;
    }

    function splitPath(normalized) {
      const extMatch = normalized.match(/\.(\w+)$/);
      const ext = extMatch ? extMatch[1].toLowerCase() : '';
      const base = extMatch ? normalized.substring(0, normalized.length - extMatch[0].length) : normalized;
      const slashIdx = base.lastIndexOf('/');
      const dir = slashIdx >= 0 ? base.substring(0, slashIdx + 1) : '';
      const baseName = slashIdx >= 0 ? base.substring(slashIdx + 1) : base;
      return { ext, dir, baseName, base };
    }

    const imageResolver = (src) => {
      const normalized = src.replace(/^\//, '');
      const { ext, dir, baseName, base } = splitPath(normalized);

      // Try to find image in hapFiles first (full path)
      if (appData.hapFiles) {
        // Try exact match with various prefixes
        const possiblePaths = [
          normalized,
          'assets/entry/resources/' + normalized,
          'assets/entry/resources/base/media/' + normalized,
          'assets/js/default/' + normalized,
          'assets/js/' + normalized,
        ];
        for (const p of possiblePaths) {
          const data = appData.hapFiles[p];
          if (data) return tryData(data, ext);
        }

        // Try to find by base name in hapFiles
        for (const [key, data] of Object.entries(appData.hapFiles)) {
          const keyBase = key.replace(/\.[^.]+$/, '').split('/').pop();
          if (keyBase === baseName) return tryData(data, ext);
        }
      }

      // Modules: exact match first, then same base name (prefer same ext)
      let data = appData.modules[normalized];
      if (data) return tryData(data, ext);

      const modKey = findSameBase(appData.modules, dir, baseName, normalized);
      if (modKey) {
        data = appData.modules[modKey];
        if (data) return tryData(data, modKey.match(/\.(\w+)$/)?.[1]);
      }

      // Resources: try each prefix, exact match then same base name
      const noCommon = normalized.replace(/^common\//, '');
      const resourcePaths = ['base/media/', 'rawfile/'];
      for (const prefix of resourcePaths) {
        const resExact = prefix + noCommon;
        data = appData.resources?.[resExact];
        if (data) return makeBlobUrl(data, guessMimeType(ext));

        const resPreferred = prefix + noCommon;
        const resKey = findSameBase(appData.resources, prefix, baseName, resPreferred);
        if (resKey) {
          data = appData.resources[resKey];
          if (data) return makeBlobUrl(data, guessMimeType(resKey.match(/\.(\w+)$/)?.[1]));
        }
      }

      return src;
    };
    Sandbox.setImageSrcResolver(imageResolver);
    DeviceFeatureDisplay.setImageSrcResolver(imageResolver);
  }

  async function loadAppFile(file) {
    if (typeof JSZip === 'undefined') {
      log('Libraries still loading, please wait...', 'warn');
      return;
    }
    log('Loading: ' + file.name, 'info');
    try {
      // Destroy current page and app lifecycle
      DeviceFeaturePageNav.clear();
      DeviceFeatureAppLifecycle.callOnDestroy();

      // Destroy old sandbox, create fresh one
      Sandbox.destroy();
      Sandbox = createSandbox();

      const appData = await Unpacker.loadFromFile(file);
      _appData = appData;

      // Set bundle name for file system paths
      DeviceFeatureVirtualFS.setBundleName(appData.bundleName);

      // Register image src resolver
      setupImageResolver(appData);

      log('Bundle: ' + appData.bundleName, 'info');
      log('Version: ' + appData.version + ' | Device: ' + appData.deviceType, 'info');
      log('Pages: ' + appData.pages.join(', '), 'info');
      log('HAP files: ' + Object.keys(appData.hapFiles || {}).length, 'info');
      const jsModules = Object.keys(appData.modules).filter(k => k.endsWith('.js'));
      log('JS modules: ' + jsModules.join(', '), 'info');
      if (appData._configRaw) log('Config: ' + appData._configRaw, 'info');
      const hapFiles = appData.hapFiles || {};
      const jsFiles = Object.keys(hapFiles).filter(f => f.endsWith('.js') && !f.endsWith('.bc'));
      const cssFiles = Object.keys(hapFiles).filter(f => f.endsWith('.css'));
      log('HAP .js files: ' + jsFiles.join(', '), 'info');
      log('HAP .css files: ' + cssFiles.join(', '), 'info');
      log('Module keys: ' + Object.keys(appData.modules).join(', '), 'info');

      const infoDiv = document.getElementById('app-info');
      if (infoDiv) infoDiv.textContent = appData.bundleName + ' v' + appData.version;

      DeviceFeatureVirtualFS.clear();
      DeviceFeaturePageNav.clear();

      // Import all HAP files to /user/ace/run/[bundleName]/
      DeviceFeatureVirtualFS.importFiles(appData.hapFiles, appData.bundleName);
      const hapFileCount = Object.keys(appData.hapFiles || {}).length;
      log('Imported ' + hapFileCount + ' files to /user/ace/run/' + appData.bundleName + '/', 'info');
      log('Internal URI: internal://app/ → /user/ace/data/' + appData.bundleName + '/', 'info');

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
