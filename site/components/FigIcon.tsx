/* The Figma icon set, served as masks so one file works in any colour and
   in either scheme. Exported as SVG with the strokes rewritten to
   currentColor, which also keeps them usable inline if that is ever
   wanted. Sized by font-size, like a glyph. */
export default function FigIcon({ name, className }: { name: string; className?: string }) {
  return (
    <span aria-hidden className={`fig-icon ${className ?? ''}`}
          style={{ '--m': `url(/figma/icons/${name}.svg)` } as React.CSSProperties} />
  );
}
