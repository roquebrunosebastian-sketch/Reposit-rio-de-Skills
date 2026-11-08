// escritorio.px.js — arte do Escritório de Agentes (DSL da skill pxl-pixel-art)
//
// Linguagem visual de RPG de bolso (padrão dos jogos Pokémon de GBA/DS): grade de 16 px por
// tile, visão 3/4 de cima, paleta clara e saturada, contornos escuros e sombreamento em 2–4 tons.
// Toda a arte é original: nada de pokébolas, criaturas, logotipos ou tiles dos jogos.
//
// Gerar:  node ferramentas/pxl-lite.mjs build arte/escritorio.px.js --out assets
// Escala: 16 px = 1 unidade (1 tile) no mundo 3D.

pal({
  // contornos e neutros (paredes, mesas, metal)
  k: "#262236", K: "#3d3a52", u: "#6f6a78", V: "#a49e93", v: "#d2cdc2", W: "#ebe8df", w: "#fcfbf6",
  // carvalho claro (piso, ripados)
  N: "#8f5f37", n: "#c08d55", O: "#e2b97c", o: "#f3d6a0",
  // teal — cor de destaque do escritório
  y: "#2b7072", T: "#46a89d", t: "#7fd4c4",
  // verdes (plantas)
  d: "#2f7040", G: "#58ad4f", g: "#9ad66f",
  // céu, vidro e azuis
  B: "#2f5a9e", b: "#4a8fd6", S: "#7cc4ef", s: "#bfe8fa",
  // cores das 5 mesas
  R: "#b83f45", r: "#f2665c", E: "#d9a032", e: "#ffd85e", P: "#7d5bbf", p: "#b995ea",
  // terracota e rosa
  A: "#c46d3d", a: "#f0a067", L: "#c4628f", l: "#f59ac0",
  // peles e cabelos
  C: "#eaa983", c: "#ffdcb8", Q: "#c98a5e", q: "#e8b88a", F: "#7d4f33", f: "#a8714c",
  H: "#432a1e", h: "#6b4430",
  // tela dos monitores
  z: "#1b2438", Z: "#2c3a5a", i: "#c9f4ff",
  // metal
  M: "#5d6578", m: "#9aa2b5",
  // roupa base dos agentes (trocada por swap em cada mesa)
  X: "#b83f45", x: "#f2665c", J: "#283358", j: "#3b4a78",
})

ramps("kKuVvWw", "kNnOo", "yTt", "dGg", "BbSs", "Rr", "Ee", "Pp", "Aa", "Cc", "Qq", "Ff", "Hh", "zZ", "kMm", "Xx", "Jj", "Ll")

// Os 8 agentes: cor de destaque (camisa, cadeira, painel, placa) e aparência (cabelo h/H, pele c/C)
const AGENTES = {
  financas: { cor: { x: "G", X: "d" }, visual: {} },
  investimentos: { cor: { x: "b", X: "B" }, visual: { h: "K", H: "k", c: "q", C: "Q" } },
  terapeuta: { cor: { x: "p", X: "P" }, visual: { h: "a", H: "A" } },
  agenda: { cor: { x: "a", X: "A" }, visual: { h: "e", H: "E" } },
  emails: { cor: { x: "r", X: "R" }, visual: { h: "K", H: "k", c: "f", C: "F" } },
  nutricao: { cor: { x: "e", X: "E" }, visual: { h: "H", H: "k", c: "q", C: "Q" } },
  exercicios: { cor: { x: "t", X: "T" }, visual: { h: "N", H: "k", c: "f", C: "F" } },
  aprendizado: { cor: { x: "l", X: "L" }, visual: { h: "v", H: "V" } },
}
const IDS = Object.keys(AGENTES)
const MESAS = ["financas", "investimentos", "agenda", "emails"]

// Ícones de 7x7 (brancos; ganham a placa colorida de cada agente)
const ICONES = {
  financas: `
    ...w...
    .wwwww.
    ww.w...
    .wwwww.
    ...w.ww
    .wwwww.
    ...w...`,
  investimentos: `
    ...wwww
    .....ww
    w...w.w
    ww.w...
    w.w....
    w......
    wwwwwww`,
  terapeuta: `
    .ww.ww.
    wwwwwww
    wwwwwww
    wwwwwww
    .wwwww.
    ..www..
    ...w...`,
  agenda: `
    .w...w.
    wwwwwww
    w.....w
    w.w.w.w
    w.....w
    w.w.w.w
    wwwwwww`,
  emails: `
    wwwwwww
    ww...ww
    w.w.w.w
    w..w..w
    w.....w
    w.....w
    wwwwwww`,
  nutricao: `
    ....w..
    ...w...
    .ww.ww.
    wwwwwww
    wwwwwww
    .wwwww.
    ..w.w..`,
  exercicios: `
    .......
    w.....w
    ww...ww
    wwwwwww
    ww...ww
    w.....w
    .......`,
  aprendizado: `
    .wwwww.
    .w...ww
    .w.w.ww
    .w...ww
    .w.w.ww
    .w...ww
    .wwwwww`,
}

