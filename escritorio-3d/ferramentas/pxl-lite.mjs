#!/usr/bin/env node
// pxl-lite — implementação mínima da DSL descrita em .claude/skills/pxl-pixel-art/SKILL.md
//
// O SKILL.md do repositório referencia `bin/pxl.js`, mas o executável não foi versionado.
// Este arquivo implementa o subconjunto da DSL usado pelos arquivos `.px.js` deste projeto,
// com as mesmas assinaturas do SKILL.md, para que a arte possa ser gerada hoje e continue
// compatível quando o pxl completo for adicionado à skill.
//
// Uso:
//   node ferramentas/pxl-lite.mjs build arte/escritorio.px.js [--out assets] [--only a,b]
//   node ferramentas/pxl-lite.mjs ascii arte/escritorio.px.js <nome> [--frame n]
//
// Saída: <out>/<nome>.png (1x), <out>/_preview/<nome>.png (ampliado, xadrez = transparente)
//        e <out>/manifest.json (dimensões, quadros e fps de cada asset).

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";

// ---------------------------------------------------------------------------------------------
// Paletas
const PALETAS = {
  pico8: ["#000000", "#1d2b53", "#7e2553", "#008751", "#ab5236", "#5f574f", "#c2c3c7", "#fff1e8",
    "#ff004d", "#ffa300", "#ffec27", "#00e436", "#29adff", "#83769c", "#ff77a8", "#ffccaa"],
  sweetie16: ["#1a1c2c", "#5d275d", "#b13e53", "#ef7d57", "#ffcd75", "#a7f070", "#38b764", "#257179",
    "#29366f", "#3b5dc9", "#41a6f6", "#73eff7", "#f4f4f4", "#94b0c2", "#566c86", "#333c57"],
  gray8: ["#000000", "#242424", "#494949", "#6d6d6d", "#929292", "#b6b6b6", "#dbdbdb", "#ffffff"],
};

function hexRgba(h) {
  let s = h.replace("#", "");
  if (s.length === 3) s = s.split("").map((c) => c + c).join("");
  const n = parseInt(s.slice(0, 6), 16);
  const a = s.length === 8 ? parseInt(s.slice(6, 8), 16) : 255;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
}

function rgbaHex([r, g, b]) {
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}

// Fonte 3x5 para text()
const FONTE = {
  "0": "111101101101111", "1": "010110010010111", "2": "111001111100111", "3": "111001111001111",
  "4": "101101111001001", "5": "111100111001111", "6": "111100111101111", "7": "111001010010010",
  "8": "111101111101111", "9": "111101111001111", A: "010101111101101", B: "110101110101110",
  C: "011100100100011", D: "110101101101110", E: "111100110100111", F: "111100110100100",
  G: "011100101101011", H: "101101111101101", I: "111010010010111", J: "001001001101010",
  K: "101101110101101", L: "100100100100111", M: "101111111101101", N: "110101101101101",
  O: "010101101101010", P: "110101110100100", Q: "010101101110011", R: "110101110101101",
  S: "011100010001110", T: "111010010010010", U: "101101101101111", V: "101101101101010",
  W: "101101111111101", X: "101101010101101", Y: "101101010010010", Z: "111001010100111",
  " ": "000000000000000", "-": "000000111000000", ".": "000000000000010", ":": "000010000010000",
  "!": "010010010000010", "?": "110001010000010", "/": "001001010100100", "+": "000010111010000",
};

