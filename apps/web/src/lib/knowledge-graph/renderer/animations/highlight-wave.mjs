export const meta = {
  id: 'highlight-wave',
  label: 'Highlight Wave',
  hint: 'Wave highlight across nodes',
};

/** @type {import("./types.js").AnimationModule} */
export function apply(cy, { onComplete } = {}) {
  const nodes = cy.nodes();
  cy.elements().removeClass('wave');
  let i = 0;
  const step = () => {
    if (i >= nodes.length) {
      cy.elements().removeClass('wave');
      onComplete?.();
      return;
    }
    nodes[i].addClass('wave');
    setTimeout(() => {
      nodes[i].removeClass('wave');
      i += 1;
      step();
    }, 120);
  };
  step();
}

export function cleanup(cy) {
  cy?.elements().removeClass('wave');
}