// Gerador determinístico (a arte sai igual a cada build)
let semente = 11
const rnd = () => (semente = (semente * 16807) % 2147483647) / 2147483647

// =============================================================================================
// PISO E PAREDES (texturas que se repetem)

// Tábuas de carvalho de 4 px com emendas desencontradas, como um piso de verdade.
sprite("piso_madeira", { w: 16, h: 16 },
  rect(0, 0, 16, 16, "o"),
  (c) => { for (let i = 0; i < 4; i++) c.hline(0, i * 4 + 3, 16, "O") },
  (c) => [10, 3, 13, 7].forEach((x, i) => { c.vline(x, i * 4, 3, "O"); c.px(x, i * 4 + 3, "n") }),
  hline(1, 1, 3, "O"), hline(5, 5, 2, "O"), hline(14, 9, 2, "O"), hline(9, 13, 3, "O"))

// Parede (3 tiles de altura): reboco branco, friso, ripado de madeira acústico e rodapé escuro.
sprite("parede", { w: 16, h: 48 },
  rect(0, 0, 16, 48, "w"),
  hline(0, 0, 16, "v"), hline(0, 1, 16, "W"),          // sombra junto ao teto
  hline(0, 30, 16, "W"), hline(0, 31, 16, "v"),        // friso
  (c) => { for (let x = 0; x < 16; x++) c.vline(x, 32, 14, ["n", "O", "o", "o"][x % 4]) },
  hline(0, 32, 16, "N"),
  hline(0, 46, 16, "u"), hline(0, 47, 16, "K"))

// Janelão com vista da cidade.
sprite("janela", { w: 32, h: 26 },
  rect(0, 0, 32, 26, "s"), rect(0, 0, 32, 9, "S"), dither(0, 9, 32, 2, "S", 0.5),
  ellipse(7, 5, 4, 1, "w"), ellipse(10, 4, 3, 1, "w"), ellipse(24, 8, 3, 1, "w"), ellipse(26, 7, 2, 1, "w"),
  // prédios ao fundo
  rect(1, 14, 5, 12, "v"), rect(6, 11, 4, 15, "v"), rect(11, 15, 6, 11, "v"), rect(18, 10, 4, 16, "v"), rect(24, 13, 7, 13, "v"),
  vline(20, 7, 3, "v"),
  // prédios próximos, com janelas acesas
  rect(0, 18, 4, 8, "V"), rect(4, 16, 5, 10, "V"), rect(10, 19, 5, 7, "V"), rect(16, 17, 5, 9, "V"), rect(22, 15, 5, 11, "V"), rect(28, 18, 4, 8, "V"),
  (c) => {
    for (const [x0, y0, w] of [[4, 16, 5], [16, 17, 5], [22, 15, 5], [10, 19, 5]])
      for (let y = y0 + 2; y < 25; y += 2) for (let x = x0 + 1; x < x0 + w - 1; x += 2)
        if (rnd() < 0.55) c.px(x, y, rnd() < 0.4 ? "e" : "W")
  },
  // reflexo diagonal no vidro
  light([6, 0, 8, 0, 0, 24, -2, 24]), light([10, 0, 11, 0, 3, 26, 2, 26]), light([24, 0, 26, 0, 18, 26, 16, 26]),
  // caixilho de alumínio preto
  box(0, 0, 32, 26, "K"), vline(15, 0, 26, "K"), vline(16, 0, 26, "u"), hline(1, 1, 14, "u"), hline(17, 1, 14, "u"))

// =============================================================================================
// DECORAÇÃO DE PAREDE

sprite("quadro_branco", { w: 40, h: 24 },
  rect(0, 0, 40, 22, "w"), box(0, 0, 40, 22, "m"), hline(1, 1, 38, "W"),
  // fluxo de agentes: tarefa -> agente -> entrega
  box(3, 4, 8, 5, "b"), box(16, 4, 8, 5, "b"), box(29, 4, 8, 5, "G"),
  hline(11, 6, 5, "b"), px(14, 5, "b"), px(14, 7, "b"),
  hline(24, 6, 5, "b"), px(27, 5, "b"), px(27, 7, "b"),
  hline(5, 6, 4, "b"), hline(18, 6, 4, "b"), line(31, 6, 32, 7, "G"), line(32, 7, 34, 5, "G"),
  // anotações
  hline(4, 12, 12, "K"), hline(4, 14, 9, "K"), hline(4, 16, 14, "K"), hline(4, 18, 6, "K"),
  ring(29, 15, 3, "r"), hline(22, 19, 14, "r"),
  // bandeja com marcadores
  rect(2, 22, 36, 2, "V"), hline(2, 22, 36, "v"), rect(5, 21, 3, 1, "r"), rect(9, 21, 3, 1, "b"), rect(13, 21, 3, 1, "G"))

