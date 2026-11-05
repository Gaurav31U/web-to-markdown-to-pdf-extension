/**
 * MarkPDF - Markdown to HTML Renderer
 * Converts Markdown text into clean, accessible, semantic HTML with styling classes.
 * Ensures images load eagerly and are fully ready for print/PDF export.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.markdownToHtml = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  function escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function cleanUrl(url) {
    if (!url) return '';
    return url.trim().replace(/^<|>$/g, '');
  }

  function parseInline(text) {
    if (!text) return '';

    // First preserve inline code: `code`
    const codes = [];
    text = text.replace(/`([^`]+)`/g, (match, code) => {
      const idx = codes.length;
      codes.push(`<code>${escapeHtml(code)}</code>`);
      return `@@CODE_${idx}@@`;
    });

    // Images: ![alt](url)
    text = text.replace(/!\[([^\]]*)\]\((.*?)\)/g, (match, alt, url) => {
      const safeUrl = cleanUrl(url);
      const safeAlt = escapeHtml(alt.trim());
      const caption = safeAlt && safeAlt !== 'Image' && safeAlt !== 'Illustration' ? `<figcaption class="markpdf-figcaption">${safeAlt}</figcaption>` : '';
      return `<figure class="markpdf-figure"><img src="${safeUrl}" alt="${safeAlt}" loading="eager" decoding="sync" class="markpdf-img">${caption}</figure>`;
    });

    // Links: [text](url)
    text = text.replace(/\[([^\]]+)\]\((.*?)\)/g, (match, linkText, url) => {
      const safeUrl = escapeHtml(cleanUrl(url));
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${parseInline(linkText)}</a>`;
    });

    // Bold + Italic: ***text***
    text = text.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');

    // Bold: **text** or __text__
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');

    // Italic: *text* or _text_
    text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    text = text.replace(/_([^_]+)_/g, '<em>$1</em>');

    // Strikethrough: ~~text~~
    text = text.replace(/~~([^~]+)~~/g, '<del>$1</del>');

    // Restore inline codes
    text = text.replace(/@@CODE_(\d+)@@/g, (match, idx) => codes[parseInt(idx, 10)]);

    return text;
  }

  function render(markdown, options = {}) {
    if (!markdown) return '';

    // Normalize newlines
    const lines = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    let html = '';
    let i = 0;

    while (i < lines.length) {
      let line = lines[i];

      // Empty line
      if (!line.trim()) {
        i++;
        continue;
      }

      // Fenced Code Block: ```lang
      const codeMatch = line.match(/^```([a-zA-Z0-9_-]*)/);
      if (codeMatch) {
        const lang = codeMatch[1].trim() || 'text';
        const codeLines = [];
        i++;
        while (i < lines.length && !lines[i].startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        if (i < lines.length && lines[i].startsWith('```')) {
          i++; // skip closing ```
        }
        const rawCode = codeLines.join('\n');
        const safeCode = escapeHtml(rawCode);
        html += `<div class="code-container"><pre class="code-block" data-language="${escapeHtml(lang)}">` +
                `<div class="code-header"><span class="code-lang">${escapeHtml(lang)}</span></div>` +
                `<code class="language-${escapeHtml(lang)}">${safeCode}</code></pre></div>\n`;
        continue;
      }

      // Standalone Block Image: ![alt](url)
      const blockImgMatch = line.trim().match(/^!\[([^\]]*)\]\((.*?)\)$/);
      if (blockImgMatch) {
        const alt = blockImgMatch[1].trim();
        const url = cleanUrl(blockImgMatch[2]);
        const safeAlt = escapeHtml(alt);
        const caption = safeAlt && safeAlt !== 'Image' && safeAlt !== 'Illustration' ? `<figcaption class="markpdf-figcaption">${safeAlt}</figcaption>` : '';
        html += `<figure class="markpdf-figure"><img src="${url}" alt="${safeAlt}" loading="eager" decoding="sync" class="markpdf-img">${caption}</figure>\n`;
        i++;
        continue;
      }

      // Headings: # to ######
      const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const headingText = headingMatch[2].trim();
        const id = headingText.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/(^-|-$)/g, '');
        html += `<h${level} id="${id}">${parseInline(headingText)}</h${level}>\n`;
        i++;
        continue;
      }

      // Explicit Page Break or Horizontal Rule: --- or ***
      if (/^(\*{3,}|-{3,}|_{3,})$/.test(line.trim())) {
        html += '<hr class="markpdf-hr">\n';
        i++;
        continue;
      }

      // Blockquotes: > text
      if (line.trim().startsWith('>')) {
        const quoteLines = [];
        while (i < lines.length && lines[i].trim().startsWith('>')) {
          quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
          i++;
        }
        const innerMd = quoteLines.join('\n');
        html += `<blockquote>${render(innerMd, options)}</blockquote>\n`;
        continue;
      }

      // Tables: | Header | Header |
      if (line.trim().startsWith('|') && line.includes('|')) {
        const tableLines = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          tableLines.push(lines[i].trim());
          i++;
        }

        if (tableLines.length >= 2) {
          const headerCells = tableLines[0].split('|').map(s => s.trim()).filter((s, idx, arr) => idx > 0 && idx < arr.length - 1);
          const sepCells = tableLines[1].split('|').map(s => s.trim()).filter((s, idx, arr) => idx > 0 && idx < arr.length - 1);

          // Detect alignment
          const aligns = sepCells.map(c => {
            if (c.startsWith(':') && c.endsWith(':')) return 'center';
            if (c.endsWith(':')) return 'right';
            return 'left';
          });

          let tableHtml = '<div class="table-container"><table><thead><tr>';
          headerCells.forEach((c, idx) => {
            const align = aligns[idx] || 'left';
            tableHtml += `<th style="text-align: ${align}">${parseInline(c)}</th>`;
          });
          tableHtml += '</tr></thead><tbody>';

          for (let r = 2; r < tableLines.length; r++) {
            const rowCells = tableLines[r].split('|').map(s => s.trim()).filter((s, idx, arr) => idx > 0 && idx < arr.length - 1);
            if (rowCells.length > 0) {
              tableHtml += '<tr>';
              rowCells.forEach((c, idx) => {
                const align = aligns[idx] || 'left';
                tableHtml += `<td style="text-align: ${align}">${parseInline(c)}</td>`;
              });
              tableHtml += '</tr>';
            }
          }
          tableHtml += '</tbody></table></div>\n';
          html += tableHtml;
          continue;
        }
      }

      // Unordered Lists / Task lists: - [ ] or - or *
      if (/^(\s*)([-*+]|\d+\.)\s+/.test(line)) {
        const isOrdered = /^\s*\d+\.\s+/.test(line);
        const tag = isOrdered ? 'ol' : 'ul';
        html += `<${tag}>\n`;

        while (i < lines.length && /^(\s*)([-*+]|\d+\.)\s+/.test(lines[i])) {
          const itemLine = lines[i];
          let itemText = itemLine.replace(/^(\s*)([-*+]|\d+\.)\s+/, '');

          // Check task item: [ ] or [x]
          let taskItemHtml = '';
          const taskMatch = itemText.match(/^\[([ xX])\]\s+(.*)$/);
          if (taskMatch) {
            const checked = taskMatch[1].toLowerCase() === 'x' ? 'checked' : '';
            taskItemHtml = `<input type="checkbox" disabled ${checked} class="task-checkbox"> `;
            itemText = taskMatch[2];
          }

          html += `<li>${taskItemHtml}${parseInline(itemText)}</li>\n`;
          i++;
        }

        html += `</${tag}>\n`;
        continue;
      }

      // Paragraph
      const pLines = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !lines[i].startsWith('#') &&
        !lines[i].startsWith('```') &&
        !lines[i].startsWith('>') &&
        !/^(\s*)([-*+]|\d+\.)\s+/.test(lines[i]) &&
        !lines[i].trim().startsWith('|') &&
        !/^!\[([^\]]*)\]\((.*?)\)$/.test(lines[i].trim()) &&
        !/^(\*{3,}|-{3,}|_{3,})$/.test(lines[i].trim())
      ) {
        pLines.push(lines[i]);
        i++;
      }

      if (pLines.length > 0) {
        html += `<p>${parseInline(pLines.join(' '))}</p>\n`;
      }
    }

    return html;
  }

  return {
    render: render,
    escapeHtml: escapeHtml
  };
});
