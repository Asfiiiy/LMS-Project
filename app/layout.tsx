// app/layout.tsx
import { GeistSans } from 'geist/font/sans';
import ConditionalLayout from './components/ConditionalLayout';
import CookieBanner from './components/CookieBanner';
import NextTopLoader from 'nextjs-toploader';
import './globals.css'; // your global Tailwind CSS

export const metadata = {
  title: 'Inspire LMS',
  description: 'Learning Management System',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="overflow-x-hidden">
      <body className={`${GeistSans.className} flex flex-col min-h-screen overflow-x-hidden w-full`}>
        <NextTopLoader
          color="#11CCEF"
          height={3}
          showSpinner={false}
          speed={200}
          shadow="0 0 10px #11CCEF,0 0 5px #11CCEF"
        />
        <ConditionalLayout>{children}</ConditionalLayout>
        <CookieBanner />
      </body>
    </html>
  );
}
