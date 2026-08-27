/**
 * Unpacker - Extracts .app (ZIP) → .hap (ZIP) → JS/HML/CSS/resources
 */
const Unpacker = (() => {

  /**
   * Unpack an .app file (ArrayBuffer) and return structured app data
   * @param {ArrayBuffer} buffer - The .app file content
   * @returns {Promise<Object>} Parsed app data
   */
  async function unpack(buffer) {
    const outerZip = await JSZip.loadAsync(buffer);

    // Find the .hap file and pack.info
    let hapFile = null;
    let packInfo = null;

    for (const name of Object.keys(outerZip.files)) {
      if (name.endsWith('.hap')) hapFile = outerZip.files[name];
      if (name === 'pack.info') packInfo = outerZip.files[name];
    }

    if (!hapFile) throw new Error('No .hap file found in .app archive');

    // Parse pack.info if available
    let outerPackInfo = {};
    if (packInfo) {
      const text = await packInfo.async('text');
      outerPackInfo = parsePackInfo(text);
    }

    // Extract inner .hap
    const hapBuffer = await hapFile.async('arraybuffer');
    const hapZip = await JSZip.loadAsync(hapBuffer);

    const result = {
      bundleName: outerPackInfo.bundleName || 'unknown',
      version: outerPackInfo.version || '1.0.0',
      versionCode: outerPackInfo.versionCode || 1,
      deviceType: outerPackInfo.deviceType || 'liteWearable',
      pages: [],
      appJs: null,
      config: null,
      manifest: null,
      modules: {},
      resources: {},
      rawfiles: {},
      hapFiles: {},
    };

    // Extract files from HAP
    for (const [path, file] of Object.entries(hapZip.files)) {
      if (file.dir) continue;

      // Store ALL HAP files as ArrayBuffer
      result.hapFiles[path] = await file.async('arraybuffer');

      if (path === 'config.json') {
        const text = await file.async('text');
        result.config = JSON.parse(text);
        if (result.config.app) {
          result.bundleName = result.config.app.bundleName || result.bundleName;
          if (result.config.app.version) {
            result.version = result.config.app.version.name || result.version;
            result.versionCode = result.config.app.version.code || result.versionCode;
          }
        }
        if (result.config.module && result.config.module.deviceType) {
          result.deviceType = result.config.module.deviceType[0] || result.deviceType;
        }
        if (result.config.module && result.config.module.js) {
          const jsConfig = result.config.module.js[0];
          if (jsConfig && jsConfig.pages) {
            result.pages = jsConfig.pages;
          }
        }
        result._configRaw = JSON.stringify(result.config).substring(0, 2000);
      } else {
        const abilityMatch = path.match(/^assets\/js\/([^/]+)\//);
        if (abilityMatch) {
          const prefix = abilityMatch[0];
          const relPath = path.substring(prefix.length);
          if (relPath === 'manifest.json') {
            const text = await file.async('text');
            result.manifest = JSON.parse(text);
          } else if (relPath === 'app.js') {
            result.appJs = await file.async('text');
          } else if (relPath.endsWith('.js') && !relPath.endsWith('.bc')) {
            result.modules[relPath] = await file.async('text');
          } else if (relPath.endsWith('.hml')) {
            result.modules[relPath] = await file.async('text');
          } else if (relPath.endsWith('.css')) {
            result.modules[relPath] = await file.async('text');
          } else if (relPath.startsWith('common/')) {
            // For common files, store the content that was already read
            if (result.hapFiles[path] instanceof ArrayBuffer) {
              result.modules[relPath] = result.hapFiles[path];
            } else {
              result.modules[relPath] = await file.async('text');
            }
          }
        } else if (path.startsWith('assets/entry/resources/')) {
          const relativePath = path.replace('assets/entry/resources/', '');
          // For resources, store the content that was already read
          if (result.hapFiles[path] instanceof ArrayBuffer) {
            result.resources[relativePath] = result.hapFiles[path];
          } else if (typeof result.hapFiles[path] === 'string') {
            // Base64 encoded binary
            result.resources[relativePath] = result.hapFiles[path];
          } else {
            result.resources[relativePath] = await file.async('arraybuffer');
          }
        }
      }
    }

    return result;
  }

  /**
   * Parse pack.info text format
   * Format: key=value lines
   */
  function parsePackInfo(text) {
    const result = {};
    const lines = text.split('\n');
    for (const line of lines) {
      const idx = line.indexOf('=');
      if (idx > 0) {
        const key = line.substring(0, idx).trim();
        const value = line.substring(idx + 1).trim();
        if (key === 'bundleName') result.bundleName = value;
        if (key === 'versionName') result.version = value;
        if (key === 'versionCode') result.versionCode = parseInt(value) || 1;
        if (key === 'deviceType') result.deviceType = value;
      }
    }
    return result;
  }

  /**
   * Load a .app file from a File object (drag-and-drop or file input)
   */
  async function loadFromFile(file) {
    const buffer = await file.arrayBuffer();
    return unpack(buffer);
  }

  return { unpack, loadFromFile };
})();
