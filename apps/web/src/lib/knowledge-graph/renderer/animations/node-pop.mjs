export const meta = { id: 'node-pop', label: 'Node Pop', hint: 'Nodes scale up with a pop' };

/** @type {import("./types.js").AnimationModule} */
export function apply(cy, { onComplete } = {}) {
  const nodes = cy.nodes();
  nodes.forEach((n) => {
    const w = n.width();
    const h = n.height();
    n.style({ width: 0, height: 0, opacity: 0 });
    n.animate({
      style: { width: w, height: h, opacity: 1 },
      duration: 450,
      easing: 'spring',
    });
  });
  setTimeout(onComplete, 500);
}

export function cleanup(cy) {
  cy?.nodes().stop(true);
}
