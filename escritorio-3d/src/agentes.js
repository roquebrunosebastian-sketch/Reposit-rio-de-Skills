// Agentes animados: entram pelo capacho, andam tile a tile (4 direções, como num RPG de bolso),
// vão até o próprio posto (mesa, ilha, poltrona ou tapete) e mostram o status num balão.
import * as THREE from "three";
import { PORTA, caminho, tileParaMundo, mundoParaTile } from "./layout.js";
import { criarBillboard, mostrarQuadro } from "./recursos.js";

// `animado`: o agente se mexe no posto (digita, gesticula, vira a página, faz agachamento...)
export const STATUS = {
  trabalhando: { balao: "balao_digitando", tela: "codigo", animado: true, rotulo: "trabalhando" },
  pensando: { balao: "balao_pensando", tela: "codigo", animado: false, rotulo: "pensando" },
  alerta: { balao: "balao_alerta", tela: "codigo", animado: false, rotulo: "alerta" },
  concluido: { balao: "balao_ok", tela: "descanso", animado: false, rotulo: "concluído" },
  ocioso: { balao: "balao_ocioso", tela: "descanso", animado: false, rotulo: "ocioso" },
  nenhum: { balao: null, tela: "codigo", animado: true, rotulo: "sem status" },
};

const VELOCIDADE = 3.4;           // tiles por segundo
const CICLO_PASSO = [0, 1, 0, 2];  // quadros do andar (parado, passo, parado, outro passo)
const VIES_ANDANDO = 0.15;

const _cima = new THREE.Vector3();
export function cimaDaCamera(camera) {
  return _cima.set(0, 1, 0).applyQuaternion(camera.quaternion);
}

// Quadros de cada pose no posto: folha usada, quadros quando animado e quadros por segundo
const POSES = {
  sentado: { folha: "sentado", animado: [0, 1], fps: 5, sentado: true },
  lendo: { folha: "lendo", animado: [0, 0, 0, 1], fps: 2, sentado: true, alternativa: "sentado" },
  em_pe: { folha: "frente", animado: [1, 0, 2, 0], fps: 4, sentado: false },
  exercitando: { folha: "exercitando", animado: [0, 1], fps: 2.5, sentado: false, alternativa: "frente" },
};

export class Agentes {
  constructor(cena, recursos, escritorio, { camera, camadaRotulos, aoMudar = () => {} }) {
    this.cena = cena;
    this.R = recursos;
    this.escritorio = escritorio;
    this.camera = camera;
    this.camadaRotulos = camadaRotulos;
    this.aoMudar = aoMudar;
    this.porPosto = new Map();
    this.saindo = new Set();
    this.portaAlternada = 0;
  }

