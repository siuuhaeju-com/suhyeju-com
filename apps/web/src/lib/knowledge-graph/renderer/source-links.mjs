/** @typedef {{ url: string; title?: string; publisher?: string; faviconUrl?: string }} SourceRef */

import { fetchLinkMetadata } from './link-metadata-client.mjs';

/** @type {Record<string, string>} */
const PUBLISHER_BY_HOST = {
  'bloomberg.com': 'Bloomberg',
  'cnbc.com': 'CNBC',
  'ft.com': 'Financial Times',
  'joseilbo.com': '조세일보',
  'm.joseilbo.com': '조세일보',
  'reuters.com': 'Reuters',
  'techcrunch.com': 'TechCrunch',
  'thenextweb.com': 'The Next Web',
  'theverge.com': 'The Verge',
  'wsj.com': 'Wall Street Journal',
  'yna.co.kr': '연합뉴스',
};

const GENERIC_URL_SLUGS = new Set([
  'view',
  'read',
  'index',
  'article',
  'articleview',
  'news',
  'html',
  'htm',
  'php',
  'aspx',
  'shtml',
  'default',
  'home',
]);

/**
 * URL 경로에서 뽑은 제목·자동 생성 refs 등 쓸모없는 라벨인지 판별합니다.
 * @param {string | undefined} title
 */
export function isWeakLinkTitle(title) {
  if (!title) return true;
  const trimmed = title.trim();
  if (!trimmed) return true;
  if (/^\d{8,}$/.test(trimmed)) return true;
  if (/^[A-Za-z0-9]{20,}$/.test(trimmed)) return true;
  if (GENERIC_URL_SLUGS.has(trimmed.toLowerCase())) return true;
  return false;
}

/**
 * @param {Array<string | undefined>} candidates
 */
function pickLinkTitle(...candidates) {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && !isWeakLinkTitle(candidate)) {
      return candidate.trim();
    }
  }
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return '';
}

/**
 * @param {string} url
 * @returns {string | undefined}
 */
export function derivePublisherFromUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    if (PUBLISHER_BY_HOST[host]) return PUBLISHER_BY_HOST[host];
    const base = host.split('.')[0];
    return base
      .split('-')
      .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
      .join(' ');
  } catch {
    return undefined;
  }
}

/**
 * @param {string} url
 * @returns {string | undefined}
 */
export function deriveTitleFromUrl(url) {
  try {
    const segment = new URL(url).pathname.split('/').filter(Boolean).pop() ?? '';
    const slug = segment.replace(/\.(html?|htm|php|aspx|shtml)$/i, '');
    if (!slug) return undefined;

    const human = decodeURIComponent(slug)
      .replace(/[-_+]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!human) return undefined;

    return human.charAt(0).toUpperCase() + human.slice(1);
  } catch {
    return undefined;
  }
}

/**
 * @param {string} url
 * @param {{
 *   nodeName?: string;
 *   publisher?: string;
 *   explicitTitle?: string;
 *   explicitPublisher?: string;
 *   multiLink?: boolean;
 * }} options
 * @returns {SourceRef}
 */
export function makeSourceRef(url, options = {}) {
  const derivedTitle = deriveTitleFromUrl(url);
  const derivedPublisher = derivePublisherFromUrl(url);
  const { nodeName, publisher, explicitTitle, explicitPublisher, multiLink = false } = options;

  if (multiLink) {
    return {
      url,
      title: pickLinkTitle(explicitTitle, derivedTitle, nodeName, url),
      publisher: explicitPublisher ?? publisher ?? derivedPublisher,
    };
  }

  return {
    url,
    title: pickLinkTitle(explicitTitle, nodeName, derivedTitle, url),
    publisher: explicitPublisher ?? publisher ?? derivedPublisher,
  };
}

/**
 * pool.json props.refs / props.link(문자열 URL 배열) → SourceRef[]
 * @param {Record<string, unknown> | undefined} props
 * @param {string} [nodeName]
 * @returns {SourceRef[]}
 */
export function normalizeSourceRefs(props, nodeName) {
  if (!props) return [];

  /** @type {SourceRef[]} */
  const out = [];
  const seen = new Set();
  const publisher = typeof props.source === 'string' ? props.source : undefined;
  const defaultTitle = nodeName;
  const rawRefs = Array.isArray(props.refs) ? props.refs : [];
  const rawLinks = Array.isArray(props.link ?? props.links) ? (props.link ?? props.links) : [];
  const multiLink = rawRefs.length + rawLinks.length > 1;

  const add = (ref) => {
    if (!ref?.url || seen.has(ref.url)) return;
    seen.add(ref.url);
    out.push(ref);
  };

  for (const item of rawRefs) {
    if (typeof item === 'string') {
      add(makeSourceRef(item, { nodeName: defaultTitle, publisher, multiLink }));
      continue;
    }
    if (item && typeof item === 'object' && 'url' in item && item.url) {
      add(
        makeSourceRef(String(item.url), {
          nodeName: defaultTitle,
          publisher,
          explicitTitle: item.title ? String(item.title) : undefined,
          explicitPublisher: item.publisher ? String(item.publisher) : undefined,
          multiLink,
        }),
      );
    }
  }

  for (const item of rawLinks) {
    if (typeof item === 'string') {
      add(makeSourceRef(item, { nodeName: defaultTitle, publisher, multiLink }));
      continue;
    }
    if (item && typeof item === 'object' && 'url' in item && item.url) {
      add(
        makeSourceRef(String(item.url), {
          nodeName: defaultTitle,
          publisher,
          explicitTitle: item.title ? String(item.title) : undefined,
          explicitPublisher: item.publisher ? String(item.publisher) : undefined,
          multiLink,
        }),
      );
    }
  }

  return out;
}

