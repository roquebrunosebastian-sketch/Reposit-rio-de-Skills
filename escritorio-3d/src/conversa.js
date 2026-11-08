// Conversa com os agentes dentro do escritório (etapa 2).
//
// Só funciona na versão publicada no claude.ai, que dá à página três recursos:
//   sample — pergunta ao Claude (na conta de quem está vendo; o 1º envio pede permissão)
//   db     — guarda o histórico em data/users/<id>/, área privada de cada pessoa
//   user   — o id de quem está vendo, para achar essa área
// Cada chamada ao Claude é independente: as instruções e o contexto do agente vão sempre como
// a primeira mensagem, seguidos do histórico. O agente termina cada resposta com uma linha
// [[status: alerta|pensando|concluido | resumo]], que vira o balão acima da cabeça dele.
import { AGENTES } from "./agentes-config.js";

const LIMITE_BYTES = 245000;          // a chamada aceita até 256 KiB de texto
const MAX_TEXTO_ANEXO = 120000;       // caracteres por arquivo de texto
const MAX_TEXTO_MENSAGEM = 180000;    // caracteres de anexos por mensagem (o documento do histórico tem 256 KiB)
const TIPOS_IMAGEM = /^image\/(png|jpeg|webp|gif)$/;
const SEM_PERMISSAO = ["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed"];

const ERROS = {
  rate_limited: "Muitas mensagens seguidas ou limite de uso atingido. Tente de novo em alguns minutos.",
  prompt_too_large: "A conversa ficou grande demais para enviar. Comece uma nova conversa ou anexe arquivos menores.",
  refused: "O Claude não respondeu a esse pedido. Tente reformular a mensagem.",
  empty_completion: "A resposta veio vazia. Tente reformular a mensagem.",
  session_expired: "Sua sessão no claude.ai expirou. Entre de novo e reenvie.",
  image_rejected: "Uma das imagens não foi aceita (tipo ou tamanho). Envie PNG ou JPG menores.",
  images_unavailable: "Esta visualização não envia imagens. Exporte a fatura em CSV ou OFX.",
};

function integracao() {
  const hoje = new Date().toLocaleDateString("pt-BR");
  return `Você é um dos agentes do "Escritório de Agentes" e conversa com o seu cliente pela janela de chat do escritório. Siga as instruções e use o contexto abaixo; em caso de conflito, as instruções prevalecem.

Regras deste ambiente:
- Hoje é ${hoje}.
- Você não pode gerar arquivos, HTML nem gráficos. Quando as instruções pedirem um dashboard ou uma planilha, mostre os mesmos dados em tabelas Markdown (com |) e listas, na mesma ordem.
- Os arquivos de texto que o cliente anexar chegam dentro da mensagem dele, entre <<arquivo nome="..."> e <</arquivo>>. Imagens anexadas chegam junto com a última mensagem; as de mensagens anteriores não são reenviadas, então registre na sua resposta os dados que tirar delas.
- Termine TODA resposta com uma última linha exatamente neste formato, sem nada depois dela:
  [[status: alerta | frase curta]] quando a resposta tiver um alerta obrigatório ou um risco que o cliente precisa ver;
  [[status: pensando | frase curta]] quando você precisar de uma resposta ou de dados do cliente para continuar;
  [[status: concluido | frase curta]] quando entregou o que foi pedido, sem pendências.
  A frase curta tem até 60 caracteres e resume a situação para o painel do escritório, por exemplo "Fatura de dezembro em 37% da renda".`;
}

const RE_STATUS = /\s*\[\[\s*status\s*:\s*(alerta|pensando|conclu[ií]do)\s*(?:\|\s*([^\]]*?))?\s*\]\]\s*$/i;

export function extrairStatus(texto) {
  const m = texto.match(RE_STATUS);
  if (!m) return { limpo: texto.trim(), status: "concluido", resumo: "" };
  const status = m[1].toLowerCase().startsWith("conclu") ? "concluido" : m[1].toLowerCase();
  return { limpo: texto.slice(0, m.index).trim(), status, resumo: (m[2] || "").trim().slice(0, 80) };
}

