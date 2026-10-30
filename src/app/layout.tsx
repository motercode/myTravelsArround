import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Next Netlify Template",
    template: "%s | Next Netlify Template",
  },
  description: "Base reutilizable para aplicaciones Next.js desplegadas en Netlify.",
  metadataBase: new URL(
    process.env.URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  ),
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: "/",
    siteName: "Next Netlify Template",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning className="dark">
      <body className="antialiased bg-background text-foreground">{children}</body>
    </html>
  );
}
