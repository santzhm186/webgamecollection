/** Small, dependency-free DOM for host integration tests. It reads the real HTML,
 * preserves template clones, and implements delegated/bubbling button events.
 * Layout and graphics intentionally remain outside these tests. */
const dataKey = name => name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
const decode = text => text.replace(/&(?:amp|lt|gt|quot|apos|#39);/g, entity => ({
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&#39;': "'",
})[entity]);

class TextNode {
  constructor(text) { this.textContent = decode(text); this.parentNode = null; }
  cloneNode() { return new TextNode(this.textContent); }
}

export class Element {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.attributes = new Map();
    this.dataset = {};
    this.childNodes = [];
    this.parentNode = null;
    this.listeners = new Map();
    this.style = { setProperty(name, value) { this[name] = value; } };
    this.classList = {
      contains: name => this.className.split(/\s+/).includes(name),
      toggle: (name, force) => {
        const classes = new Set(this.className.split(/\s+/).filter(Boolean));
        const enabled = force ?? !classes.has(name);
        if (enabled) classes.add(name); else classes.delete(name);
        this.className = [...classes].join(' ');
        return enabled;
      },
      add: (...names) => names.forEach(name => this.classList.toggle(name, true)),
      remove: (...names) => names.forEach(name => this.classList.toggle(name, false)),
    };
    if (tagName === 'template') this.content = new Element('#fragment');
  }
  get id() { return this.getAttribute('id') || ''; }
  set id(value) { this.setAttribute('id', value); }
  get className() { return this.getAttribute('class') || ''; }
  set className(value) { this.setAttribute('class', value); }
  get hidden() { return this.hasAttribute('hidden'); }
  set hidden(value) { if (value) this.setAttribute('hidden', ''); else this.removeAttribute('hidden'); }
  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(value) { if (value) this.setAttribute('disabled', ''); else this.removeAttribute('disabled'); }
  get value() { return this._value ?? this.getAttribute('value') ?? ''; }
  set value(value) { this._value = value; }
  get children() { return this.childNodes.filter(node => node instanceof Element); }
  get firstElementChild() { return this.children[0] ?? null; }
  get textContent() { return this.childNodes.map(node => node.textContent).join(''); }
  set textContent(value) {
    this.replaceChildren();
    this.append(new TextNode(String(value ?? '')));
  }
  get innerHTML() { return this._html ?? this.textContent; }
  set innerHTML(value) {
    this.replaceChildren();
    this._html = String(value);
    parseInto(this, this._html);
  }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name.startsWith('data-')) this.dataset[dataKey(name)] = String(value);
  }
  getAttribute(name) {
    // dataset is directly mutable in production DOM.
    if (name.startsWith('data-')) return this.dataset[dataKey(name)] ?? null;
    return this.attributes.get(name) ?? null;
  }
  hasAttribute(name) { return this.getAttribute(name) !== null; }
  removeAttribute(name) {
    this.attributes.delete(name);
    if (name.startsWith('data-')) delete this.dataset[dataKey(name)];
  }
  append(...nodes) {
    for (let node of nodes) {
      if (typeof node === 'string') node = new TextNode(node);
      node.remove?.();
      node.parentNode = this;
      this.childNodes.push(node);
    }
  }
  appendChild(node) { this.append(node); return node; }
  replaceChildren(...nodes) {
    for (const child of this.childNodes) child.parentNode = null;
    this.childNodes = [];
    this._html = undefined;
    this.append(...nodes);
  }
  remove() {
    if (!this.parentNode) return;
    const siblings = this.parentNode.childNodes;
    siblings.splice(siblings.indexOf(this), 1);
    this.parentNode = null;
  }
  contains(node) {
    for (let current = node; current; current = current.parentNode) if (current === this) return true;
    return false;
  }
  matches(selector) { return matches(this, selector); }
  closest(selector) {
    for (let current = this; current; current = current.parentNode) if (current.matches(selector)) return current;
    return null;
  }
  querySelectorAll(selector) {
    const found = [];
    const visit = node => {
      for (const child of node.children) {
        if (matches(child, selector)) found.push(child);
        visit(child);
      }
    };
    visit(this);
    return found;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  cloneNode(deep = false) {
    const clone = new Element(this.tagName.toLowerCase());
    for (const [key, value] of this.attributes) clone.setAttribute(key, value);
    Object.assign(clone.dataset, this.dataset);
    if (deep) {
      clone.append(...this.childNodes.map(child => child.cloneNode(true)));
      if (this.content) clone.content = this.content.cloneNode(true);
    }
    return clone;
  }
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
  }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
  dispatchEvent(event) {
    event.target ??= this;
    event.preventDefault ??= () => { event.defaultPrevented = true; };
    event.stopPropagation ??= () => { event.stopped = true; };
    for (let current = this; current; current = event.bubbles && !event.stopped ? current.parentNode : null) {
      event.currentTarget = current;
      for (const callback of [...(current.listeners.get(event.type) ?? [])]) callback(event);
    }
    return !event.defaultPrevented;
  }
  click() {
    if (!this.disabled) this.dispatchEvent({ type: 'click', bubbles: true });
  }
  showModal() { this.open = true; }
  close() { this.open = false; this.dispatchEvent({ type: 'close' }); }
  getBoundingClientRect() { return { left: 0, right: 100, top: 0, bottom: 100, width: 100, height: 100 }; }
}

