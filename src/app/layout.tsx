import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Planning & Pointage HCR",
  description: "Application de gestion de planning et pointage conforme HCR",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
