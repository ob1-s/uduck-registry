import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "uDuck Registry — Microduck behaviors",
  description:
    "A small, searchable catalog of behavior policies for Microduck.",
  keywords: [
    "Microduck",
    "robotics",
    "behavior policies",
    "ONNX",
    "MuJoCo",
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
