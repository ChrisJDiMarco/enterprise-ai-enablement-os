import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const marketingIndexable = process.env.NEXT_PUBLIC_MARKETING_INDEXABLE === "true";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002";

  if (marketingIndexable) {
    return {
      rules: {
        userAgent: "*",
        allow: ["/site", "/api/collateral"],
        disallow: ["/", "/api/"],
      },
      sitemap: `${appUrl}/sitemap.xml`,
    };
  }

  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
