/**
 * MarkPDF - Background Service Worker
 * Handles extension installation, context menu shortcuts, script injection,
 * and opening the PDF export window.
 */

// Initialize extension defaults and context menus on install
chrome.runtime.onInstalled.addListener(async () => {
  // Setup default settings
  const { settings } = await chrome.storage.local.get('settings');
  if (!settings) {
    await chrome.storage.local.set({
      settings: {
        pdfTheme: 'github',
        paperSize: 'a4',
        orientation: 'portrait',
        margin: 'normal',
        fontSize: '14',
        includeHeader: true,
        includePageNumbers: true,
        includeImages: true
      }
    });
  }

  // Remove existing context menus before recreating
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'markpdf-pick-element',
      title: '🎯 Pick element to convert to Markdown & PDF',
      contexts: ['page', 'frame']
    });

    chrome.contextMenus.create({
      id: 'markpdf-extract-selection',
      title: '📝 Convert selected text to Markdown & PDF',
      contexts: ['selection']
    });

    chrome.contextMenus.create({
      id: 'markpdf-extract-article',
      title: '📰 Convert main article to Markdown & PDF',
      contexts: ['page', 'frame']
    });
  });
});

// Helper to inject scripts into tab if not already active
async function ensureScriptsInjected(tabId) {
  try {
    await chrome.scripting.insertCSS({
      target: { tabId: tabId },
      files: ['content/picker.css']
    });
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['lib/html-to-markdown.js', 'content/picker.js']
    });
    return true;
  } catch (err) {
    console.error('Failed to inject MarkPDF scripts:', err);
    return false;
  }
}

// Handle Context Menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.id) return;

  const injected = await ensureScriptsInjected(tab.id);
  if (!injected) return;

  if (info.menuItemId === 'markpdf-pick-element') {
    chrome.tabs.sendMessage(tab.id, { action: 'start_picker' });
  } else if (info.menuItemId === 'markpdf-extract-selection') {
    chrome.tabs.sendMessage(tab.id, { action: 'extract_selection' });
  } else if (info.menuItemId === 'markpdf-extract-article') {
    chrome.tabs.sendMessage(tab.id, { action: 'extract_article' });
  }
});

// Message listener from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'open_pdf_export') {
    (async () => {
      try {
        if (message.data) {
          await chrome.storage.local.set({ exportData: message.data });
        }
        await chrome.tabs.create({
          url: chrome.runtime.getURL('pdf-export/export.html')
        });
        sendResponse({ success: true });
      } catch (err) {
        console.error('Failed to open PDF export tab:', err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true; // Keep message channel open for async response
  }

  if (message.action === 'inject_and_pick') {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) {
          sendResponse({ success: false, error: 'No active tab' });
          return;
        }
        await ensureScriptsInjected(tab.id);
        await chrome.tabs.sendMessage(tab.id, { action: 'start_picker' });
        sendResponse({ success: true });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (message.action === 'inject_and_extract_article') {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) {
          sendResponse({ success: false, error: 'No active tab' });
          return;
        }
        await ensureScriptsInjected(tab.id);
        await chrome.tabs.sendMessage(tab.id, { action: 'extract_article' });
        sendResponse({ success: true });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }
});

