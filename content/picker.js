/**
 * MarkPDF - Content Script & Interactive Element Picker
 * Allows users to hover, navigate, and pick any DOM element on any webpage,
 * converting it into clean Markdown and enabling instant PDF export.
 */

(function () {
  // Prevent duplicate injection
  if (window.__markpdfPickerInjected) return;
  window.__markpdfPickerInjected = true;

  let isPickerActive = false;
  let currentTarget = null;
  let historyStack = []; // For ArrowUp / ArrowDown navigation

  // DOM Elements for the picker
  let overlayBox = null;
  let tagBadge = null;
  let hudContainer = null;
  let toastContainer = null;

  // Initialize UI containers
  function initPickerUI() {
    if (overlayBox) return;

    // Overlay Box
    overlayBox = document.createElement('div');
    overlayBox.id = 'markpdf-overlay-box';
    tagBadge = document.createElement('div');
    tagBadge.id = 'markpdf-tag-badge';
    tagBadge.textContent = 'div';
    overlayBox.appendChild(tagBadge);
    document.documentElement.appendChild(overlayBox);

    // Toast Container
    toastContainer = document.createElement('div');
    toastContainer.id = 'markpdf-toast-container';
    document.documentElement.appendChild(toastContainer);
  }

  // Create HUD (Floating toolbar)
  function showHUD() {
    if (hudContainer) {
      hudContainer.style.display = 'flex';
      return;
    }

    hudContainer = document.createElement('div');
    hudContainer.id = 'markpdf-hud-container';
    hudContainer.innerHTML = `
      <div class="markpdf-hud-brand">
        <span>🎯 MarkPDF Picker</span>
      </div>
      <div class="markpdf-hud-info" id="markpdf-hud-tag-info">Hover over any element</div>
      <div class="markpdf-hud-hints">
        <span><kbd class="markpdf-kbd">↑</kbd> <kbd class="markpdf-kbd">↓</kbd> Parent/Child</span>
        <span><kbd class="markpdf-kbd">Click</kbd> Select</span>
        <span><kbd class="markpdf-kbd">Esc</kbd> Cancel</span>
      </div>
      <div class="markpdf-hud-actions">
        <button class="markpdf-hud-btn markpdf-hud-btn-primary" id="markpdf-btn-select-curr">Select</button>
        <button class="markpdf-hud-btn" id="markpdf-btn-auto-article">📰 Auto Article</button>
        <button class="markpdf-hud-btn markpdf-hud-btn-close" id="markpdf-btn-cancel" title="Exit Picker">✕</button>
      </div>
    `;

    document.documentElement.appendChild(hudContainer);

    // Bind HUD buttons
    document.getElementById('markpdf-btn-select-curr').addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentTarget) confirmSelection(currentTarget);
    });

    document.getElementById('markpdf-btn-auto-article').addEventListener('click', (e) => {
      e.stopPropagation();
      extractMainArticle();
    });

    document.getElementById('markpdf-btn-cancel').addEventListener('click', (e) => {
      e.stopPropagation();
      stopPicker();
    });
  }

  function hideHUD() {
    if (hudContainer) {
      hudContainer.remove();
      hudContainer = null;
    }
  }

  // Helper to show sleek toasts
  function showToast(message, type = 'info') {
    initPickerUI();
    const toast = document.createElement('div');
    toast.className = 'markpdf-toast';
    toast.innerHTML = `<span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      toast.style.transition = 'all 0.2s ease-in';
      setTimeout(() => toast.remove(), 250);
    }, 3500);
  }

  // Position the highlight overlay over an element
  function highlightElement(el) {
    if (!el || !overlayBox) return;
    currentTarget = el;

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    overlayBox.style.display = 'block';
    overlayBox.style.top = `${rect.top}px`;
    overlayBox.style.left = `${rect.left}px`;
    overlayBox.style.width = `${rect.width}px`;
    overlayBox.style.height = `${rect.height}px`;

    // Tag name, ID, class description
    const tagName = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    let cls = '';
    if (el.className && typeof el.className === 'string') {
      const parts = el.className.trim().split(/\s+/).slice(0, 2);
      cls = parts.map(c => `.${c}`).join('');
    }

    const desc = `${tagName}${id}${cls} (${Math.round(rect.width)}×${Math.round(rect.height)})`;
    tagBadge.textContent = desc;

    const hudTagInfo = document.getElementById('markpdf-hud-tag-info');
    if (hudTagInfo) {
      hudTagInfo.textContent = desc;
    }
  }

  function hideHighlight() {
    if (overlayBox) {
      overlayBox.style.display = 'none';
    }
    currentTarget = null;
  }

  // Check if an element is part of our MarkPDF UI
  function isMarkPdfElement(el) {
    if (!el) return false;
    return !!el.closest('#markpdf-overlay-box, #markpdf-hud-container, #markpdf-toast-container, #markpdf-modal-backdrop');
  }

  // Mouse move handler
  function onMouseMove(e) {
    if (!isPickerActive) return;
    const target = e.target;
    if (isMarkPdfElement(target) || target === document.documentElement || target === document.body) {
      return;
    }
    historyStack = [target];
    highlightElement(target);
  }

  // Click handler
  function onClick(e) {
    if (!isPickerActive) return;
    if (isMarkPdfElement(e.target)) return;

    e.preventDefault();
    e.stopPropagation();

    if (currentTarget) {
      confirmSelection(currentTarget);
    }
  }

  // Keydown handler
  function onKeyDown(e) {
    if (!isPickerActive) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      stopPicker();
      showToast('Picker cancelled');
      return;
    }

    // ArrowUp -> Navigate to Parent Element
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (currentTarget && currentTarget.parentElement && currentTarget.parentElement !== document.documentElement) {
        historyStack.push(currentTarget);
        highlightElement(currentTarget.parentElement);
      }
      return;
    }

    // ArrowDown -> Navigate back to Child Element
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyStack.length > 1) {
        const prev = historyStack.pop();
        if (prev && document.contains(prev)) {
          highlightElement(prev);
        }
      }
      return;
    }

    // Enter -> Confirm selection
    if (e.key === 'Enter') {
      e.preventDefault();
      if (currentTarget) {
        confirmSelection(currentTarget);
      }
    }
  }

  // Start the interactive picker
  function startPicker() {
    initPickerUI();
    isPickerActive = true;
    showHUD();

    document.addEventListener('mouseover', onMouseMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);

    showToast('🎯 MarkPDF: Click any element to convert to Markdown & PDF');
  }

  // Stop the picker
  function stopPicker() {
    isPickerActive = false;
    hideHighlight();
    hideHUD();

    document.removeEventListener('mouseover', onMouseMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
  }

  // Get CSS Selector path for debugging or storage
  function getElementSelector(el) {
    if (!el || !el.tagName) return '';
    if (el.id) return `#${el.id}`;
    let path = el.tagName.toLowerCase();
    if (el.className && typeof el.className === 'string') {
      const cls = el.className.trim().split(/\s+/)[0];
      if (cls) path += `.${cls}`;
    }
    return path;
  }

  // Confirm selection and extract markdown
  async function confirmSelection(el) {
    stopPicker();

    try {
      const converter = window.htmlToMarkdown;
      if (!converter) {
        throw new Error('Markdown converter is not loaded.');
      }

      const markdown = converter.convert(el, { baseUrl: window.location.href });
      if (!markdown || !markdown.trim()) {
        showToast('⚠️ No readable text found in selected element.', 'warning');
        return;
      }

      const extractedData = {
        markdown: markdown,
        title: document.title || 'Extracted Document',
        url: window.location.href,
        timestamp: new Date().toISOString(),
        selector: getElementSelector(el),
        tag: el.tagName.toLowerCase()
      };

      // Save to chrome.storage
      await chrome.storage.local.set({ lastExtracted: extractedData });

      // Show action modal on page
      showResultModal(extractedData);
    } catch (err) {
      console.error('MarkPDF Extraction Error:', err);
      showToast(`❌ Extraction failed: ${err.message}`);
    }
  }

  // Auto-detect main article content
  async function extractMainArticle() {
    stopPicker();

    // Priority candidates
    const selectors = [
      'article',
      'main',
      '[role="main"]',
      '.markdown-body',
      '.post-content',
      '.article-content',
      '.entry-content',
      '#content',
      '.content'
    ];

    let bestEl = null;
    for (const sel of selectors) {
      const candidate = document.querySelector(sel);
      if (candidate && candidate.innerText && candidate.innerText.trim().length > 150) {
        bestEl = candidate;
        break;
      }
    }

    // Fallback: heuristic density search
    if (!bestEl) {
      const divs = Array.from(document.querySelectorAll('div, section'));
      let maxScore = 0;
      for (const d of divs) {
        if (isMarkPdfElement(d)) continue;
        const textLen = (d.innerText || '').trim().length;
        const pCount = d.querySelectorAll('p').length;
        const score = textLen + (pCount * 100);
        if (score > maxScore && d !== document.body) {
          maxScore = score;
          bestEl = d;
        }
      }
    }

    if (!bestEl) {
      bestEl = document.body;
    }

    await confirmSelection(bestEl);
  }

  // Extract selected text
  async function extractSelectedText() {
    stopPicker();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.toString().trim() === '') {
      showToast('⚠️ No text is currently selected on the page.');
      return;
    }

    const range = selection.getRangeAt(0);
    const container = document.createElement('div');
    container.appendChild(range.cloneContents());

    await confirmSelection(container);
  }

  // Show Quick Action Modal
  function showResultModal(data) {
    const existing = document.getElementById('markpdf-modal-backdrop');
    if (existing) existing.remove();

    const charCount = data.markdown.length;
    const wordCount = data.markdown.trim().split(/\s+/).filter(Boolean).length;
    const lineCount = data.markdown.split('\n').length;
    const previewText = data.markdown.slice(0, 320) + (data.markdown.length > 320 ? '\n\n... (truncated)' : '');

    const modal = document.createElement('div');
    modal.id = 'markpdf-modal-backdrop';
    modal.innerHTML = `
      <div id="markpdf-modal-card">
        <div class="markpdf-modal-header">
          <div class="markpdf-modal-title">
            <span>📄 Element Extracted to Markdown</span>
          </div>
          <button class="markpdf-hud-btn markpdf-hud-btn-close" id="markpdf-modal-close">✕</button>
        </div>
        <div class="markpdf-modal-body">
          <div class="markpdf-preview-snippet">${escapeHtml(previewText)}</div>
          <div class="markpdf-stats-row">
            <span>📝 <strong>${wordCount.toLocaleString()}</strong> words</span>
            <span>🔤 <strong>${charCount.toLocaleString()}</strong> characters</span>
            <span>📜 <strong>${lineCount.toLocaleString()}</strong> lines</span>
          </div>
        </div>
        <div class="markpdf-modal-footer">
          <button class="markpdf-hud-btn" id="markpdf-btn-copy-md">📋 Copy Markdown</button>
          <button class="markpdf-hud-btn" id="markpdf-btn-download-md">📥 Download .md</button>
          <button class="markpdf-hud-btn markpdf-hud-btn-primary" id="markpdf-btn-export-pdf">🖨️ Export as PDF</button>
        </div>
      </div>
    `;

    document.documentElement.appendChild(modal);

    function closeModal() {
      modal.remove();
    }

    document.getElementById('markpdf-modal-close').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // Copy Markdown
    document.getElementById('markpdf-btn-copy-md').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(data.markdown);
        showToast('📋 Markdown copied to clipboard!');
      } catch (e) {
        showToast('❌ Failed to copy to clipboard');
      }
    });

    // Download .md file
    document.getElementById('markpdf-btn-download-md').addEventListener('click', () => {
      const blob = new Blob([data.markdown], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeTitle = (data.title || 'document').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
      a.href = url;
      a.download = `${safeTitle}.md`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('📥 Downloaded Markdown file!');
    });

    // Export as PDF
    document.getElementById('markpdf-btn-export-pdf').addEventListener('click', () => {
      closeModal();
      chrome.runtime.sendMessage({ action: 'open_pdf_export', data: data });
    });
  }

  function escapeHtml(text) {
    return (text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Listen for messages from background script or popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'start_picker') {
      startPicker();
      sendResponse({ status: 'picker_started' });
    } else if (request.action === 'stop_picker') {
      stopPicker();
      sendResponse({ status: 'picker_stopped' });
    } else if (request.action === 'extract_article') {
      extractMainArticle();
      sendResponse({ status: 'article_extracted' });
    } else if (request.action === 'extract_selection') {
      extractSelectedText();
      sendResponse({ status: 'selection_extracted' });
    }
    return true;
  });
})();

