# Prompt de continuidade · Monitor de pacing (para o Claude Code)

> Uso: abra o Claude Code na raiz do repositório e peça:
> **"Leia monitor-pacing/CLAUDE.md e monitor-pacing/docs/PROMPT_INICIAL.md, rode os testes e me diga o estado do projeto antes de mudar qualquer coisa."**

## Contexto

A Ampla precisa de um controle de verba (pacing) consultivo para campanhas multiplataforma de
vários clientes, cada um com as suas contas. O planejado vem do **plano de mídia Ampla** (Google
Sheets, uma aba por flight). O valor monitorado é a **coluna "Investimento Plataforma R$"** de cada
linha do plano. O monitor não altera nada nas plataformas e funciona sem IA.

## O que já existe (fases 1 a 6 entregues)

- Importador do plano com validações V1–V13 e diff entre versões (`src/core/plano.js`).
- Contrato canônico do realizado, upload de CSV/.xlsx e carga idempotente (`src/core/realizado.js`, `docs/CONTRATO_DADOS.md`).
- Vinculação conjunto ↔ linha com sugestões e alocação diária entre flights (`src/core/vinculo.js`, `docs/NOMENCLATURA.md`).
- Motor de pacing: índice, média de 7 dias, diária necessária, projeção do flight e do mês, resultado por KPI, turmas (`src/core/pacing.js`).
- 15 regras de alerta com ações numéricas, mais decisões manuais, justificativas e notas (`src/core/regras.js`, `docs/REGRAS.md`).
- Interface com seis telas, gráficos, régua de ritmo, modo escuro e celular (`src/ui`).
- 37 testes (`npm test`) e build de arquivo único (`npm run build`).

## Próximas fases (fazer uma por vez e parar ao fim de cada uma)

**F7 · Plano real.** Substituir a fixture reconstruída pelo export .xlsx real do Google Sheets
(`fixtures/`). Rodar `npm test`, ajustar o parser se o layout real diferir em algo e regenerar a demo
(`node tools/gerar_demo.mjs`). Aceite: os totais por aba batem com a coluna "Investimento Plataforma R$".

**F8 · Conector do BI.** Quando o BI definir a fonte, criar `src/core/adaptadores/<fonte>.js`, que
converte a saída do conector para o contrato canônico, e um meio de carga automática: um job que gera
o CSV num lugar fixo ou um endpoint, conforme a stack que o BI escolher. **[DECISÃO]** Aceite: carga
diária sem upload manual e com `data_extracao` preenchida.

**F9 · Armazenamento compartilhado.** Hoje tudo vive no localStorage do navegador e é compartilhado
por export/import .json. Propor 2 ou 3 opções de backend (por exemplo planilha/Drive, banco gerenciado,
storage do próprio GitHub) com prós e contras, mantendo a interface de `src/ui/storage.js`. **[DECISÃO]**

**F10 · Validação das plataformas.** Confirmar na documentação oficial o comportamento de entrega de
Meta, Google, TikTok e Pinterest e atualizar `PLATAFORMAS` em `src/config/config.js` (`validado: true`),
citando a fonte em comentário.

**F11 · Report semanal.** Export no modelo Ampla: recorte de 7 dias, data de extração, desvios acima de
±10% com causa + ação vindas das justificativas. **[DECISÃO]** sobre o formato (PDF, planilha ou página).

**F12 · IA opcional (só com aprovação).** Botão "Resumo executivo do flight" desligado por padrão,
com flag por cliente, que recebe apenas números já calculados e alertas abertos, tem teto de tokens e
log de uso. Ele não cria regras nem muda status.

## Decisões em aberto
1. Fonte do realizado (conector do BI).
2. Backend compartilhado.
3. Aprovação da nomenclatura com as agências parceiras.
4. Escopo do remanejamento R12 (hoje: mesmo flight e produto).
5. Tolerâncias por cliente (hoje: ±10% / ±20%).
6. Meta de inscritos da aba Acréscimo: própria ou repetida de Outubro.
7. Formato do report semanal.

## Regras de trabalho
Leia `CLAUDE.md`, respeite as convenções (centavos, ISO, coluna monitorada, núcleo sem DOM, ações
com número), escreva teste para toda lógica nova e não adicione dependências sem perguntar.
