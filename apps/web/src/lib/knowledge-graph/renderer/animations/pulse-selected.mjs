export const meta = {
  id: 'pulse-selected',
  label: 'Pulse Selected',
  hint: 'Selected node pulses gently',
};

let timer = null;

/** @type {import("./types.js").AnimationModule} */
export function apply(cy, { onComplete } = {}) {
  onComplete?.();
  cy.on('select', 'node', pulse);
}

function pulse(evt) {
  const node = evt.target;
  node.stop();
  node.animate({
    style: { width: node.width() * 1.15, height: node.height() * 1.15 },
    duration: 200,
    complete: () => {
      node.animate({
        style: { width: node.width() / 1.15, height: node.height() / 1.15 },
        duration: 200,
      });
    },
  });
}

export function cleanup(cy) {
  cy?.off('select', 'node', pulse);
  if (timer) clearInterval(timer);
  timer = null;
}
