import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Banqiao Run",
    short_name: "BanqiaoRun",
    description: "Banqiao running club PWA",
    start_url: "/",
    display: "standalone",
    background_color: "#0f1f17",
    theme_color: "#1a3a2a",
    lang: "zh-Hant",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