sprite("relogio", { w: 12, h: 12 },
  circ(5.5, 5.5, 5, "K"), circ(5.5, 5.5, 4, "w"),
  px(5, 1, "V"), px(6, 1, "V"), px(10, 5, "V"), px(10, 6, "V"), px(5, 10, "V"), px(6, 10, "V"), px(1, 5, "V"), px(1, 6, "V"),
  vline(5, 3, 3, "K"), line(6, 6, 8, 7, "r"), px(5, 6, "K"))

// Quadros de arte abstrata (moldura de madeira + passe-partout)
sprite("arte_1", { w: 16, h: 20 },
  rect(0, 0, 16, 20, "n"), box(0, 0, 16, 20, "N"), rect(2, 2, 12, 16, "w"),
  rect(4, 4, 8, 12, "W"), circ(8, 7, 2.5, "r"), rect(4, 11, 8, 5, "b"), poly([4, 16, 12, 16, 12, 10], "e"))
sprite("arte_2", { w: 16, h: 20 },
  rect(0, 0, 16, 20, "n"), box(0, 0, 16, 20, "N"), rect(2, 2, 12, 16, "w"),
  rect(4, 4, 8, 12, "s"), circ(10, 7, 2, "a"), poly([4, 16, 4, 11, 8, 8, 12, 12, 12, 16], "T"), poly([4, 16, 7, 12, 10, 16], "y"))

// Letreiro da equipe
sprite("letreiro", { w: 46, h: 11 },
  rect(0, 0, 46, 11, "K"), box(0, 0, 46, 11, "k"),
  poly([5.5, 1.5, 10, 5.5, 5.5, 9.5, 1, 5.5], "t"), poly([5.5, 3.5, 7.5, 5.5, 5.5, 7.5, 3.5, 5.5], "K"),
  text(14, 3, "AGENTES", "t"))

// Estante branca com nichos
sprite("estante", { w: 32, h: 36 },
  rect(0, 0, 32, 36, "W"), box(0, 0, 32, 36, "v"), rect(1, 32, 30, 3, "v"), hline(1, 35, 30, "V"),
  (c) => {
    const capas = ["r", "b", "T", "e", "p", "G", "a", "B", "R", "w"]
    for (let lin = 0; lin < 4; lin++) for (let col = 0; col < 2; col++) {
      const x0 = col ? 17 : 2, y0 = 2 + lin * 8, w = 13
      c.rect(x0, y0, w, 6, "v")
      c.hline(x0, y0, w, "V")                          // sombra da prateleira de cima
      const nicho = lin * 2 + col
      if (nicho === 1) {                               // vaso com planta
        c.rect(x0 + 4, y0 + 3, 4, 3, "w"); c.ellipse(x0 + 5.5, y0 + 2, 3, 1.5, "G"); c.px(x0 + 4, y0 + 1, "g"); c.px(x0 + 6, y0 + 1, "g")
      } else if (nicho === 4) {                         // troféu
        c.rect(x0 + 2, y0 + 1, 3, 3, "e"); c.px(x0 + 3, y0 + 4, "E"); c.hline(x0 + 2, y0 + 5, 3, "E")
        c.rect(x0 + 7, y0 + 3, 5, 3, "n"); c.hline(x0 + 7, y0 + 3, 5, "O")       // caixa
      } else if (nicho === 7 || nicho === 6) {         // cestos organizadores
        c.rect(x0 + 1, y0 + 2, 5, 4, "O"); c.rect(x0 + 7, y0 + 2, 5, 4, "O")
        c.hline(x0 + 1, y0 + 2, 5, "o"); c.hline(x0 + 7, y0 + 2, 5, "o"); c.hline(x0 + 2, y0 + 4, 3, "n"); c.hline(x0 + 8, y0 + 4, 3, "n")
      } else {                                         // livros
        let x = x0 + 1
        while (x < x0 + w - 1) {
          const lw = rnd() < 0.3 ? 2 : 1, lh = 3 + Math.floor(rnd() * 3), cor = capas[Math.floor(rnd() * capas.length)]
          if (x + lw > x0 + w - 1) break
          c.rect(x, y0 + 6 - lh, lw, lh, cor)
          x += lw
          if (rnd() < 0.15) x++
        }
      }
    }
  },
  vline(15, 1, 31, "W"), vline(16, 1, 31, "W"))

// =============================================================================================
// MESAS (5) — tampo branco, painel frontal com faixa na cor da mesa e plaquinha numerada

sprite("mesa_tampo", { w: 32, h: 16 },
  rect(0, 0, 32, 16, "w"), box(0, 0, 32, 16, "W"), hline(1, 14, 30, "W"),
  circ(27.5, 2.5, 1, "K"))                              // passa-cabos

for (const id of IDS) sprite("_icone_" + id, { w: 7, h: 7 }, ICONES[id])

