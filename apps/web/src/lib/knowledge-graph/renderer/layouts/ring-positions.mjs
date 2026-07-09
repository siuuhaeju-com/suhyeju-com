/**
 * 원형배치 — Sector (r₀) · EdgeNode (r₁) · Company (r₂) · News (r₃).
 */
import { getLayoutSettings } from '../layout-settings.mjs';

const TAU = Math.PI * 2;

/**
 * @param {number} baseAngle
 * @param {number} count
 * @param {number} [spreadRad]
 */
function fanAngles(baseAngle, count, spreadRad = 0.12) {
  if (count <= 1) return [baseAngle];
  const total = spreadRad * (count - 1);
  const start = baseAngle - total / 2;
  return Array.from({ length: count }, (_, i) => start + i * spreadRad);
}

/**
 * @param {number[]} angles rad
 */
function averageAngle(angles) {
  if (!angles.length) return 0;
  let sin = 0;
  let cos = 0;
  for (const a of angles) {
    sin += Math.sin(a);
    cos += Math.cos(a);
  }
  return Math.atan2(sin / angles.length, cos / angles.length);
}

/**
 * @param {number} angle
 * @param {number} radius
 */
function polarToXY(angle, radius) {
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}

/**
 * @param {import("cytoscape").Core} cy
 */
export function computeRingLayout(cy) {
  const { ringScale, ringGap, fanSpread } = getLayoutSettings(3);

  const sectors = cy.nodes('[type = "Sector"]');
  const edgeNodes = cy.nodes('[type = "EdgeNode"]');
  const companies = cy.nodes('[type = "Company"]');
  const newsNodes = cy.nodes('[type = "News"]');

  const sectorCount = sectors.length;
  const edgeCount = edgeNodes.length;
  const companyCount = companies.length;
  const newsCount = newsNodes.length;

  const baseR0 = Math.max(56, Math.min(110, 36 + sectorCount * 4));
  const baseGap1 = Math.max(90, 70 + edgeCount * 0.55);
  const baseGap2 = Math.max(85, 65 + companyCount * 2.4);
  const baseGap3 = Math.max(100, 80 + newsCount * 2.2);

  const r0 = baseR0 * ringScale;
  const r1 = r0 + baseGap1 * ringGap;
  const r2 = r1 + baseGap2 * ringGap;
  const r3 = r2 + baseGap3 * ringGap;

  /** @type {Map<string, number>} */
  const sectorAngle = new Map();
  sectors.forEach((node, i) => {
    const angle = sectorCount ? (i / sectorCount) * TAU - Math.PI / 2 : 0;
    sectorAngle.set(node.id(), angle);
  });

  /** @type {Map<string, { x: number; y: number }>} */
  const positions = new Map();

  sectors.forEach((node, i) => {
    const angle = sectorCount ? (i / sectorCount) * TAU - Math.PI / 2 : 0;
    positions.set(node.id(), polarToXY(angle, r0));
  });

  /** @type {Map<string, import("cytoscape").NodeSingular[]>} */
  const edgeBySector = new Map();
  edgeNodes.forEach((node) => {
    const sectorId = node.data('sectorId');
    if (!sectorId) return;
    if (!edgeBySector.has(sectorId)) edgeBySector.set(sectorId, []);
    edgeBySector.get(sectorId).push(node);
  });

  for (const [sectorId, group] of edgeBySector) {
    const base = sectorAngle.get(sectorId) ?? 0;
    const spread = Math.min(0.55, (0.08 + group.length * 0.04) * fanSpread);
    const angles = fanAngles(base, group.length, spread);
    group.forEach((node, i) => {
      positions.set(node.id(), polarToXY(angles[i], r1));
    });
  }

  edgeNodes.forEach((node) => {
    if (positions.has(node.id())) return;
    positions.set(node.id(), polarToXY(0, r1));
  });

  /** @type {Map<string, import("cytoscape").NodeSingular[]>} */
  const companyByBridge = new Map();
  companies.forEach((node) => {
    const bridge = edgeNodes.filter((en) => en.data('companyId') === node.id()).first();
    if (bridge.empty()) return;
    const bridgeId = bridge.id();
    if (!companyByBridge.has(bridgeId)) companyByBridge.set(bridgeId, []);
    companyByBridge.get(bridgeId).push(node);
  });

  for (const [bridgeId, group] of companyByBridge) {
    const bridgePos = positions.get(bridgeId);
    if (!bridgePos) continue;
    const base = Math.atan2(bridgePos.y, bridgePos.x);
    const spread = Math.min(0.4, (0.06 + group.length * 0.03) * fanSpread);
    const angles = fanAngles(base, group.length, spread);
    group.forEach((node, i) => {
      positions.set(node.id(), polarToXY(angles[i], r2));
    });
  }

  companies.forEach((node, i) => {
    if (positions.has(node.id())) return;
    const angle = companyCount ? (i / companyCount) * TAU - Math.PI / 2 : 0;
    positions.set(node.id(), polarToXY(angle, r2));
  });

  /** @type {Map<string, { node: import("cytoscape").NodeSingular; angle: number }[]>} */
  const newsByAngleKey = new Map();

  newsNodes.forEach((node, newsIndex) => {
    const sectorAngles = [];
    node.outgoers('edge').forEach((edge) => {
      if (edge.data('relation') !== 'mentions') return;
      const tgt = edge.target();
      if (tgt.data('type') === 'Sector') {
        const a = sectorAngle.get(tgt.id());
        if (a != null) sectorAngles.push(a);
      }
    });

    const angle = sectorAngles.length
      ? averageAngle(sectorAngles)
      : (newsIndex / Math.max(1, newsCount)) * TAU - Math.PI / 2;
    const key = angle.toFixed(2);
    if (!newsByAngleKey.has(key)) newsByAngleKey.set(key, []);
    newsByAngleKey.get(key).push({ node, angle });
  });

  for (const group of newsByAngleKey.values()) {
    const base = group[0].angle;
    const angles = fanAngles(base, group.length, 0.1 * fanSpread);
    group.forEach((item, i) => {
      positions.set(item.node.id(), polarToXY(angles[i], r3));
    });
  }

  return {
    positions,
    radii: { r0, r1, r2, r3 },
    center: { x: 0, y: 0 },
  };
}

/**
 * @param {import("cytoscape").Core} cy
 */
export function applyRingPositions(cy) {
  const { positions, radii } = computeRingLayout(cy);
  positions.forEach((pos, id) => {
    const node = cy.$('#' + id);
    if (!node.empty()) node.position(pos);
  });
  cy._kgRingRadii = radii;
  return { radii };
}