  /** Traz o agente do posto `postoId`. Resolve quando ele chega ao posto. */
  alocar(postoId, { nome, visual, status = "nenhum", entrarPelaPorta = true } = {}) {
    const posto = this.escritorio.postos.get(postoId);
    if (!posto) return Promise.reject(new Error(`posto '${postoId}' não existe (use: ${[...this.escritorio.postos.keys()].join(", ")})`));
    if (this.porPosto.has(posto.id)) return Promise.reject(new Error(`${this.porPosto.get(posto.id).nome} já está no posto '${posto.id}'`));
    if (status && !STATUS[status]) return Promise.reject(new Error(`status '${status}' inválido: ${Object.keys(STATUS).join(", ")}`));

    // visual: outra folha gerada pelo pxl ("agente_<id>"); por padrão, a do próprio posto
    const folha = visual ? (String(visual).startsWith("agente_") ? String(visual) : "agente_" + visual) : "agente_" + posto.id;
    const info = this.R.manifesto[folha];
    if (!info) return Promise.reject(new Error(`visual '${folha}' não existe em assets/manifest.json`));

    const textura = this.R.tex(folha);
    const sprite = criarBillboard(textura, 1, 1.5, { vies: VIES_ANDANDO });
    sprite.userData.postoId = posto.id;
    const sombra = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.32),
      new THREE.MeshBasicMaterial({ map: this.R.tex("sombra"), color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
    sombra.rotation.x = -Math.PI / 2;
    const balao = new THREE.Sprite(new THREE.SpriteMaterial({ map: null, depthTest: false, transparent: true, alphaTest: 0.5 }));
    balao.center.set(-0.45, 0);   // à direita da cabeça, em espaço de tela
    balao.renderOrder = 10;
    balao.visible = false;
    this.cena.add(sprite, sombra, balao);

    const rotulo = document.createElement("div");
    rotulo.className = "rotulo";
    rotulo.style.setProperty("--cor", posto.agente.cor);
    this.camadaRotulos?.appendChild(rotulo);

    const agente = {
      posto, nome: nome || posto.agente.nome, folha, info, textura, sprite, sombra, balao, rotulo,
      estado: "chegando", rumo: Math.PI, relogio: 0, status: null,
      pos: new THREE.Vector3(), rota: [],
    };
    rotulo.textContent = agente.nome;

    if (entrarPelaPorta) {
      const porta = PORTA[this.portaAlternada++ % PORTA.length];
      const p = tileParaMundo(porta.col, porta.lin);
      agente.pos.set(p.x, 0, p.z + 1);                // começa do lado de fora, no vão da porta
      agente.rota = [porta, ...(caminho(porta, posto.local) || [])];
    } else {
      agente.pos.copy(posto.pos);
    }
    this.porPosto.set(posto.id, agente);
    this.definirStatus(posto.id, status || "nenhum");
    posto.ocupar(true);
    this._posicionar(agente);
    this.aoMudar();

    return new Promise((ok) => { agente.aoChegar = () => ok(this._resumo(agente)); if (!entrarPelaPorta) this._chegou(agente); });
  }

  /** O agente sai pela porta. Resolve quando ele some. */
  liberar(postoId, { sairPelaPorta = true } = {}) {
    const agente = this.porPosto.get(postoId);
    if (!agente) return Promise.resolve(null);
    const posto = agente.posto;
    this.porPosto.delete(posto.id);
    posto.ocupar(false);
    posto.definirTela("descanso");
    agente.balao.visible = false;
    agente.status = null;
    this.saindo.add(agente);
    const aindaChegando = agente.estado !== "no_posto";
    agente.estado = "saindo";
    this.aoMudar();
    agente.aoChegar?.();                             // quem esperava ele chegar não fica pendurado
    if (!sairPelaPorta) { this._remover(agente); return Promise.resolve(this._resumo(agente)); }
    const atual = aindaChegando ? mundoParaTile(agente.pos.x, agente.pos.z) : posto.local;
    const porta = PORTA.reduce((melhor, p) => (Math.abs(p.col - atual.col) < Math.abs(melhor.col - atual.col) ? p : melhor));
    const rota = caminho(atual, porta) || [];
    const fora = tileParaMundo(porta.col, porta.lin);
    agente.rota = [...rota, { saida: true, x: fora.x, z: fora.z + 1.2 }];
    agente.sprite.material.userData.vies.value = VIES_ANDANDO;
    return new Promise((ok) => { agente.aoSair = () => ok(this._resumo(agente)); });
  }

  definirStatus(postoId, status) {
    const agente = this.porPosto.get(postoId);
    if (!agente) throw new Error(`o agente do posto '${postoId}' não está no escritório`);
    const s = STATUS[status || "nenhum"];
    if (!s) throw new Error(`status '${status}' inválido: ${Object.keys(STATUS).join(", ")}`);
    agente.status = status || "nenhum";
    if (s.balao) {
      agente.balaoInfo = this.R.manifesto[s.balao];
      agente.balao.material.map = this.R.tex(s.balao);
      agente.balao.material.needsUpdate = true;
      const { w, h } = this.R.tamanho(s.balao);
      agente.balao.scale.set(w, h, 1);
    }
    agente.balao.visible = !!s.balao;
    if (agente.estado === "no_posto") agente.posto.definirTela(s.tela);
    this.aoMudar();
  }

  /** Agente presente no posto (ou null). */
  obter(postoId) {
    const a = this.porPosto.get(postoId);
    return a ? this._resumo(a) : null;
  }

  listar() {
    return [...this.porPosto.values()].map((a) => this._resumo(a));
  }

  /** Sprites dos agentes presentes (para o clique). */
  sprites() {
    return [...this.porPosto.values()].map((a) => a.sprite);
  }

  atualizar(dt, larguraTela, alturaTela) {
    for (const a of [...this.porPosto.values(), ...this.saindo]) {
      a.relogio += dt;
      if (a.estado === "chegando" || a.estado === "saindo") this._andar(a, dt);
      this._animar(a);
      this._posicionar(a, larguraTela, alturaTela);
    }
  }

  // ------------------------------------------------------------------------------------------
  _resumo(a) {
    return { posto: a.posto.id, nome: a.nome, status: a.status, estado: a.estado, visual: a.folha };
  }

  _andar(a, dt) {
    const alvo = a.rota[0];
    if (!alvo) {
      if (a.estado === "chegando") this._chegou(a);
      return;
    }
    const destino = alvo.saida ? alvo : { ...tileParaMundo(alvo.col, alvo.lin) };
    const ehPosto = !alvo.saida && a.estado === "chegando" && alvo.col === a.posto.local.col && alvo.lin === a.posto.local.lin;
    if (ehPosto) { destino.x = a.posto.pos.x; destino.z = a.posto.pos.z; a.sprite.material.userData.vies.value = a.posto.vies; }
    const dx = destino.x - a.pos.x, dz = destino.z - a.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.001) a.rumo = Math.atan2(dx, dz);   // 0 = sul (para a câmera padrão)
    const passo = VELOCIDADE * dt;
    if (dist <= passo) {
      a.pos.x = destino.x; a.pos.z = destino.z;
      a.rota.shift();
      if (alvo.saida) this._remover(a);
    } else {
      a.pos.x += (dx / dist) * passo;
      a.pos.z += (dz / dist) * passo;
    }
  }

