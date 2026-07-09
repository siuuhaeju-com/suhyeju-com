/**
 * knowledge-graph main.js 핵심 렌더러 — Next.js 임베드용.
 * 풀 데이터·레이아웃·force-drag를 사용한다 (진입/줌 애니메이션 없음).
 */
import cytoscape from 'cytoscape';

import { bindForceDrag, refreshNodeDraggability } from './renderer/force-drag.mjs';
import { DEFAULT_NODE_COUNT } from './renderer/graph-settings.mjs';
import { buildGraphSlice } from './renderer/graph-pool.mjs';
import { toCytoscapeElements } from './renderer/graph.js';
import { DEFAULT_VIEW_FIT, fitWithMaxZoom } from './renderer/layout-utils.mjs';
import { syncRingLayerVisibility } from './renderer/layouts/ring-layout.mjs';
import { bindNewsVisibility, syncNewsVisibility } from './renderer/news-visibility.mjs';
import {
  getExtensionOptions,
  initExtensions,
  registerExtensions,
} from './renderer/extensions/index.mjs';
import { extractSectorSidebarFromNode } from './extract-sector-sidebar.mjs';
import { buildHighlightNeighborhood } from './highlight-neighborhood.mjs';
import { findCompanyNode, findSectorNode } from './sector-match.mjs';
import { buildThemedGraphStyleFromVars } from './renderer/themes/index.mjs';
import { applyVersion, getVersion } from './renderer/versions/index.mjs';

const DEFAULT_VERSION_ID = 3;
const DEFAULT_THEME_ID = 'midnight';

/** 문서 섹터 초기 포커스 — 하이라이트 노드 중심 고정 줌 */
const SECTOR_FOCUS_ZOOM = 1.2;

/**
 * @param {HTMLElement} themeRoot
 */
function readThemeVars(themeRoot) {
  const s = getComputedStyle(themeRoot);
  const v = (name) => s.getPropertyValue(name).trim();
  return {
    text: v('--graph-text'),
    muted: v('--graph-muted'),
    graphBg: v('--graph-bg'),
    edge: v('--graph-edge'),
    edgeLabel: v('--graph-edge-label'),
    selected: v('--graph-selected'),
    nodeBorder: v('--graph-node-border'),
    nodeNews: v('--node-news'),
    nodeSector: v('--node-sector'),
    nodeEdgeNode: v('--node-edgenode'),
    nodeCompany: v('--node-company'),
    accent: v('--accent'),
  };
}

/**
 * @param {HTMLElement} container
 * @param {{
 *   versionId?: number;
 *   themeId?: string;
 *   nodeCount?: number;
 *   highlightSector?: string;
 *   onSectorFocus?: (info: import("./extract-sector-sidebar.mjs").SectorSidebarPayload | null) => void;
 * }} [options]
 */
