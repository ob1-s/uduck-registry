import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "uDuck Registry — community moves for Microduck",
  description:
    "A small, searchable shelf of behavior policies for Microduck. 61-D observations, 14 policy joints, 50 Hz.",
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
