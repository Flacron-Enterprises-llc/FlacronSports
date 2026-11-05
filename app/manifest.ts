import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FlacronSport",
    short_name: "FlacronSport",
    description: "Multi-sport scores, viewing options and match coverage.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f7fa",
    theme_color: "#002961",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
