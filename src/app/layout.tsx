import type { Metadata, Viewport } from "next";
import { Figtree, Literata } from "next/font/google";
import "./globals.css";

const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin", "latin-ext"] });
/** Book serif for what she reads: questions, answers, explanations. */
const literata = Literata({ variable: "--font-literata", subsets: ["latin", "latin-ext"], axes: ["opsz"] });

export const metadata: Metadata = {
  title: "Nutri",
  description: "Příprava na zkoušku Výživový poradce",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#f7f5f0",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="cs" className={`${figtree.variable} ${literata.variable} h-full antialiased`}>
      <body className="min-h-full font-sans text-[17px] leading-relaxed">{children}</body>
    </html>
  );
}
