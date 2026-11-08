# Escritório de Agentes 3D

![Escritório na câmera RPG: Finanças, Investimentos e Terapeuta trabalhando; os outros postos com a placa "EM BREVE"](docs/visao-rpg.png)

Escritório moderno em 3D onde cada um dos seus agentes tem um posto temático. O visual segue o
padrão dos RPGs de bolso (a linguagem visual dos jogos Pokémon de GBA/DS): grade de 16 px, câmera
inclinada em 3/4, paleta clara, contornos escuros, balões de emoção sobre a cabeça, capacho de
entrada e personagens que andam tile a tile em 4 direções.

Toda a arte foi desenhada como código com a skill [`pxl-pixel-art`](../.claude/skills/pxl-pixel-art/SKILL.md)
deste repositório e é original: sem pokébolas, criaturas, logotipos ou tiles dos jogos.

| Prévia com os 8 agentes (isométrica) | De cima |
| --- | --- |
| ![Câmera isométrica com os 8 agentes](docs/visao-isometrica.png) | ![Câmera de cima com os 8 agentes](docs/visao-de-cima.png) |

## Rodar

```bash
cd escritorio-3d
npm run servir          # = python3 -m http.server 8080 (ou: npx serve .)
# abra http://localhost:8080/?demo=1
```

A página usa ES modules e carrega texturas, por isso precisa de um servidor HTTP (abrir o
`index.html` direto do disco não funciona). O Three.js vem do jsDelivr, com a versão fixada em 0.170.0.

| Parâmetro de URL | Efeito |
| --- | --- |
| `demo=1` | liga a simulação: os agentes presentes trocam de status sozinhos |
| `previa=1` | traz também os agentes "em breve", para ver o escritório completo |
| `vazio=1` | começa sem ninguém (os agentes ativos não aparecem já sentados) |
| `camera=rpg` \| `isometrica` \| `topo` | câmera inicial (padrão `rpg`) |
| `pixel=1..4` | tamanho do pixel na tela (padrão `2`) |
| `ui=0` | esconde a interface (para usar em `<iframe>`) |

Arraste para girar, use a roda do mouse (ou pinça) para aproximar e clique num agente para
destacá-lo no painel. Quando a câmera gira para fora de uma parede lateral, essa parede é recortada
na altura do rodapé, como nos jogos isométricos, para não esconder a sala.

## Os agentes e seus postos

| Agente | Situação | Posto | O que identifica o posto |
| --- | --- | --- | --- |
| Finanças | ativo | mesa, sob o quadro branco | calculadora, moedas, ícone `$` |
| Investimentos | ativo | mesa ao lado de Finanças | cofrinho, ícone de gráfico subindo |
| Terapeuta | ativo | poltrona mostarda no cantinho reservado, atrás das plantas | sofá, tapete, mesinha com chá e lenços |
| Agenda | em breve | mesa central | calendário de mesa |
| E-mails | em breve | mesa central | bandeja de cartas |
| Nutrição | em breve | atrás da ilha da copa (piso de ladrilho) | tábua com legumes, fruteira, quadro do cardápio |
| Exercícios | em breve | tapete de yoga na academia | suporte de halteres, kettlebell, bola de pilates |
| Aprendizado | em breve | poltrona da biblioteca | estante, luminária, pilha de livros |

Cada agente tem cor e aparência próprias (camisa, cabelo, pele) e uma pose no posto: sentado
digitando nas mesas, gesticulando na poltrona da terapia, lendo um livro na biblioteca, mexendo
na tábua da copa ou fazendo agachamento no tapete. Agente ativo fora do escritório deixa uma seta
na cor dele quicando sobre o posto. Agente "em breve" tem uma placa de giz com moldura na cor dele.

### Configurar

Os agentes ficam em [`src/agentes-config.js`](src/agentes-config.js):

```js
{
  id: "financas",
  nome: "Finanças",
  papel: "Lê seus extratos, separa gastos fixos e variáveis...",
  cor: "#58ad4f",
  ativo: true,                                   // false = placa "EM BREVE"
  projeto: "https://claude.ai/project/...",      // vira o botão "Abrir" no painel
},
```

