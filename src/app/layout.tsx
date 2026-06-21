import type { Metadata } from "next";
import "./globals.css";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002";

function metadataBaseUrl() {
  try {
    return new URL(appUrl);
  } catch {
    return new URL("http://localhost:3002");
  }
}

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
	      className="h-full antialiased"
	      suppressHydrationWarning
	    >
      <body className="min-h-full flex flex-col">
        {/* Set the theme attribute before paint to avoid a light→dark flash.
            Kept in sync afterward by useTheme(). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var m=localStorage.getItem('eaieos:theme');var d=m==='dark'||((!m||m==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light');}catch(e){}})();",
          }}
        />
        {children}
      </body>
    </html>
  );
}
