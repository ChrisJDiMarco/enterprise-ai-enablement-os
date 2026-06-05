import type { Metadata } from "next";
import type React from "react";
import { MarketingShell } from "@/components/marketing/MarketingShell";

export const metadata: Metadata = {
  title: {
    default: "Enterprise AI Enablement OS",
    template: "%s | Enterprise AI Enablement OS",
  },
  description:
    "A governed operating system for turning enterprise AI strategy into reusable Skills, Harness traces, evidence, adoption, ROI, and executive reporting.",
  robots: {
    index: process.env.NEXT_PUBLIC_MARKETING_INDEXABLE === "true",
    follow: process.env.NEXT_PUBLIC_MARKETING_INDEXABLE === "true",
  },
  openGraph: {
    title: "Enterprise AI Enablement OS",
    description:
      "The command system for enterprise AI transformation: use cases, Skills, Harness, governance, evidence, adoption, and ROI.",
    type: "website",
    images: ["/marketing/enablement-os-command-center.png"],
  },
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <MarketingShell>{children}</MarketingShell>;
}