export function mountKnowledgeGraph(container, options = {}) {
  const {
    versionId = DEFAULT_VERSION_ID,
    themeId = DEFAULT_THEME_ID,
    nodeCount = DEFAULT_NODE_COUNT,
    highlightSector,
    onSectorFocus,
  } = options;

  registerExtensions();

  const shell = document.createElement('div');
  shell.className = 'kg-embed';
  shell.dataset.theme = themeId;

  const graphEl = document.createElement('main');
  graphEl.className = 'kg-embed-graph graph';
  graphEl.setAttribute('aria-label', 'Knowledge graph canvas');
  shell.appendChild(graphEl);
  container.appendChild(shell);

  /** @type {import("cytoscape").Core | null} */
  let cy = null;

  const themeVars = () => readThemeVars(shell);

  function currentGraphData() {
    return buildGraphSlice(nodeCount);
  }

  function loadGraphElements() {
    return toCytoscapeElements(currentGraphData());
  }

  function notifySectorFocus(node) {
    if (!onSectorFocus) return;
    if (!node || node.empty() || node.data('type') !== 'Sector') return;
    onSectorFocus(extractSectorSidebarFromNode(node, highlightSector ?? ''));
  }

  function resetHighlightState() {
    if (!cy) return;
    cy.batch(() => {
      cy.elements().removeClass('dim highlight sector-origin');
      cy.$(':selected').unselect();
    });
  }

  function clearNodeFocus() {
    if (!cy) return;
    resetHighlightState();
    cy._kgSectorFocusNode = null;
    fitWithMaxZoom(cy, cy.elements(), DEFAULT_VIEW_FIT);
    if (highlightSector?.trim()) {
      const docNode = findSectorNode(cy, highlightSector);
      if (docNode && !docNode.empty()) notifySectorFocus(docNode);
    }
  }

  /**
   * @param {import("cytoscape").NodeSingular} node
   */
  function applyHighlight(node) {
    if (!cy || !node || node.empty()) return;

    resetHighlightState();

    const neighborhood = buildHighlightNeighborhood(cy, node);
    cy.batch(() => {
      cy.elements().addClass('dim');
      neighborhood.removeClass('dim').addClass('highlight');
      if (node.data('type') === 'Sector') {
        node.addClass('sector-origin');
      }
    });
    if (node.data('type') === 'Sector') {
      cy._kgSectorFocusNode = node;
      focusNodeAtZoom(node, SECTOR_FOCUS_ZOOM);
      notifySectorFocus(node);
      return;
    }

    cy._kgSectorFocusNode = null;
    fitWithMaxZoom(cy, neighborhood, DEFAULT_VIEW_FIT);
  }

  /**
   * @param {import("cytoscape").NodeSingular} node
   * @param {number} zoom
   */
  function focusNodeAtZoom(node, zoom) {
    if (!cy || !node || node.empty()) return;
    cy.stop(true, false);
    cy.zoom(zoom);
    cy.center(node);
  }

  /**
   * 문서 섹터(배지)에 해당하는 Sector 노드·연결을 초기 하이라이트하고 200% 줌.
   * @param {string} sectorName
   */
  function highlightSectorInitial(sectorName) {
    if (!cy) return;
    const node = findSectorNode(cy, sectorName);
    if (!node || node.empty()) return;
    applyHighlight(node);
  }

  /**
   * @param {string} [companyId]
   * @param {string} [companyName]
   */
  function highlightCompany(companyId = '', companyName = '') {
    if (!cy) return false;
    const node = findCompanyNode(cy, { companyId, companyName });
    if (!node || node.empty()) return false;
    applyHighlight(node);
    return true;
  }

  /**
   * @param {import("cytoscape").NodeSingular} node
   */
  function highlightNode(node) {
    applyHighlight(node);
  }

  function applyGraphLayout() {
    if (!cy) return;
    const version = getVersion(versionId);
    applyVersion(cy, version, themeVars());
  }

  function applyExtensions() {
    if (!cy) return;
    initExtensions(cy, getExtensionOptions(), {
      themeVars,
      onNodeDetail: highlightNode,
      onResetLayout: () => {
        applyGraphLayout();
        refreshNodeDraggability(cy);
      },
    });
  }

  const version = getVersion(versionId);

  cy = cytoscape({
    container: graphEl,
    elements: loadGraphElements(),
    style: buildThemedGraphStyleFromVars(version.style, themeId, themeVars()),
    layout: { name: 'preset' },
    wheelSensitivity: 0.2,
    autoungrabify: false,
    boxSelectionEnabled: false,
  });

  cy._kgAnimationIdle = true;
  cy._kgLastLayout = { ...version.layout };
  cy._kgActiveVersionId = version.id;

  applyGraphLayout();
  bindForceDrag(cy, {
    onTap: (node) => highlightNode(node),
    onDragStart: () => clearNodeFocus(),
    onDragEnd: () => cy.$(':selected').unselect(),
  });
  bindNewsVisibility(cy);
  applyExtensions();
  syncNewsVisibility(cy);
  refreshNodeDraggability(cy);

  if (highlightSector?.trim()) {
    highlightSectorInitial(highlightSector);
  }

  cy.on('tap', (evt) => {
    if (evt.target !== cy) return;
    clearNodeFocus();
    cy.elements().show();
    syncRingLayerVisibility(cy);
  });

  const resizeObserver = new ResizeObserver(() => {
    if (!cy) return;
    cy.resize();
    const sectorNode = cy._kgSectorFocusNode;
    if (sectorNode && !sectorNode.empty()) {
      focusNodeAtZoom(sectorNode, SECTOR_FOCUS_ZOOM);
    } else {
      fitWithMaxZoom(cy, cy.elements(), DEFAULT_VIEW_FIT);
    }
  });
  resizeObserver.observe(container);

  return {
    /** @type {import("cytoscape").Core} */
    cy,
    destroy() {
      resizeObserver.disconnect();
      cy?.destroy();
      shell.remove();
      cy = null;
    },
    resize() {
      if (!cy) return;
      cy.resize();
      fitWithMaxZoom(cy, cy.elements(), DEFAULT_VIEW_FIT);
    },
    highlightCompany,
  };
}
