import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
});

export const metadata: Metadata = {
  title: 'Lakshmish Cricket Events | Premium Sports Live Scoring & Auction',
  description: 'IPL & Esports inspired live scoring, tournament brackets, player auctions, and transparent streaming overlays.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} dark`}>
      <body className="bg-dark-950 text-dark-100 font-sans min-h-screen">
        {children}
      </body>
    </html>
  );
}