function simpleMatches(node, selector) {
  if (!(node instanceof Element)) return false;
  const tag = selector.match(/^[a-z][\w-]*/i)?.[0];
  if (tag && node.tagName.toLowerCase() !== tag.toLowerCase()) return false;
  for (const [, id] of selector.matchAll(/#([\w-]+)/g)) if (node.id !== id) return false;
  for (const [, name] of selector.matchAll(/\.([\w-]+)/g)) if (!node.classList.contains(name)) return false;
  for (const [, name, , value] of selector.matchAll(/\[([\w-]+)(?:\s*=\s*(["']?)([^\]"']*)\2)?\]/g)) {
    if (!node.hasAttribute(name) || (value !== undefined && node.getAttribute(name) !== value)) return false;
  }
  return true;
}

function matches(node, selector) {
  return selector.split(',').some(part => {
    const tokens = part.trim().replace(/\s*>\s*/g, ' > ').split(/\s+/);
    let current = node;
    let index = tokens.length - 1;
    if (!simpleMatches(current, tokens[index--])) return false;
    while (index >= 0) {
      if (tokens[index] === '>') {
        current = current.parentNode;
        if (!simpleMatches(current, tokens[--index])) return false;
      } else {
        current = current.parentNode;
        while (current && !simpleMatches(current, tokens[index])) current = current.parentNode;
        if (!current) return false;
      }
      index--;
    }
    return true;
  });
}

function parseInto(root, html) {
  const stack = [{ name: '#root', node: root }];
  for (const token of html.match(/<!--[\s\S]*?-->|<![^>]*>|<[^>]*>|[^<]+/g) ?? []) {
    if (token.startsWith('<!')) continue;
    const closing = token.match(/^<\/([\w-]+)/);
    if (closing) {
      const index = stack.findLastIndex(entry => entry.name === closing[1].toLowerCase());
      if (index > 0) stack.splice(index);
      continue;
    }
    const opening = token.match(/^<([\w-]+)/);
    if (!opening) { stack.at(-1).node.append(new TextNode(token)); continue; }
    const name = opening[1].toLowerCase();
    const node = new Element(name);
    const attrs = token.slice(opening[0].length, -1).replace(/\/$/, '');
    for (const [, attr, , quoted, plain] of attrs.matchAll(/([^\s=]+)(?:\s*=\s*(?:(["'])(.*?)\2|([^\s]+)))?/g)) {
      node.setAttribute(attr, decode(quoted ?? plain ?? ''));
    }
    stack.at(-1).node.append(node);
    if (!/\/$/.test(token.slice(0, -1)) && !['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'].includes(name)) {
      stack.push({ name, node: node.content ?? node });
    }
  }
}

export function createDocument(html) {
  const document = new Element('#document');
  parseInto(document, html);
  document.documentElement = document.querySelector('html');
  document.body = document.querySelector('body');
  document.createElement = name => new Element(name);
  return document;
}
