import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vibed Snake",
  description: "Real-time multiplayer Snake game",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