// Painel frontal da mesa: faixa e plaquinha com o ícone, na cor do agente
sprite("_painel", { w: 30, h: 10 },
  rect(0, 0, 30, 10, "W"), hline(0, 0, 30, "w"), rect(0, 1, 30, 2, "x"), hline(0, 9, 30, "v"),
  rect(11, 1, 9, 9, "x"), box(11, 1, 9, 9, "X"))
for (const id of MESAS)
  sprite("painel_" + id, { w: 30, h: 10, swap: AGENTES[id].cor }, stamp("_painel", 0, 0), stamp("_icone_" + id, 12, 2))

// Cadeira: tecido com costura e gomos verticais, na cor do agente
sprite("_cadeira", { w: 16, h: 16 },
  rect(0, 0, 16, 16, "x"), box(1, 1, 14, 14, "X"), vline(5, 2, 12, "X"), vline(10, 2, 12, "X"), hline(2, 2, 12, "x"))
for (const id of MESAS) sprite("cadeira_" + id, { base: "_cadeira", swap: AGENTES[id].cor })

// Crachá do agente (painel da interface e placas): placa arredondada colorida com o ícone
sprite("_cracha", { w: 11, h: 11 }, `
  .xxxxxxxxx.
  xxxxxxxxxxX
  xxxxxxxxxxX
  xxxxxxxxxxX
  xxxxxxxxxxX
  xxxxxxxxxxX
  xxxxxxxxxxX
  xxxxxxxxxxX
  xxxxxxxxxxX
  xxxxxxxxxxX
  .XXXXXXXXX.`)
for (const id of IDS)
  sprite("icone_" + id, { w: 11, h: 11, outline: "k", swap: AGENTES[id].cor }, stamp("_cracha", 0, 0), stamp("_icone_" + id, 2, 2))

// Placa "EM BREVE" (cavalete de giz) com moldura na cor do agente
sprite("_placa", { w: 24, h: 19 },
  line(5, 14, 3, 18, "N"), line(18, 14, 20, 18, "N"),
  rect(1, 0, 22, 15, "K"), box(1, 0, 22, 15, "x"), hline(2, 14, 20, "X"),
  text(9, 2, "EM", "w"), text(3, 8, "BREVE", "w"))
for (const id of IDS) sprite("placa_" + id, { w: 24, h: 19, outline: "k", swap: AGENTES[id].cor }, stamp("_placa", 0, 0))

// Monitor: traseira cinza (vista da câmera) e telas (código rolando / descanso)
sprite("monitor_costas", { w: 16, h: 10 },
  rect(0, 0, 16, 10, "u"), box(0, 0, 16, 10, "K"), hline(1, 1, 14, "V"),
  (c) => { for (let x = 3; x < 13; x += 2) c.px(x, 8, "K") },     // ventilação
  rect(7, 4, 2, 2, "t"))

sprite("tela_codigo", { w: 14, h: 32 },
  rect(0, 0, 14, 32, "z"),
  (c) => {
    const cores = ["i", "i", "t", "p", "e", "g", "u"]
    let indent = 1
    for (let y = 1; y < 32; y += 2) {
      if (rnd() < 0.12) continue
      indent = Math.max(1, Math.min(5, indent + (rnd() < 0.3 ? 2 : rnd() < 0.3 ? -2 : 0)))
      let x = indent
      while (x < 12) {
        const len = 1 + Math.floor(rnd() * 4)
        c.hline(x, y, Math.min(len, 13 - x), cores[Math.floor(rnd() * cores.length)])
        x += len + 1
        if (rnd() < 0.35) break
      }
    }
  })

sprite("tela_descanso", { w: 14, h: 8 },
  rect(0, 0, 14, 8, "z"), hline(0, 0, 14, "Z"),
  poly([7, 1, 10, 4, 7, 7, 4, 4], "T"), poly([7, 2.5, 8.5, 4, 7, 5.5, 5.5, 4], "Z"))

sprite("teclado", { w: 14, h: 5 },
  rect(0, 0, 14, 5, "K"),
  (c) => { for (let y = 1; y < 4; y++) for (let x = 1 + (y % 2); x < 13; x += 2) c.px(x, y, "u") },
  hline(4, 3, 6, "V"))

// =============================================================================================
// PLANTAS E OBJETOS (sprites com contorno, usados como billboards no 3D)

