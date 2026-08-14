import type { Metadata } from "next";
import "@fontsource/rubik/300.css";
import "@fontsource/rubik/400.css";
import "@fontsource/rubik/500.css";
import "@fontsource/rubik/600.css";
import "@fontsource/rubik/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "מכירת כיפות - תרומה לקהילת קדמא",
  description:
    "כיפות סרוגות בעבודת יד שכל הכנסותיהן מוקדשות ללימוד הורים וילדים ולתפילת הילדים של קהילת קדמא.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
