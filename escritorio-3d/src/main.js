// Escritório de Agentes — ponto de entrada.
// Renderiza em baixa resolução e amplia sem suavização (pixels nítidos), com a câmera inclinada
// dos RPGs de bolso. Expõe `window.escritorio` para chamar os agentes e mostrar o que fazem.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { carregarRecursos } from "./recursos.js";
import { construirEscritorio } from "./cena.js";
import { Agentes, STATUS, cimaDaCamera } from "./agentes.js";
import { LARGURA } from "./layout.js";
import { AGENTES } from "./agentes-config.js";
import { Conversas } from "./conversa.js";

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
  for (const el of document.querySelectorAll(".titulo, .painel, .barra, .conversa")) {
    const r = el.getBoundingClientRect();
    if (!r.width) continue;
    if (el.matches(".conversa")) { if (r.width < W * 0.7) area.l = Math.max(area.l, r.right); continue; }
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

// Aproxima a câmera de um posto (ao conversar com o agente), centralizado na área livre da tela
function focarPosto(id) {
  const posto = escritorio.postos.get(id);
  if (!posto) return;
  const p = CAMERAS[cameraAtual] || CAMERAS.rpg;
  const el = THREE.MathUtils.degToRad(p.elev), az = THREE.MathUtils.degToRad(p.azim);
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  const alvo = new THREE.Vector3(posto.pos.x, 0.6, posto.pos.z);
  const area = areaLivre();
  const desloc = { x: (area.l + area.r) / 2 - innerWidth / 2, y: (area.t + area.b) / 2 - innerHeight / 2 };
  const dist = THREE.MathUtils.clamp(8000 / Math.max(320, Math.min(area.r - area.l, area.b - area.t)), 11, 17);
  transicao = { de: camera.position.clone(), deAlvo: controles.target.clone(), deDesloc: { ...deslocamento },
    para: alvo.clone().addScaledVector(dir, dist), paraAlvo: alvo, paraDesloc: desloc, t: 0 };
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
const listaAtivos = $("#lista-ativos"), listaFuturos = $("#lista-futuros");
const ROTULO_ESTADO = { chegando: "chegando…", saindo: "saindo…" };
let simulacao = null, previa = false;

function linhaAgente(cfg) {
  const presente = agentes.obter(cfg.id);
  const li = document.createElement("li");
  li.dataset.id = cfg.id;
  li.className = cfg.ativo ? "" : "futuro";
  li.style.setProperty("--cor", cfg.cor);
  li.title = cfg.papel;
  const linkProjeto = /^https:\/\//.test(cfg.projeto || "")
    ? `<a class="botao" href="${escapar(cfg.projeto)}" target="_blank" rel="noopener" aria-label="Abrir o projeto de ${escapar(cfg.nome)} no Claude">Abrir</a>` : "";
  let situacao, controles;
  const conversa = conversas?.tem(cfg.id);
  if (conversa) {
    // o status vem da própria conversa; o painel mostra o último resumo do agente
    situacao = (presente && ROTULO_ESTADO[presente.estado]) || conversas.resumo(cfg.id) || (presente ? "presente" : "fora");
    li.title = `${cfg.papel}${conversas.resumo(cfg.id) ? `\nÚltimo resumo: ${conversas.resumo(cfg.id)}` : ""}`;
    controles = `<button type="button" data-acao="conversar">Conversar</button>${linkProjeto}${presente
      ? `<button type="button" data-acao="sair" class="icone" aria-label="${escapar(cfg.nome)} sai do escritório" title="Sair do escritório">✕</button>` : ""}`;
  } else if (presente) {
    const opcoes = Object.keys(STATUS).map((s) => `<option value="${s}" ${presente.status === s ? "selected" : ""}>${STATUS[s].rotulo}</option>`).join("");
    situacao = ROTULO_ESTADO[presente.estado] || (cfg.ativo ? "presente" : "prévia");
    controles = `<select aria-label="Status de ${escapar(cfg.nome)}" data-acao="status">${opcoes}</select>
      ${linkProjeto}<button type="button" data-acao="sair" class="icone" aria-label="${escapar(cfg.nome)} sai do escritório" title="Sair do escritório">✕</button>`;
  } else if (cfg.ativo) {
    situacao = "fora";
    controles = `${linkProjeto}<button type="button" data-acao="chegar">Chamar</button>`;
  } else {
    situacao = "em breve";
    controles = "";
  }
  li.innerHTML = `<img class="cracha" src="assets/icone_${cfg.id}.png" alt="" width="26" height="26">
    <span class="info"><b>${escapar(cfg.nome)}</b><small>${situacao}</small></span>
    <span class="acoes">${controles}</span>`;
  return li;
}

function desenharPainel() {
  if (!agentes) return;
  listaAtivos.replaceChildren(...AGENTES.filter((a) => a.ativo).map(linhaAgente));
  listaFuturos.replaceChildren(...AGENTES.filter((a) => !a.ativo).map(linhaAgente));
  $("#contagem-ativos").textContent = `${AGENTES.filter((a) => a.ativo && agentes.obter(a.id)).length} de ${AGENTES.filter((a) => a.ativo).length} presentes`;
  $("#btn-previa").textContent = previa ? "Ocultar prévia" : "Ver prévia";
  $("#btn-previa").setAttribute("aria-pressed", String(previa));
  $("#btn-simular").textContent = simulacao ? "■ Parar simulação" : "▶ Simular atividade";
  $("#btn-simular").setAttribute("aria-pressed", String(!!simulacao));
}

function escapar(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

for (const lista of [listaAtivos, listaFuturos]) {
  lista.addEventListener("click", (ev) => {
    const botao = ev.target.closest("button");
    if (!botao) return;
    const id = botao.closest("li").dataset.id;
    if (botao.dataset.acao === "chegar") API.chegar(id).catch(aviso);
    if (botao.dataset.acao === "conversar") API.conversar(id);
    if (botao.dataset.acao === "sair") API.sair(id);
  });
  lista.addEventListener("change", (ev) => {
    if (ev.target.dataset.acao !== "status") return;
    try { API.definirStatus(ev.target.closest("li").dataset.id, ev.target.value); } catch (e) { aviso(e); }
  });
}

function aviso(e) {
  const el = $("#aviso");
  el.textContent = e.message || String(e);
  el.hidden = false;
  clearTimeout(aviso.t);
  aviso.t = setTimeout(() => { el.hidden = true; }, 3500);
}

$("#btn-simular").addEventListener("click", () => API.simular(!simulacao));
$("#btn-previa").addEventListener("click", () => API.previaFuturos(!previa));
$("#sel-camera").addEventListener("change", (ev) => irParaCamera(ev.target.value));
$("#sel-pixel").addEventListener("change", (ev) => { escalaPixel = Number(ev.target.value); redimensionar(); });
$("#sel-pixel").value = String(escalaPixel);
if (params.get("ui") === "0") document.body.classList.add("sem-ui");

// Clique num posto ou num agente (no 3D) destaca a linha dele no painel
const raio = new THREE.Raycaster();
let inicioToque = null;
canvas.addEventListener("pointerdown", (ev) => { inicioToque = [ev.clientX, ev.clientY]; });
canvas.addEventListener("pointerup", (ev) => {
  if (!inicioToque || Math.hypot(ev.clientX - inicioToque[0], ev.clientY - inicioToque[1]) > 5) return;
  raio.setFromCamera(new THREE.Vector2((ev.clientX / innerWidth) * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1), camera);
  const hit = raio.intersectObjects([...agentes.sprites(), ...escritorio.clicaveis], true).find((h) => h.object.visible);
  let o = hit?.object;
  while (o && o.userData.postoId == null) o = o.parent;
  if (!o) return;
  if (conversas.tem(o.userData.postoId)) { API.conversar(o.userData.postoId); return; }
  const li = document.querySelector(`.lista-agentes li[data-id="${o.userData.postoId}"]`);
  li?.classList.remove("piscar");
  void li?.offsetWidth;
  li?.classList.add("piscar");
  li?.scrollIntoView({ block: "nearest", behavior: "smooth" });
});

// Nomes dos postos vazios (o agente presente mostra o próprio nome acima da cabeça)
const rotulosPostos = new Map();
function atualizarRotulosPostos() {
  for (const cfg of AGENTES) {
    const posto = escritorio.postos.get(cfg.id);
    if (!posto) continue;
    let el = rotulosPostos.get(cfg.id);
    if (!el) {
      el = document.createElement("div");
      el.className = "rotulo rotulo-posto";
      el.style.setProperty("--cor", cfg.cor);
      el.textContent = cfg.nome;
      $("#rotulos").appendChild(el);
      rotulosPostos.set(cfg.id, el);
    }
    const topo = posto.rotulo.base.clone().addScaledVector(cimaDaCamera(camera), posto.rotulo.altura).project(camera);
    const pe = posto.rotulo.base.clone().project(camera);
    const alturaPx = ((topo.y - pe.y) / 2) * innerHeight;
    el.style.display = !posto.ocupado && topo.z < 1 && alturaPx > 40 ? "" : "none";
    el.style.transform = `translate(${((topo.x + 1) / 2) * innerWidth}px, ${((1 - topo.y) / 2) * innerHeight}px) translate(-50%, -100%)`;
  }
}

// ---------------------------------------------------------------------------------------------
// API pública
const idDe = (x) => (typeof x === "number" ? AGENTES[x - 1]?.id : x);
const API = {
  /** Os agentes, com o posto (tile e posição 3D) e o que estão fazendo agora. */
  agentes() {
    return AGENTES.map((cfg) => {
      const presente = agentes.obter(cfg.id);
      const posto = escritorio.postos.get(cfg.id);
      return {
        id: cfg.id, nome: cfg.nome, papel: cfg.papel, cor: cfg.cor, ativo: cfg.ativo, projeto: cfg.projeto || null,
        presente: !!presente, estado: presente?.estado ?? "fora", status: presente?.status ?? null,
        posto: { tipo: posto.tipo, ...posto.local }, posicao: posto.pos.toArray(),
      };
    });
  },
  /** chegar("financas", { status: "trabalhando" }) → o agente entra pela porta e vai ao posto (Promise) */
  chegar: (id, opcoes) => agentes.alocar(idDe(id), opcoes),
  /** sair("financas") → o agente sai pela porta (Promise) */
  sair: (id, opcoes) => agentes.liberar(idDe(id), opcoes),
  /** definirStatus("financas", "alerta") — trabalhando | pensando | alerta | concluido | ocioso | nenhum */
  definirStatus: (id, status) => agentes.definirStatus(idDe(id), status),
  status: Object.keys(STATUS),
  camera: (nome) => irParaCamera(nome),
  /** Abre a conversa com o agente (para os que têm `conversa` em agentes-config.js). */
  conversar(id) {
    const agenteId = idDe(id);
    if (!conversas.tem(agenteId)) throw new Error(`${agenteId} ainda não tem conversa configurada`);
    return conversas.abrir(agenteId);
  },
  /** Liga/desliga a troca automática de status dos agentes presentes (demonstração). */
  simular(ligar = true) {
    clearInterval(simulacao);
    simulacao = null;
    if (ligar) {
      const trocar = () => {
        // quem tem conversa de verdade mostra o status que veio dela; a simulação não mexe
        const presentes = agentes.listar().filter((a) => a.estado === "no_posto" && !conversas.tem(a.posto));
        if (!presentes.length) return;
        const a = presentes[Math.floor(Math.random() * presentes.length)];
        const opcoes = ["trabalhando", "trabalhando", "pensando", "alerta", "concluido", "ocioso"].filter((s) => s !== a.status);
        agentes.definirStatus(a.posto, opcoes[Math.floor(Math.random() * opcoes.length)]);
      };
      simulacao = setInterval(trocar, 2200);
      trocar();
    }
    desenharPainel();
  },
  /** Mostra (ou esconde) os agentes que ainda vão ser criados, para ver o escritório completo. */
  previaFuturos(ligar = true) {
    previa = ligar;
    const futuros = AGENTES.filter((a) => !a.ativo);
    desenharPainel();
    return Promise.all(futuros.map((a, i) => new Promise((ok) => setTimeout(() => {
      const presente = agentes.obter(a.id);
      if (ligar && !presente) agentes.alocar(a.id, { status: "trabalhando" }).then(ok, ok);
      else if (!ligar && presente) agentes.liberar(a.id).then(ok, ok);
      else ok();
    }, i * 450))));
  },
};
// nomes antigos (primeira versão, com mesas numeradas) continuam funcionando
Object.assign(API, {
  mesas: API.agentes,
  alocarAgente: API.chegar,
  liberarMesa: API.sair,
  demonstracao: () => API.simular(true),
  esvaziar: () => Promise.all(AGENTES.map((a) => API.sair(a.id))),
});

// Integração por iframe: parent.postMessage({ escritorio: "definirStatus", args: ["financas", "alerta"], id: 7 }, "*")
const PERMITIDOS = ["agentes", "chegar", "sair", "definirStatus", "simular", "previaFuturos", "camera", "conversar",
  "mesas", "alocarAgente", "liberarMesa", "demonstracao", "esvaziar"];
addEventListener("message", (ev) => {
  const d = ev.data;
  if (!d || typeof d !== "object" || !PERMITIDOS.includes(d.escritorio)) return;
  const responder = (r) => ev.source?.postMessage({ escritorioResposta: d.id ?? null, ...r }, ev.origin === "null" ? "*" : ev.origin);
  Promise.resolve().then(() => API[d.escritorio](...(Array.isArray(d.args) ? d.args : [])))
    .then((resultado) => responder({ ok: true, resultado }), (e) => responder({ ok: false, erro: e.message }));
});

// ---------------------------------------------------------------------------------------------
let escritorio, agentes, conversas;
try {
  const R = await carregarRecursos(new URL("../assets/", import.meta.url).href);
  escritorio = construirEscritorio(cena, R);
  agentes = new Agentes(cena, R, escritorio, { camera, camadaRotulos: $("#rotulos"), aoMudar: desenharPainel });
  conversas = new Conversas({
    api: {
      presente: (id) => !!agentes.obter(id),
      chegar: (id) => { agentes.alocar(id).catch(() => {}); },
      definirStatus: (id, status) => { if (agentes.obter(id)) agentes.definirStatus(id, status); },
    },
    aoMudar: desenharPainel,
    // ao abrir a conversa a câmera se aproxima do agente; ao fechar, volta a mostrar a sala
    aoAbrirFechar: (aberta, id) => requestAnimationFrame(() => (aberta && innerWidth > 760 ? focarPosto(id) : irParaCamera(cameraAtual))),
  });
  window.escritorio = API;
  // os agentes ativos já começam no escritório (use ?vazio=1 para começar sem ninguém)
  if (params.get("vazio") !== "1")
    for (const cfg of AGENTES.filter((a) => a.ativo)) agentes.alocar(cfg.id, { entrarPelaPorta: false });
  desenharPainel();
  redimensionar();
  irParaCamera(params.get("camera") || "rpg", true);
  $("#sel-camera").value = cameraAtual;
  $("#carregando").hidden = true;
  document.body.classList.add("pronto");
  if (params.get("demo") === "1") API.simular(true);
  if (params.get("previa") === "1") API.previaFuturos(true);
  if (params.get("conversa")) API.conversar(params.get("conversa"));
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
  atualizarRotulosPostos();
  renderer.render(cena, camera);
});
