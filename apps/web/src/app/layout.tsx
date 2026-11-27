import type { Metadata, Viewport } from "next";

import { ThemeSync } from "@/components/theme-sync";
import { applyThemeScript } from "@/lib/theme";

import "./globals.css";
import { LegacyStorageMigration } from "./legacy-storage";
import { ServiceWorkerRegistrar } from "./sw-registrar";

export const metadata: Metadata = {
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Bubsie",
  },
  applicationName: "Bubsie",
  description:
    "Track feeds, sleep, diapers, and pumping in one tap. One clear, shared baby log for the whole family.",
  icons: {
    apple: "/icons/apple-touch-icon.png",
    icon: [
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
  manifest: "/manifest.json",
  title: "Bubsie",
};

export const viewport: Viewport = {
  initialScale: 1,
  viewportFit: "cover",
  width: "device-width",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Picks light or dark before first paint so the page and the
            phone's status bar never disagree. */}
        {/* oxlint-disable-next-line react/no-danger -- static script built from our own function */}
        <script dangerouslySetInnerHTML={{ __html: applyThemeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="overflow-hidden overscroll-none">
        <LegacyStorageMigration />
        <ThemeSync />
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
