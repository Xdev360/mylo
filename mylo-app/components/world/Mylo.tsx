'use client';

import { useId } from 'react';
import { COLOURS, STYLES, WEAR, type Look } from '@/lib/world';

/* Mylo, built from the Figma parts so the saved look is the one drawn
   everywhere: "Mylo/Base" in the body colour with its own shading, one of
   the twelve "Mylo" expressions, and "Mylo/Outfit" pieces on the same
   300 x 360 box. A Mylo style outfit (MS2) is a whole drawing of its own.
   Changes show as changes: the body colour blends to the new one, a new
   face fades in and a piece put on drops into place (styles/world.css). */
export const BODY = 'M200.601 50C209.572 54.6897 205.618 63.0451 201.432 71.834C196.88 81.4564 192.062 91.5999 203.856 97.957C217.003 105.052 228.692 114.621 238.379 126.105C240.857 125.664 243.459 124.65 246.002 123.658C251.534 121.487 256.794 119.435 259.945 123.583C259.788 124.907 259.601 126.224 259.383 127.518C258.161 134.819 255.993 141.638 253.128 147.956C253.151 147.999 253.175 148.043 253.198 148.086C264.542 169.529 269.549 194.008 267.586 218.426C265.623 242.844 256.778 266.107 242.17 285.27C241.121 286.645 240.045 287.994 238.944 289.318C235.6 300.397 232.402 311.552 229.228 322.764C227.243 329.772 224.589 338.901 220.653 344.748C210.994 359.098 193.575 340.378 185.417 332.944C181.892 332.584 176.513 332.742 172.871 332.729L150.651 332.641L137.486 332.487C133.641 338.538 130.508 343.213 124.508 346.965C111.383 355.171 99.5005 335.92 97.0391 323.199C93.9249 327.493 84.5264 336.248 79.2012 333.167C73.375 329.795 68.651 321.058 66.2676 314.316C63.3652 306.107 61.157 297.593 59.5146 288.894H59.7021C59.4606 288.6 59.2205 288.306 58.9814 288.01C43.8554 269.292 34.3783 246.304 31.748 221.954C29.1178 197.604 33.4529 172.986 44.2051 151.212C61.9811 115.205 112.352 63.3405 192.344 51.1123C195.057 50.6955 197.821 50.3242 200.601 50Z';

function Body({ colour, shadow = true }: { colour: string; shadow?: boolean }) {
  const id = useId().replace(/:/g, '');
  const c = COLOURS.find(x => x.id === colour) ?? COLOURS[0];
  return (
    <svg className="mylo-layer" viewBox="0 0 300 360" aria-hidden>
      <defs>
        <clipPath id={`b${id}`}><path d={BODY} /></clipPath>
        <filter id={`s${id}`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="23" /></filter>
        <filter id={`t${id}`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="15" /></filter>
      </defs>
      {shadow && <ellipse cx="150" cy="347" rx="95" ry="11" fill="#1D1D22" fillOpacity="0.08" />}
      <path d={BODY} className="mylo-tint" style={{ fill: c.body }} />
      <g clipPath={`url(#b${id})`}>
        <ellipse cx="300" cy="230" rx="100" ry="190" className="mylo-tint" style={{ fill: c.shade }} opacity="0.9" filter={`url(#s${id})`} />
        <ellipse cx="150" cy="365" rx="170" ry="45" className="mylo-tint" style={{ fill: c.shade }} opacity="0.8" filter={`url(#t${id})`} />
      </g>
    </svg>
  );
}

function Wear({ id }: { id: string }) {
  const w = WEAR[id];
  if (!w) return null;
  return (
    <img className="mylo-layer mylo-wear" src={`/figma/world/mylo/wear-${id}.svg`} alt=""
         style={{ width: `${(w.w / 300) * 100}%`, height: `${(w.h / 360) * 100}%`, top: `${((360 - w.h) / 360) * 100}%` }} />
  );
}

export default function Mylo({ look, size, className = '', shadow = true, flip = false, label }: {
  look: Look; size?: number; className?: string; shadow?: boolean; flip?: boolean; label?: string;
}) {
  const style = look.style ? STYLES.find(s => s.id === look.style) : null;
  return (
    <span role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}
          className={`mylo${look.shine ? ' is-shine' : ''}${flip ? ' is-flip' : ''} ${className}`}
          style={size ? { width: size } : undefined}>
      {style ? (
        <img key={style.id} className="mylo-layer mylo-style" src={`/figma/world/style/${style.art}.svg`} alt="" />
      ) : (
        <>
          <Body colour={look.colour} shadow={shadow} />
          <img key={look.face} className="mylo-layer mylo-face" src={`/figma/world/mylo/face-${look.face}.svg`} alt="" />
          {look.extras.filter(e => e !== look.outfit).map(e => <Wear key={e} id={e} />)}
          {look.outfit && <Wear id={look.outfit} />}
        </>
      )}
    </span>
  );
}
