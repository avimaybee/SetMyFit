import type { Metadata } from "next";
import { Work_Sans, Space_Mono } from "next/font/google";
import { MainLayout } from "@/components/layout/MainLayout";
import { Toaster } from "@/components/ui/toaster";
import { AddItemProvider } from "@/contexts/AddItemContext";
import "./globals.css";

const workSans = Work_Sans({ subsets: ["latin"], variable: "--font-sans" });
const spaceMono = Space_Mono({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "SetMyFit - Weather & Wardrobe Outfit Engine",
  description: "Weather-adaptive outfit generator and wardrobe manager",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${workSans.variable} ${spaceMono.variable}`}>
      <body>
        <AddItemProvider>
          <MainLayout>
            {children}
          </MainLayout>
          <Toaster />
        </AddItemProvider>
      </body>
    </html>
  );
}
