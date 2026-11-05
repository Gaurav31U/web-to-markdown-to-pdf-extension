# MarkPDF — Web Page Element to Markdown & Multi-Page PDF Chrome Extension

MarkPDF is a full-featured Chrome extension (Manifest V3) that lets you visually select any element or article on any website, convert it into clean, formatted Markdown, preview and edit it in real time, and export it into a beautifully styled multi-page vector PDF with verified image rendering.

---

## 🚀 Key Features

- **Visual Element Picker**: Hover over any section, table, or code snippet with an interactive overlay.
- **Hierarchy Navigation**: Use keyboard hotkeys (`↑` parent, `↓` child, `Click` or `Enter` to select, `Esc` to cancel) to fine-tune your element selection.
- **Smart Auto-Article Isolation**: One-click extraction of the main article content, ignoring sidebars, banners, and ads.
- **Automatic Multi-Page Pagination**:
  - Automatically calculates and splits long elements into discrete paper sheets (**Page 1 of 3**, **Page 2 of 3**, etc.).
  - Running headers on every page with document title, source website, and date.
  - Running footers on every page with page numbering ("Page X of Y") and generator badge.
  - **Header & Footer Toggles**: Direct checkboxes in the toolbar to turn headers and footers ON/OFF with automatic layout adjustment.
  - Live **Page Count Badge** (`📄 3 Pages`) in the toolbar.
  - Switch between **Multi-Page (Paged)** mode and **Continuous Roll** mode.
- **Complete Image & Diagram Support**:
  - Automatically captures images, responsive `srcset`, lazy-loaded images (`data-src`), `<picture>` sources, SVGs, and CSS background covers.
  - Built-in `<meta name="referrer" content="no-referrer">` prevents anti-hotlink CDN 403 blocks.
  - Preloads and decodes all images eagerly (`loading="eager"`) before triggering print, guaranteeing all pictures appear in the output PDF.
  - Live **Image Count Badge** (`📷 2 Images`) in the toolbar.
  - Formatted `<figure>` and `<figcaption>` styling with `page-break-inside: avoid` so photos are never sliced across page breaks.
- **High-Fidelity HTML-to-Markdown Engine**:
  - Headings (`#` to `######`)
  - Formatted tables with text alignment
  - Syntax-highlighted code fences with language detection
  - Blockquotes, task lists (`- [x]`), bulleted and numbered lists
  - Relative-to-absolute URL resolution for hyperlinks and images
- **Dual-Pane Popup Editor & Live Preview**:
  - Live Markdown editor with formatting toolbar (H1, H2, Bold, Italic, Code, Quote, Table)
  - Word, character, and line count statistics
  - Live rendered HTML preview
- **Customizable PDF Export**:
  - **Themes**: GitHub Clean, Academic Serif, Modern Sans, and Dark Minimal
  - **Paper Sizing**: Standard A4, US Letter, and US Legal
  - **Orientation**: Portrait and Landscape
  - **Margins**: Normal (15mm), Compact (8mm), Wide (25mm)
  - **Typography**: Small (12px), Normal (14px), Medium (16px)
- **Native Vector PDF Output**: Utilizes Chrome's built-in vector printing architecture (`window.print()`), ensuring crisp vector fonts, searchable text, and clickable hyperlinks.
- **100% Offline & Private**: Zero external network dependencies, no external CDN calls, and no data tracking.

---

## 📦 How to Install in Chrome

1. Open Google Chrome.
2. Navigate to `chrome://extensions/` in the address bar.
3. Enable **Developer mode** using the toggle switch in the top right corner.
4. Click the **Load unpacked** button in the top left.
5. Select this project folder:
   ```
   markdown Extension
   ```
6. The **MarkPDF** extension icon will now appear in your browser toolbar! (Pin it for quick access).

---

## 🛠️ How to Test & Use

1. Open [test-page.html](file:///c:/Users/gkxp1/OneDrive/Desktop/markdown%20Extension/test-page.html) included in the folder (or any website).
2. Click the **MarkPDF** extension icon in your Chrome toolbar.
3. Click **"🎯 Pick Element"** and hover over the long article (or click **"📰 Auto Article"**).
4. In the modal or popup, click **"🖨️ Export as PDF"**.
5. You will see:
   - The document cleanly split across multiple pages (**Page 1 of 3**, **Page 2 of 3**, etc.).
   - All article photos and SVG diagrams fully loaded and displayed.
   - The toolbar showing the exact page count and image count.
   - Click **"Print / Save as PDF"** to save your pristine multi-page vector PDF.