const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const limiar = (x, y) => (BAYER[((y % 4) + 4) % 4][((x % 4) + 4) % 4] + 0.5) / 16;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function noPoligono(x, y, pts) {
  let dentro = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const xi = pts[i], yi = pts[i + 1], xj = pts[j], yj = pts[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

function regiao(r) {
  if (typeof r === "function") return r;
  if (Array.isArray(r)) {
    if (r.length === 3) { const [cx, cy, rad] = r; return (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= rad * rad + rad * 0.5; }
    if (r.length === 4) { const [x0, y0, w, h] = r; return (x, y) => x >= x0 && x < x0 + w && y >= y0 && y < y0 + h; }
    if (r.length >= 6) return (x, y) => noPoligono(x + 0.5, y + 0.5, r);
  }
  throw new Error(`região inválida: ${JSON.stringify(r)} (use [cx,cy,r], [x,y,w,h], polígono ou função)`);
}

function dedent(str) {
  const linhas = str.replace(/\t/g, "  ").split("\n");
  while (linhas.length && linhas[0].trim() === "") linhas.shift();
  while (linhas.length && linhas[linhas.length - 1].trim() === "") linhas.pop();
  const ind = Math.min(...linhas.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
  return linhas.map((l) => l.slice(ind).replace(/\s+$/, ""));
}

// ---------------------------------------------------------------------------------------------
// Tela: pixels guardam a CHAVE da paleta (ou "#hex"), para que shade/light/swap funcionem.
class Tela {
  constructor(w, h, mundo) {
    this.w = w; this.h = h; this.p = new Array(w * h).fill(null);
    this.ox = 0; this.oy = 0; this.mascara = null; this.mundo = mundo;
    this.phase = 0; this.frame = 0;
  }
  dentro(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { x = Math.floor(x + this.ox); y = Math.floor(y + this.oy); return this.dentro(x, y) ? this.p[y * this.w + x] : null; }
  getAbs(x, y) { return this.dentro(x, y) ? this.p[y * this.w + x] : null; }
  setAbs(x, y, c) {
    if (!this.dentro(x, y)) return;
    if (this.mascara && !this.mascara(x - this.ox, y - this.oy)) return;
    this.p[y * this.w + x] = c === "_" ? null : c;
  }
  px(x, y, c) {
    if (c == null || c === ".") return this;
    this.mundo.validar(c);
    this.setAbs(Math.floor(x + this.ox), Math.floor(y + this.oy), c);
    return this;
  }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c); return this; }
  box(x, y, w, h, c) { this.hline(x, y, w, c); this.hline(x, y + h - 1, w, c); this.vline(x, y, h, c); this.vline(x + w - 1, y, h, c); return this; }
  hline(x, y, len, c) { for (let i = 0; i < len; i++) this.px(x + i, y, c); return this; }
  vline(x, y, len, c) { for (let j = 0; j < len; j++) this.px(x, y + j, c); return this; }
  line(x0, y0, x1, y1, c, largura = 1) {
    let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
    const o = Math.floor((largura - 1) / 2);
    for (;;) {
      this.rect(x0 - o, y0 - o, largura, largura, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return this;
  }
  circ(cx, cy, r, c) { return this.ellipse(cx, cy, r, r, c); }
  ellipse(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const dx = (x - cx) / (rx + 0.5), dy = (y - cy) / (ry + 0.5);
        if (dx * dx + dy * dy <= 1) this.px(x, y, c);
      }
    return this;
  }
  ring(cx, cy, r, c) {
    const d = (x, y) => ((x - cx) / (r + 0.5)) ** 2 + ((y - cy) / (r + 0.5)) ** 2 <= 1;
    for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++)
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++)
        if (d(x, y) && (!d(x + 1, y) || !d(x - 1, y) || !d(x, y + 1) || !d(x, y - 1))) this.px(x, y, c);
    return this;
  }
  poly(pts, c) {
    const xs = pts.filter((_, i) => i % 2 === 0), ys = pts.filter((_, i) => i % 2 === 1);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++)
      for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++)
        if (noPoligono(x + 0.5, y + 0.5, pts)) this.px(x, y, c);
    return this;
  }
  fill(x, y, c) {
    const ax = Math.floor(x + this.ox), ay = Math.floor(y + this.oy);
    const alvo = this.getAbs(ax, ay);
    if (alvo === c) return this;
    const pilha = [[ax, ay]];
    while (pilha.length) {
      const [px, py] = pilha.pop();
      if (!this.dentro(px, py) || this.getAbs(px, py) !== alvo) continue;
      this.setAbs(px, py, c);
      pilha.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
    }
    return this;
  }
  text(x, y, str, c) {
    let cx = x;
    for (const ch of String(str).toUpperCase()) {
      const g = FONTE[ch];
      if (!g) throw new Error(`text(): caractere sem glifo: '${ch}'`);
      for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j * 3 + i] === "1") this.px(cx + i, y + j, c);
      cx += 4;
    }
    return this;
  }
  grid(x, y, str) {
    dedent(str).forEach((linha, j) => [...linha].forEach((ch, i) => { if (ch !== " ") this.px(x + i, y + j, ch); }));
    return this;
  }
  _tom(r, passos, densidade, sentido) {
    const f = regiao(r);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const lx = x - this.ox, ly = y - this.oy;
      if (!f(lx, ly)) continue;
      if (densidade < 1 && limiar(x, y) >= densidade) continue;
      const c = this.getAbs(x, y);
      if (c == null) continue;
      this.setAbs(x, y, this.mundo.passo(c, passos * sentido));
    }
    return this;
  }
  shade(r, passos = 1, densidade = 1) { return this._tom(r, passos, densidade, -1); }
  light(r, passos = 1, densidade = 1) { return this._tom(r, passos, densidade, +1); }
  noise(x, y, w, h, c, densidade = 0.1, seed = 1) {
    const rnd = mulberry32(seed * 9973 + 17);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (rnd() < densidade) this.px(x + i, y + j, c);
    return this;
  }
  dither(x, y, w, h, c, densidade = 0.5) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++)
      if (limiar(x + i + this.ox, y + j + this.oy) < densidade) this.px(x + i, y + j, c);
    return this;
  }
  grad(x, y, w, h, chaves, opts = {}) {
    const ks = [...chaves], dir = opts.dir || "y";
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const t = dir === "y" ? (h <= 1 ? 0 : j / (h - 1)) : (w <= 1 ? 0 : i / (w - 1));
      const f = t * (ks.length - 1), k = Math.min(ks.length - 2, Math.floor(f)), fr = f - k;
      const c = ks.length === 1 ? ks[0] : limiar(x + i, y + j) < fr ? ks[k + 1] : ks[k];
      this.px(x + i, y + j, c);
    }
    return this;
  }
  recolor(mapa, r) {
    const f = r ? regiao(r) : () => true;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const c = this.getAbs(x, y);
      if (c != null && mapa[c] != null && f(x - this.ox, y - this.oy)) this.setAbs(x, y, mapa[c]);
    }
    return this;
  }
  stamp(nome, x, y, opts = {}) {
    const img = this.mundo.renderNome(nome, opts, this);
    const flip = opts.flip || "";
    for (let j = 0; j < img.h; j++) for (let i = 0; i < img.w; i++) {
      const sx = flip.includes("x") ? img.w - 1 - i : i, sy = flip.includes("y") ? img.h - 1 - j : j;
      let c = img.p[sy * img.w + sx];
      if (c == null) continue;
      if (opts.swap && opts.swap[c] != null) c = opts.swap[c];
      this.px(x + i, y + j, c);
    }
    return this;
  }
  tile(nome, x, y, w, h, opts = {}) {
    const img = this.mundo.renderNome(nome, opts, this);
    for (let j = 0; j < h; j += img.h) for (let i = 0; i < w; i += img.w)
      clipItens(this, [x, y, w, h], [(t) => t.stamp(nome, x + i, y + j, opts)]);
    return this;
  }
}

