# Chrome Web Store Listing — MarkPDF

**Extension Name:** MarkPDF - Element to Markdown & Multi-Page PDF  
**Version:** 1.1.0  
**Category:** Productivity / Developer Tools  
**Last Updated:** November 2026  

---

## 1. Store Summary & Description

### Short Description (max 132 characters)
Extract any webpage element to clean Markdown, preview with custom styles, and export as professional multi-page vector PDF documents.

### Detailed Description

MarkPDF turns any article, blog post, documentation section, or individual webpage element into clean Markdown and professional, multi-page vector PDF documents with a single click.

Whether you are archiving technical documentation, saving research articles, collecting recipes, or exporting discussions, MarkPDF isolates exactly the content you want—completely filtering out distracting ads, banners, cookies, and sidebars.

### 🌟 Key Features

- **Interactive Visual Element Picker**: Hover over any section, card, table, or code snippet on any website to highlight and select it.
- **Hierarchy Navigation**: Use keyboard arrows (`↑` parent / `↓` child) to expand or shrink your selection from a single paragraph to the entire article container.
- **Smart Auto-Article Isolation**: Automatically detects and extracts the main reading content while skipping navigation headers, footers, and advertisements.
- **Automatic Multi-Page Pagination**:
  - Automatically calculates and splits long elements into discrete paper sheets (**Page 1 of 3**, **Page 2 of 3**, etc.).
  - Running headers on every page with document title, source website, and date.
  - Running footers on every page with page numbering ("Page X of Y") and generator badge.
  - Live **Page Count Badge** (`📄 3 Pages`) in the toolbar.
  - Switch between **Multi-Page (Paged)** mode and **Continuous Roll** mode.
- **Complete Image & Diagram Support**:
  - Automatically captures images, responsive `srcset`, lazy-loaded images (`data-src`), `<picture>` sources, SVGs, and CSS background covers.
  - Built-in `<meta name="referrer" content="no-referrer">` prevents anti-hotlink CDN 403 blocks.
  - Preloads and decodes all images eagerly (`loading="eager"`) before triggering print, guaranteeing all pictures appear in the output PDF.
  - Live **Image Count Badge** (`📷 2 Images`) in the toolbar.
  - Formatted `<figure>` and `<figcaption>` styling with `page-break-inside: avoid` so photos are never sliced across page breaks.
- **High-Fidelity HTML-to-Markdown Engine**: Converts headings, formatted tables, code blocks with syntax styling, blockquotes, task lists, and hyperlinks. Automatically resolves relative URLs so images and links remain functional.
- **Dual-Pane Editor & Live Preview**: Real-time side-by-side editing, syntax toolbar shortcuts, and live word/character statistics.
- **Customizable PDF Export**:
  - **Themes**: GitHub Clean, Academic Serif, Modern Sans, Dark Minimal
  - **Paper Sizing**: Standard A4, US Letter, and US Legal
  - **Orientation**: Portrait and Landscape
  - **Page Margins**: Normal (15mm), Compact (8mm), Wide (25mm)
  - **Header & Footer Controls**: Document title, source URL, generation date, and page numbering with live toolbar toggles
  - **Toolbar Toggles**: Direct checkboxes for instant Header, Footer, and Image toggles without leaving the preview screen
- **Native Vector PDF Output**: Uses Chrome's built-in vector printing architecture for razor-sharp text, searchable content, and clickable links.
- **100% Private & Offline**: All processing occurs locally in your browser. No external servers, no tracking, and zero telemetry.

---

## 2. Permissions Justification

| Permission | Plain-English Reason for Review Team |
| :--- | :--- |
| `activeTab` | Required to inspect and extract the user-selected HTML element from the currently active webpage when the user invokes the extension. Access is granted solely during user interaction. |
| `scripting` | Required to inject the visual element-picker overlay and DOM extraction script into the active page upon user request. |
| `storage` | Required to save the user's preferred PDF styling settings (paper size, margin, theme) and draft Markdown locally on their device. |
| `contextMenus` | Required to provide convenient right-click context menu shortcuts ("Pick element to convert", "Convert selected text", "Convert article") on webpages. |

---

## 3. Privacy & Data Use Disclosure

- **Does the extension collect personally identifiable information (PII)?**  
  **No.** The extension does not collect, track, or transmit any user information or identity.
- **Does the extension send webpage content to any external server or third-party service?**  
  **No.** All HTML parsing, Markdown conversion, preview rendering, and PDF generation occur 100% locally within the client browser.
- **Storage Usage:**  
  Uses local browser storage (`chrome.storage.local`) exclusively to retain the user's styling preferences and recent Markdown drafts. Data never leaves the local machine.
