// Agentes animados: entram pelo capacho, andam tile a tile (4 direções, como num RPG de bolso),
// sentam na mesa alocada e mostram o status num balão acima da cabeça.
import * as THREE from "three";
import { PORTA, caminho, tileParaMundo, mundoParaTile } from "./layout.js";
import { criarBillboard, mostrarQuadro } from "./recursos.js";

export const STATUS = {
  trabalhando: { balao: "balao_digitando", tela: "codigo", digitando: true, rotulo: "trabalhando" },
  pensando: { balao: "balao_pensando", tela: "codigo", digitando: false, rotulo: "pensando" },
  alerta: { balao: "balao_alerta", tela: "codigo", digitando: false, rotulo: "precisa de atenção" },
  concluido: { balao: "balao_ok", tela: "descanso", digitando: false, rotulo: "concluído" },
  ocioso: { balao: "balao_ocioso", tela: "descanso", digitando: false, rotulo: "ocioso" },
  nenhum: { balao: null, tela: "codigo", digitando: true, rotulo: "" },
};

const VELOCIDADE = 3.4;          // tiles por segundo
const CICLO_PASSO = [0, 1, 0, 2]; // quadros do andar (parado, passo, parado, outro passo)
const ELEVACAO_SENTADO = 0.2;     // o corpo sobe com o assento da cadeira
const VIES_SENTADO = 0.3;         // o assento não cobre o agente; a mesa à frente, sim

export class Agentes {
  constructor(cena, recursos, escritorio, { camera, camadaRotulos, aoMudar = () => {} }) {
    this.cena = cena;
    this.R = recursos;
    this.escritorio = escritorio;
    this.camera = camera;
    this.camadaRotulos = camadaRotulos;
    this.aoMudar = aoMudar;
    this.porMesa = new Map();
    this.saindo = new Set();
    this.portaAlternada = 0;
  }

  /** Aloca um agente na mesa. Resolve quando ele sentar. */
  alocar(mesaId, { nome, visual, status = "trabalhando", entrarPelaPorta = true } = {}) {
    const mesa = this.escritorio.mesas.get(Number(mesaId));
    if (!mesa) return Promise.reject(new Error(`mesa ${mesaId} não existe (use 1 a 5)`));
    if (this.porMesa.has(mesa.id)) return Promise.reject(new Error(`mesa ${mesa.id} já está ocupada por ${this.porMesa.get(mesa.id).nome}`));
    if (status && !STATUS[status]) return Promise.reject(new Error(`status '${status}' inválido: ${Object.keys(STATUS).join(", ")}`));

    // visual: 1..5 (agentes de demonstração) ou o nome de outra folha gerada pelo pxl ("agente_<id>")
    const folha = typeof visual === "string" && visual.startsWith("agente_") ? visual : "agente_" + (visual || mesa.id);
    const info = this.R.manifesto[folha];
    if (!info) return Promise.reject(new Error(`visual '${visual}' não existe (use 1 a 5)`));

    const textura = this.R.tex(folha);
    const sprite = criarBillboard(textura, 1, 1.5);
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
    rotulo.style.setProperty("--cor", mesa.cor);
    this.camadaRotulos?.appendChild(rotulo);

    const agente = {
      mesa, nome: nome || `Agente ${mesa.id}`, folha, info, textura, sprite, sombra, balao, rotulo,
      estado: "entrando", rumo: Math.PI, relogio: 0, status: null,
      pos: new THREE.Vector3(), rota: [],
    };
    rotulo.textContent = agente.nome;

    if (entrarPelaPorta) {
      const porta = PORTA[this.portaAlternada++ % PORTA.length];
      const p = tileParaMundo(porta.col, porta.lin);
      agente.pos.set(p.x, 0, p.z + 1);                // começa do lado de fora, no vão da porta
      agente.rota = [porta, ...(caminho(porta, mesa.assento) || [])];
    } else {
      agente.pos.copy(mesa.posAssento);
      agente.rota = [];
    }
    this.porMesa.set(mesa.id, agente);
    this.definirStatus(mesa.id, status || "nenhum");
    mesa.marcador.visible = false;
    this._posicionar(agente);
    this.aoMudar();

    return new Promise((ok) => { agente.aoSentar = () => ok(this._resumo(agente)); if (!entrarPelaPorta) this._sentar(agente); });
  }