function clipItens(tela, r, itens) {
  const ant = tela.mascara, f = regiao(r);
  tela.mascara = ant ? (x, y) => ant(x, y) && f(x, y) : f;
  for (const it of itens) executar(tela, it);
  tela.mascara = ant;
}

function executar(tela, item) {
  if (item == null || item === false) return;
  if (typeof item === "string") return void tela.grid(0, 0, item);
  if (typeof item === "function") return void item(tela);
  if (Array.isArray(item)) return void item.forEach((i) => executar(tela, i));
  if (item.__layer) {
    const o = item.opts || {};
    if (o.shade || o.light) {
      const tmp = new Tela(tela.w, tela.h, tela.mundo);
      tmp.ox = tela.ox + (o.x || 0); tmp.oy = tela.oy + (o.y || 0); tmp.phase = tela.phase; tmp.frame = tela.frame;
      item.itens.forEach((i) => executar(tmp, i));
      const passos = (o.shade === true || o.light === true) ? 1 : (o.shade || o.light);
      for (let y = 0; y < tela.h; y++) for (let x = 0; x < tela.w; x++) {
        if (tmp.getAbs(x, y) == null) continue;
        const c = tela.getAbs(x, y);
        if (c == null) continue;
        if (o.densidade != null && limiar(x, y) >= o.densidade) continue;
        tela.setAbs(x, y, tela.mundo.passo(c, o.shade ? -passos : passos));
      }
      return;
    }
    const ax = tela.ox, ay = tela.oy;
    tela.ox += o.x || 0; tela.oy += o.y || 0;
    item.itens.forEach((i) => executar(tela, i));
    tela.ox = ax; tela.oy = ay;
    return;
  }
  if (item.__frame) return; // tratado por anim()
  if (item.__ignorar) return;
  throw new Error(`item desconhecido: ${JSON.stringify(item).slice(0, 80)}`);
}