// Enquanto a resposta chega, esconde a linha de status ainda incompleta no fim do texto
const semStatusParcial = (t) => t.replace(/\s*\[\[[^\]]*(\]\]?)?\s*$/, "");

function markdown(texto) {
  const marked = window.marked, purify = window.DOMPurify;
  if (!marked?.parse || !purify?.sanitize) {
    const p = document.createElement("p");
    p.style.whiteSpace = "pre-wrap";
    p.textContent = texto;
    return p.outerHTML;
  }
  const html = purify.sanitize(marked.parse(texto, { gfm: true, breaks: true, async: false }));
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  for (const a of tmp.querySelectorAll("a")) { a.target = "_blank"; a.rel = "noopener"; }
  for (const t of tmp.querySelectorAll("table")) {      // tabelas largas rolam sozinhas
    const caixa = document.createElement("div");
    caixa.className = "tabela";
    t.replaceWith(caixa);
    caixa.appendChild(t);
  }
  return tmp.innerHTML;
}

function tamanhoLegivel(bytes) {
  return bytes > 1e6 ? (bytes / 1e6).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(bytes / 1e3)) + " KB";
}

export class Conversas {
  constructor({ api, aoMudar = () => {}, aoAbrirFechar = () => {} }) {
    this.api = api;
    this.aoMudar = aoMudar;
    this.aoAbrirFechar = aoAbrirFechar;
    this.historicos = new Map();
    this.textos = new Map();
    this.resumos = new Map();
    this.pendentes = [];
    this.atual = null;
    this.ocupado = false;
    this.bloqueado = null;   // motivo, quando o Claude não está disponível nesta visualização
    this.el = {
      painel: document.querySelector("#conversa"),
      cracha: document.querySelector("#conversa-cracha"),
      nome: document.querySelector("#conversa-nome"),
      titulo: document.querySelector("#conversa-titulo"),
      lista: document.querySelector("#conversa-mensagens"),
      form: document.querySelector("#conversa-form"),
      texto: document.querySelector("#conversa-texto"),
      arquivo: document.querySelector("#conversa-arquivo"),
      anexos: document.querySelector("#conversa-anexos"),
      enviar: document.querySelector("#conversa-enviar"),
      parar: document.querySelector("#conversa-parar"),
      nova: document.querySelector("#conversa-nova"),
      fechar: document.querySelector("#conversa-fechar"),
      nota: document.querySelector("#conversa-nota"),
    };
    this.recursos = this._iniciar();
    this._ligarEventos();
  }

  /** O agente tem conversa configurada? */
  tem(id) {
    return !!AGENTES.find((a) => a.id === id)?.conversa;
  }

  /** Último resumo que o agente deu (vai para o painel). */
  resumo(id) {
    return this.resumos.get(id) || "";
  }

  async abrir(id) {
    const cfg = AGENTES.find((a) => a.id === id);
    if (!cfg?.conversa) return;
    this.atual = cfg;
    const { painel, cracha, nome, titulo } = this.el;
    painel.style.setProperty("--cor", cfg.cor);
    cracha.src = `assets/icone_${cfg.id}.png`;
    nome.textContent = cfg.nome;
    titulo.textContent = cfg.conversa.titulo || cfg.papel;
    this.el.texto.placeholder = `Escreva para ${cfg.nome}…`;
    painel.hidden = false;
    document.body.classList.add("conversando");
    this.aoAbrirFechar(true, id);
    this._renderizarAnexos();
    this._nota("");
    if (!this.api.presente(id)) this.api.chegar(id);

    if (!this.historicos.has(id)) {
      this._renderizar([{ papel: "sistema", texto: "Carregando a conversa…" }]);
      this.historicos.set(id, await this._carregar(id));
      const ultimo = [...this.historicos.get(id)].reverse().find((m) => m.papel === "assistant");
      if (ultimo?.resumo) { this.resumos.set(id, ultimo.resumo); this.aoMudar(); }
    }
    if (this.atual?.id !== id) return;
    this._renderizar();
    this._atualizarComposicao();
    if (!(await this.recursos).sample) { this._bloquear(); return; }
    if (!this.ocupado) this.el.texto.focus({ preventScroll: true });
  }

