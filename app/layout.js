import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

export const metadata = {
  title: 'Closed-Test Promo Code Distributor',
  description: 'Securely authenticate and claim unique promo codes for closed beta testing programs.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div id="toast-container" className="toast-container"></div>
        {children}
      </body>
    </html>
  );
}