// ---------------------------------------------------------------------------------------------
class Mundo {
  constructor() {
    this.paleta = new Map();
    PALETAS.pico8.forEach((h, i) => this.paleta.set(i.toString(16), h));
    this.ramps = [];
    this.defs = new Map();
    this.ordem = [];
    this.cache = new Map();
  }
  validar(c) {
    if (c === "_" || c === "." || (typeof c === "string" && c.startsWith("#"))) return;
    if (!this.paleta.has(c)) {
      const sug = [...this.paleta.keys()].filter((k) => k.toLowerCase() === String(c).toLowerCase());
      throw new Error(`cor '${c}' não está na paleta${sug.length ? ` (quis dizer '${sug[0]}'?)` : ""}`);
    }
  }
  passo(c, n) {
    if (c.startsWith("#")) {
      const [r, g, b] = hexRgba(c), f = n < 0 ? Math.pow(0.82, -n) : 1;
      return n < 0 ? rgbaHex([r * f, g * f, b * f]) : rgbaHex([r + (255 - r) * 0.2 * n, g + (255 - g) * 0.2 * n, b + (255 - b) * 0.2 * n]);
    }
    for (const r of this.ramps) {
      const i = r.indexOf(c);
      if (i >= 0) return r[Math.max(0, Math.min(r.length - 1, i + n))];
    }
    return c;
  }
  rgba(c) {
    if (c == null) return [0, 0, 0, 0];
    if (c.startsWith("#")) return hexRgba(c);
    return hexRgba(this.paleta.get(c));
  }
  registrar(tipo, nome, opts, itens) {
    if (this.defs.has(nome)) throw new Error(`asset '${nome}' definido duas vezes`);
    let def = { tipo, nome, opts: { ...opts }, itens };
    if (opts.base) {
      const b = this.defs.get(opts.base);
      if (!b) throw new Error(`base '${opts.base}' não existe (defina-a antes de '${nome}')`);
      const { base, ...resto } = opts;
      const swap = { ...(b.opts.swap || {}), ...(resto.swap || {}) };
      def = { tipo: b.tipo, nome, opts: { ...b.opts, ...resto, swap }, itens: [...b.itens, ...itens], baseDe: base };
    }
    this.defs.set(nome, def);
    this.ordem.push(nome);
  }
  resolver(padrao) {
    if (this.defs.has(padrao)) return [padrao];
    if (padrao.includes("*")) {
      const re = new RegExp("^" + padrao.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
      return this.ordem.filter((n) => re.test(n) && !n.startsWith("_") && this.defs.get(n).tipo !== "sheet");
    }
    throw new Error(`asset '${padrao}' não existe`);
  }
  // Renderiza um asset; retorna { w, h, quadros: [p...], fps }
  render(nome) {
    if (this.cache.has(nome)) return this.cache.get(nome);
    const def = this.defs.get(nome);
    if (!def) throw new Error(`asset '${nome}' não existe`);
    let r;
    if (def.tipo === "sheet") r = this.renderSheet(def);
    else r = this.renderSprite(def);
    this.cache.set(nome, r);
    return r;
  }
  renderNome(nome, opts = {}, pai) {
    const [n] = this.resolver(nome);
    const r = this.render(n);
    let q = opts.frame != null ? opts.frame : 0;
    if (pai && opts.frame == null && r.quadros.length > 1 && pai.frame) q = pai.frame % r.quadros.length;
    return { w: r.w, h: r.h, p: r.quadros[q] };
  }
  tamanho(def) {
    const o = def.opts;
    if (o.w && o.h) return [o.w, o.h];
    let w = 0, h = 0;
    for (const it of def.itens) if (typeof it === "string") {
      const ls = dedent(it);
      h = Math.max(h, ls.length); w = Math.max(w, ...ls.map((l) => l.length));
    }
    if (o.mx && !o.w) w *= 2;
    if (o.my && !o.h) h *= 2;
    if (!w || !h) throw new Error(`'${def.nome}': informe { w, h } ou uma grade`);
    return [o.w || w, o.h || h];
  }
  renderSprite(def) {
    const o = def.opts;
    const [w, h] = this.tamanho(def);
    const quadrosDef = def.itens.filter((i) => i && i.__frame);
    const comuns = def.itens.filter((i) => !(i && i.__frame));
    const n = quadrosDef.length || o.frames || 1;
    const quadros = [];
    let W = w, H = h;
    for (let q = 0; q < n; q++) {
      const t = new Tela(w, h, this);
      t.frame = q; t.phase = q / n;
      if (o.bg) t.rect(0, 0, w, h, o.bg);
      comuns.forEach((i) => executar(t, i));
      if (quadrosDef[q]) quadrosDef[q].itens.forEach((i) => executar(t, i));
      let p = t.p;
      if (o.mx) for (let y = 0; y < h; y++) for (let x = 0; x < Math.floor(w / 2); x++) p[y * w + (w - 1 - x)] = p[y * w + x];
      if (o.my) for (let y = 0; y < Math.floor(h / 2); y++) for (let x = 0; x < w; x++) p[(h - 1 - y) * w + x] = p[y * w + x];
      if (o.swap) p = p.map((c) => (c != null && o.swap[c] != null ? o.swap[c] : c));
      if (o.flip) {
        const f = o.flip, q2 = new Array(w * h);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
          q2[y * w + x] = p[(f.includes("y") ? h - 1 - y : y) * w + (f.includes("x") ? w - 1 - x : x)];
        p = q2;
      }
      W = w; H = h;
      if (o.outline) {
        const oc = o.outline, W2 = w + 2, H2 = h + 2, q2 = new Array(W2 * H2).fill(null);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) q2[(y + 1) * W2 + x + 1] = p[y * w + x];
        const cheio = (x, y) => x >= 0 && y >= 0 && x < W2 && y < H2 && q2[y * W2 + x] != null && q2[y * W2 + x] !== "§";
        for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++)
          if (q2[y * W2 + x] == null && (cheio(x + 1, y) || cheio(x - 1, y) || cheio(x, y + 1) || cheio(x, y - 1))) q2[y * W2 + x] = "§";
        p = q2.map((c) => (c === "§" ? oc : c));
        W = W2; H = H2;
      }
      quadros.push(p);
    }
    return { w: W, h: H, quadros, fps: o.fps || 8, tipo: def.tipo };
  }
  renderSheet(def) {
    const nomes = def.lista.flatMap((n) => this.resolver(n));
    const pad = def.opts.pad || 0;
    const itens = nomes.map((n) => ({ nome: n, r: this.render(n) }));
    let x = 0, H = 0;
    const rects = {};
    for (const it of itens) {
      const fw = it.r.w, n = it.r.quadros.length;
      rects[it.nome] = { x, y: 0, w: fw, h: it.r.h, quadros: n, fps: it.r.fps };
      x += fw * n + pad; H = Math.max(H, it.r.h);
    }
    const W = Math.max(1, x - pad), p = new Array(W * H).fill(null);
    for (const it of itens) {
      const R = rects[it.nome];
      it.r.quadros.forEach((q, k) => {
        for (let y = 0; y < it.r.h; y++) for (let xx = 0; xx < it.r.w; xx++) p[y * W + R.x + k * it.r.w + xx] = q[y * it.r.w + xx];
      });
    }
    return { w: W, h: H, quadros: [p], fps: 0, tipo: "sheet", rects };
  }
}

