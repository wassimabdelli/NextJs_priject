import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { OfflineBanner } from "@/components/pwa/OfflineBanner";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { RedesignProvider } from "@/lib/redesign/store";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "SyndicPro — Gestion de Copropriété Moderne",
  description:
    "Plateforme moderne de gestion de copropriété : finances, incidents, AG, votes et communication résidents.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SyndicPro",
  },
  icons: {
    icon: [
      { url: "/icons/icon.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="fr"
      className={`${jakarta.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="flex min-h-dvh flex-col overflow-x-hidden bg-[#f4f7fb] font-sans text-slate-800 selection:bg-blue-600 selection:text-white dark:bg-[#080d1a] dark:text-slate-100">
        <OfflineBanner />
        <ServiceWorkerRegister />
        <InstallPrompt />
        <RedesignProvider>
          <div className="flex min-h-dvh flex-1 flex-col">{children}</div>
        </RedesignProvider>
      </body>
    </html>
  );
}
