/**
 * @typedef {object} GraphVersion
 * @property {number} id
 * @property {string} name
 * @property {string} label
 * @property {string} hint
 * @property {object} layout
 * @property {{ padding?: number; maxZoom?: number; minZoom?: number; duration?: number }} [viewFit]
 * @property {Record<string, { x: number; y: number }>} [positions]
 * @property {(vars: ReturnType<import("../themes/index.mjs").getGraphThemeVars>) => object[]} style
 */

export {};
