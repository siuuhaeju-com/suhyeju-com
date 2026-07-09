/**
 * 원형배치 가이드 링 — Cytoscape pan/zoom 동기화.
 */

/**
 * @param {import("cytoscape").Core} cy
 * @param {number} mx
 * @param {number} my
 */
function modelToRendered(cy, mx, my) {
  const pan = cy.pan();
  const zoom = cy.zoom();
  return { x: mx * zoom + pan.x, y: my * zoom + pan.y };
}

/**
 * @param {SVGSVGElement} svg
 * @param {import("cytoscape").Core} cy
 */
function drawRings(svg, cy) {
  const radii = cy._kgRingRadii;
  if (!radii) return;

  const w = cy.width();
  const h = cy.height();
  svg.setAttribute('width', String(w));
  svg.setAttribute('height', String(h));
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const center = modelToRendered(cy, 0, 0);
  const stroke = 'rgba(110, 160, 255, 0.28)';
  const strokeLight = 'rgba(110, 160, 255, 0.14)';

  for (const r of [radii.r0, radii.r1, radii.r2, radii.r3]) {
    if (r == null) continue;
    const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    ring.setAttribute('cx', String(center.x));
    ring.setAttribute('cy', String(center.y));
    ring.setAttribute('r', String(r * cy.zoom()));
    ring.setAttribute('fill', 'none');
    ring.setAttribute('stroke', stroke);
    ring.setAttribute('stroke-width', '1.5');
    svg.appendChild(ring);
  }

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const outer = modelToRendered(cy, Math.cos(angle) * radii.r3, Math.sin(angle) * radii.r3);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', String(center.x));
    line.setAttribute('y1', String(center.y));
    line.setAttribute('x2', String(outer.x));
    line.setAttribute('y2', String(outer.y));
    line.setAttribute('stroke', strokeLight);
    line.setAttribute('stroke-width', '1');
    line.setAttribute('stroke-dasharray', '4 6');
    svg.appendChild(line);
  }
}

/**
 * @param {import("cytoscape").Core} cy
 */
export function mountRingGuides(cy) {
  unmountRingGuides(cy);

  const container = cy.container();
  if (!container) return;

  const wrap = document.createElement('div');
  wrap.className = 'kg-ring-guides';
  wrap.setAttribute('aria-hidden', 'true');

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  wrap.appendChild(svg);
  container.insertBefore(wrap, container.firstChild);

  const redraw = () => drawRings(svg, cy);
  redraw();

  cy.on('pan zoom resize render', redraw);

  cy._kgRingGuides = { wrap, svg, redraw };
}

/**
 * @param {import("cytoscape").Core} cy
 */
export function unmountRingGuides(cy) {
  const state = cy._kgRingGuides;
  if (!state) return;

  cy.off('pan zoom resize render', state.redraw);
  state.wrap.remove();
  cy._kgRingGuides = null;
}
