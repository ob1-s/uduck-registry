import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "uDuck Registry — Community Behaviors for MicroDuck",
  description:
    "A lightweight, community-first registry and discovery index for MicroDuck behaviors, policies, environments, and ecosystem artifacts.",
  keywords: [
    "MicroDuck",
    "Pollen Robotics",
    "Reinforcement Learning",
    "Robotics",
    "MuJoCo",
    "ONNX",
    "Biped Robot",
    "Behaviors",
    "Hugging Face",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#090d16] text-slate-100 min-h-screen flex flex-col antialiased selection:bg-amber-400 selection:text-slate-950">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
