import type { MetadataRoute } from "next";

const siteRoutes = ["/site", "/site/implementation", "/site/security", "/site/collateral"];

function appUrl() {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002");
  } catch {
    return new URL("http://localhost:3002");
  }
}

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = appUrl();
  return siteRoutes.map((route) => ({
    url: new URL(route, baseUrl).toString(),
    lastModified: new Date(),
    changeFrequency: route === "/site" ? "weekly" : "monthly",
    priority: route === "/site" ? 1 : 0.8,
  }));
}
