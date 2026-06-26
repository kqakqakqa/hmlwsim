/**
 * HML Compiler - Transpiles HML templates to HTML with data binding
 */
const HMLCompiler = (() => {

  // Map OHOS components to HTML
  const TAG_MAP = {
    'div': 'div',
    'text': 'span',
    'image': 'img',
    'list': 'div',
    'list-item': 'div',
    'stack': 'div',
    'input': 'input',
    'progress': 'progress',
    'slider': 'input',
    'switch': 'input',
    'canvas': 'canvas',
    'video': 'video',
  };

  const SELF_CLOSING = new Set(['image', 'input', 'progress', 'slider', 'switch']);

  /**
   * Compile HML string to HTML with binding markers
   * @param {string} hml - HML source
   * @param {Object} context - Data context for mustache resolution
   * @param {string} basePath - Base path for resolving relative imports
   * @returns {string} Compiled HTML
   */
  function compile(hml, context, basePath) {
    // Handle CSS imports first
    let cssImports = [];
    const cleaned = hml.replace(/@import\s+["']([^"']+)["'];?/g, (match, path) => {
      cssImports.push(resolvePath(basePath, path));
      return '';
    });

    const tokens = tokenize(cleaned);
    const ast = parse(tokens);
    return renderNode(ast, context, basePath);
  }

  /**
   * Extract CSS imports from HML
   */
  function extractCssImports(hml) {
    const imports = [];
    hml.replace(/@import\s+["']([^"']+)["'];?/g, (match, path) => {
      imports.push(path);
      return '';
    });
    return imports;
  }

  function resolvePath(base, relative) {
    if (!base) return relative;
    const baseParts = base.split('/').filter(Boolean);
    const relParts = relative.split('/').filter(Boolean);

    // Handle ../
    for (const part of relParts) {
      if (part === '..') {
        baseParts.pop();
      } else if (part !== '.') {
        baseParts.push(part);
      }
    }
    return baseParts.join('/');
  }

  // Simple tokenizer for HML
  function tokenize(hml) {
    const tokens = [];
    let i = 0;
    const len = hml.length;

    while (i < len) {
      // Comment <!-- ... -->
      if (hml.startsWith('<!--', i)) {
        const end = hml.indexOf('-->', i + 4);
        i = end > 0 ? end + 3 : len;
        continue;
      }

      // Text content
      if (hml[i] !== '<') {
        let end = hml.indexOf('<', i);
        if (end < 0) end = len;
        const text = hml.substring(i, end).trim();
        if (text) {
          tokens.push({ type: 'text', value: text });
        }
        i = end;
        continue;
      }

      // Self-closing tag
      if (hml[i + 1] === '/') {
        const end = hml.indexOf('>', i);
        i = end > 0 ? end + 1 : len;
        tokens.push({ type: 'close' });
        continue;
      }

      // Opening tag
      const tagMatch = hml.substring(i).match(/^<(\w[\w-]*)(\s[^>]*)?(\/?)>/);
      if (tagMatch) {
        const tagName = tagMatch[1];
        const attrsStr = tagMatch[2] || '';
        const selfClose = tagMatch[3] === '/' || SELF_CLOSING.has(tagName);
        tokens.push({ type: 'open', tag: tagName, attrs: parseAttrs(attrsStr), selfClose });
        i += tagMatch[0].length;
        continue;
      }

      i++;
    }

    return tokens;
  }

  function parseAttrs(str) {
    const attrs = {};
    // Match name="value" or name={{expr}} or on:event="handler"
    const re = /([\w:-]+)\s*=\s*"([^"]*)"/g;
    let m;
    while ((m = re.exec(str))) {
      attrs[m[1]] = m[2];
    }
    return attrs;
  }

  // Simple AST parser
  function parse(tokens) {
    let idx = 0;

    function parseNode() {
      if (idx >= tokens.length) return null;

      const tok = tokens[idx];
      if (tok.type === 'close') { idx++; return null; }
      if (tok.type === 'text') { idx++; return { type: 'text', value: tok.value }; }

      if (tok.type === 'open') {
        const node = {
          type: 'element',
          tag: tok.tag,
          attrs: tok.attrs,
          children: [],
          selfClose: tok.selfClose,
        };
        idx++;

        if (!tok.selfClose) {
          while (idx < tokens.length && tokens[idx].type !== 'close') {
            const child = parseNode();
            if (child) node.children.push(child);
          }
          if (idx < tokens.length) idx++; // skip close token
        }

        return node;
      }

      idx++;
      return null;
    }

    const root = { type: 'root', children: [] };
    while (idx < tokens.length) {
      const child = parseNode();
      if (child) root.children.push(child);
    }
    return root;
  }

  function renderNode(node, ctx, basePath) {
    if (!node) return '';

    if (node.type === 'text') {
      return resolveMustache(node.value, ctx);
    }

    if (node.type === 'element') {
      const htmlTag = TAG_MAP[node.tag] || node.tag;
      const isOHOSStack = node.tag === 'stack';
      const isOHOSText = node.tag === 'text';
      const isOHOSImage = node.tag === 'image';
      const isOHOSProgress = node.tag === 'progress';

      let classes = [];
      if (node.attrs.class) {
        classes.push(node.attrs.class);
      }
      if (isOHOSStack) classes.push('ohos-stack');
      if (isOHOSText) classes.push('ohos-text');
      if (isOHOSImage) classes.push('ohos-image');
      if (isOHOSProgress) classes.push('ohos-progress');

      let attrStr = '';
      for (const [key, val] of Object.entries(node.attrs)) {
        if (key === 'class') {
          attrStr += ` class="${resolveMustache(val, ctx)}"`;
        } else if (key === 'ref') {
          attrStr += ` data-ref="${val}"`;
        } else if (key.startsWith('on:')) {
          const event = key.substring(3);
          attrStr += ` data-event-${event}="${val}"`;
        } else if (key === 'style') {
          attrStr += ` style="${resolveMustacheStyle(val, ctx)}"`;
        } else if (key === 'src') {
          attrStr += ` src="${resolveMustache(val, ctx)}"`;
        } else {
          attrStr += ` ${key}="${resolveMustache(val, ctx)}"`;
        }
      }

      const children = node.children.map(c => renderNode(c, ctx, basePath)).join('');

      if (node.selfClose && htmlTag === 'img') {
        const src = node.attrs.src ? resolveMustache(node.attrs.src, ctx) : '';
        return `<img${attrStr}>`;
      }

      return `<${htmlTag}${attrStr}>${children}</${htmlTag}>`;
    }

    if (node.type === 'root') {
      return node.children.map(c => renderNode(c, ctx, basePath)).join('');
    }

    return '';
  }

  /**
   * Resolve mustache {{expr}} in a string
   */
  function resolveMustache(str, ctx) {
    return str.replace(/\{\{([^}]+)\}\}/g, (match, expr) => {
      expr = expr.trim();
      try {
        const val = evalExpr(expr, ctx);
        return val !== undefined && val !== null ? String(val) : '';
      } catch (e) {
        return '';
      }
    });
  }

  /**
   * Resolve mustache in style attributes
   */
  function resolveMustacheStyle(str, ctx) {
    return resolveMustache(str, ctx);
  }

  /**
   * Simple expression evaluator
   * Supports: variable, variable.path, 'string', number, ternary, concatenation
   */
  function evalExpr(expr, ctx) {
    // String literal
    if ((expr.startsWith('"') && expr.endsWith('"')) || (expr.startsWith("'") && expr.endsWith("'"))) {
      return expr.slice(1, -1);
    }

    // Number
    if (/^-?\d+(\.\d+)?$/.test(expr)) {
      return parseFloat(expr);
    }

    // Simple property access
    if (/^[\w.]+$/.test(expr)) {
      const parts = expr.split('.');
      let val = ctx;
      for (const part of parts) {
        if (val === undefined || val === null) return undefined;
        val = val[part];
      }
      return val;
    }

    // Ternary: a ? b : c
    const ternaryMatch = expr.match(/^(.+?)\s*\?\s*(.+?)\s*:\s*(.+)$/);
    if (ternaryMatch) {
      const cond = evalExpr(ternaryMatch[1], ctx);
      return cond ? evalExpr(ternaryMatch[2], ctx) : evalExpr(ternaryMatch[3], ctx);
    }

    // Concatenation with +
    if (expr.includes('+')) {
      const parts = expr.split('+').map(p => p.trim());
      return parts.map(p => evalExpr(p, ctx)).join('');
    }

    // Fallback: try property access
    try {
      const fn = new Function('ctx', `with(ctx) { return ${expr}; }`);
      return fn(ctx);
    } catch (e) {
      return undefined;
    }
  }

  return { compile, extractCssImports, resolveMustache, resolvePath };
})();
