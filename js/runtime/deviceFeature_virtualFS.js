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
  const LS_BINARY_PREFIX = 'hmlwsim_binary_';
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
      if (key.startsWith(LS_BINARY_PREFIX)) {
        const path = key.substring(LS_BINARY_PREFIX.length);
        const binary = atob(localStorage.getItem(key));
        store.set(path, Uint8Array.from(binary, ch => ch.charCodeAt(0)).buffer);
      } else if (key.startsWith(LS_PREFIX)) {
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
      const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : new Uint8Array(content);
      const start = callbacks && callbacks.position !== undefined ? Math.max(0, callbacks.position) : 0;
      const end = callbacks && callbacks.length !== undefined
        ? Math.min(bytes.length, start + Math.max(0, callbacks.length))
        : bytes.length;
      const text = new TextDecoder('utf-8').decode(bytes.slice(start, end));
      if (callbacks && typeof callbacks.success === 'function') callbacks.success({ text });
    } else {
      if (callbacks && typeof callbacks.fail === 'function') callbacks.fail('File not found', 301);
    }
    if (callbacks && typeof callbacks.complete === 'function') callbacks.complete();
  }

  /**
   * Read binary file
   */
  function readArrayBuffer(uri, callbacks) {
    const path = normalizePath(uri);
    const content = store.get(path);
    if (content !== undefined) {
      const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : new Uint8Array(content);
      const start = callbacks && callbacks.position !== undefined ? Math.max(0, callbacks.position) : 0;
      const end = callbacks && callbacks.length !== undefined
        ? Math.min(bytes.length, start + Math.max(0, callbacks.length))
        : bytes.length;
      if (callbacks && typeof callbacks.success === 'function') callbacks.success({ buffer: bytes.slice(start, end) });
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
      const previous = store.get(path) || '';
      if (previous instanceof ArrayBuffer) {
        const tail = new TextEncoder().encode(text);
        const bytes = new Uint8Array(previous.byteLength + tail.length);
        bytes.set(new Uint8Array(previous));
        bytes.set(tail, previous.byteLength);
        content = bytes.buffer;
      } else {
        content = previous + text;
      }
    }
    store.set(path, content);
    persist(path, content);
    if (callbacks && typeof callbacks.success === 'function') callbacks.success();
    if (callbacks && typeof callbacks.complete === 'function') callbacks.complete();
  }

  /**
   * Write file (alias for writeText without append, used by app.js)
   */
  function writeFile(uri, text) {
    const path = normalizePath(uri);
    store.set(path, text);
    persist(path, text);
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
    try {
      localStorage.removeItem(LS_PREFIX + path);
      localStorage.removeItem(LS_BINARY_PREFIX + path);
    } catch (e) {}
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
    persist(dstPath, content);
    store.delete(srcPath);
    try {
      localStorage.removeItem(LS_PREFIX + srcPath);
      localStorage.removeItem(LS_BINARY_PREFIX + srcPath);
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
    persist(dstPath, content);
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
        size: store.get(path) instanceof ArrayBuffer ? store.get(path).byteLength : new TextEncoder().encode(store.get(path)).length,
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
      if (!(content instanceof ArrayBuffer) && typeof content !== 'string') continue;
      const packagePath = path.replace(/\\/g, '/');
      const normalized = resolvePath(prefix + packagePath);
      store.set(normalized, content);
      persist(normalized, content);
      // 安装时将 rawfile 释放到应用沙盒，文件内容仍保留原始字节。
      if (packagePath.startsWith('assets/entry/resources/rawfile/')) {
        const relative = packagePath.substring('assets/entry/resources/'.length);
        const dataPath = bundleName ? resolvePath('/user/ace/data/' + bundleName + '/' + relative) : relative;
        store.set(dataPath, content);
        persist(dataPath, content);
      }
    }
  }

  function persist(path, content) {
    try {
      localStorage.removeItem(LS_PREFIX + path);
      localStorage.removeItem(LS_BINARY_PREFIX + path);
      const binary = content instanceof ArrayBuffer;
      localStorage.setItem((binary ? LS_BINARY_PREFIX : LS_PREFIX) + path,
        binary ? arrayBufferToBase64(content) : content);
    } catch (e) {}
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
      if (key.startsWith(LS_PREFIX) || key.startsWith(LS_BINARY_PREFIX)) keys.push(key);
    }
    keys.forEach(k => localStorage.removeItem(k));
  }

  return { init, setBundleName, getBundleName, readText, readArrayBuffer, writeText, writeFile, list, mkdir, deleteFile, move, copy, getInfo, importFiles, clear };
})();
