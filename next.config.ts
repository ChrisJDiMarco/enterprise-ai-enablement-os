import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";
const marketingIndexable = process.env.NEXT_PUBLIC_MARKETING_INDEXABLE === "true";

const nextConfig: NextConfig = {
  async headers() {
    const noIndexHeader = {
      key: "X-Robots-Tag",
      value: "noindex, nofollow, noarchive",
    };
    const securityHeaders = [
      {
        key: "X-Content-Type-Options",
        value: "nosniff",
      },
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      {
        key: "X-Frame-Options",
        value: "DENY",
      },
      ...(marketingIndexable ? [] : [noIndexHeader]),
      {
        key: "Cross-Origin-Opener-Policy",
        value: "same-origin",
      },
      {
        key: "Cross-Origin-Resource-Policy",
        value: "same-origin",
      },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
      },
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'none'",
          "img-src 'self' data: blob:",
          "font-src 'self' data:",
          "style-src 'self' 'unsafe-inline'",
          `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}`,
          `connect-src 'self'${isProduction ? "" : " http://localhost:*"} https:`,
          "object-src 'none'",
        ].join("; "),
      },
      ...(isProduction
        ? [
            {
              key: "Strict-Transport-Security",
              value: "max-age=63072000; includeSubDomains; preload",
            },
          ]
        : []),
    ];

    return [
      {
        source: "/api/:path*",
        headers: marketingIndexable ? [...securityHeaders, noIndexHeader] : securityHeaders,
      },
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
