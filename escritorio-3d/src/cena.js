// Monta o escritório 3D: sala recortada (sem teto e sem parede da frente, como os interiores
// dos RPGs de bolso) com um posto temático para cada agente: 4 mesas, a ilha da copa, a
// poltrona da terapia, a poltrona da biblioteca e o tapete da academia.
import * as THREE from "three";
import { LARGURA, PROFUNDIDADE, ALTURA_PAREDE, POSTOS, PORTA, tileParaMundo } from "./layout.js";
import { AGENTES } from "./agentes-config.js";
import { criarBillboard, PX } from "./recursos.js";

// Mesmas cores da paleta do pxl (arte/escritorio.px.js)
export const COR = {
  k: 0x262236, K: 0x3d3a52, u: 0x6f6a78, V: 0xa49e93, v: 0xd2cdc2, W: 0xebe8df, w: 0xfcfbf6,
  N: 0x8f5f37, n: 0xc08d55, O: 0xe2b97c, o: 0xf3d6a0, M: 0x5d6578, m: 0x9aa2b5,
  y: 0x2b7072, T: 0x46a89d, t: 0x7fd4c4, e: 0xffd85e, E: 0xd9a032, a: 0xf0a067, A: 0xc46d3d, b: 0x4a8fd6, r: 0xf2665c,
};

// Como o agente fica em cada tipo de posto: altura do corpo e o quanto o sprite "vem para a frente"
const POR_TIPO = {
  mesa: { elevacao: 0.2, vies: 0.3, placaY: 0 },
  bancada: { elevacao: 0, vies: 0.3, placaY: 0.42 },
  poltrona: { elevacao: 0.22, vies: 0.35, placaY: 0.1 },
  academia: { elevacao: 0, vies: 0.15, placaY: 0 },
};

const CONTORNO = new THREE.MeshBasicMaterial({ color: COR.k, side: THREE.BackSide });

