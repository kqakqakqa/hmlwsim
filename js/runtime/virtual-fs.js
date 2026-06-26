/**
 * Virtual Filesystem - Simulates internal://app/ storage
 */
const VirtualFS = (() => {
  const store = new Map();
  const LS_PREFIX = 'hmlwsim_fs_';

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

  function normalizePath(uri) {
    return uri.replace(/^internal:\/\/app\/?/, '').replace(/\\/g, '/');
  }

  function toInternalPath(normalized) {
    return 'internal://app/' + normalized;
  }

  /**
   * Read text file
   */
  function readText(uri, callbacks) {
    const path = normalizePath(uri);
    const content = store.get(path);
    if (content !== undefined) {
      callbacks.success && callbacks.success({ text: content });
    } else {
      callbacks.fail && callbacks.fail('File not found', 301);
    }
    callbacks.complete && callbacks.complete();
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
    callbacks.success && callbacks.success();
    callbacks.complete && callbacks.complete();
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
          // It's in a subdirectory - list immediate children
          const parts = relative.replace(/\\/g, '/').split('/').filter(Boolean);
          if (parts.length === 1) {
            fileList.push({ uri: toInternalPath(path), type: 0 }); // 0 = file
          } else {
            // Directory
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

    callbacks.success && callbacks.success({ fileList });
    callbacks.complete && callbacks.complete();
  }

  /**
   * Create directory
   */
  function mkdir(uri, callbacks) {
    const path = normalizePath(uri);
    // Directories are implicit in our Map-based FS
    callbacks.success && callbacks.success();
    callbacks.complete && callbacks.complete();
  }

  /**
   * Delete file
   */
  function deleteFile(uri, callbacks) {
    const path = normalizePath(uri);
    store.delete(path);
    try { localStorage.removeItem(LS_PREFIX + path); } catch (e) {}
    callbacks.success && callbacks.success();
    callbacks.complete && callbacks.complete();
  }

  /**
   * Move file
   */
  function move(srcUri, dstUri, callbacks) {
    const srcPath = normalizePath(srcUri);
    const dstPath = normalizePath(dstUri);
    const content = store.get(srcPath);
    if (content === undefined) {
      callbacks.fail && callbacks.fail('Source not found', 301);
      callbacks.complete && callbacks.complete();
      return;
    }
    store.set(dstPath, content);
    store.delete(srcPath);
    try {
      localStorage.setItem(LS_PREFIX + dstPath, content);
      localStorage.removeItem(LS_PREFIX + srcPath);
    } catch (e) {}
    callbacks.success && callbacks.success();
    callbacks.complete && callbacks.complete();
  }

  /**
   * Copy file
   */
  function copy(srcUri, dstUri, callbacks) {
    const srcPath = normalizePath(srcUri);
    const dstPath = normalizePath(dstUri);
    const content = store.get(srcPath);
    if (content === undefined) {
      callbacks.fail && callbacks.fail('Source not found', 301);
      callbacks.complete && callbacks.complete();
      return;
    }
    store.set(dstPath, content);
    try { localStorage.setItem(LS_PREFIX + dstPath, content); } catch (e) {}
    callbacks.success && callbacks.success();
    callbacks.complete && callbacks.complete();
  }

  /**
   * Get info about a path
   */
  function getInfo(uri, callbacks) {
    const path = normalizePath(uri);
    if (store.has(path)) {
      callbacks.success && callbacks.success({
        size: store.get(path).length || 0,
        exist: true,
      });
    } else {
      callbacks.fail && callbacks.fail('Not found', 301);
    }
    callbacks.complete && callbacks.complete();
  }

  /**
   * Import files from unpacked app (rawfiles, etc.)
   */
  function importFiles(files) {
    for (const [path, content] of Object.entries(files)) {
      const normalized = path.replace(/\\/g, '/');
      if (typeof content === 'string') {
        store.set(normalized, content);
        try { localStorage.setItem(LS_PREFIX + normalized, content); } catch (e) {}
      } else if (content instanceof ArrayBuffer) {
        // Binary files - store as base64
        const base64 = arrayBufferToBase64(content);
        store.set(normalized, base64);
        try { localStorage.setItem(LS_PREFIX + normalized, base64); } catch (e) {}
      }
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

  return { init, readText, writeText, list, mkdir, deleteFile, move, copy, getInfo, importFiles, clear };
})();
