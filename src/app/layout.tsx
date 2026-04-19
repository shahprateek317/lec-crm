import type { Metadata, Viewport } from "next";
import { Inter, Lora } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Life Energy Centre",
    template: "%s · Life Energy Centre",
  },
  description:
    "A calm, welcoming CRM for Pranic Healing at Life Energy Centre, New Town, Kolkata.",
  applicationName: "Life Energy Centre",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Life Energy Centre",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcf8f2" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1624" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${lora.variable} h-full`}>
      <body className="min-h-full antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
