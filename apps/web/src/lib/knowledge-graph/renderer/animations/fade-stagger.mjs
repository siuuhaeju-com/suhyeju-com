import { getEdgeOpacity } from '../graph-display-settings.mjs';

export const meta = { id: 'fade-stagger', label: 'Fade Stagger', hint: 'Nodes fade in one by one' };

/** @type {import("./types.js").AnimationModule} */
export function apply(cy, { onComplete } = {}) {
  const nodes = cy.nodes();
  const edgeOpacity = getEdgeOpacity();
  nodes.style({ opacity: 0 });
  cy.edges().style({ opacity: 0 });

  let i = 0;
  const step = () => {
    if (i >= nodes.length) {
      cy.edges().animate({
        style: { opacity: edgeOpacity, 'text-opacity': Math.min(1, edgeOpacity * 0.85) },
        duration: 400,
        complete: onComplete,
      });
      return;
    }
    nodes[i].animate({
      style: { opacity: 1 },
      duration: 280,
      complete: () => {
        i += 1;
        step();
      },
    });
  };
  step();
}

export function cleanup() {}