// ---------------------------------------------------------------------------------------------
// PNG
const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(tipo, dados) {
  const len = Buffer.alloc(4); len.writeUInt32BE(dados.length);
  const td = Buffer.concat([Buffer.from(tipo, "ascii"), dados]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

function imagem(mundo, r) {
  const n = r.quadros.length, W = r.w * n, H = r.h, buf = Buffer.alloc(W * H * 4);
  r.quadros.forEach((p, k) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < r.w; x++) {
      const [R, G, B, A] = mundo.rgba(p[y * r.w + x]);
      const i = (y * W + k * r.w + x) * 4;
      buf[i] = R; buf[i + 1] = G; buf[i + 2] = B; buf[i + 3] = A;
    }
  });
  return { W, H, buf };
}

function preview({ W, H, buf }, quadroW) {
  const s = Math.max(2, Math.min(16, Math.floor(640 / Math.max(W, H))));
  const PW = W * s, PH = H * s, out = Buffer.alloc(PW * PH * 4);
  for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
    const sx = Math.floor(x / s), sy = Math.floor(y / s), i = (sy * W + sx) * 4;
    const xadrez = ((Math.floor(x / 8) + Math.floor(y / 8)) & 1) ? 205 : 235;
    const a = buf[i + 3] / 255;
    let c = [0, 1, 2].map((k) => buf[i + k] * a + xadrez * (1 - a));
    const borda8 = (x % (s * 8) === 0) || (y % (s * 8) === 0);
    const bordaQ = quadroW && x % (quadroW * s) === 0 && x > 0;
    if (bordaQ) c = [255, 0, 128];
    else if (s >= 4 && (x % s === 0 || y % s === 0)) c = c.map((v) => v * (borda8 ? 0.7 : 0.9));
    const o = (y * PW + x) * 4;
    out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2]; out[o + 3] = 255;
  }
  return png(PW, PH, out);
}