- **Ativar um agente futuro:** troque `ativo: false` por `true`.
- **Ligar ao seu Projeto do Claude:** cole o link do projeto em `projeto` e o painel ganha o botão "Abrir".

### A planta

O mapa de tiles fica em [`src/layout.js`](src/layout.js). A câmera olha para o norte: a linha 0
encosta na parede do fundo e a linha 10 é a entrada. `s` marca o lugar de cada agente.

```
   0123456789012345
 0 P......CC......P     P/p plantas   C aparador (sob o letreiro)
 1 .............s.B     s(13,1) Nutrição, atrás da ilha I; B balcão do café
 2 ..s..s..s..s.IIB     assentos das 4 mesas
 3 .mm.mm.mm.mm...B     Finanças · Investimentos · Agenda · E-mails
 4 ...............A     A bebedouro
 5 E...............     E estante
 6 ELs#.......p.sT.     s(2,6) Aprendizado (L luminária, # livros) · s(13,6) Terapeuta (T mesinha)
 7 ...............F     F sofá
 8 H.s........p...F     s(2,8) Exercícios (H halteres; tapete de yoga até a linha 9)
 9 b.#k...........F     b bola de pilates   k kettlebell
10 p......DD......p     D capacho da entrada
```

## API

A página expõe `window.escritorio`. Os agentes são identificados pelo `id`
(`financas`, `investimentos`, `terapeuta`, `agenda`, `emails`, `nutricao`, `exercicios`,
`aprendizado`) ou pela posição na lista (1 a 8).

```js
escritorio.definirStatus("financas", "alerta");     // balão "!" e o agente para de digitar
await escritorio.sair("investimentos");             // levanta e sai pela porta
await escritorio.chegar("investimentos", { status: "pensando" });   // entra e vai ao posto
escritorio.agentes();                               // quem está presente, status, posto e posição 3D
```

| Método | O que faz |
| --- | --- |
| `chegar(id, { status, nome, visual, entrarPelaPorta })` | o agente entra pelo capacho e anda até o posto; a promessa resolve quando ele chega. `entrarPelaPorta: false` faz ele aparecer direto no posto. |
| `sair(id, { sairPelaPorta })` | o agente sai pela porta; resolve quando ele some. |
| `definirStatus(id, status)` | `trabalhando`, `pensando`, `alerta`, `concluido`, `ocioso` ou `nenhum`. |
| `agentes()` | os 8 agentes: `ativo`, `presente`, `estado`, `status`, `projeto`, posto e posição 3D. |
| `simular(ligar)` | liga/desliga a troca automática de status (demonstração). |
| `previaFuturos(ligar)` | traz/leva os agentes "em breve". |
| `camera(nome)` | `rpg`, `isometrica` ou `topo`. |

| Status | Balão | No posto | Monitor (mesas) |
| --- | --- | --- | --- |
| `trabalhando` | "…" animado | se mexe (digita, lê, agacha…) | código rolando |
| `pensando` | "?" | parado | código |
| `alerta` | "!" (quicando) | parado | código |
| `concluido` | ✓ | parado | descanso de tela |
| `ocioso` | "Z" animado | parado | descanso de tela |
| `nenhum` | — | se mexe | código rolando |

Também dá para controlar de fora, com a página dentro de um `<iframe>`:

```js
iframe.contentWindow.postMessage({ escritorio: "definirStatus", args: ["financas", "alerta"], id: 1 }, "*");
// resposta: { escritorioResposta: 1, ok: true }
```

Os nomes da primeira versão (`alocarAgente`, `liberarMesa`, `mesas`, `demonstracao`, `esvaziar`)
continuam funcionando.

## Como foi feito

```
escritorio-3d/
├── arte/escritorio.px.js     toda a pixel art, na DSL da skill pxl
├── assets/                   PNGs gerados + manifest.json (npm run arte)
├── ferramentas/pxl-lite.mjs  renderizador da DSL (veja abaixo)
├── src/agentes-config.js     seus agentes: nome, papel, cor, ativo, link do projeto
├── src/layout.js             mapa de tiles, postos e caminho (BFS em 4 direções)
├── src/cena.js               sala, paredes recortáveis e a mobília de cada posto
├── src/agentes.js            agentes: chegar, andar, pose no posto, status, sair
├── src/recursos.js           texturas sem suavização + billboards de pixel art
├── src/main.js               renderizador pixelado, câmeras, painel e API
└── index.html
```

