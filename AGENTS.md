# Agent Instructions

## What This Application Is

**Image Text Overlay Editor** — A web tool for compositing text and logo overlays onto images. Primarily used embedded inside **Salesforce Marketing Cloud (SFMC)** as a custom app, but also usable standalone. Users position text and brand logos over a background image, adjust styling, and export the result as a JPEG/PNG for use in email campaigns.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js (App Router + Pages Router hybrid) |
| Language | TypeScript 5, React 19 |
| Styling | Tailwind CSS 3, Salesforce Lightning Design System (SLDS) |
| Canvas/Image | HTML5 Canvas (browser preview), Sharp (server-side export) |
| Font rendering | OpenType.js (text-to-path for canvas and export) |
| Database | Neon Postgres via `@neondatabase/serverless` |
| URL compression | LZ-String (project state shared via compressed URL) |
| IDs | nanoid (10-char project/folder IDs) |
| Deployment | Vercel |

---

## Project Structure

```
src/
  app/                        # Next.js App Router (pages only)
    layout.tsx                # Root layout — loads SLDS CSS, ThemeProvider
    page.tsx                  # Main page — renders <ClientWrapper />
    globals.css               # CSS variables, Tailwind base, font-face declaration
    p/[id]/
      page.tsx                # Shareable project link — loads project by ID and hydrates state
      not-found.tsx           # 404 page for unknown project IDs
  pages/
    api/                      # Next.js Pages Router (API routes only)
      overlay.ts              # POST — server-side image export (Sharp + OpenType.js)
      overlay-opentype.ts     # POST — alternative SVG-path text rendering
      load-images.ts          # POST — proxies external images as base64 (CORS workaround)
      preset-logos.ts         # GET — returns Milwaukee preset logos from milwaukee-logos.json
      projects/
        index.ts              # GET list / POST create projects
        [id].ts               # GET / PUT / DELETE single project
      folders/
        index.ts              # GET folder tree (recursive CTE) / POST create folder
        [id].ts               # GET / PUT / DELETE single folder
  components/
    ClientWrapper.tsx         # Suspense wrapper around ClientApp
    ClientApp.tsx             # Central state hub — all app state lives here; exports TextOverlay, ImageOverlay, PresetLogo interfaces
    CanvasGenerator.tsx       # Canvas rendering engine — drag, resize, preview; SSR disabled
    RichTextEditor.tsx        # Text overlay editing panel; SSR disabled
    ProjectsBrowser.tsx       # Folder/project browser modal — create, rename, delete, navigate
    StatusManager.tsx         # Toast notification system
    TickerText.tsx            # Scrolling marquee for overflow text in UI
    ThemeProvider.tsx         # Dark/light mode toggle
    Icons.tsx                 # Full SVG icon library (single source of truth for all icons)
    ErrorBoundary.tsx         # React error boundary
    LoadingSpinner.tsx        # Loading indicator
  hooks/
    useFocusTrap.ts           # Traps keyboard focus inside modals
    useKeyboardManager.ts     # Global keyboard shortcut manager
    useKeyboardNavigation.ts  # Arrow key navigation for overlay selection
    usePreviewKeyboard.ts     # Keyboard controls in canvas preview mode
  utils/
    db.ts                     # Returns a Neon SQL client from DATABASE_URL env var
    fontData.ts               # Base64-encoded Helvetica Neue LT Pro 93 (for server-side rendering)
    presetLogos.ts            # Loads and parses milwaukee-logos.json
    focusTrap.ts              # DOM utility for focus trapping
  types/
    opentype.d.ts             # TypeScript declarations for opentype.js
    svgdom.d.ts               # TypeScript declarations for svgdom
public/
  fonts/                      # Helvetica Neue LT Pro 93 Black Extended OTF (browser preview)
  assets/icons/               # SVG sprite assets
scripts/
  convertFontToBase64.js      # One-time script — converts OTF to base64 for fontData.ts
  migrate.ts                  # Database migration — creates projects and folders tables
milwaukee-logos.json          # All Milwaukee brand logos (system + trade, with language variants)
```

---

## Key Architecture Decisions

### Hybrid Routing
The app uses **App Router** for pages and **Pages Router** for all API routes (`src/pages/api/`). This is intentional — the Pages Router API routes have simpler body parsing configuration and work better with Sharp's binary responses.

### Dynamic Imports (SSR disabled)
`CanvasGenerator` and `RichTextEditor` are imported with `{ ssr: false }` because they rely on browser APIs (Canvas API, DOM). Never add SSR to these components.

### Image Proxying
The `/api/load-images` endpoint fetches external images server-side and returns them as base64 data URLs. This is required because the HTML5 Canvas API taints the canvas when drawing cross-origin images, which would block export. Always route external image loading through this proxy.

### Font Handling
Helvetica Neue LT Pro 93 is used for all text. Two copies exist:
- `/public/fonts/` — loaded via CSS `@font-face` for browser canvas preview
- `src/utils/fontData.ts` — base64-encoded for server-side use in API routes (Sharp/OpenType)

Do not try to load fonts from the filesystem in API routes — use the base64 version from `fontData.ts`.

### State Serialization
The entire app state (`textOverlays`, `imageOverlays`, canvas dimensions, background settings) is serialized to JSON and compressed with LZ-String for URL sharing. The `/p/[id]` route decompresses and hydrates this state.

