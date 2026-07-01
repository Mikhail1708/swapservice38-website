import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const inter = Inter({ subsets: ["cyrillic", "latin"], weight: ["300", "400", "500", "600"] });

export const metadata: Metadata = {
  title: "SWAP SERVICE 38 | Свапы двигателей",
  description: "Профессиональные свапы двигателей 3UZ, 5VZ, VQ35",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className={inter.className}>
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}