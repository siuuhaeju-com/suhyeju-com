/** @typedef {{ id: string; label: string; name: string; props?: Record<string, unknown> }} GraphNode */
/** @typedef {{ source: string; target: string; relation: string; weight?: number; props?: Record<string, unknown> }} GraphEdge */

import { normalizeSourceRefs } from './source-links.mjs';

const LABEL_COLORS = {
  News: '#38bdf8',
  Sector: '#22c55e',
  EdgeNode: '#a78bfa',
  Company: '#fbbf24',
};

/**
 * @param {{ nodes: GraphNode[]; edges: GraphEdge[] }} data
 */
export function toCytoscapeElements(data) {
  const nodes = (data.nodes ?? []).map((n) => {
    const normalizedRefs = normalizeSourceRefs(n.props, n.name);
    const restProps = { ...(n.props ?? {}) };
    delete restProps.refs;
    delete restProps.link;
    delete restProps.links;
    return {
      data: {
        id: n.id,
        label: n.name,
        type: n.label,
        ...(normalizedRefs.length ? { refsJson: JSON.stringify(normalizedRefs) } : {}),
        ...restProps,
      },
    };
  });

  const edges = (data.edges ?? []).map((e, i) => ({
    data: {
      id: `e-${i}`,
      source: e.source,
      target: e.target,
      relation: e.relation,
      weight: e.weight ?? 1,
      label: e.relation,
      ...e.props,
    },
  }));

  return [...nodes, ...edges];
}

/**
 * @param {string} type
 * @param {ReturnType<import("./themes/index.mjs").getGraphThemeVars> | null} [vars]
 */
export function nodeColor(type, vars) {
  if (vars) {
    const map = {
      News: vars.nodeNews,
      Sector: vars.nodeSector,
      EdgeNode: vars.nodeEdgeNode,
      Company: vars.nodeCompany,
    };
    return map[type] ?? vars.muted;
  }
  return LABEL_COLORS[type] ?? '#94a3b8';
}

export function graphStats(data) {
  return {
    nodes: data.nodes?.length ?? 0,
    edges: data.edges?.length ?? 0,
  };
}
