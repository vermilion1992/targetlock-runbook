import React from "react";
import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import "./css/globals.css";
import "../utils/i18n";
import NextTopLoader from "nextjs-toploader";
import { Toaster } from "../components/ui/toaster";
import { CustomizerContextProvider } from "./context/customizer-context";
import { ThemeProvider } from "@/components/ThemeProvider";
import { OperatorSessionProvider } from "@/components/session";

const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  applicationName: "TargetLock",
  title: {
    default: "TargetLock",
    template: "%s | TargetLock",
  },
  description: "Local-first field runbook for diamond-drilling operations.",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className={`${dmSans.className}`}>
        <NextTopLoader color="#1f6feb" showSpinner={false} />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <OperatorSessionProvider>
            <CustomizerContextProvider>{children}</CustomizerContextProvider>
          </OperatorSessionProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
