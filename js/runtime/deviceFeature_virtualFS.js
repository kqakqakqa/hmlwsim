/**
 * Device Feature: Virtual Filesystem
 * Simulates real device file system structure:
 * - internal://app/ → /user/ace/data/[bundleName]/
 * - /user/ace/run/[bundleName]/ → extracted HAP files
 * Supports .. path traversal
 */
const DeviceFeatureVirtualFS = (() => {
  const store = new Map();
  const LS_PREFIX = 'hmlwsim_fs_';
  let _bundleName = '';

  function setBundleName(name) {
    _bundleName = name;
  }

  function getBundleName() {
    return _bundleName;
  }

  /**
   * Initialize from localStorage
   */
  function init() {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(LS_PREFIX)) {
        const path = key.substring(LS_PREFIX.length);
        store.set(path, localStorage.getItem(key));
      }
    }
  }

  /**
   * Resolve .. path segments
   */
  function resolvePath(path) {
    const parts = path.split('/').filter(Boolean);
    const resolved = [];
    for (const part of parts) {
      if (part === '..') {
        resolved.pop();
      } else if (part !== '.') {
        resolved.push(part);
      }
    }
    return resolved.join('/');
  }

  /**
   * Normalize URI to internal path
   * internal://app/xxx → /user/ace/data/[bundleName]/xxx
   * Supports .. traversal
   */
  function normalizePath(uri) {
    let normalized = uri.replace(/\\/g, '/');
    
    // Handle internal://app/ protocol
    if (normalized.startsWith('internal://app')) {
      const rest = normalized.substring('internal://app'.length);
      const path = rest.startsWith('/') ? rest.substring(1) : rest;
      if (_bundleName) {
        return resolvePath('/user/ace/data/' + _bundleName + '/' + path);
      }
      return resolvePath(path);
    }
    
    // Handle absolute paths (including /user/ace/run/...)
    if (normalized.startsWith('/')) {
      return resolvePath(normalized);
    }
    
    return resolvePath(normalized);
  }

  /**
   * Convert internal path back to URI
   */
  function toInternalPath(normalized) {
    if (_bundleName) {
      const dataPrefix = '/user/ace/data/' + _bundleName + '/';
      if (normalized.startsWith(dataPrefix)) {
        return 'internal://app/' + normalized.substring(dataPrefix.length);
      }
    }
    return 'internal://app/' + normalized;
  }

  /**
   * Read text file
   */
  function readText(uri, callbacks) {
    const path = normalizePath(uri);
    const content = store.get(path);
    if (content !== undefined) {
      if (callbacks && typeof callbacks.success === 'function') callbacks.success({ text: content });
    } else {
      if (callbacks && typeof callbacks.fail === 'function') callbacks.fail('File not found', 301);
    }
    if (callbacks && typeof callbacks.complete === 'function') callbacks.complete();
  }

  /**
   * Write text file
   */
  function writeText(uri, text, append, callbacks) {
    const path = normalizePath(uri);
    let content = text;
    if (append) {
      content = (store.get(path) || '') + text;
    }
    store.set(path, content);
    try {
      localStorage.setItem(LS_PREFIX + path, content);
    } catch (e) {
      // localStorage full - silently fail
    }
    if (callbacks && typeof callbacks.success === 'function') callbacks.success();
    if (callbacks && typeof callbacks.complete === 'function') callbacks.complete();
  }

  /**
   * Write file (alias for writeText without append, used by app.js)
   */
  function writeFile(uri, text) {
    const path = normalizePath(uri);
    store.set(path, text);
    try {
      localStorage.setItem(LS_PREFIX + path, text);
    } catch (e) {}
  }

  /**
   * List directory
   */
  function list(uri, callbacks) {
    const dirPath = normalizePath(uri).replace(/\\/g, '/');
    const fileList = [];

    for (const path of store.keys()) {
      if (path.startsWith(dirPath)) {
        const relative = path.substring(dirPath.length);
        if (relative.includes('/') || relative.includes('\\')) {
          const parts = relative.replace(/\\/g, '/').split('/').filter(Boolean);
          if (parts.length === 1) {
            fileList.push({ uri: toInternalPath(path), type: 0 }); // 0 = file
          } else {
            const dirName = parts[0];
            const dirEntry = fileList.find(f => f.uri.endsWith(dirName));
            if (!dirEntry) {
              fileList.push({
                uri: toInternalPath(dirPath + '/' + dirName),
                type: 1 // 1 = directory
              });
            }
          }
        } else if (relative && !relative.includes('/') && !relative.includes('\\')) {
          fileList.push({ uri: toInternalPath(path), type: 0 });
        }
      }
    }

    if (callbacks && typeof callbacks.success === 'function') callbacks.success({ fileList });
    if (callbacks && typeof callbacks.complete === 'function') callbacks.complete();
  }

  /**
   * Create directory
   */
  function mkdir(uri, callbacks) {
    const path = normalizePath(uri);
    // Directories are implicit in our Map-based FS
    if (callbacks && typeof callbacks.success === 'function') callbacks.success();
    if (callbacks && typeof callbacks.complete === 'function') callbacks.complete();
  }

  /**
   * Delete file
   */
  function deleteFile(uri, callbacks) {
    const path = normalizePath(uri);
    store.delete(path);
    try { localStorage.removeItem(LS_PREFIX + path); } catch (e) {}
    if (callbacks && typeof callbacks.success === 'function') callbacks.success();
    if (callbacks && typeof callbacks.complete === 'function') callbacks.complete();
  }

  /**
   * Move file
   */
  function move(srcUri, dstUri, callbacks) {
    const srcPath = normalizePath(srcUri);
    const dstPath = normalizePath(dstUri);
    const content = store.get(srcPath);
    if (content === undefined) {
      if (callbacks && typeof callbacks.fail === 'function') callbacks.fail('Source not found', 301);
      if (callbacks && typeof callbacks.complete === 'function') callbacks.complete();
      return;
    }
    store.set(dstPath, content);
    store.delete(srcPath);
    try {
      localStorage.setItem(LS_PREFIX + dstPath, content);
      localStorage.removeItem(LS_PREFIX + srcPath);
    } catch (e) {}
    if (callbacks && typeof callbacks.success === 'function') callbacks.success();
    if (callbacks && typeof callbacks.complete === 'function') callbacks.complete();
  }

  /**
   * Copy file
   */
  function copy(srcUri, dstUri, callbacks) {
    const srcPath = normalizePath(srcUri);
    const dstPath = normalizePath(dstUri);
    const content = store.get(srcPath);
    if (content === undefined) {
      if (callbacks && typeof callbacks.fail === 'function') callbacks.fail('Source not found', 301);
      if (callbacks && typeof callbacks.complete === 'function') callbacks.complete();
      return;
    }
    store.set(dstPath, content);
    try { localStorage.setItem(LS_PREFIX + dstPath, content); } catch (e) {}
    if (callbacks && typeof callbacks.success === 'function') callbacks.success();
    if (callbacks && typeof callbacks.complete === 'function') callbacks.complete();
  }

  /**
   * Get info about a path
   */
  function getInfo(uri, callbacks) {
    const path = normalizePath(uri);
    if (store.has(path)) {
      if (callbacks && typeof callbacks.success === 'function') callbacks.success({
        size: store.get(path).length || 0,
        exist: true,
      });
    } else {
      if (callbacks && typeof callbacks.fail === 'function') callbacks.fail('Not found', 301);
    }
    if (callbacks && typeof callbacks.complete === 'function') callbacks.complete();
  }

  /**
   * Import files from unpacked app to /user/ace/run/[bundleName]/ path
   */
  function importFiles(files, bundleName) {
    const prefix = bundleName ? '/user/ace/run/' + bundleName + '/' : '';
    for (const [path, content] of Object.entries(files)) {
      const normalized = resolvePath(prefix + path.replace(/\\/g, '/'));
      let stored;
      if (content instanceof ArrayBuffer) {
        stored = arrayBufferToBase64(content);
      } else if (typeof content === 'string') {
        stored = content;
      } else {
        continue;
      }
      store.set(normalized, stored);
      try { localStorage.setItem(LS_PREFIX + normalized, stored); } catch (e) {}
    }
  }

  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function clear() {
    store.clear();
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(LS_PREFIX)) keys.push(key);
    }
    keys.forEach(k => localStorage.removeItem(k));
  }

  return { init, setBundleName, getBundleName, readText, writeText, writeFile, list, mkdir, deleteFile, move, copy, getInfo, importFiles, clear };
})();