export function construirEscritorio(cena, R) {
  const materiais = new Map();
  const cor = (c) => {
    if (!materiais.has(c)) materiais.set(c, new THREE.MeshLambertMaterial({ color: c }));
    return materiais.get(c);
  };
  const tex = (nome, rx = 1, ry = 1) => new THREE.MeshLambertMaterial({ map: R.tex(nome, rx, ry) });

  // Caixa com material por face (px nx py ny pz nz) e contorno escuro por casco invertido.
  function caixa(w, h, d, mats, x, y, z, { sombra = true, contorno = true, pai = cena } = {}) {
    let m = mats;
    if (!(mats instanceof THREE.Material)) {
      const r = mats.resto || cor(COR.W);
      m = [mats.px || r, mats.nx || r, mats.py || r, mats.ny || r, mats.pz || r, mats.nz || r];
    }
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    mesh.castShadow = sombra;
    mesh.receiveShadow = true;
    if (contorno) {
      const e = 0.022;
      const casco = new THREE.Mesh(new THREE.BoxGeometry(w + 2 * e, h + 2 * e, d + 2 * e), CONTORNO);
      mesh.add(casco);
    }
    pai.add(mesh);
    return mesh;
  }

  function cilindro(r, h, material, x, y, z, { lados = 8, pai = cena } = {}) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, lados), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const casco = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.022, r + 0.022, h + 0.044, lados), CONTORNO);
    mesh.add(casco);
    pai.add(mesh);
    return mesh;
  }

  function plano(nome, w, h, x, y, z, { rotY = 0, basico = false, pai = cena } = {}) {
    const map = R.tex(nome);
    const material = basico ? new THREE.MeshBasicMaterial({ map, alphaTest: 0.5 })
      : new THREE.MeshLambertMaterial({ map, alphaTest: 0.5 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    mesh.receiveShadow = !basico;
    pai.add(mesh);
    return mesh;
  }

  function noChao(nome, w, d, x, z, { y = 0.004, opacidade = 1, pai = cena, rep = [1, 1] } = {}) {
    const translucido = opacidade < 1;
    const material = new THREE.MeshLambertMaterial({ map: R.tex(nome, ...rep), transparent: translucido, opacity: opacidade, depthWrite: !translucido, alphaTest: translucido ? 0 : 0.5 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    pai.add(mesh);
    return mesh;
  }

  // Objeto em pixel art (billboard) com sombra oval no chão.
  function objeto(nome, x, y, z, { sombra = true, escalaSombra = 1, pai = cena, vies } = {}) {
    const { w, h } = R.tamanho(nome);
    const s = criarBillboard(R.tex(nome), w, h, vies != null ? { vies } : undefined);
    s.position.set(x, y, z);
    pai.add(s);
    if (sombra) {
      const sb = noChao("sombra", w * 0.9 * escalaSombra, 0.38 * escalaSombra, x, z + 0.04, { y: y + 0.006, opacidade: 0.22, pai });
      sb.material.color.set(0x000000);
    }
    return s;
  }

  // Poltrona virada para a câmera (o agente senta nela de frente)
  function poltrona(nomeTecido, corLateral, x, z, pai) {
    const tecido = (rx, ry) => tex(nomeTecido, rx, ry);
    const lateral = cor(corLateral);
    caixa(0.78, 0.26, 0.7, { py: tecido(1, 1), pz: tecido(1, 0.4), resto: lateral }, x, 0.29, z, { pai });
    caixa(0.78, 0.62, 0.2, { pz: tecido(1, 0.8), py: lateral, resto: lateral }, x, 0.62, z - 0.3, { pai });
    for (const s of [-1, 1]) caixa(0.14, 0.42, 0.66, { py: tecido(0.3, 1), resto: lateral }, x + s * 0.42, 0.37, z + 0.02, { pai });
    for (const [dx, dz] of [[-0.34, -0.3], [0.34, -0.3], [-0.34, 0.28], [0.34, 0.28]]) caixa(0.06, 0.16, 0.06, cor(COR.N), x + dx, 0.08, z + dz, { pai, contorno: false });
  }

  const meiaL = LARGURA / 2, meiaP = PROFUNDIDADE / 2, E = 0.25, H = ALTURA_PAREDE;
  const mundo = (c, l) => tileParaMundo(c, l);

  // -------------------------------------------------------------------------------------------
  // SALA
  noChao("piso_madeira", LARGURA, PROFUNDIDADE, 0, 0, { y: 0, rep: [LARGURA, PROFUNDIDADE] });
  noChao("piso_cozinha", 4, 5, meiaL - 2, -meiaP + 2.5, { y: 0.002, rep: [4, 5] });   // copa (cols 12–15, lin 0–4)

  const topo = cor(COR.K), escuro = cor(COR.k);
  caixa(LARGURA, H, E, { pz: tex("parede", LARGURA, 1), py: topo, resto: escuro }, 0, H / 2, -meiaP - E / 2, { contorno: false });
  // Paredes laterais: quando a câmera gira para o lado de fora de uma delas, ela é "cortada"
  // na altura do rodapé (como nos jogos isométricos) para não esconder a sala.
  const paredeEsq = caixa(E, H, PROFUNDIDADE + E, { px: tex("parede", PROFUNDIDADE + E, 1), py: topo, resto: escuro }, -meiaL - E / 2, H / 2, -E / 2, { contorno: false });
  const paredeDir = caixa(E, H, PROFUNDIDADE + E, { nx: tex("parede", PROFUNDIDADE + E, 1), py: topo, resto: escuro }, meiaL + E / 2, H / 2, -E / 2, { contorno: false });
  const ALTURA_CORTE = 0.3;
  const cortes = [
    { parede: paredeEsq, decoracao: [], cortada: false, fora: (c) => c.x < -meiaL - 0.5 },
    { parede: paredeDir, decoracao: [], cortada: false, fora: (c) => c.x > meiaL + 0.5 },
  ];
  for (const corte of cortes) corte.mapa = corte.parede.material.find((m) => m.map).map;
  function cortarParede(corte, cortar) {
    if (corte.cortada === cortar) return;
    corte.cortada = cortar;
    const h = cortar ? ALTURA_CORTE : H;
    corte.parede.scale.y = h / H;
    corte.parede.position.y = h / 2;
    corte.mapa.repeat.y = h / H;      // a textura acompanha o corte: sobra a faixa do rodapé
    corte.decoracao.forEach((d) => { d.visible = !cortar; });
  }

  // Mureta da frente (corte da parede), com vão na porta
  const porta0 = mundo(PORTA[0].col, 0).x - 0.5, porta1 = mundo(PORTA[PORTA.length - 1].col, 0).x + 0.5;
  const hM = 0.28;
  caixa(porta0 + meiaL + E, hM, E, { py: topo, resto: escuro }, (-meiaL - E + porta0) / 2, hM / 2, meiaP + E / 2, { contorno: false });
  caixa(meiaL + E - porta1, hM, E, { py: topo, resto: escuro }, (meiaL + E + porta1) / 2, hM / 2, meiaP + E / 2, { contorno: false });
  noChao("tapete_entrada", 2, 1, (porta0 + porta1) / 2, meiaP - 0.5);

  // Parede do fundo: janelões e letreiro
  for (const x of [-6, -3, 3, 6]) {
    plano("janela", 2, 26 / PX, x, 1.12 + 13 / PX, -meiaP + 0.006, { basico: true });
    caixa(2.12, 0.06, 0.14, cor(COR.w), x, 1.09, -meiaP + 0.07);
  }
  plano("letreiro", 46 / PX, 11 / PX, 0, 2.2, -meiaP + 0.006, { basico: true });

  // Parede esquerda: relógio, quadro branco (sobre Finanças), quadro de arte (academia)
  cortes[0].decoracao.push(plano("relogio", 0.75, 0.75, -meiaL + 0.006, 2.25, -4.3, { rotY: Math.PI / 2 }));
  cortes[0].decoracao.push(plano("quadro_branco", 2.5, 1.5, -meiaL + 0.02, 1.62, -2.0, { rotY: Math.PI / 2 }));
  cortes[0].decoracao.push(plano("arte_1", 1, 1.25, -meiaL + 0.006, 1.75, 4.3, { rotY: Math.PI / 2 }));
  // Parede direita: cardápio (copa) e quadro de arte (terapia)
  cortes[1].decoracao.push(plano("cardapio", 1.5, 1.25, meiaL - 0.006, 1.9, -3.0, { rotY: -Math.PI / 2 }));
  cortes[1].decoracao.push(plano("arte_2", 1, 1.25, meiaL - 0.006, 1.75, 3.0, { rotY: -Math.PI / 2 }));

  // Aparador sob o letreiro
  const ap = mundo(7, 0);
  caixa(1.9, 14 / PX, 0.6, { pz: tex("balcao", 2, 1), py: cor(COR.w), resto: cor(COR.W) }, ap.x + 0.5, 7 / PX, ap.z - 0.18);
  objeto("planta_mesa", ap.x + 1.05, 14 / PX, ap.z - 0.2, { sombra: false });
  caixa(0.3, 0.14, 0.24, cor(COR.b), ap.x + 0.1, 14 / PX + 0.07, ap.z - 0.2);
  caixa(0.3, 0.08, 0.24, cor(COR.r), ap.x + 0.12, 14 / PX + 0.18, ap.z - 0.2);

  // Plantas: cantos do fundo, frente e a "cerca viva" que dá privacidade à terapia
  for (const [c, l, nome] of [[0, 0, "planta_grande"], [15, 0, "planta_grande"], [0, 10, "planta_media"], [15, 10, "planta_media"], [11, 6, "planta_media"], [11, 8, "planta_media"]]) {
    const p = mundo(c, l);
    objeto(nome, p.x, 0, p.z);
  }

  // Café na parede direita + bebedouro
  const bal = mundo(15, 2);
  caixa(0.7, 14 / PX, 3, { nx: tex("balcao", 3, 1), resto: cor(COR.W) }, meiaL - 0.35, 7 / PX, bal.z);
  caixa(0.78, 0.06, 3.06, cor(COR.w), meiaL - 0.39, 14 / PX + 0.03, bal.z);
  objeto("maquina_cafe", meiaL - 0.4, 14 / PX + 0.06, bal.z - 0.8, { sombra: false });
  cilindro(0.06, 0.12, cor(COR.w), meiaL - 0.5, 14 / PX + 0.12, bal.z + 0.1);
  cilindro(0.06, 0.12, cor(COR.t), meiaL - 0.35, 14 / PX + 0.12, bal.z + 0.3);
  const beb = mundo(15, 4);
  objeto("bebedouro", beb.x + 0.05, 0, beb.z);

  // Sofá da terapia (parede direita, virado para a sala) e tapete
  const sofaZ = mundo(15, 8).z;
  const tecido = (rx, ry) => tex("sofa_tecido", rx, ry);
  const sx = meiaL - 0.45;
  caixa(0.9, 0.36, 2.8, { py: tecido(1, 3), nx: tecido(3, 0.4), resto: cor(COR.T) }, sx, 0.24, sofaZ);
  caixa(0.24, 0.5, 2.8, { nx: tecido(3, 0.5), py: cor(COR.y), resto: cor(COR.T) }, meiaL - 0.12, 0.67, sofaZ);
  for (const s of [-1, 1]) caixa(0.9, 0.56, 0.18, { py: cor(COR.y), resto: tecido(1, 0.6) }, sx, 0.34, sofaZ + s * 1.31);
  for (const s of [-1, 0, 1]) caixa(0.7, 0.1, 0.84, { py: tecido(1, 1), resto: cor(COR.T) }, sx - 0.06, 0.47, sofaZ + s * 0.86);
  noChao("tapete_lounge", 3, 2, mundo(13, 7).x, mundo(13, 7).z + 0.2, { y: 0.005 });

  // -------------------------------------------------------------------------------------------
  // POSTOS DOS AGENTES
  const postos = new Map();
  const clicaveis = [];

  for (const def of POSTOS) {
    const agente = AGENTES.find((a) => a.id === def.id) || { id: def.id, nome: def.id, cor: "#ffffff", ativo: false };
    const g = new THREE.Group();
    g.name = "posto-" + def.id;
    g.userData.postoId = def.id;
    cena.add(g);
    clicaveis.push(g);

    const local = mundo(def.local.col, def.local.lin);
    const pos = new THREE.Vector3(local.x + (def.ajuste?.x || 0), 0, local.z + (def.ajuste?.z || 0));
    const corAgente = new THREE.Color(agente.cor);
    const corEscura = cor(corAgente.clone().multiplyScalar(0.72).getHex());
    let definirTela = () => {}, atualizarTela = () => {};

    if (def.tipo === "mesa") {
      const centro = mundo(def.mesa.col, def.mesa.lin);
      const m = new THREE.Group();
      m.position.set(centro.x + 0.5, 0, centro.z);
      g.add(m);
      // tampo branco (2 x 1), pés pretos, painel frontal com o ícone do agente
      caixa(2, 0.06, 1, { py: tex("mesa_tampo"), resto: cor(COR.W) }, 0, 0.72, 0, { pai: m });
      for (const s of [-1, 1]) caixa(0.06, 0.69, 0.86, cor(COR.K), s * 0.93, 0.345, 0, { pai: m });
      caixa(30 / PX, 10 / PX, 0.04, { pz: tex("painel_" + def.id), resto: cor(COR.W) }, 0, 0.06 + 5 / PX, 0.4, { pai: m });

      // monitor no lado esquerdo, virado para o assento
      const mon = new THREE.Group();
      mon.position.set(-0.42, 0.75, 0.1);
      mon.rotation.y = -0.3;
      m.add(mon);
      caixa(0.36, 0.025, 0.22, cor(COR.u), 0, 0.012, 0, { pai: mon, contorno: false });
      caixa(0.07, 0.2, 0.05, cor(COR.u), 0, 0.11, 0.02, { pai: mon, contorno: false });
      caixa(16 / PX, 10 / PX, 0.05, { pz: tex("monitor_costas"), resto: cor(COR.K) }, 0, 0.18 + 5 / PX, 0, { pai: mon });
      const codigo = R.tex("tela_codigo", 1, 8 / 32);
      const descanso = R.tex("tela_descanso");
      const tela = new THREE.Mesh(new THREE.PlaneGeometry(14 / PX, 8 / PX), new THREE.MeshBasicMaterial({ map: descanso }));
      tela.rotation.y = Math.PI;
      tela.position.set(0, 0.18 + 5 / PX, -0.027);
      mon.add(tela);
      let modo = "descanso", acumulado = 0;
      definirTela = (novo) => { modo = novo; tela.material.map = novo === "descanso" ? descanso : codigo; tela.material.needsUpdate = true; };
      atualizarTela = (dt) => {
        if (modo !== "codigo") return;
        acumulado += dt;
        if (acumulado > 0.22) { acumulado = 0; codigo.offset.y = (codigo.offset.y + 2 / 32) % 1; }
      };

      // teclado, mouse e o objeto que identifica o trabalho do agente
      caixa(14 / PX, 0.02, 5 / PX, { py: tex("teclado"), resto: cor(COR.K) }, 0.42, 0.76, -0.2, { pai: m, contorno: false });
      caixa(0.07, 0.03, 0.11, cor(COR.w), 0.86, 0.765, -0.18, { pai: m, contorno: false });
      const objetoDaMesa = { financas: "calculadora", investimentos: "cofrinho", agenda: "calendario_mesa", emails: "bandeja_cartas" }[def.id];
      if (objetoDaMesa) objeto(objetoDaMesa, 0.72, 0.75, 0.24, { sombra: false, pai: m });
      if (def.id === "financas") for (let i = 0; i < 3; i++) cilindro(0.07, 0.025, cor(COR.e), 0.3, 0.765 + i * 0.028, 0.28, { pai: m, lados: 10 });
      if (def.id === "investimentos") objeto("planta_mesa", 0.18, 0.75, 0.3, { sombra: false, pai: m });
      if (def.id === "agenda") cilindro(0.055, 0.12, cor(COR.a), 0.3, 0.81, 0.25, { pai: m });
      if (def.id === "emails") caixa(0.32, 0.05, 0.24, cor(COR.w), 0.25, 0.775, 0.24, { pai: m });

      // cadeira (encosto ao norte: o agente olha para a câmera)
      const cad = new THREE.Group();
      cad.position.set(local.x, 0, local.z + 0.1);
      g.add(cad);
      caixa(0.56, 0.04, 0.08, cor(COR.K), 0, 0.04, 0, { pai: cad, contorno: false });
      caixa(0.08, 0.04, 0.56, cor(COR.K), 0, 0.04, 0, { pai: cad, contorno: false });
      caixa(0.06, 0.36, 0.06, cor(COR.u), 0, 0.24, 0, { pai: cad, contorno: false });
      caixa(0.62, 0.1, 0.56, { py: tex("cadeira_" + def.id), resto: corEscura }, 0, 0.47, 0, { pai: cad });
      caixa(0.62, 0.5, 0.08, { pz: tex("cadeira_" + def.id), nz: tex("cadeira_" + def.id), resto: corEscura }, 0, 0.84, -0.27, { pai: cad });
      pos.z += 0.12;
    } else if (def.tipo === "bancada") {
      // ilha da copa: o agente fica atrás dela, de frente para a câmera
      const ilha = mundo(13, 2);
      caixa(1.9, 14 / PX, 0.8, { pz: tex("balcao", 2, 1), resto: cor(COR.W) }, ilha.x + 0.5, 7 / PX, ilha.z, { pai: g });
      caixa(2.0, 0.06, 0.9, cor(COR.w), ilha.x + 0.5, 14 / PX + 0.03, ilha.z, { pai: g });
      objeto("tabua_legumes", ilha.x + 0.2, 14 / PX + 0.06, ilha.z + 0.1, { sombra: false, pai: g });
      cilindro(0.2, 0.08, cor(COR.n), ilha.x + 1.05, 14 / PX + 0.1, ilha.z + 0.05, { lados: 10, pai: g });
      for (const [dx, dz, c] of [[-0.06, -0.04, COR.r], [0.07, 0.02, COR.e], [0, 0.08, 0x9ad66f]]) {
        const fruta = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), cor(c));
        fruta.position.set(ilha.x + 1.05 + dx, 14 / PX + 0.18, ilha.z + 0.05 + dz);
        g.add(fruta);
      }
    } else if (def.tipo === "poltrona") {
      if (def.id === "terapeuta") {
        poltrona("poltrona_terapeuta", COR.E, local.x, local.z, g);
        // mesinha com chá e lenços, ao lado
        const mt = mundo(14, 6);
        cilindro(0.26, 0.04, cor(COR.n), mt.x, 0.5, mt.z, { lados: 12, pai: g });
        cilindro(0.04, 0.48, cor(COR.N), mt.x, 0.25, mt.z, { lados: 6, pai: g });
        cilindro(0.06, 0.1, cor(COR.w), mt.x - 0.08, 0.57, mt.z + 0.05, { pai: g });
        caixa(0.18, 0.1, 0.12, { py: cor(COR.w), resto: cor(COR.b) }, mt.x + 0.1, 0.57, mt.z - 0.05, { pai: g });
      } else {
        // biblioteca: estante, luminária, pilha de livros e tapete redondo
        noChao("tapete_redondo", 2, 1.5, local.x - 0.1, local.z + 0.2, { y: 0.006, pai: g });
        poltrona("poltrona_aprendizado", COR.A, local.x, local.z, g);
        caixa(0.45, 36 / PX, 2, { px: tex("estante"), resto: cor(COR.W) }, -meiaL + 0.225, 18 / PX, mundo(0, 5).z + 0.5, { pai: g });
        const lum = mundo(1, 6), liv = mundo(3, 6);
        objeto("luminaria", lum.x + 0.05, 0, lum.z - 0.2, { pai: g, escalaSombra: 0.6 });
        objeto("pilha_livros", liv.x - 0.1, 0, liv.z, { pai: g, escalaSombra: 0.8 });
      }
    } else if (def.tipo === "academia") {
      // tapete de yoga (2 tiles), suporte de halteres, bola de pilates e kettlebell
      noChao("tapete_yoga", 1, 2, local.x, local.z + 0.5, { y: 0.006, pai: g });
      const rack = mundo(0, 8), bola = mundo(0, 9), kb = mundo(3, 9);
      objeto("rack_halteres", rack.x - 0.1, 0, rack.z, { pai: g });
      const esfera = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), cor(COR.t));
      esfera.position.set(bola.x - 0.05, 0.34, bola.z);
      esfera.castShadow = true;
      g.add(esfera);
      objeto("kettlebell", kb.x - 0.2, 0, kb.z, { pai: g, escalaSombra: 0.6 });
    }

    // Enquanto o agente não está no posto: seta (agente ativo) ou placa "EM BREVE" (futuro)
    const tipo = POR_TIPO[def.tipo];
    const tamSeta = R.tamanho("seta_livre");
    const seta = criarBillboard(R.tex("seta_livre"), tamSeta.w, tamSeta.h, { vies: 0.5 });
    seta.material.color.set(agente.cor);
    seta.position.set(pos.x, 1.5, pos.z);
    seta.userData.postoId = def.id;
    cena.add(seta);
    const tamPlaca = R.tamanho("placa_" + def.id);
    const placa = criarBillboard(R.tex("placa_" + def.id), tamPlaca.w, tamPlaca.h, { vies: 0.5 });
    placa.position.set(pos.x, tipo.placaY, pos.z);
    placa.userData.postoId = def.id;
    cena.add(placa);
    clicaveis.push(seta, placa);

    let ocupado = false;
    const posto = {
      ...def,
      agente,
      grupo: g,
      pos,
      elevacao: tipo.elevacao,
      vies: tipo.vies,
      // nome do posto vazio: acima da seta (agente ativo) ou da placa "EM BREVE" (futuro);
      // `altura` é medida na direção "para cima" da câmera, como o sprite aparece na tela
      rotulo: agente.ativo
        ? { base: new THREE.Vector3(pos.x, 1.5, pos.z), altura: tamSeta.h + 0.08 }
        : { base: new THREE.Vector3(pos.x, tipo.placaY, pos.z), altura: tamPlaca.h + 0.05 },
      get ocupado() { return ocupado; },
      ocupar(sim) {
        ocupado = sim;
        seta.visible = !sim && agente.ativo;
        placa.visible = !sim && !agente.ativo;
      },
      definirTela,
      atualizar(t, dt) {
        atualizarTela(dt);
        seta.position.y = 1.5 + (0.07 * Math.round(Math.sin(t * 4 + pos.x) * 2)) / 2;   // quica em degraus, como nos jogos
      },
    };
    posto.ocupar(false);
    postos.set(def.id, posto);
  }

  return {
    postos,
    clicaveis,
    atualizar(t, dt, camera) {
      if (camera) for (const c of cortes) cortarParede(c, c.fora(camera.position));
      for (const p of postos.values()) p.atualizar(t, dt);
    },
  };
}
