// Monta o escritório 3D: sala recortada (sem teto e sem parede da frente, como os interiores
// dos RPGs de bolso), 5 mesas com cadeira/monitor/teclado, café, área de descanso e decoração.
import * as THREE from "three";
import { LARGURA, PROFUNDIDADE, ALTURA_PAREDE, MESAS, PORTA, tileParaMundo } from "./layout.js";
import { criarBillboard, PX } from "./recursos.js";

// Mesmas cores da paleta do pxl (arte/escritorio.px.js)
export const COR = {
  k: 0x262236, K: 0x3d3a52, u: 0x6f6a78, V: 0xa49e93, v: 0xd2cdc2, W: 0xebe8df, w: 0xfcfbf6,
  N: 0x8f5f37, n: 0xc08d55, O: 0xe2b97c, o: 0xf3d6a0, M: 0x5d6578, m: 0x9aa2b5,
  y: 0x2b7072, T: 0x46a89d, t: 0x7fd4c4, e: 0xffd85e, E: 0xd9a032, a: 0xf0a067, A: 0xc46d3d, b: 0x4a8fd6, r: 0xf2665c,
};

const CONTORNO = new THREE.MeshBasicMaterial({ color: COR.k, side: THREE.BackSide });

export function construirEscritorio(cena, R) {
  const materiais = new Map();
  const cor = (c) => {
    if (!materiais.has(c)) materiais.set(c, new THREE.MeshLambertMaterial({ color: c }));
    return materiais.get(c);
  };
  const tex = (nome, rx = 1, ry = 1) => new THREE.MeshLambertMaterial({ map: R.tex(nome, rx, ry) });
  const solidos = []; // objetos clicáveis / com sombra

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

  function plano(nome, w, h, x, y, z, { rotY = 0, basico = false, pai = cena, cor: tinta } = {}) {
    const map = R.tex(nome);
    const material = basico ? new THREE.MeshBasicMaterial({ map, alphaTest: 0.5 })
      : new THREE.MeshLambertMaterial({ map, alphaTest: 0.5 });
    if (tinta) material.color.set(tinta);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    mesh.receiveShadow = !basico;
    pai.add(mesh);
    return mesh;
  }

  function noChao(nome, w, d, x, z, { y = 0.004, opacidade = 1, tinta, pai = cena, rep = [1, 1] } = {}) {
    const translucido = opacidade < 1;
    const material = new THREE.MeshLambertMaterial({ map: R.tex(nome, ...rep), transparent: translucido, opacity: opacidade, depthWrite: !translucido, alphaTest: translucido ? 0 : 0.5 });
    if (tinta) material.color.set(tinta);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    pai.add(mesh);
    return mesh;
  }

  // Objeto em pixel art (billboard) com sombra oval no chão.
  function objeto(nome, x, y, z, { sombra = true, escalaSombra = 1, pai = cena } = {}) {
    const { w, h } = R.tamanho(nome);
    const s = criarBillboard(R.tex(nome), w, h);
    s.position.set(x, y, z);
    pai.add(s);
    if (sombra) {
      const sb = noChao("sombra", w * 0.9 * escalaSombra, 0.38 * escalaSombra, x, z + 0.04, { y: y + 0.006, opacidade: 0.22, pai });
      sb.material.color.set(0x000000);
    }
    return s;
  }

  // -------------------------------------------------------------------------------------------
  // SALA
  const meiaL = LARGURA / 2, meiaP = PROFUNDIDADE / 2, E = 0.25, H = ALTURA_PAREDE;

  noChao("piso_madeira", LARGURA, PROFUNDIDADE, 0, 0, { y: 0, rep: [LARGURA, PROFUNDIDADE] });

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
  for (const corte of cortes) {
    // a textura acompanha o corte: mostra só a faixa de baixo (rodapé + ripado)
    const face = corte.parede.material.find((m) => m.map);
    corte.mapa = face.map;
  }
  function cortarParede(corte, cortar) {
    if (corte.cortada === cortar) return;
    corte.cortada = cortar;
    const h = cortar ? ALTURA_CORTE : H;
    corte.parede.scale.y = h / H;
    corte.parede.position.y = h / 2;
    corte.mapa.repeat.y = h / H;
    corte.decoracao.forEach((d) => { d.visible = !cortar; });
  }

  // Mureta da frente (corte da parede), com vão na porta
  const porta0 = tileParaMundo(PORTA[0].col, 0).x - 0.5, porta1 = tileParaMundo(PORTA[PORTA.length - 1].col, 0).x + 0.5;
  const hM = 0.28;
  caixa(porta0 + meiaL + E, hM, E, { py: topo, resto: escuro }, (-meiaL - E + porta0) / 2, hM / 2, meiaP + E / 2, { contorno: false });
  caixa(meiaL + E - porta1, hM, E, { py: topo, resto: escuro }, (meiaL + E + porta1) / 2, hM / 2, meiaP + E / 2, { contorno: false });
  noChao("tapete_entrada", 2, 1, (porta0 + porta1) / 2, meiaP - 0.5);

  // Parede do fundo: janelões, letreiro
  for (const x of [-6, -3, 3, 6]) {
    plano("janela", 2, 26 / PX, x, 1.12 + 13 / PX, -meiaP + 0.006, { basico: true });
    caixa(2.12, 0.06, 0.14, cor(COR.w), x, 1.09, -meiaP + 0.07);
  }
  plano("letreiro", 46 / PX, 11 / PX, 0, 2.2, -meiaP + 0.006, { basico: true });
  cortes[1].decoracao.push(plano("relogio", 0.75, 0.75, meiaL - 0.006, 2.25, -3, { rotY: -Math.PI / 2 }));

  // Parede esquerda: quadro branco, estante, quadro de arte
  cortes[0].decoracao.push(plano("quadro_branco", 2.5, 1.5, -meiaL + 0.02, 1.62, -2.0, { rotY: Math.PI / 2 }));
  caixa(0.45, 36 / PX, 2, { px: tex("estante"), resto: cor(COR.W) }, -meiaL + 0.225, 18 / PX, 1.5);
  cortes[0].decoracao.push(plano("arte_1", 1, 1.25, -meiaL + 0.006, 1.6, 4.0, { rotY: Math.PI / 2 }));

  // Parede direita: quadro de arte sobre o sofá
  cortes[1].decoracao.push(plano("arte_2", 1, 1.25, meiaL - 0.006, 1.75, 2.0, { rotY: -Math.PI / 2 }));

  // Aparador sob o letreiro
  const ap = tileParaMundo(7, 0);
  caixa(1.9, 14 / PX, 0.6, { pz: tex("balcao", 2, 1), py: cor(COR.w), resto: cor(COR.W) }, ap.x + 0.5, 7 / PX, ap.z - 0.18);
  objeto("planta_mesa", ap.x + 1.05, 14 / PX, ap.z - 0.2, { sombra: false });
  caixa(0.3, 0.14, 0.24, cor(COR.b), ap.x + 0.1, 14 / PX + 0.07, ap.z - 0.2);
  caixa(0.3, 0.08, 0.24, cor(COR.r), ap.x + 0.12, 14 / PX + 0.18, ap.z - 0.2);

  // Plantas
  for (const [c, l, nome] of [[0, 0, "planta_grande"], [15, 0, "planta_grande"], [0, 9, "planta_media"], [15, 9, "planta_media"]]) {
    const p = tileParaMundo(c, l);
    objeto(nome, p.x, 0, p.z);
  }

  // -------------------------------------------------------------------------------------------
  // CAFÉ (parede direita, fundo)
  const bal = tileParaMundo(15, 2);
  caixa(0.7, 14 / PX, 3, { nx: tex("balcao", 3, 1), resto: cor(COR.W) }, meiaL - 0.35, 7 / PX, bal.z);
  caixa(0.78, 0.06, 3.06, cor(COR.w), meiaL - 0.39, 14 / PX + 0.03, bal.z);
  objeto("maquina_cafe", meiaL - 0.4, 14 / PX + 0.06, bal.z - 0.8, { sombra: false });
  cilindro(0.06, 0.12, cor(COR.w), meiaL - 0.5, 14 / PX + 0.12, bal.z + 0.1);
  cilindro(0.06, 0.12, cor(COR.t), meiaL - 0.35, 14 / PX + 0.12, bal.z + 0.3);
  cilindro(0.2, 0.08, cor(COR.n), meiaL - 0.4, 14 / PX + 0.1, bal.z + 0.9, { lados: 10 });
  for (const [dx, dz, c] of [[-0.06, -0.04, COR.r], [0.07, 0.02, COR.e], [0, 0.08, 0x9ad66f]]) {
    const fruta = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), cor(c));
    fruta.position.set(meiaL - 0.4 + dx, 14 / PX + 0.18, bal.z + 0.9 + dz);
    cena.add(fruta);
  }
  const beb = tileParaMundo(15, 4);
  objeto("bebedouro", beb.x + 0.05, 0, beb.z);

  // -------------------------------------------------------------------------------------------
  // ÁREA DE DESCANSO
  const sofa = tileParaMundo(15, 7);
  const tecido = (rx, ry) => tex("sofa_tecido", rx, ry);
  const sx = meiaL - 0.45;
  caixa(0.9, 0.36, 2.8, { py: tecido(1, 3), nx: tecido(3, 0.4), resto: cor(COR.T) }, sx, 0.24, sofa.z);
  caixa(0.24, 0.5, 2.8, { nx: tecido(3, 0.5), py: cor(COR.y), resto: cor(COR.T) }, meiaL - 0.12, 0.67, sofa.z);
  for (const s of [-1, 1]) caixa(0.9, 0.56, 0.18, { py: cor(COR.y), resto: tecido(1, 0.6) }, sx, 0.34, sofa.z + s * 1.31);
  for (const s of [-1, 0, 1]) caixa(0.7, 0.1, 0.84, { py: tecido(1, 1), resto: cor(COR.T) }, sx - 0.06, 0.47, sofa.z + s * 0.86);
  noChao("tapete_lounge", 3, 2, tileParaMundo(13, 7).x, sofa.z, { y: 0.005 });
  const mc = tileParaMundo(13, 7);
  caixa(0.95, 0.06, 0.62, cor(COR.o), mc.x, 0.36, mc.z);
  for (const [dx, dz] of [[-0.4, -0.24], [0.4, -0.24], [-0.4, 0.24], [0.4, 0.24]]) caixa(0.05, 0.33, 0.05, cor(COR.n), mc.x + dx, 0.165, mc.z + dz, { contorno: false });
  caixa(0.34, 0.02, 0.24, cor(COR.w), mc.x - 0.15, 0.4, mc.z + 0.05);
  cilindro(0.06, 0.12, cor(COR.a), mc.x + 0.25, 0.45, mc.z - 0.08);
  for (const [c, l, k] of [[12, 6, COR.e], [12, 8, COR.a]]) {
    const p = tileParaMundo(c, l);
    cilindro(0.3, 0.36, cor(k), p.x + 0.1, 0.18, p.z, { lados: 10 });
  }

  // -------------------------------------------------------------------------------------------
  // MESAS
  const mesas = new Map();
  for (const def of MESAS) {
    const centro = tileParaMundo(def.mesa.col, def.mesa.lin);
    const g = new THREE.Group();
    g.position.set(centro.x + 0.5, 0, centro.z);
    g.name = "mesa-" + def.id;
    g.userData.mesaId = def.id;
    cena.add(g);
    const corMesa = cor(new THREE.Color(def.cor).getHex());
    const corEscura = cor(new THREE.Color(def.corEscura).getHex());

    // tampo branco (2 x 1), pés pretos, painel frontal na cor da mesa
    caixa(2, 0.06, 1, { py: tex("mesa_tampo"), resto: cor(COR.W) }, 0, 0.72, 0, { pai: g });
    for (const s of [-1, 1]) caixa(0.06, 0.69, 0.86, cor(COR.K), s * 0.93, 0.345, 0, { pai: g });
    caixa(30 / PX, 10 / PX, 0.04, { pz: tex("mesa_painel_" + def.id), resto: cor(COR.W) }, 0, 0.06 + 5 / PX, 0.4, { pai: g });

    // monitor no lado esquerdo, virado para o assento
    const mon = new THREE.Group();
    mon.position.set(-0.42, 0.75, 0.1);
    mon.rotation.y = -0.3;
    g.add(mon);
    caixa(0.36, 0.025, 0.22, cor(COR.u), 0, 0.012, 0, { pai: mon, contorno: false });
    caixa(0.07, 0.2, 0.05, cor(COR.u), 0, 0.11, 0.02, { pai: mon, contorno: false });
    caixa(16 / PX, 10 / PX, 0.05, { pz: tex("monitor_costas"), resto: cor(COR.K) }, 0, 0.18 + 5 / PX, 0, { pai: mon });
    const codigo = R.tex("tela_codigo", 1, 8 / 32);
    const descanso = R.tex("tela_descanso");
    const tela = new THREE.Mesh(new THREE.PlaneGeometry(14 / PX, 8 / PX), new THREE.MeshBasicMaterial({ map: descanso }));
    tela.rotation.y = Math.PI;
    tela.position.set(0, 0.18 + 5 / PX, -0.027);
    mon.add(tela);

    // teclado, mouse e objetos pessoais
    caixa(14 / PX, 0.02, 5 / PX, { py: tex("teclado"), resto: cor(COR.K) }, 0.42, 0.76, -0.2, { pai: g, contorno: false });
    caixa(0.07, 0.03, 0.11, cor(COR.w), 0.86, 0.765, -0.18, { pai: g, contorno: false });
    const enfeite = def.id % 3;
    if (enfeite === 0) objeto("planta_mesa", 0.78, 0.75, 0.28, { sombra: false, pai: g });
    else if (enfeite === 1) { cilindro(0.055, 0.12, corMesa, 0.8, 0.81, 0.2, { pai: g }); caixa(0.32, 0.05, 0.24, cor(COR.w), 0.25, 0.775, 0.22, { pai: g }); }
    else { caixa(0.3, 0.06, 0.22, cor(COR.T), 0.75, 0.78, 0.22, { pai: g }); caixa(0.28, 0.05, 0.2, cor(COR.a), 0.76, 0.835, 0.22, { pai: g }); objeto("planta_mesa", 0.1, 0.75, 0.28, { sombra: false, pai: g }); }

    // cadeira no assento (encosto ao norte, agente olha para a câmera)
    const a = tileParaMundo(def.assento.col, def.assento.lin);
    const cad = new THREE.Group();
    cad.position.set(a.x, 0, a.z + 0.1);
    cena.add(cad);
    caixa(0.56, 0.04, 0.08, cor(COR.K), 0, 0.04, 0, { pai: cad, contorno: false });
    caixa(0.08, 0.04, 0.56, cor(COR.K), 0, 0.04, 0, { pai: cad, contorno: false });
    caixa(0.06, 0.36, 0.06, cor(COR.u), 0, 0.24, 0, { pai: cad, contorno: false });
    caixa(0.62, 0.1, 0.56, { py: tex("cadeira_" + def.id), resto: corEscura }, 0, 0.47, 0, { pai: cad });
    caixa(0.62, 0.5, 0.08, { pz: tex("cadeira_" + def.id), nz: tex("cadeira_" + def.id), resto: corEscura }, 0, 0.84, -0.27, { pai: cad });

    // seta de mesa livre (flutua sobre a cadeira enquanto ninguém está alocado)
    const seta = R.tamanho("seta_livre");
    const marcador = criarBillboard(R.tex("seta_livre"), seta.w, seta.h, { vies: 0.5 });
    marcador.material.color.set(def.cor);
    marcador.position.set(a.x, 1.5, a.z + 0.1);
    cena.add(marcador);

    let modoTela = "descanso", acumulado = 0;
    mesas.set(def.id, {
      ...def,
      grupo: g,
      cadeira: cad,
      marcador,
      // posição onde o agente fica sentado (pés), e tile do assento para o caminho
      posAssento: new THREE.Vector3(a.x, 0, a.z + 0.12),
      definirTela(modo) {
        modoTela = modo;
        tela.material.map = modo === "descanso" ? descanso : codigo;
        tela.material.needsUpdate = true;
      },
      atualizar(dt) {
        if (modoTela !== "codigo") return;
        acumulado += dt;
        if (acumulado > 0.22) { acumulado = 0; codigo.offset.y = (codigo.offset.y + 2 / 32) % 1; }
      },
    });
    solidos.push(g);
  }

  return {
    mesas,
    clicaveis: solidos,
    atualizar(t, dt, camera) {
      if (camera) for (const c of cortes) cortarParede(c, c.fora(camera.position));
      for (const m of mesas.values()) {
        m.atualizar(dt);
        m.marcador.position.y = 1.5 + 0.07 * Math.round(Math.sin(t * 4 + m.id) * 2) / 2;   // quica em degraus, como nos jogos
      }
    },
  };
}
