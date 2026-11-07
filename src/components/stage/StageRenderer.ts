/**
 * Reconciliador do plano no DOM. Só toca no que mudou: atributos de transformação são
 * trocados diretamente e o conteúdo só é reescrito quando a string muda.
 */
import type { FramePlan, PlanEntry, PlanGroup } from '@/engine/render/plan';

const SVG_NS = 'http://www.w3.org/2000/svg';

interface EntryEl { el: SVGGElement; inner: string; transform: string; opacity: number; filter: string; blend: string }
interface GroupEl { el: SVGGElement; entries: Map<string, EntryEl>; order: string[] }

export class StageRenderer {
  private defs: SVGDefsElement;
  private bg: SVGRectElement;
  private groupsRoot: SVGGElement;
  private screen: SVGGElement;
  private groups = new Map<string, GroupEl>();
  private lastDefs = '';
  private lastScreen = '';

  constructor(private svg: SVGSVGElement) {
    this.defs = document.createElementNS(SVG_NS, 'defs');
    this.bg = document.createElementNS(SVG_NS, 'rect');
    this.groupsRoot = document.createElementNS(SVG_NS, 'g');
    this.screen = document.createElementNS(SVG_NS, 'g');
    this.screen.setAttribute('data-layer', 'screen');
    this.screen.style.pointerEvents = 'none';
    svg.append(this.defs, this.bg, this.groupsRoot, this.screen);
  }

  update(plan: FramePlan): void {
    if (plan.defs !== this.lastDefs) {
      this.defs.innerHTML = plan.defs;
      this.lastDefs = plan.defs;
    }
    if (plan.background) {
      this.bg.setAttribute('x', String(-plan.frameW / 2));
      this.bg.setAttribute('y', String(-plan.frameH / 2));
      this.bg.setAttribute('width', String(plan.frameW));
      this.bg.setAttribute('height', String(plan.frameH));
      this.bg.setAttribute('fill', plan.background);
      this.bg.style.display = '';
    } else {
      this.bg.style.display = 'none';
    }
    const seen = new Set<string>();
    plan.groups.forEach((g, i) => {
      seen.add(g.key);
      this.updateGroup(g, i);
    });
    for (const [k, g] of this.groups) {
      if (!seen.has(k)) {
        g.el.remove();
        this.groups.delete(k);
      }
    }
    if (plan.screen !== this.lastScreen) {
      this.screen.innerHTML = plan.screen;
      this.lastScreen = plan.screen;
    }
  }

  private updateGroup(g: PlanGroup, index: number): void {
    let ge = this.groups.get(g.key);
    if (!ge) {
      const el = document.createElementNS(SVG_NS, 'g');
      ge = { el, entries: new Map(), order: [] };
      this.groups.set(g.key, ge);
    }
    if (this.groupsRoot.children[index] !== ge.el) this.groupsRoot.insertBefore(ge.el, this.groupsRoot.children[index] ?? null);
    setAttr(ge.el, 'transform', g.transform);
    setAttr(ge.el, 'opacity', g.opacity < 1 ? g.opacity.toFixed(3) : '');
    setAttr(ge.el, 'clip-path', g.clip ? `url(#${g.clip})` : '');
    const nextOrder = g.entries.map((e) => e.key);
    const seen = new Set(nextOrder);
    for (const [k, e] of ge.entries) {
      if (!seen.has(k)) {
        e.el.remove();
        ge.entries.delete(k);
      }
    }
    for (const entry of g.entries) this.updateEntry(ge, entry);
    // A ordem no DOM é a ordem de sobreposição, a mesma da exportação.
    if (nextOrder.join('|') !== ge.order.join('|')) {
      for (const key of nextOrder) ge.el.appendChild(ge.entries.get(key)!.el);
      ge.order = nextOrder;
    }
  }

  private updateEntry(ge: GroupEl, e: PlanEntry): void {
    let cur = ge.entries.get(e.key);
    if (!cur) {
      const el = document.createElementNS(SVG_NS, 'g');
      if (e.nodeId) el.setAttribute('data-node-id', e.nodeId);
      else el.style.pointerEvents = 'none';
      cur = { el, inner: '', transform: '', opacity: 1, filter: '', blend: '' };
      ge.entries.set(e.key, cur);
    }
    if (cur.inner !== e.inner) {
      cur.el.innerHTML = e.inner;
      cur.inner = e.inner;
    }
    if (cur.transform !== e.transform) {
      setAttr(cur.el, 'transform', e.transform);
      cur.transform = e.transform;
    }
    if (cur.opacity !== e.opacity) {
      setAttr(cur.el, 'opacity', e.opacity < 1 ? e.opacity.toFixed(3) : '');
      cur.opacity = e.opacity;
    }
    if (cur.filter !== e.filter) {
      setAttr(cur.el, 'filter', e.filter ? `url(#${e.filter})` : '');
      cur.filter = e.filter;
    }
    if (cur.blend !== e.blend) {
      cur.el.style.mixBlendMode = e.blend;
      cur.blend = e.blend;
    }
  }

  dispose(): void {
    this.svg.replaceChildren();
  }
}

function setAttr(el: Element, name: string, value: string): void {
  if (value) el.setAttribute(name, value);
  else el.removeAttribute(name);
}
