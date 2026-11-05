/**
 * MarkPDF - Advanced HTML to Markdown Converter
 * Converts DOM elements and HTML strings into clean, formatted Markdown.
 * Preserves images (including srcset, lazy-loaded, SVGs, and picture sources).
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.htmlToMarkdown = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  // Escape markdown special characters in plain text
  function escapeMarkdownText(text) {
    if (!text) return '';
    return text
      .replace(/\\/g, '\\\\')
      .replace(/\*/g, '\\*')
      .replace(/_/g, '\\_')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/`/g, '\\`');
  }

  // Resolve relative URLs against a base URL
  function resolveUrl(url, baseUrl) {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;
    if (!baseUrl) return url;
    try {
      return new URL(url, baseUrl).href;
    } catch (e) {
      return url;
    }
  }

  // Check if an element should be ignored (scripts, styles, ads, buttons)
  function isIgnoredElement(el) {
    if (!el || el.nodeType !== 1) return false;
    const tagName = el.tagName.toLowerCase();
    if (['script', 'style', 'noscript', 'template'].includes(tagName)) return true;

    // Ignore interactive utility buttons on pages (e.g. "Copy code", "Like", "Share", "Report")
    const cls = (el.className || '').toString().toLowerCase();
    const role = (el.getAttribute('role') || '').toLowerCase();
    const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();

    if (tagName === 'button') {
      if (
        cls.includes('copy') ||
        cls.includes('share') ||
        cls.includes('feedback') ||
        ariaLabel.includes('copy') ||
        ariaLabel.includes('share')
      ) {
        return true;
      }
    }

    if (cls.includes('ad-container') || cls.includes('advertisement') || cls.includes('cookie-banner')) {
      return true;
    }

    // Check style display: none
    const style = el.getAttribute('style') || '';
    if (style.includes('display: none') || style.includes('display:none') || style.includes('visibility: hidden')) {
      return true;
    }

    return false;
  }

  // Extract the highest-fidelity image URL from an <img> element
  function extractBestImageSrc(img, baseUrl) {
    if (!img) return '';

    // Check currentSrc first if available in active DOM
    if (img.currentSrc && !isPlaceholderImage(img.currentSrc)) {
      return resolveUrl(img.currentSrc, baseUrl);
    }

    // Check picture element parent sources
    if (img.parentElement && img.parentElement.tagName.toLowerCase() === 'picture') {
      const sources = Array.from(img.parentElement.querySelectorAll('source'));
      for (const s of sources) {
        const srcset = s.getAttribute('srcset') || s.getAttribute('data-srcset');
        if (srcset) {
          const candidates = srcset.split(',').map(c => c.trim().split(/\s+/)[0]).filter(Boolean);
          if (candidates.length > 0) {
            const best = candidates[candidates.length - 1];
            if (!isPlaceholderImage(best)) return resolveUrl(best, baseUrl);
          }
        }
      }
    }

    // Check srcset attribute on img
    const srcset = img.getAttribute('srcset') || img.getAttribute('data-srcset');
    if (srcset) {
      const candidates = srcset.split(',').map(c => c.trim().split(/\s+/)[0]).filter(Boolean);
      if (candidates.length > 0) {
        const best = candidates[candidates.length - 1];
        if (!isPlaceholderImage(best)) return resolveUrl(best, baseUrl);
      }
    }

    // Check data-src, data-original, and common lazy load attributes
    const lazyAttributes = [
      'data-src',
      'data-original',
      'data-lazy-src',
      'data-actualsrc',
      'data-url',
      'data-zoom-src',
      'data-hi-res-src',
      'data-full-url'
    ];

    for (const attr of lazyAttributes) {
      const val = img.getAttribute(attr);
      if (val && !isPlaceholderImage(val)) {
        return resolveUrl(val, baseUrl);
      }
    }

    // Check standard src attribute
    const src = img.getAttribute('src');
    if (src && !isPlaceholderImage(src)) {
      return resolveUrl(src, baseUrl);
    }

    // Fallback to any src even if placeholder
    return src ? resolveUrl(src, baseUrl) : (img.currentSrc ? resolveUrl(img.currentSrc, baseUrl) : '');
  }

  // Helper to check if a URL is a tiny 1x1 spacer GIF or blank SVG placeholder
  function isPlaceholderImage(url) {
    if (!url) return true;
    if (url.includes('data:image/gif;base64,R0lGODlhAQAB') || url.includes('data:image/svg+xml;base64,PHN2Zy')) {
      return true;
    }
    // Check 1x1 spacer images
    if (url.includes('spacer.gif') || url.includes('blank.gif') || url.includes('transparent.png')) {
      return true;
    }
    return false;
  }

  // Serialize an SVG element into a clean data URI
  function serializeSvg(svgEl) {
    try {
      if (typeof XMLSerializer !== 'undefined') {
        const serializer = new XMLSerializer();
        let svgString = serializer.serializeToString(svgEl);

        // Ensure xmlns is present
        if (!svgString.includes('xmlns=')) {
          svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
        }

        // Check if SVG has width and height
        const rect = svgEl.getBoundingClientRect ? svgEl.getBoundingClientRect() : null;
        const w = (rect && rect.width) ? Math.round(rect.width) : (svgEl.getAttribute('width') || '100');
        const h = (rect && rect.height) ? Math.round(rect.height) : (svgEl.getAttribute('height') || '100');

        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
      }
    } catch (e) {
      console.warn('Could not serialize SVG:', e);
    }
    return '';
  }

  // Extract CSS background-image if element is used as an image container
  function extractBackgroundImage(el, baseUrl) {
    const style = el.getAttribute('style') || '';
    const match = style.match(/background(?:-image)?\s*:\s*url\((['"]?)(.*?)\1\)/i);
    if (match && match[2] && !isPlaceholderImage(match[2])) {
      return resolveUrl(match[2], baseUrl);
    }
    return '';
  }

  // Check if an element is styled as bold (via tags, attributes, classes, or computed styles)
  function checkIsBold(el) {
    if (!el || el.nodeType !== 1) return false;
    const tagName = el.tagName.toLowerCase();

    // Headings handle their own bold styling in markdown via '# ' syntax
    if (/^h[1-6]$/.test(tagName)) return false;

    // Native bold/term tags
    if (['strong', 'b', 'dt', 'summary'].includes(tagName)) return true;

    // Inline style
    const style = el.getAttribute('style') || '';
    if (/font-weight\s*:\s*(?:bold|bolder|[6-9]00)/i.test(style)) return true;

    // CSS class checks (Tailwind, Bootstrap, modern roadmaps/docs)
    const cls = (el.className || '').toString().toLowerCase();
    if (/\b(?:font-(?:bold|semibold|extrabold|black)|fw-(?:bold|semibold|bolder)|font-weight-bold|bold|semibold)\b/i.test(cls)) {
      return true;
    }
    // Also check if class has title/heading with medium/semibold
    if (/(?:item-title|pattern-title|card-title|section-title|entry-title|roadmap-title)/i.test(cls)) {
      return true;
    }

    // Role heading
    if (el.getAttribute('role') === 'heading') return true;

    // Computed style if attached to live DOM
    try {
      const win = el.ownerDocument ? el.ownerDocument.defaultView : (typeof window !== 'undefined' ? window : null);
      if (win && win.getComputedStyle) {
        const comp = win.getComputedStyle(el);
        if (comp) {
          const fw = comp.fontWeight;
          const num = parseInt(fw, 10);
          if (fw === 'bold' || fw === 'bolder' || (!isNaN(num) && num >= 600)) {
            return true;
          }
          if (!isNaN(num) && num >= 500 && (cls.includes('title') || cls.includes('header') || cls.includes('heading') || cls.includes('term') || cls.includes('name'))) {
            return true;
          }
        }
      }
    } catch (e) {}

    return false;
  }

  // Check if an element is styled as italic
  function checkIsItalic(el) {
    if (!el || el.nodeType !== 1) return false;
    const tagName = el.tagName.toLowerCase();
    if (['em', 'i'].includes(tagName)) return true;

    const style = el.getAttribute('style') || '';
    if (/font-style\s*:\s*italic/i.test(style)) return true;

    const cls = (el.className || '').toString().toLowerCase();
    if (/\b(?:italic|font-italic)\b/i.test(cls)) return true;

    try {
      const win = el.ownerDocument ? el.ownerDocument.defaultView : (typeof window !== 'undefined' ? window : null);
      if (win && win.getComputedStyle) {
        const comp = win.getComputedStyle(el);
        if (comp && comp.fontStyle === 'italic') {
          return true;
        }
      }
    } catch (e) {}

    return false;
  }

  // Detect code language from class list
  function detectCodeLanguage(el) {
    const cls = (el.className || '') + ' ' + (el.parentElement ? el.parentElement.className || '' : '');
    const match = cls.match(/(?:language|lang)-([a-zA-Z0-9_-]+)/i);
    if (match) return match[1].toLowerCase();
    const dataLang = el.getAttribute('data-lang') || el.getAttribute('data-language') ||
      (el.parentElement ? el.parentElement.getAttribute('data-language') || el.parentElement.getAttribute('data-lang') : null);
    if (dataLang) return dataLang.toLowerCase();
    return '';
  }

  // Convert table node to Markdown table
  function convertTable(tableNode, baseUrl) {
    const rows = Array.from(tableNode.querySelectorAll('tr'));
    if (rows.length === 0) return '';

    const tableData = [];
    const alignments = [];

    rows.forEach((tr) => {
      const rowCells = [];
      const cells = Array.from(tr.querySelectorAll('th, td'));
      cells.forEach((cell, colIndex) => {
        let align = 'left';
        const alignAttr = (cell.getAttribute('align') || '').toLowerCase();
        const style = (cell.getAttribute('style') || '').toLowerCase();
        if (alignAttr === 'right' || style.includes('text-align: right') || style.includes('text-align:right')) {
          align = 'right';
        } else if (alignAttr === 'center' || style.includes('text-align: center') || style.includes('text-align:center')) {
          align = 'center';
        }

        if (!alignments[colIndex]) {
          alignments[colIndex] = align;
        }

        const cellContent = nodeToMarkdown(cell, { baseUrl, inTable: true }).trim().replace(/\n+/g, ' ').replace(/\|/g, '\\|');
        rowCells.push(cellContent || ' ');
      });
      if (rowCells.length > 0) {
        tableData.push(rowCells);
      }
    });

    if (tableData.length === 0) return '';

    // Calculate maximum columns
    let maxCols = Math.max(...tableData.map(r => r.length));
    if (maxCols === 0) return '';

    // Pad rows that have fewer columns
    tableData.forEach(r => {
      while (r.length < maxCols) r.push(' ');
    });

    let md = '\n';
    const headerRow = tableData[0];
    md += '| ' + headerRow.join(' | ') + ' |\n';

    // Alignment separator row
    const sepRow = [];
    for (let c = 0; c < maxCols; c++) {
      const align = alignments[c] || 'left';
      if (align === 'right') {
        sepRow.push('---:');
      } else if (align === 'center') {
        sepRow.push(':---:');
      } else {
        sepRow.push('---');
      }
    }
    md += '| ' + sepRow.join(' | ') + ' |\n';

    // Body rows
    for (let i = 1; i < tableData.length; i++) {
      md += '| ' + tableData[i].join(' | ') + ' |\n';
    }
    md += '\n';

    return md;
  }

  // Recursive DOM converter
  function nodeToMarkdown(node, options = {}) {
    if (!node) return '';

    const baseUrl = options.baseUrl || '';
    const listDepth = options.listDepth || 0;
    const inTable = options.inTable || false;
    const isParentBold = options.isParentBold || false;
    const isParentItalic = options.isParentItalic || false;

    // Text node
    if (node.nodeType === 3) {
      let text = node.nodeValue || '';
      if (!options.preserveWhitespace) {
        text = text.replace(/[\r\n\t]+/g, ' ');
      }
      return text;
    }

    // Comment node
    if (node.nodeType === 8) {
      return '';
    }

    if (node.nodeType !== 1) {
      return '';
    }

    const el = node;
    if (isIgnoredElement(el)) {
      return '';
    }

    const tagName = el.tagName.toLowerCase();

    // Check if this element is bold or italic
    const isHeading = /^h[1-6]$/.test(tagName);
    const isBold = !isParentBold && !isHeading && checkIsBold(el);
    const isItalic = !isParentItalic && checkIsItalic(el);

    const nextOptions = {
      ...options,
      isParentBold: isParentBold || isBold || isHeading,
      isParentItalic: isParentItalic || isItalic
    };

    // SVG elements (diagrams, logos, charts)
    if (tagName === 'svg') {
      const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
      // Skip tiny decorative icons (< 14px)
      if (rect && (rect.width < 14 || rect.height < 14)) {
        return '';
      }
      const dataUri = serializeSvg(el);
      if (dataUri) {
        const alt = el.getAttribute('aria-label') || el.getAttribute('title') || 'Illustration';
        return `\n\n![${alt}](${dataUri})\n\n`;
      }
      return '';
    }

    // Preformatted code block
    if (tagName === 'pre') {
      const codeEl = el.querySelector('code') || el;
      const lang = detectCodeLanguage(codeEl);
      const codeText = codeEl.textContent || '';
      const cleanCode = codeText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      return `\n\n\`\`\`${lang}\n${cleanCode.trim()}\n\`\`\`\n\n`;
    }

    // Tables
    if (tagName === 'table') {
      return convertTable(el, baseUrl);
    }

    // Check for background-image on hero / card divs
    if (tagName === 'div' || tagName === 'figure' || tagName === 'span') {
      const bgImg = extractBackgroundImage(el, baseUrl);
      if (bgImg) {
        const alt = el.getAttribute('aria-label') || el.getAttribute('title') || 'Cover Image';
        return `\n\n![${alt}](${bgImg})\n\n`;
      }
    }

    // Recurse children
    let childrenMd = '';
    const childNodes = Array.from(el.childNodes);
    for (const child of childNodes) {
      childrenMd += nodeToMarkdown(child, nextOptions);
    }

    // Formatting rules
    switch (tagName) {
      case 'h1':
        return `\n\n# ${childrenMd.trim()}\n\n`;
      case 'h2':
        return `\n\n## ${childrenMd.trim()}\n\n`;
      case 'h3':
        return `\n\n### ${childrenMd.trim()}\n\n`;
      case 'h4':
        return `\n\n#### ${childrenMd.trim()}\n\n`;
      case 'h5':
        return `\n\n##### ${childrenMd.trim()}\n\n`;
      case 'h6':
        return `\n\n###### ${childrenMd.trim()}\n\n`;

      case 'p':
      case 'div':
      case 'section':
      case 'article':
      case 'main':
      case 'header':
      case 'footer': {
        const trimmed = childrenMd.trim();
        if (!trimmed) return '';
        let formatted = trimmed;
        if (isBold) {
          formatted = `**${formatted}**`;
        } else if (isItalic) {
          formatted = `*${formatted}*`;
        }
        return `\n\n${formatted}\n\n`;
      }

      case 'dt':
      case 'summary': {
        const trimmed = childrenMd.trim();
        if (!trimmed) return '';
        return `\n\n**${trimmed}**\n\n`;
      }

      case 'dd': {
        const trimmed = childrenMd.trim();
        return trimmed ? `\n\n${trimmed}\n\n` : '';
      }

      case 'strong':
      case 'b': {
        const trimmed = childrenMd.trim();
        return trimmed ? `**${trimmed}**` : '';
      }

      case 'em':
      case 'i': {
        const trimmed = childrenMd.trim();
        return trimmed ? `*${trimmed}*` : '';
      }

      case 'del':
      case 's':
      case 'strike': {
        const trimmed = childrenMd.trim();
        return trimmed ? `~~${trimmed}~~` : '';
      }

      case 'code': {
        // If not inside pre
        if (el.closest('pre')) {
          return childrenMd;
        }
        const text = el.textContent || '';
        return text ? `\`${text}\`` : '';
      }

      case 'blockquote': {
        const lines = childrenMd.trim().split('\n');
        const quoted = lines.map(line => `> ${line}`).join('\n');
        return `\n\n${quoted}\n\n`;
      }

      case 'a': {
        const href = el.getAttribute('href');
        const linkText = childrenMd.trim() || el.getAttribute('title') || href || '';
        if (!href || href.startsWith('javascript:')) {
          return linkText;
        }
        const fullHref = resolveUrl(href, baseUrl);
        return `[${linkText}](${fullHref})`;
      }

      case 'img': {
        const bestSrc = extractBestImageSrc(el, baseUrl);
        if (!bestSrc) return '';
        const alt = el.getAttribute('alt') || el.getAttribute('title') || 'Image';
        return `\n\n![${alt}](${bestSrc})\n\n`;
      }

      case 'hr':
        return '\n\n---\n\n';

      case 'br':
        return '\n';

      case 'ul': {
        let ulContent = '';
        const items = Array.from(el.children).filter(c => c.tagName.toLowerCase() === 'li');
        items.forEach(li => {
          // Check task item
          const checkbox = li.querySelector('input[type="checkbox"]');
          let prefix = '- ';
          if (checkbox) {
            prefix = checkbox.checked ? '- [x] ' : '- [ ] ';
          }
          const indent = '  '.repeat(listDepth);
          const liText = nodeToMarkdown(li, { ...nextOptions, listDepth: listDepth + 1 }).trim();
          ulContent += `${indent}${prefix}${liText}\n`;
        });
        return `\n\n${ulContent}\n`;
      }

      case 'ol': {
        let olContent = '';
        const start = parseInt(el.getAttribute('start') || '1', 10);
        const items = Array.from(el.children).filter(c => c.tagName.toLowerCase() === 'li');
        items.forEach((li, idx) => {
          const num = start + idx;
          const indent = '  '.repeat(listDepth);
          const liText = nodeToMarkdown(li, { ...nextOptions, listDepth: listDepth + 1 }).trim();
          olContent += `${indent}${num}. ${liText}\n`;
        });
        return `\n\n${ulContent}\n`;
      }

      case 'li': {
        const trimmed = childrenMd.trim();
        if (!trimmed) return '';
        if (isBold) return `**${trimmed}**`;
        if (isItalic) return `*${trimmed}*`;
        return trimmed;
      }

      default: {
        const trimmed = childrenMd.trim();
        if (!trimmed) return childrenMd;
        if (isBold) {
          const leadingSpace = (childrenMd.match(/^\s+/) || [''])[0];
          const trailingSpace = (childrenMd.match(/\s+$/) || [''])[0];
          return `${leadingSpace}**${trimmed}**${trailingSpace}`;
        }
        if (isItalic) {
          const leadingSpace = (childrenMd.match(/^\s+/) || [''])[0];
          const trailingSpace = (childrenMd.match(/\s+$/) || [''])[0];
          return `${leadingSpace}*${trimmed}*${trailingSpace}`;
        }
        return childrenMd;
      }
    }
  }

  // Main converter function
  function convert(input, options = {}) {
    let rootNode;
    const baseUrl = options.baseUrl || (typeof window !== 'undefined' ? window.location.href : '');

    if (typeof input === 'string') {
      if (typeof DOMParser !== 'undefined') {
        const parser = new DOMParser();
        const doc = parser.parseFromString(input, 'text/html');
        rootNode = doc.body;
      } else {
        throw new Error('DOMParser is not available to parse HTML string.');
      }
    } else if (input && input.nodeType) {
      rootNode = input;
    } else {
      return '';
    }

    const rawMd = nodeToMarkdown(rootNode, { baseUrl, ...options });

    // Clean up multiple newlines, trailing spaces
    const cleaned = rawMd
      .replace(/[ \t]+$/gm, '') // remove trailing spaces per line
      .replace(/\n{3,}/g, '\n\n') // maximum two consecutive newlines
      .trim();

    return cleaned;
  }

  return {
    convert: convert
  };
});
