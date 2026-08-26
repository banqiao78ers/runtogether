import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "板橋約跑",
    short_name: "板橋約跑",
    description: "板橋跑友揪團約跑",
    start_url: "/",
    display: "standalone",
    background_color: "#f2f2f2",
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