/**
 * @param {string} json
 * @returns {SourceRef[]}
 */
function parseRefsJson(json) {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((r) => r?.url) : [];
  } catch {
    return [];
  }
}

/**
 * @param {import("cytoscape").NodeSingular} node
 * @returns {SourceRef[]}
 */
function getOwnSourceRefs(node) {
  const raw = node.data('refs');
  if (Array.isArray(raw)) return raw.filter((r) => r?.url);

  const json = node.data('refsJson');
  if (json) return parseRefsJson(json);

  const link = node.data('link');
  const links = node.data('links');
  if (Array.isArray(link) || Array.isArray(links)) {
    return normalizeSourceRefs(
      { link: link ?? links, source: node.data('source'), refs: raw },
      node.data('label'),
    );
  }

  return [];
}

/**
 * mentions 관계로 연결된 뉴스의 근거 링크를 모음 (Sector·Company).
 * @param {import("cytoscape").NodeSingular} node
 */
function collectMentionNewsRefs(node) {
  /** @type {SourceRef[]} */
  const refs = [];
  const seen = new Set();

  node.incomers('edge').forEach((edge) => {
    if (edge.data('relation') !== 'mentions') return;
    const news = edge.source();
    if (news.data('type') !== 'News') return;

    for (const ref of getOwnSourceRefs(news)) {
      if (seen.has(ref.url)) continue;
      seen.add(ref.url);
      refs.push({
        ...ref,
        title: ref.title || news.data('label'),
        publisher: ref.publisher || news.data('source'),
      });
    }
  });

  return refs;
}

/**
 * EdgeNode: props.refs / link + 연결 섹터·기업의 mentions 뉴스.
 * @param {import("cytoscape").NodeSingular} node
 */
function collectEdgeNodeNewsRefs(node) {
  const own = getOwnSourceRefs(node);
  if (own.length) return own;

  const sectorId = node.data('sectorId');
  const companyId = node.data('companyId');
  const cy = node.cy();
  /** @type {SourceRef[]} */
  const refs = [];
  const seen = new Set();

  const addFrom = (targetNode) => {
    for (const ref of collectMentionNewsRefs(targetNode)) {
      if (seen.has(ref.url)) continue;
      seen.add(ref.url);
      refs.push(ref);
    }
  };

  if (companyId) {
    const companyNode = cy.getElementById(companyId);
    if (companyNode.length) addFrom(companyNode);
  }
  if (sectorId) {
    const sectorNode = cy.getElementById(sectorId);
    if (sectorNode.length) addFrom(sectorNode);
  }

  return refs;
}

/**
 * @param {import("cytoscape").NodeSingular} node
 * @returns {SourceRef[]}
 */
export function getNodeSourceRefs(node) {
  const type = node.data('type');
  const own = getOwnSourceRefs(node);
  if (own.length) return own;

  if (type === 'EdgeNode') {
    return collectEdgeNodeNewsRefs(node);
  }

  if (type === 'Sector' || type === 'Company') {
    return collectMentionNewsRefs(node);
  }

  return [];
}

/**
 * @param {string} url
 */
export function faviconUrlFromLink(url) {
  try {
    const { origin } = new URL(url);
    return `${origin}/favicon.ico`;
  } catch {
    return '';
  }
}

/**
 * @param {string} url
 */
