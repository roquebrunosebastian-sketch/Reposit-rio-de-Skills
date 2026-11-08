// Escritório de Agentes — ponto de entrada.
// Renderiza em baixa resolução e amplia sem suavização (pixels nítidos), com a câmera inclinada
// dos RPGs de bolso. Expõe `window.escritorio` para alocar agentes nas 5 mesas.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { carregarRecursos } from "./recursos.js";
import { construirEscritorio } from "./cena.js";
import { Agentes, STATUS } from "./agentes.js";
import { MESAS, LARGURA } from "./layout.js";

const params = new URLSearchParams(location.search);
const $ = (s) => document.querySelector(s);

// ---------------------------------------------------------------------------------------------
// Renderizador pixelado
const canvas = $("#tela");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

let escalaPixel = Number(params.get("pixel")) || 2;

const cena = new THREE.Scene();
cena.background = new THREE.Color(0x1d1a2b);

const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.5, 200);
const controles = new OrbitControls(camera, canvas);
controles.enableDamping = true;
controles.dampingFactor = 0.12;
controles.minPolarAngle = THREE.MathUtils.degToRad(6);
controles.maxPolarAngle = THREE.MathUtils.degToRad(68);
controles.minAzimuthAngle = THREE.MathUtils.degToRad(-75);
controles.maxAzimuthAngle = THREE.MathUtils.degToRad(75);
controles.minDistance = 7;
controles.maxDistance = 70;
controles.screenSpacePanning = false;
controles.target.set(0, 0.6, 0);
controles.addEventListener("change", () => {
  controles.target.x = THREE.MathUtils.clamp(controles.target.x, -7, 7);
  controles.target.z = THREE.MathUtils.clamp(controles.target.z, -5, 5);
  controles.target.y = 0.6;
});

// Câmeras prontas (elevação e azimute em graus). "rpg" é a vista inclinada dos jogos de bolso.
const CAMERAS = {
  rpg: { elev: 52, azim: 0 },
  isometrica: { elev: 35.3, azim: 45 },
  topo: { elev: 84, azim: 0 },
};
let cameraAtual = "rpg";
let transicao = null;
let deslocamento = { x: 0, y: 0 };

// Cantos da sala: o enquadramento garante que todos caibam na área livre da tela.
const CANTOS = [];
for (const x of [-8.25, 8.25]) for (const y of [0, 3]) for (const z of [-5.75, 5.75]) CANTOS.push(new THREE.Vector3(x, y, z));

function aplicarDeslocamento(d) {
  deslocamento = d;
  camera.setViewOffset(innerWidth, innerHeight, -d.x, -d.y, innerWidth, innerHeight);
}

// Área da tela não coberta pela interface (painel à direita / embaixo, barra, título no celular).
function areaLivre() {
  const W = innerWidth, H = innerHeight, area = { l: 0, t: 0, r: W, b: H };
  if (document.body.classList.contains("sem-ui")) return area;
  for (const el of document.querySelectorAll(".titulo, .painel, .barra")) {
    const r = el.getBoundingClientRect();
    if (!r.width) continue;
    if (el.matches(".painel") && r.left > W / 2) area.r = Math.min(area.r, r.left);
    else if (r.top > H / 2) area.b = Math.min(area.b, r.top);
    else if (r.width > W * 0.6) area.t = Math.max(area.t, r.bottom);
  }
  return area;
}