// Costela-de-adão num vaso branco
sprite("planta_grande", { w: 14, h: 28, outline: "k" },
  // caules
  line(7, 21, 4, 9, "d"), line(7, 21, 10, 7, "d"), line(7, 21, 7, 13, "d"), line(7, 21, 3, 15, "d"), line(7, 21, 11, 14, "d"),
  // folhas
  ellipse(4, 8, 3.5, 2.5, "G"), ellipse(10, 6, 3.5, 3, "G"), ellipse(7, 2.5, 2.5, 2.5, "G"),
  ellipse(7, 12.5, 3.5, 2.5, "G"), ellipse(3, 15, 2.5, 2, "G"), ellipse(11, 14, 2.5, 2, "G"),
  // luz de cima, sombra embaixo de cada folha
  (c) => [[4, 8, 3.5, 2.5], [10, 6, 3.5, 3], [7, 2.5, 2.5, 2.5], [7, 12.5, 3.5, 2.5], [3, 15, 2.5, 2], [11, 14, 2.5, 2]].forEach(([x, y, rx, ry]) => {
    c.ellipse(x - 0.8, y - 0.8, rx * 0.45, ry * 0.4, "g")
    c.hline(Math.round(x - rx * 0.5), Math.round(y + ry), Math.max(1, Math.round(rx)), "d")
  }),
  // recortes típicos da folha
  px(2, 8, "d"), px(11, 5, "d"), px(12, 7, "d"), px(5, 12, "d"), px(9, 13, "d"),
  vline(7, 15, 6, "d"),
  // vaso
  ellipse(7, 20.5, 4.5, 1.5, "N"), rect(3, 21, 9, 7, "w"), vline(10, 21, 7, "W"), vline(11, 21, 7, "W"), hline(3, 21, 9, "W"), hline(3, 27, 9, "v"))

// Espada-de-são-jorge em vaso de concreto
sprite("planta_media", { w: 12, h: 22, outline: "k" }, `
  ......g.....
  .....gG.....
  .....gG.....
  ..g..gGd....
  .gG..gdG..g.
  .gG..gGG.gG.
  .gGd.gGG.gd.
  .gdG.gGd.gG.
  .gGG.gGG.gG.
  .gGGggdGgGd.
  ..gdgGGGgdG.
  ..gGgGGdgGG.
  ..gGGGGGGG..
  ...GdGGdGG..
  .WWWWWWWWWW.
  .vvvvvvvvVV.
  .vvvvvvvvVV.
  .vvvvvvvvVV.
  .vvvvvvvvVV.
  .vvvvvvvvVV.
  .vvvvvvvvVV.
  .VVVVVVVVVV.`)

// Suculenta de mesa
sprite("planta_mesa", { w: 7, h: 8, outline: "k" },
  ellipse(3, 2, 3, 2, "G"), px(3, 0, "g"), px(1, 2, "g"), px(5, 2, "g"), px(3, 2, "d"),
  rect(1, 4, 5, 4, "a"), hline(1, 4, 5, "A"), vline(5, 4, 4, "A"))

// Bebedouro
sprite("bebedouro", { w: 10, h: 26, outline: "k" },
  rect(2, 0, 6, 1, "b"), rect(1, 1, 8, 8, "S"), vline(2, 2, 6, "s"), vline(3, 2, 5, "s"), hline(1, 8, 8, "b"),
  rect(0, 9, 10, 17, "w"), vline(8, 9, 17, "W"), vline(9, 9, 17, "W"),
  rect(2, 11, 6, 6, "K"), px(3, 13, "r"), px(6, 13, "b"), hline(2, 16, 6, "V"),
  hline(0, 25, 10, "v"))

// Máquina de café espresso
sprite("maquina_cafe", { w: 14, h: 14, outline: "k" },
  rect(0, 0, 14, 14, "K"), rect(1, 1, 12, 3, "u"), px(10, 2, "t"), px(11, 2, "t"),
  rect(4, 5, 6, 2, "m"), vline(6, 7, 2, "M"), vline(7, 7, 2, "M"),
  rect(5, 10, 4, 3, "w"), vline(8, 10, 3, "W"),
  hline(1, 13, 12, "M"))

// Balcão do café: ripado de madeira
sprite("balcao", { w: 16, h: 14 },
  (c) => { for (let x = 0; x < 16; x++) c.vline(x, 0, 14, ["n", "O", "o", "o"][x % 4]) },
  hline(0, 0, 16, "N"), hline(0, 13, 16, "N"))

// Sofá: tecido teal capitonê
sprite("sofa_tecido", { w: 16, h: 16 },
  rect(0, 0, 16, 16, "T"),
  (c) => [[4, 4], [12, 4], [0, 12], [8, 12]].forEach(([x, y]) => {
    c.line(x - 4, y, x, y - 4, "y"); c.line(x, y - 4, x + 4, y, "y")
  }),
  (c) => [[4, 4], [12, 4], [0, 12], [8, 12]].forEach(([x, y]) => { c.px(x, y, "y"); c.px(x - 1, y - 1, "t") }))

// Tapete da área de descanso (meados do século)
sprite("tapete_lounge", { w: 48, h: 32 },
  rect(0, 0, 48, 32, "W"), box(2, 2, 44, 28, "v"), box(4, 4, 40, 24, "T"),
  circ(16, 16, 7, "e"), circ(27, 14, 6, "a"), clip([27, 14, 6], circ(16, 16, 7, "A")),
  circ(35, 19, 4, "t"), ring(35, 19, 4, "T"),
  (c) => { for (let y = 3; y < 30; y += 2) { c.px(0, y, "v"); c.px(47, y, "v") } })   // franjas

