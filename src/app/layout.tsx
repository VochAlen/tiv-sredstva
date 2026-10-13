import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ServiceWorkerRegister } from "@/components/pwa/sw-register";
import { LanguageProvider } from "@/lib/lang-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display font za landing/hero naslove (vidi worker-page.tsx) - namjerno
// drugačiji od Geist Sans-a koji nosi ostatak aplikacije, da naslov nosi
// jasan karakter umjesto da bude neutralan nosač teksta.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "GSE Control - Ground Support Equipment Management",
  description: "QR-based check-in/check-out system for airport ground support equipment with inspection checklist, damage reporting and central dashboard.",
  keywords: ["GSE", "airport", "ground support equipment", "QR", "fleet management", "aviation"],
  authors: [{ name: "GSE Control" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "GSE Control",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} antialiased bg-background text-foreground`}
      >
        <LanguageProvider>
          {children}
          <Toaster />
          <SonnerToaster richColors position="top-center" />
          <ServiceWorkerRegister />
        </LanguageProvider>
      </body>
    </html>
  );
}