### SFMC Embedding
The app is embedded in Salesforce Marketing Cloud via `<iframe>`. Key implications:
- `X-Frame-Options: ALLOWALL` is set in `next.config.js`
- CSP `frame-ancestors` allows `*.exacttarget.com`, `*.marketingcloudapps.com`, `*.salesforce.com`, `*.force.com`
- Do not remove or restrict these headers

---

## Database Schema

Tables live in **Neon Postgres**. Run `npx ts-node scripts/migrate.ts` to create them fresh.

```sql
CREATE TABLE folders (
  id          VARCHAR(20) PRIMARY KEY,
  name        TEXT NOT NULL,
  parent_id   VARCHAR(20) REFERENCES folders(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE projects (
  id          VARCHAR(20) PRIMARY KEY,
  name        TEXT NOT NULL,
  folder_id   VARCHAR(20) REFERENCES folders(id) ON DELETE SET NULL,
  data        JSONB NOT NULL,          -- full serialized app state
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
```

The `data` column holds the full LZ-String-decompressed app state object.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon Postgres connection string |
| `POSTGRES_URL` | Fallback | Alternative name for the same connection string |

Set these in Vercel project settings and pull locally with `vercel env pull`.

---

## API Routes Reference

| Route | Method | Description |
|-------|--------|-------------|
| `/api/overlay` | POST | Server-side image export. Accepts `{ textOverlays, imageOverlays, imageUrl, brightness, tintColor, ... }`, returns an image buffer (JPEG/PNG). Uses Sharp + OpenType.js. Max duration: 60s. |
| `/api/overlay-opentype` | POST | Alternative text renderer that converts text to SVG paths. Used for precise font rendering. |
| `/api/load-images` | POST | Accepts `{ images: string[] }` (URLs or base64). Fetches and converts to base64. CORS proxy for canvas. |
| `/api/preset-logos` | GET | Returns `{ systemLogos, tradeLogos }` from `milwaukee-logos.json`. |
| `/api/projects` | GET | List all projects. Query params: `folder_id`, `unfiled=true`. |
| `/api/projects` | POST | Create project. Body: `{ data, name, folderId }`. Returns `{ id, name }`. |
| `/api/projects/[id]` | GET | Fetch single project with full data. |
| `/api/projects/[id]` | PUT | Update project name or data. |
| `/api/projects/[id]` | DELETE | Delete project. |
| `/api/folders` | GET | List folders. Query: `parent_id`, `tree=true` (recursive hierarchy). |
| `/api/folders` | POST | Create folder. Body: `{ name, parentId }`. |
| `/api/folders/[id]` | GET/PUT/DELETE | Single folder operations. |

---

## Core Interfaces (from ClientApp.tsx)

```typescript
interface TextOverlay {
  id: string;
  text: string;
  fontSize: number;
  desktopFontSize?: number;
  mobileFontSize?: number;
  fontColor: string;
  x: number; y: number;                         // % of canvas
  desktopX?: number; desktopY?: number;
  mobileX?: number; mobileY?: number;
  allCaps?: boolean;
  alignment?: 'left' | 'center' | 'right';
}

interface ImageOverlay {
  id: string;
  imageUrl: string;
  originalImageUrl: string;
  width: number; height: number;                // % of canvas
  x: number; y: number;                         // % position
  desktopX?: number; desktopY?: number;
  mobileX?: number; mobileY?: number;
  desktopWidth?: number; desktopHeight?: number;
  mobileWidth?: number; mobileHeight?: number;
  aspectRatio: number;
  presetLogoId?: string;
  presetLogoType?: 'system' | 'trade';
  selectedLanguage?: string;
  availableLanguages?: string[];
}
```

---

## Development Commands

```bash
npm run dev      # Start local dev server (http://localhost:3000)
npm run build    # Production build
npm run start    # Start production server locally
npm run lint     # Run ESLint
```

---

## Branch & Deployment Strategy

This project uses a two-branch workflow on Vercel:

| Branch | Vercel Deployment | Purpose |
|--------|-------------------|---------|
| `main` | Production URL | Stable, tested version — only updated when features are confirmed working |
| `beta` | Preview/alias URL | Active development and testing of new features |

### Rules

- **All new feature work happens on `beta`**. Never develop directly on `main`.
- Pushing to `beta` auto-deploys to the Vercel beta preview URL.
- When a feature is tested and approved on `beta`, merge into `main` to promote it to production.
- After merging to `main`, always switch back to `beta` to continue development.

### Common Commands

```bash
# Switch to beta to continue working
git checkout beta

# Commit and deploy to beta
git add .
git commit -m "description of change"
git push

# Promote beta → production
git checkout main
git merge beta
git push
git checkout beta   # return to beta immediately after
```

### Keeping branches in sync (e.g. after a hotfix on main)

```bash
git checkout beta
git merge main
git push
```

---

## Common Gotchas

- **Never SSR `CanvasGenerator` or `RichTextEditor`** — they use browser-only APIs.
- **All font loading in API routes must use `fontData.ts`** — filesystem access is not reliable in Vercel serverless functions.
- **External images must be proxied** through `/api/load-images` before drawing to canvas.
- **Do not remove SFMC frame headers** in `next.config.js` — the app will break when embedded.
- **`DATABASE_URL` must be set** — the app throws a clear error at runtime if missing; configure via Vercel dashboard and `vercel env pull` locally.
- **Sharp is a `serverExternalPackage`** — do not attempt to import Sharp in client components.
- **Milwaukee logos are in `milwaukee-logos.json`** at the project root — not in the database.
- Position/size values for overlays are **percentages of canvas dimensions**, not pixels.
