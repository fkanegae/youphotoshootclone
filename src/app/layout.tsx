import type { Metadata } from "next";

import { Analytics } from "@vercel/analytics/react";
import { DM_Sans } from "next/font/google";
import "./globals.css";

const BG = DM_Sans({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "The #1 Professional AI Photo Generator",
  description:
    "The most popular AI headshot generator. Create studio quality headshots with YouPhotoshoot. Best for professional business headshots.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, viewport-fit=cover"
        />
      </head>
      <body className={BG.className}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