  fechar() {
    if (this.el.painel.hidden) return;
    this.el.painel.hidden = true;
    document.body.classList.remove("conversando");
    this.aoAbrirFechar(false, this.atual?.id);
  }

  // ------------------------------------------------------------------------------------------
  async _iniciar() {
    const c = window.claude;
    if (typeof c?.use !== "function") return { sample: null, db: null, uid: null, limites: null };
    const [sample, db, user] = await Promise.all(["sample", "db", "user"].map((n) => c.use(n).catch(() => null)));
    const uid = user ? await user.id().catch(() => null) : null;
    const limites = sample ? await sample.limits().catch(() => null) : null;
    return { sample, db, uid, limites };
  }

  _ligarEventos() {
    const { form, texto, arquivo, parar, nova, fechar } = this.el;
    form.addEventListener("submit", (ev) => { ev.preventDefault(); this._enviar(); });
    texto.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); this._enviar(); }
    });
    texto.addEventListener("input", () => this._atualizarComposicao());
    arquivo.addEventListener("change", async () => {
      const arquivos = [...arquivo.files];
      arquivo.value = "";
      for (const f of arquivos) {
        try { this.pendentes.push(await this._lerArquivo(f)); } catch (e) { this._nota(e.message, true); }
      }
      this._renderizarAnexos();
      this._atualizarComposicao();
    });
    this.el.anexos.addEventListener("click", (ev) => {
      const b = ev.target.closest("button[data-indice]");
      if (!b) return;
      this.pendentes.splice(Number(b.dataset.indice), 1);
      this._renderizarAnexos();
      this._atualizarComposicao();
    });
    parar.addEventListener("click", () => this.controle?.abort());
    fechar.addEventListener("click", () => this.fechar());
    document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && !this.el.painel.hidden) this.fechar(); });
    // "Nova conversa" pede confirmação na própria página (sem confirm())
    let confirmar = null;
    nova.addEventListener("click", async () => {
      if (!confirmar) {
        nova.textContent = "Apagar histórico?";
        nova.classList.add("perigo");
        confirmar = setTimeout(() => { confirmar = null; nova.textContent = "Nova conversa"; nova.classList.remove("perigo"); }, 3500);
        return;
      }
      clearTimeout(confirmar);
      confirmar = null;
      nova.textContent = "Nova conversa";
      nova.classList.remove("perigo");
      await this._apagar(this.atual.id);
    });
  }

  async _instrucoes(cfg) {
    if (this.textos.has(cfg.id)) return this.textos.get(cfg.id);
    const ler = async (caminho) => {
      if (!caminho) return "";
      const r = await fetch(new URL("../" + caminho, import.meta.url));
      if (!r.ok) throw new Error(`Não encontrei ${caminho}. Coloque as instruções do agente nesse arquivo (veja instrucoes/LEIAME.md).`);
      return r.text();
    };
    const [instrucoes, contexto] = await Promise.all([ler(cfg.conversa.instrucoes), ler(cfg.conversa.contexto)]);
    const base = `${integracao()}

<instrucoes_do_agente>
${instrucoes.trim()}
</instrucoes_do_agente>${contexto ? `

<contexto_do_agente>
${contexto.trim()}
</contexto_do_agente>` : ""}`;
    this.textos.set(cfg.id, base);
    return base;
  }

  async _lerArquivo(f) {
    const { limites } = await this.recursos;
    if (TIPOS_IMAGEM.test(f.type)) {
      if (!limites?.images) throw new Error(ERROS.images_unavailable);
      if (f.size > limites.images.maxInputBytes) throw new Error(`${f.name} passa de ${tamanhoLegivel(limites.images.maxInputBytes)}.`);
      if (this.pendentes.filter((a) => a.blob).length >= limites.images.maxCount) throw new Error(`Envie no máximo ${limites.images.maxCount} imagens por mensagem.`);
      return { nome: f.name, tipo: f.type, tamanho: f.size, blob: f };
    }
    if (f.type === "application/pdf" || /\.pdf$/i.test(f.name))
      throw new Error(`${f.name}: PDF ainda não é lido aqui. Exporte a fatura em CSV ou OFX, ou envie um print de cada página.`);
    const buf = await f.arrayBuffer();
    let texto = new TextDecoder("utf-8").decode(buf);
    if (texto.includes("\uFFFD")) texto = new TextDecoder("iso-8859-1").decode(buf);   // OFX de banco costuma vir em Latin-1
    if (texto.length > MAX_TEXTO_ANEXO) texto = texto.slice(0, MAX_TEXTO_ANEXO) + "\n[... o restante do arquivo foi cortado ...]";
    const jaAnexado = this.pendentes.reduce((s, a) => s + (a.texto?.length || 0), 0);
    if (jaAnexado + texto.length > MAX_TEXTO_MENSAGEM) throw new Error(`${f.name} não coube nesta mensagem. Envie os arquivos em mensagens separadas.`);
    return { nome: f.name, tipo: f.type || "text/plain", tamanho: f.size, texto };
  }

  _conteudo(m) {
    if (m.papel === "assistant") return m.status ? `${m.texto}\n\n[[status: ${m.status} | ${m.resumo || ""}]]` : m.texto;
    let c = m.texto || "(sem texto)";
    for (const a of m.anexos || []) {
      c += a.conteudo != null
        ? `\n\n<<arquivo nome="${a.nome}">>\n${a.conteudo}\n<</arquivo>>`
        : `\n\n(imagem anexada: ${a.nome})`;
    }
    return c;
  }

  // As instruções sempre vão; do histórico, cabem as mensagens mais recentes.
  _turnos(base, historico) {
    const bytes = (s) => new TextEncoder().encode(s).length;
    let total = bytes(base);
    const turnos = [];
    for (let i = historico.length - 1; i >= 0; i--) {
      const m = historico[i];
      if (m.papel !== "user" && m.papel !== "assistant") continue;
      const conteudo = this._conteudo(m);
      const b = bytes(conteudo);
      if (turnos.length && total + b > LIMITE_BYTES) break;
      turnos.unshift({ role: m.papel, content: conteudo });
      total += b;
    }
    return [{ role: "user", content: base }, ...turnos];
  }

  async _enviar() {
    const cfg = this.atual;
    if (!cfg || this.ocupado || this.bloqueado) return;
    const texto = this.el.texto.value.trim();
    const anexos = this.pendentes;
    if (!texto && !anexos.length) return;
    const { sample } = await this.recursos;
    if (!sample) { this._bloquear(); return; }
    let base;
    try { base = await this._instrucoes(cfg); } catch (e) { this._nota(e.message, true); return; }

    const historico = this.historicos.get(cfg.id);
    const msgUsuario = {
      papel: "user", texto, criadoEm: Date.now(),
      anexos: anexos.map((a) => ({ nome: a.nome, tipo: a.tipo, tamanho: a.tamanho, ...(a.texto != null ? { conteudo: a.texto } : {}) })),
    };
    historico.push(msgUsuario);
    this.el.texto.value = "";
    this.pendentes = [];
    this._renderizarAnexos();
    this.ocupado = true;
    this._atualizarComposicao();
    this._nota("");
    this._renderizar();
    const bolha = this._bolhaEmAndamento(cfg);
    if (!this.api.presente(cfg.id)) this.api.chegar(cfg.id);
    this.api.definirStatus(cfg.id, "trabalhando");

    const imagens = anexos.filter((a) => a.blob).map((a) => a.blob);
    const controle = (this.controle = new AbortController());
    let quadro = 0;
    try {
      const r = await sample(this._turnos(base, historico), {
        cache: false,
        signal: controle.signal,
        ...(imagens.length ? { images: imagens } : {}),
        onText: ({ text }) => {
          cancelAnimationFrame(quadro);
          quadro = requestAnimationFrame(() => bolha.mostrar(semStatusParcial(text)));
        },
      });
      cancelAnimationFrame(quadro);
      const { limpo, status, resumo } = extrairStatus(r.text);
      const msgAgente = { papel: "assistant", texto: limpo, status, resumo, criadoEm: Date.now(), ...(r.truncated ? { cortada: true } : {}) };
      historico.push(msgAgente);
      this._concluir(cfg, status, resumo);
      await this._salvar(cfg.id, [msgUsuario, msgAgente]);
      if (r.truncated) this._nota("A resposta foi cortada no limite de tamanho. Peça \"continue\" para ver o resto.");
    } catch (e) {
      cancelAnimationFrame(quadro);
      const codigo = e?.code || "upstream_error";
      if (e?.text && codigo !== "refused") {
        // guarda o que chegou a ser escrito, marcado como interrompido
        const { limpo, status, resumo } = extrairStatus(e.text);
        const msgAgente = { papel: "assistant", texto: limpo, status: "pensando", resumo: resumo || "Resposta interrompida", criadoEm: Date.now(), cortada: true };
        historico.push(msgAgente);
        this._concluir(cfg, status === "alerta" ? "alerta" : "pensando", msgAgente.resumo);
        await this._salvar(cfg.id, [msgUsuario, msgAgente]);
        if (codigo !== "cancelled") this._nota((ERROS[codigo] || "A conexão caiu no meio da resposta.") + " O que chegou foi guardado.", true);
      } else {
        // nada foi respondido: devolve a mensagem e os anexos para reenviar
        historico.splice(historico.indexOf(msgUsuario), 1);
        if (!this.el.texto.value) this.el.texto.value = texto;
        this.pendentes = anexos;
        this._renderizarAnexos();
        this.api.definirStatus(cfg.id, "nenhum");
        if (SEM_PERMISSAO.includes(codigo)) this._bloquear(codigo);
        else if (codigo !== "cancelled") this._nota(ERROS[codigo] || "Falha de conexão. Sua mensagem foi mantida; tente enviar de novo.", true);
      }
    } finally {
      this.ocupado = false;
      this.controle = null;
      if (this.atual?.id === cfg.id) { this._renderizar(); this._atualizarComposicao(); }
    }
  }

  _concluir(cfg, status, resumo) {
    this.api.definirStatus(cfg.id, status);
    if (resumo) this.resumos.set(cfg.id, resumo);
    this.aoMudar();
  }

  // ------------------------------------------------------------------------------------------
  // Histórico em data/users/<id>/<agente>/mensagens (área privada de quem está vendo)
  _colecao(recursos, id) {
    return recursos.db.collection("data/users/" + recursos.uid).doc(id).collection("mensagens");
  }

  async _carregar(id) {
    const r = await this.recursos;
    if (!r.db || !r.uid) return [];
    try {
      const snap = await Promise.race([
        this._colecao(r, id).orderBy("criadoEm").limit(500).get(),
        new Promise((_, nao) => setTimeout(() => nao({ code: "timeout" }), 10000)),
      ]);
      return snap.docs.map((d) => ({ ...d.data(), _id: d.id }));
    } catch {
      this._nota("Não consegui carregar o histórico agora; as novas mensagens continuam funcionando.", true);
      return [];
    }
  }

  async _salvar(id, mensagens) {
    const r = await this.recursos;
    if (!r.db || !r.uid) return;
    try {
      for (const m of mensagens) {
        const { _id, ...corpo } = m;
        const ref = this._colecao(r, id).doc();
        await ref.set(corpo);
        m._id = ref.id;
      }
    } catch (e) {
      this._nota(e?.code === "quota_exceeded"
        ? "O histórico encheu. Use \"Nova conversa\" para liberar espaço."
        : "Não consegui salvar esta conversa no histórico.", true);
    }
  }

  async _apagar(id) {
    const r = await this.recursos;
    const historico = this.historicos.get(id) || [];
    if (r.db && r.uid) {
      for (const m of historico) if (m._id) await this._colecao(r, id).doc(m._id).delete().catch(() => {});
    }
    this.historicos.set(id, []);
    this.resumos.delete(id);
    this.api.definirStatus(id, "nenhum");
    this.aoMudar();
    if (this.atual?.id === id) this._renderizar();
  }

  // ------------------------------------------------------------------------------------------
  // Interface
  async _bloquear(codigo) {
    const r = await this.recursos;
    this.bloqueado = codigo || (r.sample ? null : "sem_claude");
    this._atualizarComposicao();
    const cfg = this.atual;
    const link = /^https:\/\//.test(cfg?.projeto || "") ? ` Você também pode conversar no <a href="${cfg.projeto}" target="_blank" rel="noopener">projeto de ${cfg.nome}</a>.` : "";
    this._nota(codigo
      ? `O escritório não tem permissão para usar o Claude nesta visualização.${link}`
      : `A conversa funciona na versão do escritório publicada no claude.ai.${link}`, true, true);
  }

  _atualizarComposicao() {
    const { texto, enviar, parar, arquivo } = this.el;
    const travado = this.ocupado || !!this.bloqueado;
    texto.disabled = !!this.bloqueado;
    arquivo.disabled = travado;
    enviar.disabled = travado || (!texto.value.trim() && !this.pendentes.length);
    enviar.hidden = this.ocupado;
    parar.hidden = !this.ocupado;
  }

  _nota(msg, aviso = false, html = false) {
    const n = this.el.nota;
    n.hidden = !msg;
    n.classList.toggle("aviso", aviso);
    if (html) n.innerHTML = msg; else n.textContent = msg;
  }

  _renderizarAnexos() {
    this.el.anexos.replaceChildren(...this.pendentes.map((a, i) => {
      const chip = document.createElement("span");
      chip.className = "anexo";
      chip.textContent = `${a.blob ? "Imagem" : "Arquivo"}: ${a.nome} (${tamanhoLegivel(a.tamanho)})`;
      const x = document.createElement("button");
      x.type = "button";
      x.dataset.indice = i;
      x.setAttribute("aria-label", `Remover ${a.nome}`);
      x.textContent = "✕";
      chip.appendChild(x);
      return chip;
    }));
    this.el.anexos.hidden = !this.pendentes.length;
  }

  _renderizar(lista) {
    const cfg = this.atual;
    if (!cfg) return;
    const msgs = lista || this.historicos.get(cfg.id) || [];
    const itens = [];
    if (!lista && cfg.conversa.saudacao) itens.push(this._bolha({ papel: "assistant", texto: cfg.conversa.saudacao, saudacao: true }, cfg));
    for (const m of msgs) itens.push(this._bolha(m, cfg));
    this.el.lista.replaceChildren(...itens);
    this.el.lista.scrollTop = this.el.lista.scrollHeight;
  }

  _bolha(m, cfg) {
    const div = document.createElement("article");
    if (m.papel === "sistema") {
      div.className = "msg msg-sistema";
      div.textContent = m.texto;
      return div;
    }
    const doAgente = m.papel === "assistant";
    div.className = "msg " + (doAgente ? "msg-agente" : "msg-usuario");
    const quem = document.createElement("header");
    quem.textContent = doAgente ? cfg.nome : "Você";
    div.appendChild(quem);
    const corpo = document.createElement("div");
    corpo.className = "corpo";
    if (doAgente) corpo.innerHTML = markdown(m.texto);
    else corpo.textContent = m.texto;
    div.appendChild(corpo);
    if (m.anexos?.length) {
      const anexos = document.createElement("p");
      anexos.className = "anexos-msg";
      anexos.textContent = m.anexos.map((a) => `${a.conteudo != null ? "Arquivo" : "Imagem"}: ${a.nome}`).join(" · ");
      div.appendChild(anexos);
    }
    if (doAgente && (m.resumo || m.cortada)) {
      const rodape = document.createElement("p");
      rodape.className = "status-msg status-" + (m.status || "concluido");
      rodape.textContent = [m.resumo, m.cortada ? "resposta incompleta" : ""].filter(Boolean).join(" · ");
      div.appendChild(rodape);
    }
    return div;
  }

  _bolhaEmAndamento(cfg) {
    const div = this._bolha({ papel: "assistant", texto: "" }, cfg);
    const corpo = div.querySelector(".corpo");
    corpo.innerHTML = `<p class="digitando">${cfg.nome} está analisando<span>.</span><span>.</span><span>.</span></p>`;
    this.el.lista.appendChild(div);
    this.el.lista.scrollTop = this.el.lista.scrollHeight;
    const lista = this.el.lista;
    return {
      mostrar(texto) {
        const noFim = lista.scrollHeight - lista.scrollTop - lista.clientHeight < 60;
        corpo.innerHTML = markdown(texto);
        if (noFim) lista.scrollTop = lista.scrollHeight;
      },
    };
  }
}
