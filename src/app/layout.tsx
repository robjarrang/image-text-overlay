import type { Metadata } from "next";
import { ThemeProvider } from "@/components/ThemeProvider";
import "@salesforce-ux/design-system/assets/styles/salesforce-lightning-design-system.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Image Text Overlay Editor",
  description: "Add text overlays to images with precise control",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider />
        {children}
      </body>
    </html>
  );
}
