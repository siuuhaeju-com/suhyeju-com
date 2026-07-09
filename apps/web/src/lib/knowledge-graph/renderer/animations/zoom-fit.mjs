import { DEFAULT_VIEW_FIT } from '../layout-utils.mjs';

export const meta = { id: 'zoom-fit', label: 'Zoom Fit', hint: 'Animated zoom to fit graph' };

/** @type {import("./types.js").AnimationModule} */
export function apply(cy, { onComplete } = {}) {
  cy.animate({
    fit: { eles: cy.elements(), padding: DEFAULT_VIEW_FIT.padding },
    duration: 800,
    easing: 'ease-in-out-cubic',
    complete: () => {
      if (cy.zoom() > DEFAULT_VIEW_FIT.maxZoom) {
        cy.zoom(DEFAULT_VIEW_FIT.maxZoom);
        cy.center(cy.elements());
      }
      onComplete?.();
    },
  });
}

export function cleanup(cy) {
  cy?.stop(true, true);
}
