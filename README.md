# Text Overlay Image Generator

A Next.js application that allows users to overlay formatted text onto images, with support for text alignment, superscript, and styling.

## Features

- Upload images via URL
- Text formatting with alignment tags ([center], [left], [right])
- Superscript text support (^{text})
- Font size and color customization
- Image preview with real-time updates
- Share settings via URL
- Download result as JPEG

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000)

## Deployment

This application is ready to be deployed on Vercel. Simply:

1. Push your code to a Git repository
2. Connect your repository to Vercel
3. Deploy

## Built With

- Next.js
- TypeScript
- Salesforce Lightning Design System
- sharp (for image processing)
- html2canvas

## Environment Variables

No environment variables are required for basic functionality.

## Browser Support

Tested and working in modern browsers (Chrome, Firefox, Safari, Edge).

```
image-text-overlay-new
├─ .next
│  ├─ app-build-manifest.json
│  ├─ build-manifest.json
│  ├─ cache
│  │  ├─ next-server.js.nft.json
│  │  ├─ swc
│  │  │  └─ plugins
│  │  │     └─ v7_macos_aarch64_0.98.5
│  │  └─ webpack
│  │     ├─ client-development
│  │     │  ├─ 0.pack.gz
│  │     │  ├─ 1.pack.gz
│  │     │  ├─ 10.pack.gz
│  │     │  ├─ 11.pack.gz
│  │     │  ├─ 12.pack.gz
│  │     │  ├─ 13.pack.gz
│  │     │  ├─ 2.pack.gz
│  │     │  ├─ 3.pack.gz
│  │     │  ├─ 4.pack.gz
│  │     │  ├─ 5.pack.gz
│  │     │  ├─ 6.pack.gz
│  │     │  ├─ 7.pack.gz
│  │     │  ├─ 8.pack.gz
│  │     │  ├─ 9.pack.gz
│  │     │  ├─ index.pack.gz
│  │     │  └─ index.pack.gz.old
│  │     ├─ client-production
│  │     │  ├─ 0.pack.gz
│  │     │  └─ index.pack.gz
│  │     ├─ server-development
│  │     │  ├─ 0.pack.gz
│  │     │  ├─ 1.pack.gz
│  │     │  ├─ 2.pack.gz
│  │     │  ├─ 3.pack.gz
│  │     │  ├─ 4.pack.gz
│  │     │  ├─ 5.pack.gz
│  │     │  ├─ 6.pack.gz
│  │     │  ├─ index.pack.gz
│  │     │  └─ index.pack.gz.old
│  │     └─ server-production
│  │        ├─ 0.pack.gz
│  │        ├─ index.pack.gz
│  │        └─ index.pack.gz.old
│  ├─ package.json
│  ├─ react-loadable-manifest.json
│  ├─ server
│  │  ├─ app
│  │  │  ├─ favicon.ico
│  │  │  │  └─ route.js
│  │  │  ├─ page.js
│  │  │  └─ page_client-reference-manifest.js
│  │  ├─ app-paths-manifest.json
│  │  ├─ middleware-build-manifest.js
│  │  ├─ middleware-manifest.json
│  │  ├─ middleware-react-loadable-manifest.js
│  │  ├─ next-font-manifest.js
│  │  ├─ next-font-manifest.json
│  │  ├─ pages-manifest.json
│  │  ├─ server-reference-manifest.js
│  │  ├─ server-reference-manifest.json
│  │  └─ webpack-runtime.js
│  ├─ static
│  │  ├─ chunks
│  │  │  ├─ _app-pages-browser_src_components_CanvasGenerator_tsx.js
│  │  │  ├─ _app-pages-browser_src_components_ClientApp_tsx.js
│  │  │  ├─ _app-pages-browser_src_components_Icons_tsx.js
│  │  │  ├─ _app-pages-browser_src_components_RichTextEditor_tsx.js
│  │  │  ├─ app
│  │  │  │  ├─ layout.js
│  │  │  │  └─ page.js
│  │  │  ├─ app-pages-internals.js
│  │  │  ├─ polyfills.js
│  │  │  ├─ react-refresh.js
│  │  │  └─ webpack.js
│  │  ├─ css
│  │  │  └─ app
│  │  │     └─ layout.css
│  │  ├─ development
│  │  │  ├─ _buildManifest.js
│  │  │  └─ _ssgManifest.js
│  │  ├─ media
│  │  │  ├─ banner-brand-default.3a737d1c.png
│  │  │  ├─ banner-group-public-default.6410eb8b.png
│  │  │  ├─ banner-user-default.576ef500.png
│  │  │  ├─ bg-info@2x.7e377fdc.png
│  │  │  ├─ einstein-figure.5bd56004.svg
│  │  │  ├─ einstein-header-background.6057e53b.svg
│  │  │  ├─ group_avatar_160.cffa85e2.png
│  │  │  ├─ group_avatar_200.6f8a0108.png
│  │  │  ├─ group_avatar_96.e9622120.png
│  │  │  ├─ logo-noname.49824344.svg
│  │  │  ├─ popover-action.20f66960.png
│  │  │  ├─ popover-header.33c3b5f4.png
│  │  │  ├─ profile_avatar_160.d96bb93c.png
│  │  │  ├─ profile_avatar_200.50651d6d.png
│  │  │  └─ profile_avatar_96.856e654e.png
│  │  └─ webpack
│  │     ├─ 29c51b82c949d9bb.webpack.hot-update.json
│  │     ├─ 2fd2facb14acfc98.webpack.hot-update.json
│  │     ├─ 3a07fe0b9ad2a338.webpack.hot-update.json
│  │     ├─ 6040d3ba43faef62.webpack.hot-update.json
│  │     ├─ 87f3fb9457220bf4.webpack.hot-update.json
│  │     ├─ 9fe85b666c311d64.webpack.hot-update.json
│  │     ├─ a24c45e68ba7fafa.webpack.hot-update.json
│  │     ├─ app
│  │     │  ├─ layout.29c51b82c949d9bb.hot-update.js
│  │     │  ├─ layout.2fd2facb14acfc98.hot-update.js
│  │     │  ├─ layout.3a07fe0b9ad2a338.hot-update.js
│  │     │  ├─ layout.6040d3ba43faef62.hot-update.js
│  │     │  ├─ layout.87f3fb9457220bf4.hot-update.js
│  │     │  ├─ layout.9fe85b666c311d64.hot-update.js
│  │     │  ├─ layout.a24c45e68ba7fafa.hot-update.js
│  │     │  ├─ layout.bd409bd79d791696.hot-update.js
│  │     │  ├─ layout.be3fb1f62a3a4787.hot-update.js
│  │     │  ├─ layout.c7cdcc10311ac96a.hot-update.js
│  │     │  ├─ layout.ce60ef48a2b71ff1.hot-update.js
│  │     │  ├─ layout.dce79bf6631ea04b.hot-update.js
│  │     │  ├─ layout.e1dec4295a137821.hot-update.js
│  │     │  ├─ layout.e781d870b882f352.hot-update.js
│  │     │  └─ layout.e945e93b2c7e2356.hot-update.js
│  │     ├─ b6587bb98c3efae6.webpack.hot-update.json
│  │     ├─ bd409bd79d791696.webpack.hot-update.json
│  │     ├─ be3fb1f62a3a4787.webpack.hot-update.json
│  │     ├─ c7cdcc10311ac96a.webpack.hot-update.json
│  │     ├─ ce60ef48a2b71ff1.webpack.hot-update.json
│  │     ├─ dce79bf6631ea04b.webpack.hot-update.json
│  │     ├─ e1dec4295a137821.webpack.hot-update.json
│  │     ├─ e781d870b882f352.webpack.hot-update.json
│  │     ├─ e945e93b2c7e2356.webpack.hot-update.json
│  │     ├─ webpack.29c51b82c949d9bb.hot-update.js
│  │     ├─ webpack.2fd2facb14acfc98.hot-update.js
│  │     ├─ webpack.3a07fe0b9ad2a338.hot-update.js
│  │     ├─ webpack.6040d3ba43faef62.hot-update.js
│  │     ├─ webpack.87f3fb9457220bf4.hot-update.js
│  │     ├─ webpack.9fe85b666c311d64.hot-update.js
│  │     ├─ webpack.a24c45e68ba7fafa.hot-update.js
│  │     ├─ webpack.b6587bb98c3efae6.hot-update.js
│  │     ├─ webpack.bd409bd79d791696.hot-update.js
│  │     ├─ webpack.be3fb1f62a3a4787.hot-update.js
│  │     ├─ webpack.c7cdcc10311ac96a.hot-update.js
│  │     ├─ webpack.ce60ef48a2b71ff1.hot-update.js
│  │     ├─ webpack.dce79bf6631ea04b.hot-update.js
│  │     ├─ webpack.e1dec4295a137821.hot-update.js
│  │     ├─ webpack.e781d870b882f352.hot-update.js
│  │     └─ webpack.e945e93b2c7e2356.hot-update.js
│  ├─ trace
│  └─ types
│     ├─ app
│     │  ├─ layout.ts
│     │  └─ page.ts
│     └─ package.json
├─ HelveticaNeue-Condensed-Bold.ttf
├─ README.md
├─ eslint.config.mjs
├─ next.config.js
├─ next.config.ts
├─ package-lock.json
├─ package.json
├─ postcss.config.mjs
├─ public
│  ├─ assets
│  │  └─ icons
│  │     └─ utility-sprite
│  │        └─ svg
│  │           └─ symbols.svg
│  ├─ file.svg
│  ├─ globe.svg
│  ├─ next.svg
│  ├─ vercel.svg
│  └─ window.svg
├─ scripts
│  └─ convertFontToBase64.js
├─ src
│  ├─ app
│  │  ├─ favicon.ico
│  │  ├─ globals.css
│  │  ├─ layout.tsx
│  │  └─ page.tsx
│  ├─ components
│  │  ├─ CanvasGenerator.tsx
│  │  ├─ ClientApp.tsx
│  │  ├─ ClientWrapper.tsx
│  │  ├─ ErrorBoundary.tsx
│  │  ├─ Icons.tsx
│  │  ├─ Icons.tsx.bak
│  │  ├─ LoadingSpinner.tsx
│  │  ├─ RichTextEditor.tsx
│  │  ├─ StatusManager.tsx
│  │  └─ ThemeProvider.tsx
│  ├─ hooks
│  │  ├─ useFocusTrap.ts
│  │  ├─ useKeyboardManager.ts
│  │  ├─ useKeyboardNavigation.ts
│  │  └─ usePreviewKeyboard.ts
│  ├─ pages
│  │  └─ api
│  │     ├─ load-images.ts
│  │     ├─ overlay-opentype.ts
│  │     └─ overlay.ts
│  ├─ types
│  │  ├─ opentype.d.ts
│  │  └─ svgdom.d.ts
│  └─ utils
│     ├─ focusTrap.ts
│     └─ fontData.ts
├─ tailwind.config.ts
├─ tsconfig.json
└─ vercel.json

```