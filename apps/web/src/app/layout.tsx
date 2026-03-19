import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  description: "Babytalk application",
  title: "Babytalk",
};

/**
 * Runtime env vars injected into the client via a script tag.
 * NEXT_PUBLIC_* vars are baked in at build time, which doesn't work
 * for standalone deployments where the image is built once and deployed
 * to multiple environments. This reads server-side env at request time.
 */
const getRuntimeEnv = () =>
  JSON.stringify({
    API_URL: process.env.API_URL ?? "",
  });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script id="runtime-env">{`window.__ENV__=${getRuntimeEnv()}`}</script>
      </head>
      <body>{children}</body>
    </html>
  );
}
