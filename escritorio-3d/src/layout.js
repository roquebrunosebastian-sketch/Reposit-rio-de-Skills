// Planta do escritório em tiles (1 tile = 1 unidade = 16 px de textura), como num mapa de RPG.
// A câmera olha para o norte: a linha 0 encosta na parede do fundo e a linha 10 é a entrada.

export const LARGURA = 16;
export const PROFUNDIDADE = 11;
export const ALTURA_PAREDE = 3;

// Legenda (só "." e "D" são passagem livre; "s" é o lugar de um agente: só ele entra)
//   s  lugar de um agente        D  capacho da entrada (onde os agentes surgem)
//   m  mesa (2 tiles)            I  ilha da copa (2 tiles)     B  balcão do café   A  bebedouro
//   E  estante                   L  luminária                  #  pilha de livros / tapete de yoga
//   H  suporte de halteres       b  bola de pilates            k  kettlebell
//   P/p plantas                  C  aparador                   T  mesinha de chá   F  sofá
export const MAPA = [
  // 0123456789012345
  "P......CC......P", // 0
  ".............s.B", // 1   s(13,1) Nutrição, atrás da ilha
  "..s..s..s..s.IIB", // 2   assentos das 4 mesas
  ".mm.mm.mm.mm...B", // 3   Finanças · Investimentos · Agenda · E-mails
  "...............A", // 4
  "E...............", // 5
  "ELs#.......p.sT.", // 6   s(2,6) Aprendizado (poltrona) · s(13,6) Terapeuta (poltrona)
  "...............F", // 7
  "H.s........p...F", // 8   s(2,8) Exercícios (tapete de yoga)
  "b.#k...........F", // 9
  "p......DD......p", // 10
];

// Postos de trabalho. `tipo` define a mobília; `pose` a animação do agente ali.
// `local` é o tile onde o agente fica; `ajuste` desloca a posição final dentro do tile.
export const POSTOS = [
  { id: "financas", tipo: "mesa", pose: "sentado", mesa: { col: 1, lin: 3 }, local: { col: 2, lin: 2 } },
  { id: "investimentos", tipo: "mesa", pose: "sentado", mesa: { col: 4, lin: 3 }, local: { col: 5, lin: 2 } },
  { id: "agenda", tipo: "mesa", pose: "sentado", mesa: { col: 7, lin: 3 }, local: { col: 8, lin: 2 } },
  { id: "emails", tipo: "mesa", pose: "sentado", mesa: { col: 10, lin: 3 }, local: { col: 11, lin: 2 } },
  { id: "nutricao", tipo: "bancada", pose: "em_pe", local: { col: 13, lin: 1 }, ajuste: { x: 0.5, z: 0.05 } },
  { id: "terapeuta", tipo: "poltrona", pose: "sentado", local: { col: 13, lin: 6 } },
  { id: "aprendizado", tipo: "poltrona", pose: "lendo", local: { col: 2, lin: 6 } },
  { id: "exercicios", tipo: "academia", pose: "exercitando", local: { col: 2, lin: 8 }, ajuste: { x: 0, z: 0.5 } },
];

export const PORTA = [{ col: 7, lin: 10 }, { col: 8, lin: 10 }];

export function tileParaMundo(col, lin) {
  return { x: col - LARGURA / 2 + 0.5, z: lin - PROFUNDIDADE / 2 + 0.5 };
}

export function mundoParaTile(x, z) {
  return { col: Math.floor(x + LARGURA / 2), lin: Math.floor(z + PROFUNDIDADE / 2) };
}

function livre(col, lin, destino) {
  if (col < 0 || lin < 0 || col >= LARGURA || lin >= PROFUNDIDADE) return false;
  if (destino && destino.col === col && destino.lin === lin) return true;
  const c = MAPA[lin][col];
  return c === "." || c === "D";
}

// Caminho em 4 direções (BFS), estilo RPG: lista de tiles da origem (exclusiva) ao destino (inclusivo).
export function caminho(origem, destino) {
  const chave = (c, l) => l * LARGURA + c;
  const veio = new Map([[chave(origem.col, origem.lin), null]]);
  const fila = [origem];
  while (fila.length) {
    const atual = fila.shift();
    if (atual.col === destino.col && atual.lin === destino.lin) {
      const rota = [];
      for (let n = atual; n && !(n.col === origem.col && n.lin === origem.lin); n = veio.get(chave(n.col, n.lin))) rota.unshift(n);
      return rota;
    }
    for (const [dc, dl] of [[0, -1], [1, 0], [-1, 0], [0, 1]]) {
      const prox = { col: atual.col + dc, lin: atual.lin + dl };
      const k = chave(prox.col, prox.lin);
      if (veio.has(k) || !livre(prox.col, prox.lin, destino)) continue;
      veio.set(k, atual);
      fila.push(prox);
    }
  }
  return null;
}
