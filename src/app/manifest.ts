import type { MetadataRoute } from "next";

/** "Přidat na plochu" — opens like an app, Czech name. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nutri – příprava na zkoušku",
    short_name: "Nutri",
    lang: "cs",
    start_url: "/",
    display: "standalone",
    background_color: "#faf7f2",
    theme_color: "#3f6a4f",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
