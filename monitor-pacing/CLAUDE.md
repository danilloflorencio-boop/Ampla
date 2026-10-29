# CLAUDE.md · monitor-pacing

Contexto para o Claude Code. Leia antes de mudar qualquer coisa.

## O que é
Monitor consultivo de pacing de mídia paga da Ampla. Compara o gasto real das plataformas com a
**coluna "Investimento Plataforma R$"** do plano de mídia (cada aba do plano = um flight; cada linha
da tabela = uma veiculação). Somente leitura nas plataformas e sem IA no núcleo.

## Comandos
- `npm test`: testes do núcleo (`node --test`). Rodar após qualquer mudança em `src/core` ou `src/config`.
- `npm run dev`: servidor estático local (porta 5173).
- `npm run build`: `dist/monitor-pacing.html` e `dist/teste-painel.html` (página de teste do painel), arquivos únicos.
- `node tools/gerar_demo.mjs`: regenera `src/demo/planoDemo.js` se o parser ou a fixture mudarem.
- `python3 tools/gerar_fixture_sebrae.py`: regenera a fixture .xlsx.
- `node tools/avisos.mjs workspace.json [--ref AAAA-MM-DD]`: avisos do dia em JSON, para o Operações Bot.

## Convenções que não podem quebrar
- **Dinheiro em centavos inteiros** em todo o núcleo. Formatar só na UI (`brl()`).
- **Datas como string ISO `AAAA-MM-DD`**, fuso America/Sao_Paulo. Contagem de dias **inclusiva**
  (02/09 → 22/09 = 21 dias, igual à planilha).
- **O dia de referência é parcial**: não entra em gasto acumulado, médias nem projeções.
- **A coluna "Investimento Plataforma R$" é a fonte da verdade.** A cascata (÷98%, −20%, −12,15%) é
  só conferência (aviso V10). Os totais e o "Resumo por plataforma" da planilha também.
- **`src/core` não toca no DOM.** Toda lógica nova entra no núcleo com teste; a UI só renderiza.
- **Toda recomendação tem entidade, número, ação e prazo.** O teste `toda recomendação é executável`
  garante isso. Texto novo de alerta vai em `src/config/textos.js`; limiar novo, em `src/config/config.js`.
- O mesmo conjunto atravessa flights. O gasto é alocado **por dia** à linha ativa (`vinculo.js`).
- Sem bibliotecas novas no app sem perguntar. Hoje são só Chart.js 4.4.1 e SheetJS 0.18.5 via cdnjs.
- Textos de interface em pt-BR, frase em caixa normal, verbos de ação nos botões.
- **Só pacing.** Nada de KPI (custo unitário, resultado, leads) nas telas nem nos avisos.
- **O app é consultivo.** Quem avisa é o chat, e só fora da margem perto do fim (`docs/AVISOS.md`).
  Dado desatualizado nunca vira aviso.
- Navegação: Painel e Equipe e avisos no menu; a Visão geral abre pelo botão do painel (nada de
  navegar ao clicar na linha). Ritmo por linha e Turmas saíram: o painel cumpre essa função.
- Equipe e avisos é da liderança (`podeGerirEquipe`). Sem login, o bloqueio vale pela pessoa escolhida
  em "Você é"; vira restrição de verdade quando houver backend/login.
- Caso novo de pacing ou de aviso entra também em `src/demo/cenarios.js`, com o esperado: o teste
  `tests/cenarios.test.js` confere o roteiro inteiro.

## Glossário
flight = aba do plano · linha = uma linha da tabela PLANO DE MÍDIA · turma = código EV-xxxxx ·
conjunto = ad set / ad group · índice de ritmo = gasto até ontem ÷ planejado até ontem (no painel,
"saúde geral" = o mesmo índice somado de todas as contas, em %) ·
diária necessária = saldo ÷ dias restantes · conta = cliente × plataforma no painel ·
margem = ±10% do índice; janela = 10 dias para o fim da linha.

## Decisões pendentes (perguntar antes de decidir)
Conector do BI · backend/armazenamento compartilhado · aprovação da nomenclatura · escopo do
remanejamento (R12) · validação dos limites de entrega das plataformas · meta do Acréscimo · IA opcional ·
entrega dos avisos pelo Operações Bot · origem do cadastro de equipe e lideranças.