// ---------------------------------------------------------------------------------------------
function carregar(arquivo) {
  const mundo = new Mundo();
  const op = (nome) => (...a) => (t) => t[nome](...a);
  const dsl = {
    pal: (obj) => Object.entries(obj).forEach(([k, v]) => { if (k.length !== 1) throw new Error(`pal(): chave '${k}' deve ter 1 caractere`); mundo.paleta.set(k, v); }),
    use: (nome) => { const p = PALETAS[nome]; if (!p) throw new Error(`paleta '${nome}' não disponível no pxl-lite`); p.forEach((h, i) => mundo.paleta.set(i.toString(16), h)); },
    ramps: (...rs) => rs.forEach((r) => mundo.ramps.push([...r])),
    sprite: (nome, a, ...resto) => {
      const opts = a && typeof a === "object" && !Array.isArray(a) && !a.__layer && !a.__frame ? a : {};
      const itens = opts === a ? resto : [a, ...resto];
      mundo.registrar("sprite", nome, opts, itens);
    },
    anim: (nome, opts, ...itens) => mundo.registrar("anim", nome, opts || {}, itens),
    scene: (nome, opts, ...itens) => mundo.registrar("scene", nome, opts || {}, itens),
    sheet: (nome, lista, opts = {}) => { mundo.defs.set(nome, { tipo: "sheet", nome, lista, opts }); mundo.ordem.push(nome); },
    frame: (...itens) => ({ __frame: true, itens }),
    layer: (nome, a, ...resto) => {
      const opts = a && typeof a === "object" && !Array.isArray(a) && !a.__layer ? a : {};
      return { __layer: true, nome, opts, itens: opts === a ? resto : [a, ...resto] };
    },
    clip: (r, ...itens) => (t) => clipItens(t, r, itens),
    glow: () => ({ __ignorar: true }),
    Math, console, JSON, Array, Object, String, Number,
  };
  for (const n of ["px", "rect", "box", "hline", "vline", "line", "circ", "ring", "ellipse", "poly", "fill", "text",
    "grid", "shade", "light", "noise", "dither", "grad", "recolor", "stamp", "tile"]) dsl[n] = op(n);
  const codigo = fs.readFileSync(arquivo, "utf8");
  try {
    vm.runInNewContext(codigo, dsl, { filename: arquivo });
  } catch (e) {
    const linha = (e.stack || "").split("\n").find((l) => l.includes(path.basename(arquivo)));
    console.error(`✗ ${arquivo}: ${e.message}${linha ? "\n   " + linha.trim() : ""}`);
    process.exit(1);
  }
  return mundo;
}

