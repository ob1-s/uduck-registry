import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { HOME_SOCIAL_IMAGE_PATHS, SITE_NAME, SITE_URL, SOCIAL_IMAGE_SIZE } from "@/lib/site";
import "./globals.css";

const siteTitle = "uDuck Registry — community moves for Microduck";
const siteDescription =
  "A small, searchable shelf of behavior policies for Microduck. 61-D observations, 14 policy joints, 50 Hz.";

export const metadata: Metadata = {
  metadataBase: SITE_URL,
  applicationName: SITE_NAME,
  title: siteTitle,
  description: siteDescription,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    url: "/",
    title: siteTitle,
    description: siteDescription,
    images: [{
      url: HOME_SOCIAL_IMAGE_PATHS.openGraph,
      width: SOCIAL_IMAGE_SIZE.width,
      height: SOCIAL_IMAGE_SIZE.height,
      alt: "uDuck Registry — community moves for Microduck",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: [{
      url: HOME_SOCIAL_IMAGE_PATHS.twitter,
      width: SOCIAL_IMAGE_SIZE.width,
      height: SOCIAL_IMAGE_SIZE.height,
      alt: "uDuck Registry — community moves for Microduck",
    }],
  },
  keywords: [
    "Microduck",
    "robotics",
    "behavior policies",
    "ONNX",
    "reinforcement learning",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col antialiased">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
