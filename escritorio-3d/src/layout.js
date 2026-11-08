// Layout do escritório em tiles (1 tile = 1 unidade = 16 px de textura), como num mapa de RPG.
// A câmera olha para o norte: linha 0 fica encostada na parede do fundo, a linha 10 é a entrada.

export const LARGURA = 16;
export const PROFUNDIDADE = 11;
export const ALTURA_PAREDE = 3;

// Legenda do mapa (tudo que não é "." ou "D" bloqueia a passagem)
//   .  piso livre            D  capacho da entrada (onde os agentes surgem)
//   m  mesa (2 tiles)        s  assento de uma mesa (só o agente daquela mesa entra)
//   P  planta grande         p  planta média          C  aparador
//   B  balcão do café        A  bebedouro             E  estante
//   F  sofá                  O  pufe                  t  mesinha de centro
export const MAPA = [
  // 0123456789012345
  "P......CC......P", // 0
  "...............B", // 1
  "..s..s..s......B", // 2
  ".mm.mm.mm......B", // 3
  "...............A", // 4
  "................", // 5
  "E..s...s....O..F", // 6
  "E.mm..mm.....t.F", // 7
  "............O..F", // 8
  "p..............p", // 9
  ".......DD.......", // 10
];

// As 5 mesas. `mesa` é o tile da esquerda (a mesa ocupa col e col+1); `assento` é onde o agente senta.
export const MESAS = [
  { id: 1, cor: "#f2665c", corEscura: "#b83f45", nomeCor: "vermelha", mesa: { col: 1, lin: 3 }, assento: { col: 2, lin: 2 } },
  { id: 2, cor: "#4a8fd6", corEscura: "#2f5a9e", nomeCor: "azul", mesa: { col: 4, lin: 3 }, assento: { col: 5, lin: 2 } },
  { id: 3, cor: "#58ad4f", corEscura: "#2f7040", nomeCor: "verde", mesa: { col: 7, lin: 3 }, assento: { col: 8, lin: 2 } },
  { id: 4, cor: "#ffd85e", corEscura: "#d9a032", nomeCor: "amarela", mesa: { col: 2, lin: 7 }, assento: { col: 3, lin: 6 } },
  { id: 5, cor: "#b995ea", corEscura: "#7d5bbf", nomeCor: "roxa", mesa: { col: 6, lin: 7 }, assento: { col: 7, lin: 6 } },
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
