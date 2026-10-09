import { Cormorant_Garamond } from 'next/font/google'

/** Serifada editorial dos templates Natural e Dark. Exposta como --font-booking-serif. */
export const bookingSerif = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-booking-serif',
  display: 'swap',
})