export function googleFaviconFallback(url) {
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`;
  } catch {
    return '';
  }
}

/**
 * @param {string} text
 */
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 상세 패널 하단 — 클릭 시 패널이 아래로 늘어나며 관련 자료 목록 표시.
 * @param {SourceRef[]} refs
 */
export function renderSourceRefsDrawer(refs) {
  if (!refs.length) return '';

  const primary = refs[0];
  const favicon = faviconUrlFromLink(primary.url);
  const fallback = googleFaviconFallback(primary.url);
  const label = primary.publisher || primary.title || '관련 자료';

  const listItems = refs
    .map((ref) => {
      const icon = ref.faviconUrl || faviconUrlFromLink(ref.url);
      const iconFallback = googleFaviconFallback(ref.url);
      const title = escapeHtml(ref.title || ref.url);
      const publisher = ref.publisher
        ? `<span class="detail-source-publisher">${escapeHtml(ref.publisher)}</span>`
        : '';
      return `
        <li data-link-url="${escapeHtml(ref.url)}">
          <a class="detail-source-link" href="${escapeHtml(ref.url)}" target="_blank" rel="noopener noreferrer">
            <img
              class="detail-source-favicon"
              src="${escapeHtml(icon)}"
              data-fallback="${escapeHtml(iconFallback)}"
              alt=""
              width="16"
              height="16"
              loading="lazy"
            />
            <span class="detail-source-text">
              <span class="detail-source-title">${title}</span>
              ${publisher}
            </span>
          </a>
        </li>
      `;
    })
    .join('');

  return `
    <footer class="detail-sources" data-source-count="${refs.length}">
      <div id="detail-sources-panel" class="detail-sources-panel" aria-hidden="true">
        <h3 class="detail-sources-heading">관련 자료</h3>
        <ul class="detail-sources-list">${listItems}</ul>
      </div>
      <button
        type="button"
        class="detail-sources-trigger"
        aria-label="관련 자료 ${refs.length}건"
        aria-expanded="false"
        aria-controls="detail-sources-panel"
      >
        <img
          class="detail-sources-trigger-icon"
          src="${escapeHtml(favicon)}"
          data-fallback="${escapeHtml(fallback)}"
          alt="${escapeHtml(label)}"
          width="18"
          height="18"
          loading="lazy"
        />
        ${refs.length > 1 ? `<span class="detail-sources-badge">${refs.length}</span>` : ''}
      </button>
    </footer>
  `;
}

/** @deprecated renderSourceRefsDrawer 사용 */
export function renderSourceRefsCorner(refs) {
  return renderSourceRefsDrawer(refs);
}

/**
 * 상세 패널의 관련 자료 링크마다 HTML head title·파비콘을 비동기로 채웁니다.
 * @param {HTMLElement} detailRoot
 */
export async function hydrateSourceRefsMetadata(detailRoot) {
  const links = [...detailRoot.querySelectorAll('.detail-source-link[href]')];
  if (!links.length) return;

  await Promise.allSettled(
    links.map(async (anchor) => {
      const url = anchor.getAttribute('href');
      if (!url) return;

      const meta = await fetchLinkMetadata(url);
      if (!meta) return;

      const titleEl = anchor.querySelector('.detail-source-title');
      const publisherEl = anchor.querySelector('.detail-source-publisher');
      const img = anchor.querySelector('.detail-source-favicon');

      if (meta.title && titleEl) titleEl.textContent = meta.title;

      if (meta.publisher) {
        if (publisherEl) {
          publisherEl.textContent = meta.publisher;
        } else {
          const textWrap = anchor.querySelector('.detail-source-text');
          textWrap?.insertAdjacentHTML(
            'beforeend',
            `<span class="detail-source-publisher">${escapeHtml(meta.publisher)}</span>`,
          );
        }
      }

      if (meta.faviconUrl && img instanceof HTMLImageElement) {
        img.src = meta.faviconUrl;
        img.dataset.fallback = googleFaviconFallback(url);
      }
    }),
  );

  const trigger = detailRoot.querySelector('.detail-sources-trigger-icon');
  const firstUrl = links[0]?.getAttribute('href');
  if (trigger instanceof HTMLImageElement && firstUrl) {
    const meta = await fetchLinkMetadata(firstUrl);
    if (meta?.faviconUrl) {
      trigger.src = meta.faviconUrl;
      trigger.dataset.fallback = googleFaviconFallback(firstUrl);
    }
  }
}

/** @param {HTMLElement} detailRoot */
export function bindSourceRefsInteractions(detailRoot) {
  detailRoot.querySelectorAll('img[data-fallback]').forEach((img) => {
    img.addEventListener('error', () => {
      const fallback = img.getAttribute('data-fallback');
      if (fallback && img.src !== fallback) img.src = fallback;
    });
  });

  const footer = detailRoot.querySelector('.detail-sources');
  if (!footer) return;

  const trigger = footer.querySelector('.detail-sources-trigger');
  const panel = footer.querySelector('.detail-sources-panel');
  if (!trigger || !panel) return;

  const close = () => {
    footer.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    trigger.setAttribute('aria-expanded', 'false');
  };

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    const willOpen = !footer.classList.contains('is-open');
    if (willOpen) {
      footer.classList.add('is-open');
      panel.setAttribute('aria-hidden', 'false');
      trigger.setAttribute('aria-expanded', 'true');
    } else {
      close();
    }
  });

  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape') close();
    },
    { signal: detailRoot._kgSourceAbort?.signal },
  );
}

/** @param {HTMLElement} detailRoot */
export function resetSourceRefsBindings(detailRoot) {
  detailRoot._kgSourceAbort?.abort();
  detailRoot._kgSourceAbort = new AbortController();
}
