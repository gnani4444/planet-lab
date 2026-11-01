import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
const inter = Inter({subsets: ['latin'], weight: ['400','500','600'], display: 'swap'});
export const metadata: Metadata = {title: 'Planet Lab — Same experiment. Different world.', description: 'Explore gravity and atmosphere through everyday experiments on Earth, the Moon, and Mars.'};
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {return <html lang="en"><body className={inter.className}>{children}</body></html>;}
