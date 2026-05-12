import type { Metadata, Viewport } from "next";

import { ThemeColorSync } from "@/components/theme-color-sync";

import "./globals.css";
import { ServiceWorkerRegistrar } from "./sw-registrar";

export const metadata: Metadata = {
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BabyTalk",
  },
  applicationName: "BabyTalk",
  description: "Track feeds, sleep, and diapers with your voice",
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
  title: "BabyTalk",
};

export const viewport: Viewport = {
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { color: "#ede8df", media: "(prefers-color-scheme: light)" },
    { color: "#262420", media: "(prefers-color-scheme: dark)" },
  ],
  userScalable: false,
  viewportFit: "cover",
  width: "device-width",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
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
        <ThemeColorSync />
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
