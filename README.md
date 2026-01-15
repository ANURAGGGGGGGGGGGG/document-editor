Document Editor (Next.js + Tiptap)

Create paginated, print‑perfect documents with a clean, focused layout. This app renders a US Letter page surface in the browser, provides rich text editing with Tiptap, and outputs a clean Print/PDF without extra UI.

## Getting Started

Run the development server:

```bash
npm run dev
```

Open http://localhost:3000 to use the editor.

## Features

- US Letter page surface with inch-based layout (8.5in × 11in, 1in margins)
- Toolbar
  - Undo/Redo with hover tooltips
  - Headings (H1), bold/italic via StarterKit
  - Text alignment (left/center/right/justify) with crisp SVG icons
  - Bullet list toggle
  - Font size +/− control
- Color Picker
  - Compact grid palette with hand-picked swatches
  - Live preview on the button
  - Eyedropper support (where available) and native color input fallback
  - Space-optimized: no reset button clutter
- Indent Ruler
  - Drag handles for Left, Right, and First Line indent
  - Tooltips show distances in inches
  - Tick marks and subtle highlights guide paragraph layout
- Pagination Indicator: Page N of M badge during editing
- Print/PDF
  - Hides editor chrome (header, toolbar, ruler) for clean output
  - Sets @page to US Letter with 1in margins
  - Preserves bullet/number styling with visible markers

## Tech Stack

- Next.js 16.1.1
- React 19.x
- Tiptap 3.x (@tiptap/react, StarterKit, Color, TextStyle, TextAlign)
- Tailwind CSS 4 (utility-first styling)

The main editor lives in app/page.js and is built with @tiptap/react and @tiptap/starter-kit. It supports headings, paragraphs, bold, italic, and bullet lists, and renders inside a virtual page surface sized to US Letter (8.5in × 11in) with 1-inch margins.

## Usage Guide

### Toolbar
- Undo / Redo: Hover shows labels; click to apply.
- H1: Toggles heading level 1 on the current block.
- Alignment: Choose left/center/right/justify via SVG buttons.
- Bullets: Toggles an unordered list.
- Font Size: Use + and − to adjust text size per document session.
- Text Color: Click the color button to open the palette, select a swatch or:
  - “+” opens the native color picker
  - Eyedropper (if available) picks any color on screen

### Ruler
- Left/Right indent: Drag black markers to set left and right padding.
- First Line indent: Drag the blue marker to set first-line text indent.
- Tooltips show inches; ticks help align content visually.
- Applies to paragraphs and headings by updating node attributes.

### How pagination is calculated (updated)

- The editor content is rendered inside a single scrollable container.
- The page surface uses CSS inch units for width, height, and margins:
  - width: 8.5in
  - page height: 11in
  - body content height: 11in − 2in (top and bottom margins)
- Visual page boundaries are drawn using a repeating linear gradient on the editor-page-surface element, with background-size set to 11in. This creates a horizontal rule at every virtual page break.
- Pagination helper measures the editor-page-surface scrollHeight (not the whole container), converts 11in to pixels at 96 dpi, and estimates pageCount = ceil(contentHeight / pageHeightPx).
- Current page is derived from container.scrollTop relative to the surface’s offsetTop, then rounded and clamped.
- Pagination updates reactively on:
  - Typing/selection changes
  - Font size changes
  - Window resize
  - editor-page-surface ResizeObserver
- Because the editor and print styles share inch-based metrics, where a paragraph crosses a drawn page boundary in the editor it will also cross a real page break when printed, within browser engine limits.

### Print and PDF output

- A Print / PDF button calls window.print from the client-side page component.
- The print stylesheet uses @media print and @page:
  - @page size: 8.5in 11in
  - @page margin: 1in
  - Page chrome, toolbars, ruler, pagination badge, and background decorations are hidden in print mode.
  - The editor content is rendered as normal flowing text and lists; the browser handles physical page breaks.
- Export to PDF is handled by the browser or operating system print-to-PDF pipeline, so the on-screen layout and printed/PDF layout stay aligned.

## Customization

- Color Palette: Edit the palette array in [page.js](file:///c:/Users/acer/Coding%20stuff/New%20folder%20(2)/tiptap/app/page.js) inside the ColorPicker component.
- Bullet/Number Styling: Adjust list marker colors and sizes in [globals.css](file:///c:/Users/acer/Coding%20stuff/New%20folder%20(2)/tiptap/app/globals.css) under .editor-content ul/ol.
- Page Metrics: Edit pageMetrics in [page.js](file:///c:/Users/acer/Coding%20stuff/New%20folder%20(2)/tiptap/app/page.js) to change size/margins (editor uses inch units).
- Ruler Spacing: Increase/decrease the gap under the ruler by tweaking .doc-ruler margin-bottom in [globals.css](file:///c:/Users/acer/Coding%20stuff/New%20folder%20(2)/tiptap/app/globals.css).

## Scripts

- dev: Start the development server
- build: Build the Next app
- start: Run the production server
- lint: Run ESLint

```bash
npm install
npm run dev
# in another terminal
npm run lint
```

## Directory Reference

- App page: [page.js](file:///c:/Users/acer/Coding%20stuff/New%20folder%20(2)/tiptap/app/page.js)
- Global styles: [globals.css](file:///c:/Users/acer/Coding%20stuff/New%20folder%20(2)/tiptap/app/globals.css)
- Package and scripts: [package.json](file:///c:/Users/acer/Coding%20stuff/New%20folder%20(2)/tiptap/package.json)

## Trade-offs and limitations

- The editor uses a single flowing DOM rather than splitting content into real per-page containers. This keeps the ProseMirror schema simple and editing fast, but means pagination is a visual overlay rather than hard structural page breaks.
- Exact line and page breaks depend on the user’s environment:
  - Fonts must be available and rendered consistently.
  - Browser differences in layout and print engines can produce small variations.
- Advanced page-layout features such as widows/orphans control, keep-with-next, and per-section page styles are not implemented.
- Header and footer are treated as document-level chrome, not true repeating per-page headers/footers. Implementing fully accurate per-page header/footer content typically requires a dedicated print layout pipeline or a server-side PDF generator.

## Possible improvements with more time

- Introduce a logical Page node in the Tiptap schema and a custom NodeView that handles per-page containers, enabling explicit control over where page breaks occur.
- Add support for repeating per-page headers and footers, potentially driven by page templates and variables like page number and total pages.
- Integrate a PDF-generation backend (for example, Playwright or a headless browser) to render server-side PDFs using the same inch-based layout rules, guaranteeing identical output for exports.
- Implement a more robust pagination engine that measures actual rendered block heights and inserts soft page-break markers at stable boundaries, while still allowing responsive reflow during edits.
- Extend formatting features to match richer word processors: numbered lists, tables, images, and styles, all respecting the same pagination rules.

## License

No license specified. Add your preferred license (e.g., MIT) before distribution.

## Support

Issues and feature requests are welcome. Describe expected behavior, actual behavior, steps to reproduce, and your browser/OS.
