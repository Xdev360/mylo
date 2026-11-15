'use client';
import { useState } from 'react';
import { FAQ } from '@/lib/content';
import FigIcon from './FigIcon';

/* Figma frames "08 Questions" (887:4619) and 887:189305.

   One open at a time. The open card takes the surface fill and the closed
   ones the sheet fill, which is the inversion Figma draws, the open one
   recedes while its answer reads.

   The height eases with a grid row rather than a measured pixel height, so
   an answer can be any length and still animate, and it reflows correctly
   if the window changes size mid-open. The plus turns into the close mark
   rather than being swapped for it. */
export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="faq">
      {FAQ.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q} className={`faq-item${isOpen ? ' is-open' : ''}`}>
            <h3>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                aria-controls={`faq-a-${i}`}
                className="faq-q"
              >
                <span>{item.q}</span>
                <FigIcon name="plus" className="faq-mark" />
              </button>
            </h3>
            <div
              id={`faq-a-${i}`}
              role="region"
              className="faq-fold"
              style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
            >
              <div className="overflow-hidden">
                <p className="faq-a">{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
