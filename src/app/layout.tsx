import type { Metadata, Viewport } from "next";
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
        <ThemeProvider />
        {children}
      </body>
    </html>
  );
}