function build(arquivo, saida, so) {
  const mundo = carregar(arquivo);
  fs.mkdirSync(path.join(saida, "_preview"), { recursive: true });
  const manifestoArq = path.join(saida, "manifest.json");
  const manifesto = fs.existsSync(manifestoArq) && so ? JSON.parse(fs.readFileSync(manifestoArq, "utf8")) : {};
  let erros = 0, ok = 0;
  for (const nome of mundo.ordem) {
    if (nome.startsWith("_")) continue;
    if (so && !so.some((s) => (s.includes("*") ? new RegExp("^" + s.replace(/\*/g, ".*") + "$").test(nome) : s === nome))) continue;
    try {
      const r = mundo.render(nome);
      const img = imagem(mundo, r);
      fs.writeFileSync(path.join(saida, nome + ".png"), png(img.W, img.H, img.buf));
      fs.writeFileSync(path.join(saida, "_preview", nome + ".png"), preview(img, r.quadros.length > 1 ? r.w : 0));
      manifesto[nome] = { arquivo: nome + ".png", w: r.w, h: r.h, quadros: r.quadros.length, fps: r.fps, tipo: r.tipo };
      if (r.rects) manifesto[nome].rects = r.rects;
      ok++;
    } catch (e) {
      erros++;
      const linha = (e.stack || "").split("\n").find((l) => l.includes(path.basename(arquivo)));
      console.error(`✗ ${nome}: ${e.message}${linha ? "\n   " + linha.trim() : ""}`);
    }
  }
  fs.writeFileSync(manifestoArq, JSON.stringify(manifesto, null, 1) + "\n");
  console.log(`pxl-lite: ${ok} asset(s) gerado(s) em ${saida}${erros ? `, ${erros} com erro` : ""}`);
  if (erros) process.exitCode = 1;
}

function ascii(arquivo, nome, quadro = 0) {
  const mundo = carregar(arquivo);
  const r = mundo.render(nome), p = r.quadros[quadro];
  const dez = [...Array(r.w)].map((_, x) => (x % 10 === 0 ? String(Math.floor(x / 10) % 10) : " ")).join("");
  const un = [...Array(r.w)].map((_, x) => String(x % 10)).join("");
  console.log("    " + dez + "\n    " + un);
  for (let y = 0; y < r.h; y++)
    console.log(String(y).padStart(3) + " " + [...Array(r.w)].map((_, x) => { const c = p[y * r.w + x]; return c == null ? "." : c.startsWith("#") ? "#" : c; }).join(""));
}

const [cmd, arquivo, ...resto] = process.argv.slice(2);
const flag = (f) => { const i = resto.indexOf(f); return i >= 0 ? resto[i + 1] : null; };
if (cmd === "build" && arquivo) build(arquivo, flag("--out") || path.join(path.dirname(arquivo), "out"), flag("--only")?.split(","));
else if (cmd === "ascii" && arquivo && resto[0]) ascii(arquivo, resto[0], Number(flag("--frame") || 0));
else {
  console.log("uso: pxl-lite build <arte.px.js> [--out dir] [--only a,b] | ascii <arte.px.js> <nome> [--frame n]");
  process.exitCode = 1;
}
