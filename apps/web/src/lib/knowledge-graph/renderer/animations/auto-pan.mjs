export const meta = { id: 'auto-pan', label: 'Auto Pan', hint: 'Subtle continuous pan drift' };

let timer = null;

/** @type {import("./types.js").AnimationModule} */
export function apply(cy, { onComplete } = {}) {
  onComplete?.();
  let t = 0;
  const pan = cy.pan();
  timer = setInterval(() => {
    t += 0.02;
    cy.pan({ x: pan.x + Math.sin(t) * 2, y: pan.y + Math.cos(t) * 1.5 });
  }, 50);
}

export function cleanup() {
  if (timer) clearInterval(timer);
  timer = null;
}
