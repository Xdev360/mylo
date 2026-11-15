/* Marks every .reveal already on screen as in, and watches the rest, the
   moment the page is parsed. Inlined by the layout; see components/Reveal. */
export const REVEAL_BOOT = `(function(){var h=innerHeight,io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('is-in');io.unobserve(e.target)}})},{threshold:.15});document.querySelectorAll('.reveal').forEach(function(el){if(el.getBoundingClientRect().top<h)el.classList.add('is-in');else io.observe(el)})})()`;
