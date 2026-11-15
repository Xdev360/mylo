/* The App Router runs on Next's own React, which has ViewTransition; the
   published types do not list it yet. */
import 'react';
declare module 'react' {
  export const ViewTransition: React.FC<{ name?: string; children: React.ReactNode }>;
}
