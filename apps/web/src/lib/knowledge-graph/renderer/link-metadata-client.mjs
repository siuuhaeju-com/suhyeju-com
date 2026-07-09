/** @typedef {{ title?: string; faviconUrl?: string; publisher?: string }} LinkMetadata */

/** @type {Map<string, LinkMetadata>} */
const cache = new Map();

/**
 * @param {string} url
 * @returns {Promise<LinkMetadata | null>}
 */
export async function fetchLinkMetadata(url) {
  if (cache.has(url)) return cache.get(url) ?? null;

  try {
    const response = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
    if (!response.ok) return null;

    const data = await response.json();
    if (!data || typeof data !== 'object') return null;

    /** @type {LinkMetadata} */
    const meta = {};
    if (typeof data.title === 'string' && data.title) meta.title = data.title;
    if (typeof data.faviconUrl === 'string' && data.faviconUrl) meta.faviconUrl = data.faviconUrl;
    if (typeof data.publisher === 'string' && data.publisher) meta.publisher = data.publisher;

    cache.set(url, meta);
    return meta;
  } catch {
    return null;
  }
}
