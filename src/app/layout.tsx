import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002";

function metadataBaseUrl() {
  try {
    return new URL(appUrl);
  } catch {
    return new URL("http://localhost:3002");
  }
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: metadataBaseUrl(),
  applicationName: "Enterprise AI Enablement OS",
  title: "Enterprise AI Enablement OS",
  description:
    "A governed operating system for designing, deploying, measuring, and scaling enterprise AI Skills.",
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "Enterprise AI Enablement OS",
    description:
      "A governed operating system for designing, deploying, measuring, and scaling enterprise AI Skills.",
    siteName: "Enterprise AI Enablement OS",
    type: "website",
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
  appleWebApp: {
    capable: true,
    title: "AI Enablement OS",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
