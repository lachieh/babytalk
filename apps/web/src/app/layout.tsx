import type { Metadata } from "next";
import Script from "next/script";

import "./globals.css";

export const metadata: Metadata = {
  description: "Babytalk application",
  title: "Babytalk",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const runtimeEnv = JSON.stringify({
    API_URL: process.env.API_URL || "",
  });

  return (
    <html lang="en">
      <head>
        <Script
          id="runtime-env"
          strategy="beforeInteractive"
        >{`window.__ENV__=${runtimeEnv}`}</Script>
      </head>
      <body>{children}</body>
    </html>
  );
}
