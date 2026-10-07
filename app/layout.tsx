import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PharmaLaunch AI — GlucoNova Launch Simulator",
  description: "Simulated pharmaceutical launch strategy sandbox. All data is fictional.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
