/** @typedef {{ title?: string; faviconUrl?: string; publisher?: string }} LinkMetadata */

/**
 * @param {string} text
 */
function decodeHtmlEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)));
}

/**
 * @param {string} html
 * @param {string} attr
 */
function readMetaContent(html, attr) {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${attr}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${attr}["']`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtmlEntities(match[1].trim());
  }

  return undefined;
}

/**
 * @param {string} href
 * @param {string} pageUrl
 */
function resolveAssetUrl(href, pageUrl) {
  try {
    return new URL(href, pageUrl).href;
  } catch {
    return undefined;
  }
}

/**
 * @param {string} html
 * @param {string} pageUrl
 */
function readFaviconUrl(html, pageUrl) {
  const tags = html.match(/<link[^>]+>/gi) ?? [];

  /** @type {{ href: string; score: number }[]} */
  const candidates = [];

  for (const tag of tags) {
    const rel = tag.match(/\srel=["']([^"']+)["']/i)?.[1]?.toLowerCase() ?? '';
    if (!/(^|\s)(?:shortcut\s+icon|icon|apple-touch-icon)(\s|$)/.test(rel)) continue;

    const href = tag.match(/\shref=["']([^"']+)["']/i)?.[1];
    if (!href || href.startsWith('data:')) continue;

    const resolved = resolveAssetUrl(href, pageUrl);
    if (!resolved) continue;

    let score = 1;
    if (rel.includes('apple-touch-icon')) score = 2;
    if (rel.includes('icon') && !rel.includes('apple')) score = 3;
    if (tag.includes('sizes=') && !tag.includes('sizes="16x16"')) score += 1;

    candidates.push({ href: resolved, score });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.href;
}

/**
 * HTML head에서 title·파비콘·출처 메타를 추출합니다.
 * @param {string} html
 * @param {string} pageUrl
 * @returns {LinkMetadata}
 */
export function extractLinkMetadata(html, pageUrl) {
  const snippet = html.slice(0, 120_000);

  const documentTitle = snippet.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
  const titleCandidates = [
    readMetaContent(snippet, 'og:title'),
    readMetaContent(snippet, 'twitter:title'),
    documentTitle
      ? decodeHtmlEntities(documentTitle)
          .replace(/\s*[-–|]\s*조세일보(?:\s*모바일)?\s*$/i, '')
          .trim()
      : undefined,
  ].filter((value) => typeof value === 'string' && value.trim());

  titleCandidates.sort((a, b) => b.length - a.length);
  const title = titleCandidates[0];

  const publisher =
    readMetaContent(snippet, 'og:site_name') ?? readMetaContent(snippet, 'application-name');

  const faviconUrl = readFaviconUrl(snippet, pageUrl);

  /** @type {LinkMetadata} */
  const out = {};
  if (title) out.title = decodeHtmlEntities(title);
  if (publisher) out.publisher = decodeHtmlEntities(publisher);
  if (faviconUrl) out.faviconUrl = faviconUrl;
  return out;
}

/**
 * @param {string} charset
 */
function normalizeCharset(charset) {
  const c = charset.trim().toLowerCase().replace(/[_\s]/g, '-');
  if (c === 'euc-kr' || c === 'ks-c-5601' || c === 'ksc5601' || c === 'cp949') return 'euc-kr';
  if (c === 'utf8') return 'utf-8';
  return c;
}

/**
 * Content-Type·meta 태그에서 HTML 문자 인코딩을 추정합니다.
 * @param {string | null} contentType
 * @param {string} htmlHead
 */
export function detectHtmlCharset(contentType, htmlHead) {
  const fromHeader = contentType?.match(/charset=([^;\s]+)/i)?.[1];
  if (fromHeader) return normalizeCharset(fromHeader);

  const patterns = [
    /<meta[^>]+charset\s*=\s*["']?([^"'\s>]+)/i,
    /<meta[^>]+content=["'][^"']*charset=([^"'\s;]+)/i,
  ];
  for (const pattern of patterns) {
    const match = htmlHead.match(pattern);
    if (match?.[1]) return normalizeCharset(match[1]);
  }

  return 'utf-8';
}

/**
 * @param {ArrayBuffer} buffer
 * @param {string} charset
 */
export function decodeHtmlBuffer(buffer, charset) {
  const normalized = normalizeCharset(charset);
  try {
    return new TextDecoder(normalized).decode(buffer);
  } catch {
    return new TextDecoder('utf-8').decode(buffer);
  }
}

/**
 * @param {string} url
 * @param {typeof fetch} fetchImpl
 * @returns {Promise<LinkMetadata>}
 */
export async function fetchLinkMetadataFromUrl(url, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'KnowledgeGraphLinkPreview/1.0',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Link preview failed (${response.status})`);
  }

  const buffer = await response.arrayBuffer();
  const peek = new TextDecoder('latin1').decode(buffer.slice(0, 8192));
  const charset = detectHtmlCharset(response.headers.get('content-type'), peek);
  const html = decodeHtmlBuffer(buffer, charset);
  return extractLinkMetadata(html, response.url || url);
}
