/* An icon from the Figma set, as a mask so it follows the text colour in both
   themes. Sized by `size`, 22 by default as the tab bar draws them. A few
   icons carry a white part in Figma (the target's ring, the search lens); a
   mask can only draw one colour, so that part is cut out of the icon and laid
   back on top in white from its "-w" twin. */
const WHITE = new Set(['tab-goals', 'nav-goals', 'type-goal', 'search']);

export default function Icon({ name, size = 22, className = '' }: { name: string; size?: number; className?: string }) {
  const style = { '--m': `url(/figma/${name}.svg)`, '--s': `${size}px` } as React.CSSProperties;
  if (!WHITE.has(name)) return <span aria-hidden className={`icon ${className}`} style={style} />;
  return (
    <span aria-hidden className={`icon-pair ${className}`} style={style}>
      <span className="icon" />
      <span className="icon icon-w" style={{ '--m': `url(/figma/${name}-w.svg)` } as React.CSSProperties} />
    </span>
  );
}