// Capacho da entrada (ponto de chegada dos agentes)
sprite("tapete_entrada", { w: 32, h: 16 },
  rect(0, 0, 32, 16, "u"), box(0, 0, 32, 16, "K"), box(1, 1, 30, 14, "V"),
  (c) => [8, 16, 24].forEach((x) => { for (const y of [4, 8]) { c.line(x - 3, y, x, y + 3, "t"); c.line(x, y + 3, x + 3, y, "t") } }))

// Seta de "mesa livre": flutua sobre a cadeira vazia. Branca, recebe a cor da mesa no 3D.
sprite("seta_livre", { w: 9, h: 8, outline: "k" }, `
  ..wwwWW..
  ..wwwWW..
  ..wwwWW..
  wwwwwwWWW
  .wwwwwWW.
  ..wwwWW..
  ...wwW...
  ....w....`)

sprite("sombra", { w: 14, h: 6 }, ellipse(6.5, 2.5, 6.5, 2.5, "k"))

// =============================================================================================
// OBJETOS DOS POSTOS (identificam o trabalho de cada agente)

// Mesa de Finanças: calculadora
sprite("calculadora", { w: 7, h: 9, outline: "k" },
  rect(0, 0, 7, 9, "K"), rect(1, 1, 5, 2, "g"), px(5, 1, "d"),
  (c) => { for (let y = 4; y < 9; y += 2) for (let x = 1; x < 6; x += 2) c.px(x, y, x === 5 && y === 8 ? "r" : "v") })

// Mesa de Investimentos: cofrinho
sprite("cofrinho", { w: 11, h: 8, outline: "k" }, `
  ...ll.l....
  .llllllll..
  lllkllllll.
  llllllllLLl
  llllllllLLL
  .lllllllll.
  ..LL...LL..
  ..LL...LL..`,
  hline(3, 1, 3, "K"))

// Mesa da Agenda: calendário de mesa
sprite("calendario_mesa", { w: 9, h: 9, outline: "k" },
  rect(0, 0, 9, 9, "w"), rect(0, 0, 9, 2, "r"), px(2, 0, "K"), px(6, 0, "K"), text(1, 3, "12", "K"), hline(0, 8, 9, "W"))

// Mesa dos E-mails: bandeja com cartas
sprite("bandeja_cartas", { w: 11, h: 7, outline: "k" },
  rect(1, 0, 9, 4, "w"), box(1, 0, 9, 4, "W"), line(1, 0, 5, 2, "V"), line(9, 0, 5, 2, "V"), px(8, 1, "r"),
  rect(0, 3, 11, 4, "m"), hline(0, 3, 11, "W"), hline(0, 6, 11, "M"))

// Bancada da Nutrição: tábua com legumes, e o quadro de giz do cardápio
sprite("tabua_legumes", { w: 14, h: 8, outline: "k" },
  rect(0, 2, 14, 6, "O"), hline(0, 7, 14, "n"), circ(3.5, 3.5, 2, "r"), px(3, 2, "g"),
  rect(7, 3, 5, 2, "a"), px(12, 3, "g"), px(12, 4, "G"), ellipse(10, 6, 2, 1, "g"))

sprite("cardapio", { w: 24, h: 20 },
  rect(0, 0, 24, 20, "n"), box(0, 0, 24, 20, "N"), rect(2, 2, 20, 16, "K"),
  text(4, 3, "HOJE", "e"),
  hline(4, 10, 9, "v"), hline(4, 13, 11, "v"), hline(4, 16, 7, "v"),
  circ(18, 12, 2, "r"), px(18, 9, "g"), px(19, 9, "g"))

// Biblioteca: luminária de piso e pilha de livros
sprite("luminaria", { w: 9, h: 28, outline: "k" },
  poly([1, 6, 8, 6, 6.5, 0, 2.5, 0], "e"), hline(1, 5, 7, "E"), hline(2, 0, 5, "w"),
  vline(4, 6, 20, "K"), rect(1, 26, 7, 2, "K"))

sprite("pilha_livros", { w: 12, h: 11, outline: "k" },
  rect(0, 7, 12, 4, "B"), hline(0, 7, 12, "b"), vline(10, 8, 2, "w"),
  rect(1, 3, 10, 4, "R"), hline(1, 3, 10, "r"), vline(2, 4, 2, "w"),
  rect(2, 0, 8, 3, "G"), hline(2, 0, 8, "g"), vline(8, 1, 1, "w"))

// Academia: suporte de halteres, kettlebell e tapete de yoga
sprite("rack_halteres", { w: 14, h: 22, outline: "k" },
  rect(1, 0, 2, 22, "K"), rect(11, 0, 2, 22, "K"), rect(1, 7, 12, 1, "K"), rect(1, 15, 12, 1, "K"), rect(0, 21, 14, 1, "K"),
  (c) => [[4, "r"], [12, "b"], [20, "e"]].forEach(([y, cor]) => {
    c.rect(3, y - 1, 8, 1, "m")
    c.rect(3, y - 3, 2, 4, cor); c.rect(9, y - 3, 2, 4, cor)
  }))

