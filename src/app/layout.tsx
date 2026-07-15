import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});
import { AuthProvider } from "@/components/auth/AuthProvider";
import { BooksProvider } from "@/components/BooksProvider";

export const metadata: Metadata = {
  title: "Shelf | Your Reading Life",
  description: "Track, discover, and share your reading journey",
};

export const viewport: Viewport = {
  themeColor: '#0a0a0b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased min-h-screen pb-20 md:pb-0">
        <AuthProvider>
          <BooksProvider>
            {children}
          </BooksProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
