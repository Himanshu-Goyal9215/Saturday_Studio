import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Saturday Studio — AI Saturday Planner Agent",
  description:
    "Conversational AI Saturday planner powered by Gemini, real OpenStreetMap places, Open-Meteo weather, and transparent tool-calling traces.",
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