function calcularEnquadramento(nome) {
  const p = CAMERAS[nome] || CAMERAS.rpg;
  const el = THREE.MathUtils.degToRad(p.elev), az = THREE.MathUtils.degToRad(p.azim);
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  const alvo = new THREE.Vector3(0, 0.6, 0);
  const area = areaLivre(), margem = 14, W = innerWidth, H = innerHeight;
  const salvo = { pos: camera.position.clone(), quat: camera.quaternion.clone(), desloc: deslocamento };
  const medir = (dist) => {
    camera.position.copy(alvo).addScaledVector(dir, dist);
    camera.lookAt(alvo);
    camera.updateMatrixWorld();
    const b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
    for (const c of CANTOS) {
      const v = c.clone().project(camera);
      const px = ((v.x + 1) / 2) * W, py = ((1 - v.y) / 2) * H;
      b.x0 = Math.min(b.x0, px); b.x1 = Math.max(b.x1, px); b.y0 = Math.min(b.y0, py); b.y1 = Math.max(b.y1, py);
    }
    return b;
  };
  aplicarDeslocamento({ x: 0, y: 0 });
  let lo = 4, hi = 160;
  for (let i = 0; i < 32; i++) {
    const meio = (lo + hi) / 2, b = medir(meio);
    if (b.x1 - b.x0 <= area.r - area.l - 2 * margem && b.y1 - b.y0 <= area.b - area.t - 2 * margem) hi = meio; else lo = meio;
  }
  const b = medir(hi);
  const desloc = { x: (area.l + area.r) / 2 - (b.x0 + b.x1) / 2, y: (area.t + area.b) / 2 - (b.y0 + b.y1) / 2 };
  const resultado = { pos: camera.position.clone(), alvo, desloc, dist: hi };
  camera.position.copy(salvo.pos);
  camera.quaternion.copy(salvo.quat);
  aplicarDeslocamento(salvo.desloc);
  return resultado;
}

function irParaCamera(nome, instantaneo = false) {
  cameraAtual = CAMERAS[nome] ? nome : "rpg";
  const e = calcularEnquadramento(cameraAtual);
  controles.maxDistance = Math.max(40, e.dist * 1.6);
  if (instantaneo) {
    camera.position.copy(e.pos);
    controles.target.copy(e.alvo);
    aplicarDeslocamento(e.desloc);
    controles.update();
    transicao = null;
    return;
  }
  transicao = { de: camera.position.clone(), deAlvo: controles.target.clone(), deDesloc: { ...deslocamento }, para: e.pos, paraAlvo: e.alvo, paraDesloc: e.desloc, t: 0 };
}

// Luz: céu claro e chapado (estilo de bolso) + sol de frente-esquerda para dar volume e sombras.
cena.add(new THREE.HemisphereLight(0xfffaf0, 0xcfc4b4, 2.1));
const sol = new THREE.DirectionalLight(0xfff0d8, 1.9);
sol.position.set(-7, 14, 9);
sol.castShadow = true;
sol.shadow.mapSize.set(2048, 2048);
Object.assign(sol.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 50 });
sol.shadow.bias = -0.0008;
sol.shadow.normalBias = 0.02;
cena.add(sol);

function redimensionar() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(Math.ceil(w / escalaPixel), Math.ceil(h / escalaPixel), false);
  camera.aspect = w / h;
  aplicarDeslocamento(deslocamento);
}

// ---------------------------------------------------------------------------------------------
// Interface
const listaMesas = $("#lista-mesas");
const NOMES_DEMO = ["Pesquisadora", "Codificador", "Revisora", "Designer", "Analista"];
const STATUS_DEMO = ["trabalhando", "pensando", "trabalhando", "alerta", "concluido"];

function desenharPainel() {
  if (!agentes) return;
  const ocupadas = new Map(agentes.listar().map((a) => [a.mesa, a]));
  listaMesas.replaceChildren(...MESAS.map((m) => {
    const a = ocupadas.get(m.id);
    const li = document.createElement("li");
    li.dataset.mesa = m.id;
    li.style.setProperty("--cor", m.cor);
    const opcoes = Object.keys(STATUS).map((s) => `<option value="${s}" ${a?.status === s ? "selected" : ""}>${s === "nenhum" ? "sem balão" : STATUS[s].rotulo}</option>`).join("");
    li.innerHTML = a
      ? `<span class="chip">${m.id}</span>
         <span class="info"><b>${escapar(a.nome)}</b><small>${a.estado === "sentado" ? "na mesa" : a.estado === "entrando" ? "chegando…" : "saindo…"}</small></span>
         <select aria-label="Status do agente da mesa ${m.id}" data-acao="status">${opcoes}</select>
         <button data-acao="liberar" aria-label="Liberar mesa ${m.id}">✕</button>`
      : `<span class="chip">${m.id}</span>
         <span class="info"><b>Mesa ${m.id}</b><small>livre · ${m.nomeCor}</small></span>
         <button data-acao="alocar">Alocar</button>`;
    return li;
  }));
}

