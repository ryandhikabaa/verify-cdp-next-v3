import type {Metadata} from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dotvera-v3',
  description: 'Verify CDP V3 workspace for the generator and verifier.',
};

/** Provides the root HTML shell for the Next.js migration app. */
export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