  _chegou(a) {
    a.estado = "no_posto";
    a.rumo = 0;
    a.pos.copy(a.posto.pos);
    a.sprite.material.userData.vies.value = a.posto.vies;
    a.posto.definirTela(STATUS[a.status || "nenhum"].tela);
    this.aoMudar();
    a.aoChegar?.();
  }

  _remover(a) {
    this.saindo.delete(a);
    this.cena.remove(a.sprite, a.sombra, a.balao);
    a.sprite.material.dispose();
    a.sombra.material.dispose();
    a.balao.material.dispose();
    a.rotulo.remove();
    this.aoMudar();
    a.aoSair?.();
  }

  _quadro(a, folha) {
    const id = a.folha.replace("agente_", "");
    return folha ? a.info.rects[`_${folha}_${id}`] : undefined;
  }

  _animar(a) {
    let rect, indice, espelhar = false;
    if (a.estado === "no_posto") {
      const pose = POSES[a.posto.pose] || POSES.sentado;
      const propria = this._quadro(a, pose.folha);
      rect = propria || this._quadro(a, pose.alternativa);
      const ciclo = STATUS[a.status || "nenhum"].animado && propria ? pose.animado : [0];
      indice = ciclo[Math.floor(a.relogio * pose.fps) % ciclo.length];
    } else {
      // direção relativa à câmera: girando a câmera, o sprite certo (frente/costas/lado) aparece
      const direcao = this._direcaoNaTela(a.rumo ?? Math.PI);
      rect = this._quadro(a, direcao === "esquerda" || direcao === "direita" ? "lado" : direcao);
      espelhar = direcao === "direita";
      indice = CICLO_PASSO[Math.floor(a.relogio * 7) % 4];
    }
    mostrarQuadro(a.textura, rect, a.info.w, a.info.h, indice, espelhar);

    if (a.balao.visible && a.balaoInfo) {
      const n = a.balaoInfo.quadros;
      const q = n > 1 ? Math.floor(a.relogio * a.balaoInfo.fps) % n : 0;
      const t = a.balao.material.map;
      t.repeat.set(1 / n, 1);
      t.offset.set(q / n, 0);
    }
  }

  _direcaoNaTela(rumo) {
    this.camera.getWorldDirection(this._olhar ||= new THREE.Vector3());
    const azimuteCamera = Math.atan2(-this._olhar.x, -this._olhar.z);
    let ang = rumo - azimuteCamera;
    ang = Math.atan2(Math.sin(ang), Math.cos(ang));
    if (Math.abs(ang) <= Math.PI / 4) return "frente";
    if (Math.abs(ang) >= (3 * Math.PI) / 4) return "costas";
    return ang > 0 ? "direita" : "esquerda";
  }

  _posicionar(a, larguraTela, alturaTela) {
    const noPosto = a.estado === "no_posto";
    const pose = POSES[a.posto.pose] || POSES.sentado;
    const sentado = noPosto && pose.sentado;
    const elevacao = noPosto ? a.posto.elevacao : 0;
    a.sprite.position.set(a.pos.x, elevacao, a.pos.z);
    a.sombra.position.set(a.pos.x, 0.012, a.pos.z + 0.02);
    a.sombra.visible = !sentado;
    const pulo = a.status === "alerta" ? Math.abs(Math.sin(a.relogio * 6)) * 0.08 : 0;
    a.balao.position.set(a.pos.x, elevacao + 0.95 + pulo, a.pos.z);
    if (larguraTela && this.camera) {
      // o sprite fica "em pé" na tela: o topo da cabeça está na direção "para cima" da câmera
      const pe = new THREE.Vector3(a.pos.x, elevacao, a.pos.z);
      const topo = pe.clone().addScaledVector(cimaDaCamera(this.camera), sentado ? 1.4 : 1.56).project(this.camera);
      pe.project(this.camera);
      // nome só aparece quando o agente está grande o bastante na tela (evita amontoar no zoom aberto)
      const alturaPx = ((topo.y - pe.y) / 2) * alturaTela;
      a.rotulo.style.transform = `translate(${((topo.x + 1) / 2) * larguraTela}px, ${((1 - topo.y) / 2) * alturaTela}px) translate(-50%, -100%)`;
      a.rotulo.style.display = topo.z < 1 && alturaPx > 38 ? "" : "none";
    }
  }
}
