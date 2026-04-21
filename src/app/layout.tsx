import type { Metadata, Viewport } from "next";
import fs from "node:fs";
import path from "node:path";
import { ThemeProvider } from "@/components/ThemeProvider";
import "@salesforce-ux/design-system/assets/styles/salesforce-lightning-design-system.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Image Text Overlay Editor",
  description: "Add text overlays to images with precise control",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

// Read the SLDS utility sprite from disk at module-load time and inline it
// into the initial HTML. External-file `<use xlinkHref=".../symbols.svg#id">`
// references don't inherit host-document CSS in Safari/Firefox, and a
// client-side fetch has a race window before paint. Inlining the sprite
// into the document body once means every `<use href="#id">` resolves
// against a same-document `<symbol>`, so CSS — including our
// `--slds-c-icon-color-foreground: currentColor` override — cascades
// reliably into the icon paths.
const spriteMarkup = (() => {
  try {
    const file = path.join(
      process.cwd(),
      "public",
      "assets",
      "icons",
      "utility-sprite",
      "svg",
      "symbols.svg",
    );
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
})();

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Inline script: synchronously tag <html> with `is-embedded` when
  // loaded inside an iframe, BEFORE first paint. We can't rely on
  // ThemeProvider's useEffect for this because by the time React
  // hydrates, the mobile-sticky CSS has already laid out the page
  // (pinning the preview, trapping scroll inside narrow SFMC iframes).
  // Running synchronously in <head> means the class is present when
  // the first stylesheet match happens, so `html.is-embedded` rules
  // win from the first frame.
  const embedDetect = `try{if(window.self!==window.top){document.documentElement.classList.add('is-embedded')}}catch(e){document.documentElement.classList.add('is-embedded')}`;
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: embedDetect }} />
      </head>
      <body>
        {/* Inlined SLDS utility sprite — see comment on spriteMarkup above. */}
        <div
          id="slds-utility-sprite"
          aria-hidden="true"
          style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
          dangerouslySetInnerHTML={{ __html: spriteMarkup }}
        />
        <ThemeProvider />
        {children}
      </body>
    </html>
  );
}