import { Caveat } from 'next/font/google';
import Welcome from '@/components/signin/Welcome';

export const metadata = { title: 'Welcome · Mylo' };

/* The sticky notes on O2 are written in Caveat, as drawn. */
const caveat = Caveat({ subsets: ['latin'], weight: '400', display: 'swap' });

export default function WelcomePage() {
  return <Welcome handFont={caveat.className} />;
}
