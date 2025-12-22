// app/layout.tsx
import ConditionalLayout from './components/ConditionalLayout';
import './globals.css'; // your global Tailwind CSS

export const metadata = {
  title: 'Inspire LMS',
  description: 'Learning Management System',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="overflow-x-hidden">
      <body className="flex flex-col min-h-screen overflow-x-hidden w-full">
        <ConditionalLayout>{children}</ConditionalLayout>
      </body>
    </html>
  );
}
