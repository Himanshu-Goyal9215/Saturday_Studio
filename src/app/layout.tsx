import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Saturday Studio — AI Saturday Planner Agent",
  description:
    "Conversational AI Saturday planner powered by real OpenStreetMap places, Saturday weather forecasts, and transparent tool-calling traces.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
    apple: "/logo.jpg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-[#FAF8F5] text-[#1A1917] flex flex-col">
        {children}
      </body>
    </html>
  );
}
