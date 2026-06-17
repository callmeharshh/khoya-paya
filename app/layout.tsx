import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Khoya-Paya — Reunification Agent for Kumbh Mela",
  description:
    "A multilingual, AI-powered missing-person reunification agent for Simhastha Kumbh 2027.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
