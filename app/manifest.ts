import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rental Tax Tracker",
    short_name: "Tax Tracker",
    description: "Track Airbnb rentals, revenue, and tax estimates in Denmark.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0e1d1d",
    theme_color: "#ff2d63",
    icons: [
      { src: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