sprite("kettlebell", { w: 8, h: 9, outline: "k" },
  ring(3.5, 2, 2, "K"), circ(3.5, 5.5, 3, "K"), px(2, 4, "u"), px(1, 5, "u"))

sprite("tapete_yoga", { w: 16, h: 32 },
  rect(0, 0, 16, 32, "t"), box(1, 1, 14, 30, "T"), hline(1, 3, 14, "T"), hline(1, 28, 14, "T"))

// Piso da copa: ladrilho xadrez claro (como as cozinhas dos jogos)
sprite("piso_cozinha", { w: 16, h: 16 },
  rect(0, 0, 8, 8, "w"), rect(8, 0, 8, 8, "W"), rect(0, 8, 8, 8, "W"), rect(8, 8, 8, 8, "w"),
  hline(0, 7, 16, "v"), hline(0, 15, 16, "v"), vline(7, 0, 16, "v"), vline(15, 0, 16, "v"))

// Biblioteca: tapete redondo
sprite("tapete_redondo", { w: 32, h: 24 },
  ellipse(15.5, 11.5, 15.5, 11.5, "P"), ellipse(15.5, 11.5, 13.5, 9.5, "p"), ellipse(15.5, 11.5, 9, 6, "W"), ellipse(15.5, 11.5, 7, 4, "p"))

// Poltronas (Terapeuta: mostarda; Aprendizado: terracota): tecido capitonê
sprite("_poltrona", { w: 16, h: 16 },
  rect(0, 0, 16, 16, "x"),
  (c) => [[4, 4], [12, 4], [8, 10], [0, 10]].forEach(([x, y]) => { c.px(x, y, "X"); c.px(x - 1, y - 1, "w") }))
sprite("poltrona_terapeuta", { base: "_poltrona", swap: { x: "e", X: "E", w: "e" } })
sprite("poltrona_aprendizado", { base: "_poltrona", swap: { x: "a", X: "A", w: "a" } })

// =============================================================================================
// BALÕES DE EMOÇÃO (status dos agentes, acima da cabeça)

sprite("_balao", { w: 12, h: 11 }, `
  .wwwwwwwwww.
  wwwwwwwwwwww
  wwwwwwwwwwww
  wwwwwwwwwwww
  wwwwwwwwwwww
  wwwwwwwwwwww
  wwwwwwwwwwww
  .wwwwwwwwww.
  ...www......
  ...ww.......
  ...w........`)

anim("balao_digitando", { w: 12, h: 11, outline: "k", fps: 3 }, stamp("_balao", 0, 0),
  frame(rect(2, 3, 2, 2, "K")),
  frame(rect(2, 3, 2, 2, "K"), rect(5, 3, 2, 2, "K")),
  frame(rect(2, 3, 2, 2, "K"), rect(5, 3, 2, 2, "K"), rect(8, 3, 2, 2, "K")))
sprite("balao_alerta", { w: 12, h: 11, outline: "k" }, stamp("_balao", 0, 0), rect(5, 1, 2, 4, "r"), rect(5, 6, 2, 1, "r"))
sprite("balao_pensando", { w: 12, h: 11, outline: "k" }, stamp("_balao", 0, 0), `
  ............
  ....bbbb....
  ...bb..bb...
  ......bb....
  .....bb.....
  ............
  .....bb.....`)
sprite("balao_ok", { w: 12, h: 11, outline: "k" }, stamp("_balao", 0, 0), line(3, 3, 5, 5, "G"), line(5, 5, 8, 2, "G"), line(3, 4, 5, 6, "G"), line(5, 6, 8, 3, "G"))
anim("balao_ocioso", { w: 12, h: 11, outline: "k", fps: 2 }, stamp("_balao", 0, 0),
  frame(text(4, 1, "Z", "b")),
  frame(text(2, 2, "Z", "S"), text(6, 1, "Z", "b")))

// =============================================================================================
// AGENTE DE DEMONSTRAÇÃO (placeholder para os agentes animados que serão alocados depois)
// Quadros de 16x24 (com contorno). Chaves trocáveis: x/X camisa, h/H cabelo, c/C pele.

// Frente (olhando para a câmera) — escrevo só a metade esquerda e espelho.
sprite("_frente", { w: 14, h: 22, mx: true }, `
  ....hhh
  ..hhhhh
  .hhhhhh
  .hhhhhh
  hhhhhhh
  hhhHhhh
  hhHcchh
  hHccccc
  hcckccc
  hcckccc
  .Cccccc
  ..CCccc
  ..xxxCC
  .xxxxxx
  xxXxxxx
  xxXxxxx
  xxXxxxx
  ccjjjjj
  .jjjjjj
  ..jjjj.
  ..jjjj.
  ..KKKK.`)

