export const meta = {
  id: 'bounce-entry',
  label: 'Bounce Entry',
  hint: 'Nodes bounce in from below',
};

/** @type {import("./types.js").AnimationModule} */
export function apply(cy, { onComplete } = {}) {
  const nodes = cy.nodes();
  const saved = nodes.map((n) => ({ n, pos: { ...n.position() } }));

  saved.forEach(({ n, pos }) => {
    n.position({ x: pos.x, y: pos.y + 80 });
    n.style({ opacity: 0 });
    n.animate({
      position: pos,
      style: { opacity: 1 },
      duration: 600,
      easing: 'ease-out-bounce',
    });
  });

  setTimeout(onComplete, 650);
}

export function cleanup(cy) {
  cy?.nodes().stop(true);
}
