export const SITE_NAME = "uDuck Registry";
export const SITE_URL = new URL("https://uduckmoves.com");

export const SOCIAL_IMAGE_SIZE = {
  width: 1200,
  height: 630,
} as const;

export const SOCIAL_IMAGE_PATHS = {
  openGraph: "open-graph.png",
  twitter: "x-card.png",
} as const;

export const HOME_SOCIAL_IMAGE_PATHS = {
  openGraph: "/open-graph.png",
  twitter: "/x-card.png",
} as const;
