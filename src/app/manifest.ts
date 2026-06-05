import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Enterprise AI Enablement OS",
    short_name: "AI Enablement OS",
    description:
      "A governed operating system for designing, deploying, measuring, and scaling enterprise AI capabilities.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#635bff",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
