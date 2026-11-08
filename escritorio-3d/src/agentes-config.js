// Seus agentes. Edite à vontade:
//   nome     — o que aparece no painel e acima da cabeça
//   papel    — uma frase sobre o que o agente faz
//   ativo    — true: o agente está no escritório; false: o posto mostra a placa "EM BREVE"
//   projeto  — link do Projeto no claude.ai (ex.: "https://claude.ai/project/..."); vira o botão "Abrir"
//   cor      — cor do agente (camisa, cadeira, crachá); precisa bater com arte/escritorio.px.js
// O `id` liga o agente ao posto dele (src/layout.js) e à arte (agente_<id>, icone_<id>...).
export const AGENTES = [
  {
    id: "financas",
    nome: "Finanças",
    papel: "Lê seus extratos, separa gastos fixos e variáveis, monta dashboards e avisa quando um limite estoura.",
    cor: "#58ad4f",
    ativo: true,
    projeto: "",
  },
  {
    id: "investimentos",
    nome: "Investimentos",
    papel: "Avalia o melhor caminho para começar a investir e qual é o cenário mais favorável.",
    cor: "#4a8fd6",
    ativo: true,
    projeto: "",
  },
  {
    id: "terapeuta",
    nome: "Terapeuta",
    papel: "Conversa, faz perguntas e dá dicas sobre o que fazer.",
    cor: "#b995ea",
    ativo: true,
    projeto: "",
  },
  {
    id: "agenda",
    nome: "Agenda",
    papel: "Organiza seus compromissos e o seu dia.",
    cor: "#f0a067",
    ativo: false,
    projeto: "",
  },
  {
    id: "emails",
    nome: "E-mails",
    papel: "Encontra e-mails que ainda esperam a sua resposta.",
    cor: "#f2665c",
    ativo: false,
    projeto: "",
  },
  {
    id: "nutricao",
    nome: "Nutrição",
    papel: "Planeja refeições e acompanha a sua alimentação.",
    cor: "#ffd85e",
    ativo: false,
    projeto: "",
  },
  {
    id: "exercicios",
    nome: "Exercícios",
    papel: "Monta treinos e acompanha a sua rotina de atividade física.",
    cor: "#7fd4c4",
    ativo: false,
    projeto: "",
  },
  {
    id: "aprendizado",
    nome: "Aprendizado",
    papel: "Monta planos de estudo e ajuda a revisar o que você aprendeu.",
    cor: "#f59ac0",
    ativo: false,
    projeto: "",
  },
];
