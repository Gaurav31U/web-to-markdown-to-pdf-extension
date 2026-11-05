/**
 * MarkPDF - Popup Controller
 * Manages editor, live preview, settings, element picker trigger, and PDF export.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const markdownInput = document.getElementById('markdown-input');
  const previewContainer = document.getElementById('preview-container');
  const editorStats = document.getElementById('editor-stats');
  const docTitleInput = document.getElementById('doc-title-input');
  const pdfThemeSelect = document.getElementById('pdf-theme-select');
  const paperSizeSelect = document.getElementById('paper-size-select');
  const orientationSelect = document.getElementById('orientation-select');
  const marginSelect = document.getElementById('margin-select');
  const fontSizeSelect = document.getElementById('font-size-select');
  const checkIncludeHeader = document.getElementById('check-include-header');
  const checkIncludeNumbers = document.getElementById('check-include-numbers');
  const checkIncludeImages = document.getElementById('check-include-images');

  const sourceBanner = document.getElementById('source-banner');
  const sourceTitle = document.getElementById('source-title');
  const btnClearContent = document.getElementById('btn-clear-content');

  const tabBtns = document.querySelectorAll('.nav-tabs .tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  const btnPickElement = document.getElementById('btn-pick-element');
  const btnAutoArticle = document.getElementById('btn-auto-article');
  const btnCopyMd = document.getElementById('btn-copy-md');
  const btnDownloadMd = document.getElementById('btn-download-md');
  const btnExportPdf = document.getElementById('btn-export-pdf');
  const toastEl = document.getElementById('popup-toast');

  let currentSourceUrl = '';

  // Default starter sample markdown for first-time use
  const defaultSample = `# Welcome to MarkPDF

MarkPDF lets you effortlessly extract any page element or article from any website, convert it to clean Markdown, and export it into a beautifully styled PDF document!

## Key Features

- **Visual Element Picker**: Click any element on any webpage to capture it.
- **Auto-Detect Article**: Automatically isolate main content, stripping ads and sidebars.
- **Clean Markdown Output**: Headings, lists, code blocks, tables, and links.
- **Customizable PDF Export**: Choose paper size, themes, margins, and headers.

### Sample Data Table

| Feature | Support | Description |
| :--- | :---: | :--- |
| Element Picker | Yes | Interactive overlay with hierarchy navigation |
| Tables & Code | Yes | Syntax-styled code blocks and formatted tables |
| Chrome Vector PDF | Yes | Razor-sharp text, clickable links, perfect layout |

### Code Example

\`\`\`javascript
// Extract and convert elements to PDF seamlessly
const element = document.querySelector('article');
const markdown = htmlToMarkdown.convert(element);
console.log('Exporting clean PDF...');
\`\`\`

> "A simple, privacy-first way to save, archive, and share clean web content."

- [x] Select any element with mouse or keyboard
- [x] Edit and preview markdown in real time
- [ ] Export directly to PDF with 1 click
`;

  // Show Toast
  function showToast(text) {
    if (!toastEl) return;
    toastEl.textContent = text;
    toastEl.classList.add('show');
    setTimeout(() => {
      toastEl.classList.remove('show');
    }, 2500);
  }

  // Update Stats
  function updateStats() {
    const text = markdownInput.value || '';
    const charCount = text.length;
    const wordCount = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
    const lineCount = text ? text.split('\n').length : 0;
    editorStats.textContent = `${wordCount.toLocaleString()} words | ${charCount.toLocaleString()} chars | ${lineCount} lines`;
  }

  // Update Preview
  function updatePreview() {
    const md = markdownInput.value || '';
    if (window.markdownToHtml) {
      previewContainer.innerHTML = window.markdownToHtml.render(md);
    }
  }

  // Tab Switching
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      const targetPane = document.getElementById(targetId);
      if (targetPane) {
        targetPane.classList.add('active');
        if (targetId === 'tab-preview') {
          updatePreview();
        }
      }
    });
  });

  // Editor Toolbar Helper
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.getAttribute('data-tool');
      const start = markdownInput.selectionStart;
      const end = markdownInput.selectionEnd;
      const text = markdownInput.value;
      const selected = text.substring(start, end);

      let replacement = '';
      let cursorOffset = 0;

      switch (tool) {
        case 'h1':
          replacement = `# ${selected || 'Heading 1'}`;
          break;
        case 'h2':
          replacement = `## ${selected || 'Heading 2'}`;
          break;
        case 'bold':
          replacement = `**${selected || 'bold text'}**`;
          break;
        case 'italic':
          replacement = `*${selected || 'italic text'}*`;
          break;
        case 'code':
          replacement = selected ? `\`\`\`text\n${selected}\n\`\`\`` : '```javascript\n// code here\n```';
          break;
        case 'quote':
          replacement = `> ${selected || 'Quote'}`;
          break;
        case 'list':
          replacement = selected ? selected.split('\n').map(l => `- ${l}`).join('\n') : '- List item\n- List item';
          break;
        case 'table':
          replacement = '\n| Column 1 | Column 2 |\n| --- | --- |\n| Item 1 | Item 2 |\n';
          break;
      }

      markdownInput.setRangeText(replacement, start, end, 'end');
      markdownInput.focus();
      updateStats();
    });
  });

  // Input event on editor
  markdownInput.addEventListener('input', () => {
    updateStats();
    saveCurrentDraft();
  });

  // Save current draft
  async function saveCurrentDraft() {
    await chrome.storage.local.set({
      draftMarkdown: markdownInput.value,
      draftTitle: docTitleInput.value
    });
  }

  // Load Saved Data & Settings
  async function loadData() {
    const data = await chrome.storage.local.get(['lastExtracted', 'draftMarkdown', 'draftTitle', 'settings']);

    // Load Settings
    if (data.settings) {
      const s = data.settings;
      if (s.pdfTheme) pdfThemeSelect.value = s.pdfTheme;
      if (s.paperSize) paperSizeSelect.value = s.paperSize;
      if (s.orientation) orientationSelect.value = s.orientation;
      if (s.margin) marginSelect.value = s.margin;
      if (s.fontSize) fontSizeSelect.value = s.fontSize;
      if (typeof s.includeHeader === 'boolean') checkIncludeHeader.checked = s.includeHeader;
      if (typeof s.includePageNumbers === 'boolean') checkIncludeNumbers.checked = s.includePageNumbers;
      if (typeof s.includeImages === 'boolean') checkIncludeImages.checked = s.includeImages;
    }

    // Determine initial markdown
    if (data.lastExtracted && data.lastExtracted.markdown) {
      markdownInput.value = data.lastExtracted.markdown;
      docTitleInput.value = data.lastExtracted.title || 'Extracted Document';
      currentSourceUrl = data.lastExtracted.url || '';

      sourceTitle.textContent = data.lastExtracted.title || data.lastExtracted.url || 'Web Element';
      sourceBanner.style.display = 'flex';
    } else if (data.draftMarkdown) {
      markdownInput.value = data.draftMarkdown;
      docTitleInput.value = data.draftTitle || 'Untitled Document';
    } else {
      markdownInput.value = defaultSample;
      docTitleInput.value = 'Welcome to MarkPDF';
    }

    updateStats();
  }

  // Save settings on changes
  const settingElements = [
    pdfThemeSelect, paperSizeSelect, orientationSelect, marginSelect, fontSizeSelect,
    checkIncludeHeader, checkIncludeNumbers, checkIncludeImages
  ];
  settingElements.forEach(el => {
    el.addEventListener('change', async () => {
      const updatedSettings = {
        pdfTheme: pdfThemeSelect.value,
        paperSize: paperSizeSelect.value,
        orientation: orientationSelect.value,
        margin: marginSelect.value,
        fontSize: fontSizeSelect.value,
        includeHeader: checkIncludeHeader.checked,
        includePageNumbers: checkIncludeNumbers.checked,
        includeImages: checkIncludeImages.checked
      };
      await chrome.storage.local.set({ settings: updatedSettings });
    });
  });

  docTitleInput.addEventListener('input', saveCurrentDraft);

  // Clear / Reset
  btnClearContent.addEventListener('click', async () => {
    await chrome.storage.local.remove(['lastExtracted', 'draftMarkdown', 'draftTitle']);
    markdownInput.value = '';
    docTitleInput.value = '';
    sourceBanner.style.display = 'none';
    updateStats();
    showToast('Cleared content');
  });

  // Copy Markdown
  btnCopyMd.addEventListener('click', async () => {
    const text = markdownInput.value;
    if (!text.trim()) {
      showToast('No content to copy');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast('📋 Copied Markdown!');
    } catch (e) {
      showToast('Failed to copy');
    }
  });

  // Download Markdown
  btnDownloadMd.addEventListener('click', () => {
    const text = markdownInput.value;
    if (!text.trim()) {
      showToast('No content to download');
      return;
    }
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const title = (docTitleInput.value || 'document').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
    a.href = url;
    a.download = `${title}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📥 Downloaded .md file');
  });

  // Pick Element Button
  btnPickElement.addEventListener('click', async () => {
    chrome.runtime.sendMessage({ action: 'inject_and_pick' });
    window.close(); // Close popup so user can pick on page
  });

  // Auto Article Button
  btnAutoArticle.addEventListener('click', async () => {
    chrome.runtime.sendMessage({ action: 'inject_and_extract_article' });
    window.close();
  });

  // Export to PDF
  btnExportPdf.addEventListener('click', async () => {
    const markdown = markdownInput.value;
    if (!markdown.trim()) {
      showToast('Please enter or extract some markdown first');
      return;
    }

    const exportData = {
      markdown: markdown,
      title: docTitleInput.value || 'Document',
      url: currentSourceUrl,
      timestamp: new Date().toISOString(),
      settings: {
        pdfTheme: pdfThemeSelect.value,
        paperSize: paperSizeSelect.value,
        orientation: orientationSelect.value,
        margin: marginSelect.value,
        fontSize: fontSizeSelect.value,
        includeHeader: checkIncludeHeader.checked,
        includePageNumbers: checkIncludeNumbers.checked,
        includeImages: checkIncludeImages.checked
      }
    };

    chrome.runtime.sendMessage({
      action: 'open_pdf_export',
      data: exportData
    });
  });

  await loadData();
});

