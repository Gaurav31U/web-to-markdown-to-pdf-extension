/**
 * MarkPDF - Advanced Multi-Page PDF Exporter
 * Implements intelligent multi-page pagination, eager image loading,
 * vector print stylesheet configuration, and live page statistics.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Controls
  const exportTitleInput = document.getElementById('export-title-input');
  const selectLayoutMode = document.getElementById('select-layout-mode');
  const selectTheme = document.getElementById('select-theme');
  const selectSize = document.getElementById('select-size');
  const selectOrientation = document.getElementById('select-orientation');
  const selectMargin = document.getElementById('select-margin');
  const selectFontSize = document.getElementById('select-font-size');
  const toggleHeader = document.getElementById('toggle-header');
  const toggleFooter = document.getElementById('toggle-footer');
  const toggleImages = document.getElementById('toggle-images');
  const btnDownloadMd = document.getElementById('btn-download-md');
  const btnPrintPdf = document.getElementById('btn-print-pdf');

  const statPageCount = document.getElementById('stat-page-count');
  const statImgCount = document.getElementById('stat-img-count');
  const imageStatusBar = document.getElementById('image-status-bar');
  const imageStatusText = document.getElementById('image-status-text');

  const pagesContainer = document.getElementById('pages-container');
  const measureSandbox = document.getElementById('measure-sandbox');
  const dynamicPrintStyle = document.getElementById('dynamic-print-style');

  let currentData = null;
  let totalCalculatedPages = 1;
  let isPaginating = false;

  // MM to Pixel Conversion helper at 96 DPI (Standard CSS screen DPI)
  const MM_TO_PX = 96 / 25.4; // ~3.7795 px per mm

  // Paper Dimensions in Millimeters [Width, Height]
  const PAPER_SPECS_MM = {
    a4: [210, 297],
    letter: [215.9, 279.4],
    legal: [215.9, 355.6]
  };

  // Margin Definitions in Millimeters
  const MARGIN_SPECS_MM = {
    normal: 15,
    compact: 8,
    wide: 25
  };

  // Format Date
  function formatDate(isoStr) {
    const d = isoStr ? new Date(isoStr) : new Date();
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  // Pre-load all images so dimensions and pixels are fully ready for print
  async function preloadAllImages(container) {
    const images = Array.from(container.querySelectorAll('img'));
    if (images.length === 0) {
      statImgCount.textContent = '📷 0 Images';
      return;
    }

    statImgCount.textContent = `📷 ${images.length} Image${images.length > 1 ? 's' : ''}`;
    imageStatusBar.style.display = 'block';
    imageStatusText.textContent = `⏳ Loading and decoding ${images.length} image(s) for high-resolution PDF export...`;

    let loadedCount = 0;
    const promises = images.map(img => {
      // Force eager decoding
      img.loading = 'eager';
      img.decoding = 'sync';

      if (img.complete && img.naturalWidth > 0) {
        loadedCount++;
        return Promise.resolve();
      }

      return new Promise(resolve => {
        const onDone = () => {
          loadedCount++;
          imageStatusText.textContent = `⏳ Loaded ${loadedCount} of ${images.length} image(s)...`;
          resolve();
        };

        img.addEventListener('load', onDone, { once: true });
        img.addEventListener('error', () => {
          console.warn('Image failed to load in PDF export:', img.src);
          // Mark image with a clean fallback border
          img.style.minHeight = '60px';
          img.style.background = '#F3F4F6';
          img.alt = `[Image unavailable: ${img.alt || 'photo'}]`;
          onDone();
        }, { once: true });

        // Timeout safety fallback (max 4.5 seconds per image)
        setTimeout(onDone, 4500);
      });
    });

    await Promise.all(promises);

    imageStatusText.textContent = `✅ All ${images.length} image(s) loaded and optimized for PDF!`;
    setTimeout(() => {
      imageStatusBar.style.display = 'none';
    }, 2000);
  }

  // Calculate paper dimensions in Pixels based on size, orientation, and margin
  function getPaperDimensionsPx() {
    const size = selectSize.value || 'a4';
    const orientation = selectOrientation.value || 'portrait';
    const marginKey = selectMargin.value || 'normal';

    const mmSpec = PAPER_SPECS_MM[size] || PAPER_SPECS_MM.a4;
    let wMm = mmSpec[0];
    let hMm = mmSpec[1];

    if (orientation === 'landscape') {
      const temp = wMm;
      wMm = hMm;
      hMm = temp;
    }

    const marginMm = MARGIN_SPECS_MM[marginKey] || 15;

    const widthPx = Math.round(wMm * MM_TO_PX);
    const heightPx = Math.round(hMm * MM_TO_PX);
    const marginPx = Math.round(marginMm * MM_TO_PX);

    return {
      size,
      orientation,
      marginKey,
      wMm,
      hMm,
      marginMm,
      widthPx,
      heightPx,
      marginPx
    };
  }

  // Update @page CSS for printing
  function updatePrintStylesheet(paper) {
    dynamicPrintStyle.innerHTML = `
      @page {
        size: ${paper.size} ${paper.orientation};
        margin: ${paper.marginMm}mm;
      }
    `;
  }

  // Build a single Page Sheet DOM Element
  function createPageSheet(pageIndex, totalPages, paper, isFirstPage, includeHeader = true, includeFooter = true) {
    const docTitle = exportTitleInput.value || 'Document';
    const sourceUrl = currentData && currentData.url ? currentData.url : '';
    let hostName = '';
    if (sourceUrl) {
      try {
        hostName = new URL(sourceUrl).hostname;
      } catch (e) {
        hostName = sourceUrl;
      }
    }
    const dateStr = formatDate(currentData ? currentData.timestamp : null);

    const sheet = document.createElement('div');
    sheet.className = 'pdf-page-sheet';
    sheet.dataset.pageIndex = pageIndex;
    sheet.style.width = `${paper.widthPx}px`;
    sheet.style.minHeight = `${paper.heightPx}px`;
    sheet.style.padding = `${paper.marginPx}px`;

    // Running Header (if enabled)
    if (includeHeader) {
      const header = document.createElement('div');
      header.className = 'page-header';
      header.innerHTML = `
        <div class="page-header-title">${escapeHtml(docTitle)}</div>
        <div class="page-header-meta">
          ${hostName ? `<span>Source: ${escapeHtml(hostName)}</span>` : ''}
          <span>${dateStr}</span>
        </div>
      `;
      sheet.appendChild(header);
    }

    // If first page, add Document Title headline
    if (isFirstPage) {
      const firstTitle = document.createElement('h1');
      firstTitle.className = 'doc-first-page-title';
      firstTitle.textContent = docTitle;
      sheet.appendChild(firstTitle);
    }

    // Content container
    const content = document.createElement('div');
    content.className = 'page-content';
    sheet.appendChild(content);

    // Running Footer (if enabled)
    if (includeFooter) {
      const footer = document.createElement('div');
      footer.className = 'page-footer';
      footer.innerHTML = `
        <span>Generated with MarkPDF</span>
        <span class="page-number-pill" data-page-num="${pageIndex}">Page ${pageIndex} of ${totalPages}</span>
      `;
      sheet.appendChild(footer);
    }

    return {
      sheet,
      header: includeHeader ? sheet.querySelector('.page-header') : null,
      content,
      footer: includeFooter ? sheet.querySelector('.page-footer') : null
    };
  }

  // Update Page numbers across all generated sheets
  function refreshPageNumbers(totalPages) {
    totalCalculatedPages = totalPages;
    statPageCount.textContent = `📄 ${totalPages} Page${totalPages > 1 ? 's' : ''}`;

    const numPills = pagesContainer.querySelectorAll('.page-number-pill');
    numPills.forEach((pill, idx) => {
      const pNum = idx + 1;
      pill.textContent = `Page ${pNum} of ${totalPages}`;
    });
  }

  // Main Pagination Algorithm
  async function paginateDocument() {
    if (isPaginating || !currentData || !currentData.markdown) return;
    isPaginating = true;

    const paper = getPaperDimensionsPx();
    updatePrintStylesheet(paper);

    const layoutMode = selectLayoutMode.value; // 'paged' or 'continuous'
    const fontSize = selectFontSize.value || '14';
    const includeHeader = toggleHeader ? toggleHeader.checked : true;
    const includeFooter = toggleFooter ? toggleFooter.checked : true;
    const includeImages = toggleImages ? toggleImages.checked : true;

    // Prepare measurement sandbox
    measureSandbox.innerHTML = '';
    measureSandbox.className = `measure-sandbox ${selectTheme.value}`;
    measureSandbox.style.width = `${paper.widthPx - (paper.marginPx * 2)}px`;
    measureSandbox.style.fontSize = `${fontSize}px`;

    // Render raw HTML into sandbox
    const rawHtml = window.markdownToHtml ? window.markdownToHtml.render(currentData.markdown) : '<p>No content</p>';
    measureSandbox.innerHTML = rawHtml;

    // Handle image visibility setting
    if (!includeImages) {
      measureSandbox.querySelectorAll('.markpdf-figure, .markpdf-img').forEach(el => el.remove());
      statImgCount.textContent = '📷 0 Images (off)';
    } else {
      // Wait for all images in the sandbox to complete loading
      await preloadAllImages(measureSandbox);
    }

    // Get all top-level child elements to paginate
    const childElements = Array.from(measureSandbox.children);

    pagesContainer.innerHTML = '';
    pagesContainer.className = `pages-container ${selectTheme.value} ${layoutMode === 'continuous' ? 'continuous-mode' : ''}`;
    pagesContainer.style.fontSize = `${fontSize}px`;

    if (childElements.length === 0) {
      const emptyPage = createPageSheet(1, 1, paper, true, includeHeader, includeFooter);
      emptyPage.content.innerHTML = '<p>No readable content.</p>';
      pagesContainer.appendChild(emptyPage.sheet);
      refreshPageNumbers(1);
      isPaginating = false;
      return;
    }

    // CONTINUOUS ROLL MODE
    if (layoutMode === 'continuous') {
      const singlePage = createPageSheet(1, 1, paper, true, includeHeader, includeFooter);
      singlePage.sheet.style.minHeight = 'auto';
      childElements.forEach(el => singlePage.content.appendChild(el.cloneNode(true)));
      pagesContainer.appendChild(singlePage.sheet);

      // Estimate equivalent printed pages
      const totalContentHeight = singlePage.content.scrollHeight;
      const printableHeight = paper.heightPx - (paper.marginPx * 2) - 80;
      const estimatedPages = Math.max(1, Math.ceil(totalContentHeight / printableHeight));
      refreshPageNumbers(estimatedPages);
      isPaginating = false;
      return;
    }

    // MULTI-PAGE PAGED MODE
    const createdPages = [];
    let currentPageIndex = 1;
    let currentPageObj = createPageSheet(currentPageIndex, 1, paper, true, includeHeader, includeFooter);
    pagesContainer.appendChild(currentPageObj.sheet);
    createdPages.push(currentPageObj);

    // Height reserved for Header and Footer
    const headerH = includeHeader ? 35 : 0;
    const footerH = includeFooter ? 32 : 0;
    const firstTitleH = 50;

    // Available height per page in pixels
    const maxContentH_Page1 = paper.heightPx - (paper.marginPx * 2) - headerH - footerH - firstTitleH;
    const maxContentH_Normal = paper.heightPx - (paper.marginPx * 2) - headerH - footerH;

    let currentAllowedH = maxContentH_Page1;

    for (let i = 0; i < childElements.length; i++) {
      const originalEl = childElements[i];
      const clonedEl = originalEl.cloneNode(true);

      // Check height if we append this element
      currentPageObj.content.appendChild(clonedEl);
      const contentH = currentPageObj.content.scrollHeight;

      // If adding this element overflows the page
      if (contentH > currentAllowedH && currentPageObj.content.children.length > 1) {
        // Remove it from current page
        clonedEl.remove();

        // Start a brand new page
        currentPageIndex++;
        currentPageObj = createPageSheet(currentPageIndex, currentPageIndex, paper, false, includeHeader, includeFooter);
        pagesContainer.appendChild(currentPageObj.sheet);
        createdPages.push(currentPageObj);

        currentAllowedH = maxContentH_Normal;

        // Append element to the new page
        currentPageObj.content.appendChild(clonedEl);
      }
    }

    refreshPageNumbers(createdPages.length);
    isPaginating = false;
  }

  // Load Document
  async function loadDocument() {
    const stored = await chrome.storage.local.get(['exportData', 'lastExtracted', 'settings']);
    currentData = stored.exportData || stored.lastExtracted;

    if (!currentData || !currentData.markdown) {
      currentData = {
        title: 'Sample MarkPDF Document',
        markdown: '# No Content Provided\n\nPlease select an element on a webpage using MarkPDF.',
        url: '',
        timestamp: new Date().toISOString(),
        settings: stored.settings || {}
      };
    }

    const settings = currentData.settings || stored.settings || {};

    const title = currentData.title || 'Untitled Document';
    document.title = `${title} - MarkPDF`;
    exportTitleInput.value = title;

    if (settings.pdfTheme) {
      selectTheme.value = `theme-${settings.pdfTheme}`;
    }
    if (settings.paperSize) {
      selectSize.value = settings.paperSize;
    }
    if (settings.orientation) {
      selectOrientation.value = settings.orientation;
    }
    if (settings.margin) {
      selectMargin.value = settings.margin;
    }
    if (settings.fontSize) {
      selectFontSize.value = settings.fontSize;
    }
    if (typeof settings.includeHeader === 'boolean') {
      toggleHeader.checked = settings.includeHeader;
    }
    if (typeof settings.includePageNumbers === 'boolean') {
      toggleFooter.checked = settings.includePageNumbers;
    } else if (typeof settings.includeFooter === 'boolean') {
      toggleFooter.checked = settings.includeFooter;
    }
    if (typeof settings.includeImages === 'boolean') {
      toggleImages.checked = settings.includeImages;
    }

    await paginateDocument();
  }

  // Helper escape
  function escapeHtml(text) {
    return (text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Event Listeners
  exportTitleInput.addEventListener('input', () => {
    const newTitle = exportTitleInput.value || 'Document';
    document.title = `${newTitle} - MarkPDF`;
    const firstTitles = pagesContainer.querySelectorAll('.doc-first-page-title');
    firstTitles.forEach(t => t.textContent = newTitle);
    const headerTitles = pagesContainer.querySelectorAll('.page-header-title');
    headerTitles.forEach(t => t.textContent = newTitle);
  });

  selectLayoutMode.addEventListener('change', paginateDocument);
  selectTheme.addEventListener('change', () => {
    pagesContainer.className = `pages-container ${selectTheme.value} ${selectLayoutMode.value === 'continuous' ? 'continuous-mode' : ''}`;
  });
  selectSize.addEventListener('change', paginateDocument);
  selectOrientation.addEventListener('change', paginateDocument);
  selectMargin.addEventListener('change', paginateDocument);
  selectFontSize.addEventListener('change', paginateDocument);

  async function onToggleSettingChanged() {
    const updated = {
      includeHeader: toggleHeader.checked,
      includeFooter: toggleFooter.checked,
      includePageNumbers: toggleFooter.checked,
      includeImages: toggleImages.checked
    };
    const stored = await chrome.storage.local.get('settings');
    await chrome.storage.local.set({
      settings: { ...(stored.settings || {}), ...updated }
    });
    paginateDocument();
  }

  toggleHeader.addEventListener('change', onToggleSettingChanged);
  toggleFooter.addEventListener('change', onToggleSettingChanged);
  toggleImages.addEventListener('change', onToggleSettingChanged);

  // Print to PDF with full image verification
  btnPrintPdf.addEventListener('click', async () => {
    const images = Array.from(pagesContainer.querySelectorAll('img'));
    const uncompleted = images.filter(img => !img.complete);

    if (uncompleted.length > 0) {
      imageStatusBar.style.display = 'block';
      imageStatusText.textContent = `⏳ Finishing image rendering before PDF export (${uncompleted.length} left)...`;
      await Promise.all(uncompleted.map(img => {
        return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
          setTimeout(resolve, 2000);
        });
      }));
      imageStatusBar.style.display = 'none';
    }

    window.print();
  });

  // Download Markdown file
  btnDownloadMd.addEventListener('click', () => {
    if (!currentData || !currentData.markdown) return;
    const blob = new Blob([currentData.markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeTitle = (exportTitleInput.value || 'document').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
    a.href = url;
    a.download = `${safeTitle}.md`;
    a.click();
    URL.revokeObjectURL(url);
  });

  window.addEventListener('resize', () => {
    clearTimeout(window.__markpdfResizeTimer);
    window.__markpdfResizeTimer = setTimeout(paginateDocument, 250);
  });

  await loadDocument();
});
