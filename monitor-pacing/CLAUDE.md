# CLAUDE.md · monitor-pacing

Contexto para o Claude Code. Leia antes de mudar qualquer coisa.

## O que é
Monitor consultivo de pacing de mídia paga da Ampla. Compara o gasto real das plataformas com a
**coluna "Investimento Plataforma R$"** do plano de mídia (cada aba do plano = um flight; cada linha
da tabela = uma veiculação). Somente leitura nas plataformas e sem IA no núcleo.

## Comandos
- `npm test`: testes do núcleo (`node --test`). Rodar após qualquer mudança em `src/core` ou `src/config`.
- `npm run dev`: servidor estático local (porta 5173).
- `npm run build`: `dist/monitor-pacing.html`, arquivo único.
- `node tools/gerar_demo.mjs`: regenera `src/demo/planoDemo.js` se o parser ou a fixture mudarem.
- `python3 tools/gerar_fixture_sebrae.py`: regenera a fixture .xlsx.

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

## Glossário
flight = aba do plano · linha = uma linha da tabela PLANO DE MÍDIA · turma = código EV-xxxxx ·
conjunto = ad set / ad group · índice de ritmo = gasto até ontem ÷ planejado até ontem ·
diária necessária = saldo ÷ dias restantes.

## Decisões pendentes (perguntar antes de decidir)
Conector do BI · backend/armazenamento compartilhado · aprovação da nomenclatura · escopo do
remanejamento (R12) · validação dos limites de entrega das plataformas · meta do Acréscimo · IA opcional.
