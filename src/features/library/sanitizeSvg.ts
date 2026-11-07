/**
 * Sanitização rigorosa de SVG importado. Abordagem por LISTA DE PERMISSÃO: só entra o
 * que é conhecido. Remove scripts, handlers, links externos, foreignObject e CSS ativo.
 * O resultado é um arquivo novo: o original nunca é inserido no DOM.
 */
const ALLOWED_TAGS = new Set([
  'svg', 'g', 'defs', 'symbol', 'use', 'title', 'desc', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan',
  'lineargradient', 'radialgradient', 'stop', 'clippath', 'mask', 'pattern', 'image', 'filter', 'fegaussianblur', 'feoffset', 'feblend', 'fecolormatrix', 'femerge', 'femergenode', 'feflood', 'fecomposite', 'fedropshadow',
]);

const ALLOWED_ATTRS = new Set([
  'id', 'class', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'fx', 'fy', 'width', 'height', 'd', 'points', 'transform', 'viewbox', 'preserveaspectratio', 'version',
  'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-miterlimit', 'opacity', 'clip-path', 'clip-rule', 'mask', 'filter',
  'offset', 'stop-color', 'stop-opacity', 'gradientunits', 'gradienttransform', 'spreadmethod', 'patternunits', 'patterntransform', 'patterncontentunits', 'clippathunits', 'maskunits',
  'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor', 'dx', 'dy', 'letter-spacing', 'href', 'xlink:href', 'xmlns', 'xmlns:xlink',
  'stddeviation', 'in', 'in2', 'result', 'mode', 'values', 'type', 'operator', 'flood-color', 'flood-opacity', 'style', 'display', 'visibility',
]);

const SAFE_STYLE_PROPS = new Set(['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'stop-color', 'stop-opacity', 'font-size', 'font-family', 'font-weight', 'display', 'visibility']);

const SAFE_DATA_IMAGE = /^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i;
/** url(...) só pode apontar para um id local */
const unsafeUrl = (v: string) => {
  const m = v.match(/url\(([^)]*)\)/gi);
  if (!m) return false;
  return m.some((u) => !/^url\(\s*['"]?#[\w-]+['"]?\s*\)$/i.test(u));
};

export interface SanitizeResult { svg: string; removed: string[]; width: number; height: number }

export class SvgRejectedError extends Error {}

export function sanitizeSvg(source: string): SanitizeResult {
  if (source.length > 8 * 1024 * 1024) throw new SvgRejectedError('SVG maior que 8 MB.');
  if (/<!ENTITY|<!DOCTYPE[^>]*\[/i.test(source)) throw new SvgRejectedError('SVG com entidades XML personalizadas foi rejeitado.');
  const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) {
    throw new SvgRejectedError('O arquivo não é um SVG válido.');
  }
  const removed: string[] = [];
  const walk = (el: Element) => {
    for (const child of Array.from(el.children)) {
      const tag = child.localName.toLowerCase();
      if (!ALLOWED_TAGS.has(tag) || (child.namespaceURI && child.namespaceURI !== 'http://www.w3.org/2000/svg')) {
        removed.push(`<${child.localName}>`);
        child.remove();
        continue;
      }
      walk(child);
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value;
      if (!ALLOWED_ATTRS.has(name) || name.startsWith('on')) {
        removed.push(`atributo ${attr.name}`);
        el.removeAttribute(attr.name);
        continue;
      }
      if (name === 'href' || name === 'xlink:href') {
        const v = value.trim();
        const local = v.startsWith('#');
        const img = el.localName.toLowerCase() === 'image' && SAFE_DATA_IMAGE.test(v);
        if (!local && !img) {
          removed.push(`link ${v.slice(0, 40)}`);
          el.removeAttribute(attr.name);
        }
        continue;
      }
      if (name === 'style') {
        const kept = value.split(';').map((d) => d.trim()).filter(Boolean).filter((d) => {
          const [prop, ...rest] = d.split(':');
          const val = rest.join(':');
          const ok = SAFE_STYLE_PROPS.has((prop ?? '').trim().toLowerCase()) && !unsafeUrl(val) && !/expression|javascript|@import/i.test(val);
          if (!ok) removed.push(`estilo ${(prop ?? '').trim()}`);
          return ok;
        });
        if (kept.length) el.setAttribute('style', kept.join(';'));
        else el.removeAttribute('style');
        continue;
      }
      if (unsafeUrl(value) || /javascript:/i.test(value)) {
        removed.push(`valor inseguro em ${attr.name}`);
        el.removeAttribute(attr.name);
      }
    }
  };
  walk(root);
  const vb = (root.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number);
  const width = parseFloat(root.getAttribute('width') ?? '') || vb[2] || 400;
  const height = parseFloat(root.getAttribute('height') ?? '') || vb[3] || 400;
  if (!root.getAttribute('viewBox')) root.setAttribute('viewBox', `0 0 ${width} ${height}`);
  root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return { svg: new XMLSerializer().serializeToString(root), removed, width, height };
}
