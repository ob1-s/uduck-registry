import type { Metadata } from "next";
import { Anton, DM_Sans } from "next/font/google";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import "./globals.css";

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "uDuck Registry — community moves for Microduck",
  description:
    "A small, searchable shelf of behavior policies for Microduck. 61-D observations, 14 servos, 50 Hz, sim2real.",
  keywords: [
    "Microduck",
    "robotics",
    "behavior policies",
    "ONNX",
    "MuJoCo",
    "reinforcement learning",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${anton.variable} ${dmSans.variable}`}>
      <body className="min-h-screen flex flex-col antialiased">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