// Costas
sprite("_costas", { w: 14, h: 22, mx: true }, `
  ....hhh
  ..hhhhh
  .hhhhhh
  .hhhhhh
  hhhhhhh
  hhhhhhh
  hhhhhhh
  hhhhhhh
  hhhhhhh
  hHhhhhh
  .HHhhhh
  ..HHHhh
  ..xxxCC
  .xxxxxx
  xxXxxxx
  xxXxxxx
  xxXxxxx
  ccjjjjj
  .jjjjjj
  ..jjjj.
  ..jjjj.
  ..KKKK.`)

// Perfil (olhando para a esquerda; a direita é o espelho no 3D)
sprite("_lado", { w: 14, h: 22 }, `
  ....hhhhh.....
  ..hhhhhhhhh...
  .hhhhhhhhhhh..
  .hhhhhhhhhhh..
  hhhhhhhhhhhhh.
  hhhhhhhhhhhhh.
  hcchhhhhhhhhh.
  cccchhhhhhhhh.
  ckccchhhhhhhh.
  ckccchCchhhhh.
  ccccccCChhhh..
  .CCcccchhhh...
  ...CCxxxxx....
  ...xxxxxxxx...
  ...xxXXxxxx...
  ...xxXXxxxx...
  ...xxXXxxxx...
  ...xcCjjjjj...
  ....jjjjjjj...
  .....jjjjj....
  .....jjjjj....
  ....KKKKKK....`)

// Sentado, de frente, digitando (cabeça 3 px mais baixa; as pernas ficam atrás da mesa)
sprite("_sentado", { w: 14, h: 22, mx: true }, `
  .......
  .......
  .......
  ....hhh
  ..hhhhh
  .hhhhhh
  .hhhhhh
  hhhhhhh
  hhhHhhh
  hhHcchh
  hHccccc
  hcckccc
  hcckccc
  .Cccccc
  ..CCccc
  ..xxxCC
  .xxxxxx
  xxXxxxx
  xxXXxxx
  .xxXXxx
  ..ccXxx
  ..ccjjj`)

// Animações base (partes "_": não viram arquivo; cada agente as recolore com swap)
anim("_agente_frente", { w: 14, h: 22, outline: "k", fps: 6 }, stamp("_frente", 0, 0),
  frame(),
  frame(grid(2, 20, "KKKK\n____"), grid(0, 16, "xx\nxx")),
  frame(grid(8, 20, "KKKK\n____"), grid(12, 16, "xx\nxx")))

anim("_agente_costas", { w: 14, h: 22, outline: "k", fps: 6 }, stamp("_costas", 0, 0),
  frame(),
  frame(grid(2, 20, "KKKK\n____")),
  frame(grid(8, 20, "KKKK\n____")))

anim("_agente_lado", { w: 14, h: 22, outline: "k", fps: 6 }, stamp("_lado", 0, 0),
  frame(),
  frame(grid(0, 19, "____jjj_JJJ___\n___jjj___JJJ__\n__KKK_____KKK_")),
  frame(grid(0, 19, "____JJJ_jjj___\n___JJJ___jjj__\n__KKK_____KKK_")))

anim("_agente_sentado", { w: 14, h: 22, outline: "k", fps: 5 }, stamp("_sentado", 0, 0),
  frame(grid(2, 20, "cc\ncc"), grid(10, 19, "cc\ncc\nxx")),
  frame(grid(2, 19, "cc\ncc\nxx"), grid(10, 20, "cc\ncc")))

// Lendo (poltrona da biblioteca): livro aberto nas mãos; no 2º quadro vira a página
anim("_agente_lendo", { w: 14, h: 22, outline: "k", fps: 2 }, stamp("_sentado", 0, 0), `
  ..............
  ..............
  ..............
  ..............
  ..............
  ..............
  ..............
  ..............
  ..............
  ..............
  ..............
  ..............
  ..............
  ..............
  ..............
  ..............
  ..............
  ...bbbbbbbb...
  ..cbbbBBbbbc..
  ..cbbeBBebbc..
  ...bbbBBbbb...
  ...bbbbbbbb...`,
  frame(),
  frame(grid(7, 16, "ww\nwB")))

// Exercitando (academia): agachamento — em pé / agachado com os pés afastados
anim("_agente_exercitando", { w: 14, h: 22, outline: "k", fps: 3 },
  frame(stamp("_frente", 0, 0)),
  frame(stamp("_frente", 0, 2), grid(0, 19, "_cc________cc_"), grid(0, 21, "_KKKKK__KKKKK_"), grid(2, 15, "cc"), grid(10, 15, "cc")))

// Folha de cada agente: andar (frente/costas/perfil), sentado, lendo e exercitando
const POSES = ["frente", "costas", "lado", "sentado", "lendo", "exercitando"]
for (const id of IDS) {
  const swap = { ...AGENTES[id].cor, ...AGENTES[id].visual }
  for (const pose of POSES) anim("_" + pose + "_" + id, { base: "_agente_" + pose, swap })
  sheet("agente_" + id, POSES.map((pose) => "_" + pose + "_" + id))
}
