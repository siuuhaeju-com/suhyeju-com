export const meta = { id: 'ripple-tap', label: 'Ripple Tap', hint: 'Ripple flash on node tap' };

/** @type {import("./types.js").AnimationModule} */
export function apply(cy, { onComplete } = {}) {
  onComplete?.();
  cy.on('tap', 'node', ripple);
}

function ripple(evt) {
  const node = evt.target;
  const base = node.style('border-width') || 2;
  node.stop();
  node.animate({
    style: { 'border-width': base * 3, opacity: 0.85 },
    duration: 180,
    complete: () => {
      node.animate({
        style: { 'border-width': base, opacity: 1 },
        duration: 220,
      });
    },
  });
}

export function cleanup(cy) {
  cy?.off('tap', 'node', ripple);
}
