# Instruções dos agentes

Cada agente que conversa dentro do escritório tem uma pasta aqui:

```
instrucoes/
└── financas/
    ├── instrucoes.md   # o texto das instruções do Projeto no claude.ai (papel, regras, formato)
    └── contexto.md     # a base de conhecimento do agente (tabelas, fórmulas, exemplos)
```

Os caminhos são ligados ao agente em `src/agentes-config.js`, no campo `conversa`.

**Estes arquivos não vão para o GitHub** (veja `.gitignore`): o repositório é público e
instruções de finanças, terapia e saúde costumam ter informações pessoais. Eles ficam só na sua
máquina e na versão publicada (privada) do escritório no claude.ai. Se o repositório virar
privado, dá para remover as linhas de `instrucoes/` do `.gitignore`.