  /** Libera a mesa: o agente levanta e sai pela porta. Resolve quando ele sair. */
  liberar(mesaId, { sairPelaPorta = true } = {}) {
    const agente = this.porMesa.get(Number(mesaId));
    if (!agente) return Promise.resolve(null);
    this.porMesa.delete(agente.mesa.id);
    agente.mesa.marcador.visible = true;
    agente.mesa.definirTela("descanso");
    agente.balao.visible = false;
    agente.status = null;
    this.saindo.add(agente);
    this.aoMudar();
    const aindaChegando = agente.estado !== "sentado";
    agente.estado = "saindo";
    agente.aoSentar?.();                              // quem esperava ele sentar não fica pendurado
    if (!sairPelaPorta) { this._remover(agente); return Promise.resolve(this._resumo(agente)); }
    const atual = aindaChegando ? mundoParaTile(agente.pos.x, agente.pos.z) : agente.mesa.assento;
    const porta = PORTA.reduce((melhor, p) => (Math.abs(p.col - atual.col) < Math.abs(melhor.col - atual.col) ? p : melhor));
    const rota = caminho(atual, porta) || [];
    const fora = tileParaMundo(porta.col, porta.lin);
    agente.rota = [...rota, { saida: true, x: fora.x, z: fora.z + 1.2 }];
    agente.sprite.material.userData.vies.value = 0.15;
    return new Promise((ok) => { agente.aoSair = () => ok(this._resumo(agente)); });
  }

  definirStatus(mesaId, status) {
    const agente = this.porMesa.get(Number(mesaId));
    if (!agente) throw new Error(`mesa ${mesaId} está livre`);
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
    if (agente.estado === "sentado") agente.mesa.definirTela(s.tela);
    this.aoMudar();
  }

  listar() {
    return [...this.porMesa.values()].map((a) => this._resumo(a));
  }

  atualizar(dt, larguraTela, alturaTela) {
    for (const a of [...this.porMesa.values(), ...this.saindo]) {
      a.relogio += dt;
      if (a.estado === "entrando" || a.estado === "saindo") this._andar(a, dt);
      this._animar(a);
      this._posicionar(a, larguraTela, alturaTela);
    }
  }

  // ------------------------------------------------------------------------------------------
  _resumo(a) {
    return { mesa: a.mesa.id, nome: a.nome, status: a.status, estado: a.estado, visual: a.folha };
  }

  _andar(a, dt) {
    const alvo = a.rota[0];
    if (!alvo) {
      if (a.estado === "entrando") this._sentar(a);
      return;
    }
    const destino = alvo.saida ? alvo : { ...tileParaMundo(alvo.col, alvo.lin) };
    const ehAssento = !alvo.saida && alvo.col === a.mesa.assento.col && alvo.lin === a.mesa.assento.lin && a.estado === "entrando";
    if (ehAssento) { destino.x = a.mesa.posAssento.x; destino.z = a.mesa.posAssento.z; a.sprite.material.userData.vies.value = VIES_SENTADO; }
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

  _sentar(a) {
    a.estado = "sentado";
    a.rumo = 0;
    a.pos.copy(a.mesa.posAssento);
    a.sprite.material.userData.vies.value = VIES_SENTADO;
    a.mesa.definirTela(STATUS[a.status || "nenhum"].tela);
    this.aoMudar();
    a.aoSentar?.();
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

  _animar(a) {
    const rects = a.info.rects;
    const id = a.folha.replace("agente_", "");
    let pose, indice, espelhar = false;
    if (a.estado === "sentado") {
      pose = "sentado";
      const s = STATUS[a.status || "nenhum"];
      indice = s.digitando ? Math.floor(a.relogio * 5) % 2 : 0;
    } else {
      // direção relativa à câmera: girando a câmera, o sprite certo (frente/costas/lado) aparece
      const direcao = this._direcaoNaTela(a.rumo ?? Math.PI);
      pose = direcao === "esquerda" || direcao === "direita" ? "lado" : direcao;
      espelhar = direcao === "direita";
      indice = CICLO_PASSO[Math.floor(a.relogio * 7) % 4];
    }
    mostrarQuadro(a.textura, rects[`_${pose}_${id}`], a.info.w, a.info.h, indice, espelhar);

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
    const sentado = a.estado === "sentado";
    const elevacao = sentado ? ELEVACAO_SENTADO : 0;
    a.sprite.position.set(a.pos.x, elevacao, a.pos.z);
    a.sombra.position.set(a.pos.x, 0.012, a.pos.z + 0.02);
    a.sombra.visible = !sentado;
    const pulo = a.status === "alerta" ? Math.abs(Math.sin(a.relogio * 6)) * 0.08 : 0;
    a.balao.position.set(a.pos.x, elevacao + 0.95 + pulo, a.pos.z);
    if (larguraTela && this.camera) {
      const topo = new THREE.Vector3(a.pos.x, elevacao + 1.58, a.pos.z).project(this.camera);
      const pe = new THREE.Vector3(a.pos.x, elevacao, a.pos.z).project(this.camera);
      // nome só aparece quando o agente está grande o bastante na tela (evita amontoar no zoom aberto)
      const alturaPx = ((topo.y - pe.y) / 2) * alturaTela;
      a.rotulo.style.transform = `translate(${((topo.x + 1) / 2) * larguraTela}px, ${((1 - topo.y) / 2) * alturaTela}px) translate(-50%, -100%)`;
      a.rotulo.style.display = topo.z < 1 && alturaPx > 32 ? "" : "none";
    }
  }
}

