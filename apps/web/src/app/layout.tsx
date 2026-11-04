import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Casefolio — Polished UI Case Studies in Minutes",
  description:
    "Pick a professionally designed template, fill constrained content and media slots, and publish or export your UI case study.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
