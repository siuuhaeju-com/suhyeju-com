import { getEdgeOpacity } from '../graph-display-settings.mjs';

export const meta = {
  id: 'edge-draw-in',
  label: 'Edge Draw',
  hint: 'Edges draw in after nodes appear',
};

/** @type {import("./types.js").AnimationModule} */
export function apply(cy, { onComplete } = {}) {
  const edgeOpacity = getEdgeOpacity();
  cy.nodes().style({ opacity: 1 });
  cy.edges().style({ opacity: 0, width: 0 });

  const edges = cy.edges();
  let i = 0;
  const step = () => {
    if (i >= edges.length) {
      onComplete?.();
      return;
    }
    const e = edges[i];
    const w = 1 + (e.data('weight') ?? 1) * 2;
    e.animate({
      style: {
        opacity: edgeOpacity,
        'text-opacity': Math.min(1, edgeOpacity * 0.85),
        width: w,
      },
      duration: 350,
      complete: () => {
        i += 1;
        step();
      },
    });
  };
  step();
}

export function cleanup(cy) {
  cy?.edges().stop(true);
}