function escapar(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

listaMesas.addEventListener("click", (ev) => {
  const botao = ev.target.closest("button");
  if (!botao) return;
  const id = Number(botao.closest("li").dataset.mesa);
  if (botao.dataset.acao === "alocar") API.alocarAgente(id, { nome: NOMES_DEMO[id - 1] }).catch(aviso);
  if (botao.dataset.acao === "liberar") API.liberarMesa(id);
});
listaMesas.addEventListener("change", (ev) => {
  if (ev.target.dataset.acao !== "status") return;
  try { API.definirStatus(Number(ev.target.closest("li").dataset.mesa), ev.target.value); } catch (e) { aviso(e); }
});

function aviso(e) {
  const el = $("#aviso");
  el.textContent = e.message || String(e);
  el.hidden = false;
  clearTimeout(aviso.t);
  aviso.t = setTimeout(() => { el.hidden = true; }, 3500);
}

let cicloDemo = null;
$("#btn-demo").addEventListener("click", () => API.demonstracao());
$("#btn-esvaziar").addEventListener("click", () => API.esvaziar());
$("#sel-camera").addEventListener("change", (ev) => irParaCamera(ev.target.value));
$("#sel-pixel").addEventListener("change", (ev) => { escalaPixel = Number(ev.target.value); redimensionar(); });
$("#sel-pixel").value = String(escalaPixel);
if (params.get("ui") === "0") document.body.classList.add("sem-ui");

// Clique numa mesa (no 3D) destaca a linha dela no painel
const raio = new THREE.Raycaster();
let inicioToque = null;
canvas.addEventListener("pointerdown", (ev) => { inicioToque = [ev.clientX, ev.clientY]; });
canvas.addEventListener("pointerup", (ev) => {
  if (!inicioToque || Math.hypot(ev.clientX - inicioToque[0], ev.clientY - inicioToque[1]) > 5) return;
  raio.setFromCamera(new THREE.Vector2((ev.clientX / innerWidth) * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1), camera);
  const hit = raio.intersectObjects(escritorio.clicaveis, true)[0];
  let o = hit?.object;
  while (o && o.userData.mesaId == null) o = o.parent;
  if (!o) return;
  const li = listaMesas.querySelector(`li[data-mesa="${o.userData.mesaId}"]`);
  li?.classList.remove("piscar");
  void li?.offsetWidth;
  li?.classList.add("piscar");
  li?.scrollIntoView({ block: "nearest", behavior: "smooth" });
});

// ---------------------------------------------------------------------------------------------
// API pública
const API = {
  /** Lista as 5 mesas com o agente (se houver) e as coordenadas do assento no mundo 3D. */
  mesas() {
    const ocupadas = new Map(agentes.listar().map((a) => [a.mesa, a]));
    return MESAS.map((m) => {
      const e = escritorio.mesas.get(m.id);
      return {
        id: m.id, cor: m.cor, livre: !ocupadas.has(m.id), agente: ocupadas.get(m.id) || null,
        assento: { ...m.assento }, posicao: e.posAssento.toArray(),
      };
    });
  },
  /** alocarAgente(1, { nome: "Pesquisadora", visual: 1..5, status: "trabalhando" }) → Promise (resolve ao sentar) */
  alocarAgente: (mesaId, opcoes) => agentes.alocar(mesaId, opcoes),
  /** liberarMesa(1) → Promise (resolve quando o agente sai pela porta) */
  liberarMesa: (mesaId, opcoes) => agentes.liberar(mesaId, opcoes),
  /** definirStatus(1, "pensando") — trabalhando | pensando | alerta | concluido | ocioso | nenhum */
  definirStatus: (mesaId, status) => agentes.definirStatus(mesaId, status),
  status: Object.keys(STATUS),
  camera: (nome) => irParaCamera(nome),
  async demonstracao() {
    clearInterval(cicloDemo);
    const livres = API.mesas().filter((m) => m.livre);
    const chegadas = livres.map((m, i) => new Promise((ok) => setTimeout(() =>
      agentes.alocar(m.id, { nome: NOMES_DEMO[m.id - 1], status: STATUS_DEMO[m.id - 1] }).then(ok, ok), i * 700)));
    cicloDemo = setInterval(() => {
      const ocupados = agentes.listar().filter((a) => a.estado === "sentado");
      if (!ocupados.length) return;
      const a = ocupados[Math.floor(Math.random() * ocupados.length)];
      const opcoes = ["trabalhando", "trabalhando", "pensando", "alerta", "concluido", "ocioso"].filter((s) => s !== a.status);
      agentes.definirStatus(a.mesa, opcoes[Math.floor(Math.random() * opcoes.length)]);
    }, 2600);
    return Promise.all(chegadas);
  },
  esvaziar() {
    clearInterval(cicloDemo);
    return Promise.all(MESAS.map((m, i) => new Promise((ok) => setTimeout(() => agentes.liberar(m.id).then(ok), i * 250))));
  },
};

// Integração por iframe: parent.postMessage({ escritorio: "alocarAgente", args: [2, { nome: "X" }], id: 7 }, "*")
const PERMITIDOS = ["mesas", "alocarAgente", "liberarMesa", "definirStatus", "camera", "demonstracao", "esvaziar"];
addEventListener("message", (ev) => {
  const d = ev.data;
  if (!d || typeof d !== "object" || !PERMITIDOS.includes(d.escritorio)) return;
  const responder = (r) => ev.source?.postMessage({ escritorioResposta: d.id ?? null, ...r }, ev.origin === "null" ? "*" : ev.origin);
  Promise.resolve().then(() => API[d.escritorio](...(Array.isArray(d.args) ? d.args : [])))
    .then((resultado) => responder({ ok: true, resultado }), (e) => responder({ ok: false, erro: e.message }));
});

// ---------------------------------------------------------------------------------------------
let escritorio, agentes;
try {
  const R = await carregarRecursos(new URL("../assets/", import.meta.url).href);
  escritorio = construirEscritorio(cena, R);
  agentes = new Agentes(cena, R, escritorio, { camera, camadaRotulos: $("#rotulos"), aoMudar: desenharPainel });
  window.escritorio = API;
  desenharPainel();
  redimensionar();
  irParaCamera(params.get("camera") || "rpg", true);
  $("#sel-camera").value = cameraAtual;
  $("#carregando").hidden = true;
  document.body.classList.add("pronto");
  if (params.get("demo") === "1") API.demonstracao();
} catch (e) {
  $("#carregando").textContent = "Não foi possível carregar o escritório: " + e.message;
  throw e;
}

// Ao redimensionar, reenquadra a sala na câmera pronta atual
let esperaResize;
addEventListener("resize", () => {
  redimensionar();
  clearTimeout(esperaResize);
  esperaResize = setTimeout(() => irParaCamera(cameraAtual, true), 120);
});

const relogio = new THREE.Clock();
let t = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(relogio.getDelta(), 0.05);
  t += dt;
  if (transicao) {
    transicao.t = Math.min(1, transicao.t + dt / 0.7);
    const k = 1 - Math.pow(1 - transicao.t, 3);
    camera.position.lerpVectors(transicao.de, transicao.para, k);
    controles.target.lerpVectors(transicao.deAlvo, transicao.paraAlvo, k);
    aplicarDeslocamento({
      x: THREE.MathUtils.lerp(transicao.deDesloc.x, transicao.paraDesloc.x, k),
      y: THREE.MathUtils.lerp(transicao.deDesloc.y, transicao.paraDesloc.y, k),
    });
    if (transicao.t >= 1) transicao = null;
  }
  controles.update();
  escritorio.atualizar(t, dt, camera);
  agentes.atualizar(dt, innerWidth, innerHeight);
  renderer.render(cena, camera);
});
