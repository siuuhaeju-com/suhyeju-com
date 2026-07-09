export const meta = {
  id: 'layout-ease',
  label: 'Layout Ease',
  hint: 'Layout runs with smooth easing',
};

import { finishLayout } from '../layout-utils.mjs';

/** @type {import("./types.js").AnimationModule} */
export function apply(cy, { onComplete } = {}) {
  cy._kgLayoutIdle = false;
  const layout = cy.layout({
    ...cy._kgLastLayout,
    fit: false,
    animate: true,
    animationDuration: 900,
    animationEasing: 'ease-out-cubic',
  });
  layout.one('layoutstop', () => {
    finishLayout(cy, { layoutName: cy._kgLastLayout?.name });
    onComplete?.();
  });
  layout.run();
}

export function cleanup(cy) {
  cy?.stop(true, true);
}