- **Pixels nítidos:** a cena é renderizada em 1/N da resolução da tela e ampliada com
  `image-rendering: pixelated`; as texturas usam filtro `Nearest`. Os móveis têm contorno escuro
  (casco invertido), como os sprites dos jogos.
- **Sprites no 3D:** plantas, objetos, balões e agentes são billboards de pixel art virados para a
  câmera. A profundidade de cada sprite é calculada como se ele fosse um plano em pé no próprio pé.
  Assim ele passa na frente de mesas que estão atrás, fica atrás da mesa em que está sentado e não
  atravessa a parede, sem perder o desenho de frente.
- **Direção relativa à câmera:** ao girar a câmera, o agente mostra o sprite certo (frente, costas
  ou perfil) para a direção em que anda na tela.

## Visual de um agente

Cada folha `agente_<id>` (16×24 px por quadro) junta seis animações:

| Animação | Quadros |
| --- | --- |
| `_frente_<id>` | parado, passo, outro passo (olhando para a câmera) |
| `_costas_<id>` | parado, passo, outro passo |
| `_lado_<id>` | parado, passo, outro passo (olhando para a esquerda; a direita é espelhada) |
| `_sentado_<id>` | 2 quadros digitando/gesticulando |
| `_lendo_<id>` | livro aberto; o 2º quadro vira a página |
| `_exercitando_<id>` | em pé / agachado |

Para mudar a aparência de um agente, edite a entrada dele em `AGENTES` no `arte/escritorio.px.js`
(chaves trocáveis: `x/X` camisa, `h/H` cabelo, `c/C` pele, `j/J` calça) e rode `npm run arte`:

```js
aprendizado: { cor: { x: "l", X: "L" }, visual: { h: "v", H: "V" } },   // camisa rosa, cabelo grisalho
```

Um agente novo precisa de: uma entrada em `AGENTES` e um ícone em `ICONES` no `arte/escritorio.px.js`
(se o posto for uma mesa, o id também entra em `MESAS`, para gerar painel e cadeira); uma entrada em
`src/agentes-config.js`; um posto em `src/layout.js` (`POSTOS` e uma letra `s` no `MAPA`); e, se não
for uma mesa, a mobília do posto em `src/cena.js` (as mesas são genéricas; os outros cantos foram
montados um a um).

## Sobre o `pxl-lite`

O `SKILL.md` da skill `pxl-pixel-art` manda rodar `bin/pxl.js`, mas esse executável (e o
`reference.md`) não estão no repositório; só o `SKILL.md` foi versionado. Para gerar a arte,
`ferramentas/pxl-lite.mjs` implementa o subconjunto da DSL usado aqui, com as assinaturas do
`SKILL.md`: `pal`, `ramps`, `use`, `sprite`, `anim`/`frame`, `scene`, `layer` (inclusive
`shade: true`), `sheet`, `clip`, as formas (`px rect box hline vline line circ ring ellipse poly fill text grid`),
os tons (`shade light dither grad noise recolor`), `stamp`/`tile` e as opções `w h mx my outline base swap flip bg fps`.
Ele grava `assets/<nome>.png`, prévias ampliadas em `assets/_preview/` e um `manifest.json` com
tamanho, quadros e retângulos das folhas.

```bash
npm run arte                                                        # gera tudo
node ferramentas/pxl-lite.mjs build arte/escritorio.px.js --out assets --only agente_financas
node ferramentas/pxl-lite.mjs ascii arte/escritorio.px.js seta_livre   # grade com réguas
```

Detalhes que o `SKILL.md` não define e que o `pxl-lite` escolheu: com `mx`, a largura informada é a
final e a metade esquerda é espelhada; `grad(x, y, w, h, "chaves", { dir })`; o `manifest.json`.
Quando o `pxl` completo for adicionado à skill, o mesmo `arte/escritorio.px.js` deve rodar com ele
(o `manifest.json` é específico do `pxl-lite`).
