# Catálogo de regras (alertas e recomendações)

Motor determinístico, sem IA, em `src/core/regras.js`. Os limiares ficam em `src/config/config.js`
(`regras`, `status`) e os textos em `src/config/textos.js`. Qualquer pessoa do time de mídia
pode ajustar os dois sem mexer na lógica.

**Princípio:** toda recomendação traz **entidade, número, ação e prazo**. O teste
`tests/regras.test.js` reprova qualquer ação sem número ou com placeholder vazio.

## Base dos cálculos

- **Valor monitorado:** coluna **"Investimento Plataforma R$"** de cada linha do plano.
- **Planejado até ontem:** diária planejada (investimento ÷ dias da linha) × dias fechados.
- **Índice de ritmo:** gasto até ontem ÷ planejado até ontem. 1,00 significa no ritmo.
- **Status:** "no ritmo" com até ±10% (regra do próprio plano); "atenção" de 10% a 20%; "crítico" acima de 20%.
  Abaixo do ritmo usa cor fria; acima, cor quente.
- **O dia de hoje é parcial:** não entra no gasto acumulado, nas médias nem nas projeções.
- **Projeção:** gasto + média dos últimos 7 dias fechados × dias restantes.
- **Resultado:** segue o KPI da linha (CPC → cliques no link, CPL → leads, CPM → impressões, CPV → views, CPE → engajamentos).

## Regras

| ID | Quando dispara | Severidade | Ação gerada |
|---|---|---|---|
| R01 | Linha ativa abaixo do ritmo | atenção / crítico | Nova diária = diária necessária, com % de aumento e prazo. Se o aumento passar de +50%, avisa que o catch-up é arriscado e propõe um passo intermediário com o fechamento esperado |
| R02 | Linha ativa acima do ritmo | atenção / crítico | Reduzir a diária para a necessária e informar a data de esgotamento. Se a verba já acabou: pausar e justificar o excedente |
| R03 | Índice no ritmo, mas a média recente esgota a verba antes do fim | atenção | Fixar a diária na necessária |
| R04 | Sem gasto vinculado depois de D+3 do início (prazo de setup do plano) | crítico | Cobrar o setup da parceira com a diária a configurar, ou vincular o conjunto |
| R05 | Conjunto gastando fora do período das linhas vinculadas | info / atenção | Configurar a data de término ou vincular à linha certa |
| R05b | Gasto depois do início da turma | atenção | Confirmar com o atendimento; encerrar e remanejar o saldo |
| R06 | Custo unitário real mais de 20% acima do plano (com ≥ 3 dias e ≥ 30 resultados) | atenção | Revisar o conjunto que concentra o gasto, com o custo dele |
| R07 | Resultado projetado < 90% do plano (mesmo volume mínimo) | atenção | Verba extra necessária ao custo atual, ou entrega esperada sem ela |
| R07b | Leads projetados do flight < 90% da meta de inscritos do briefing | atenção (info se encerrado) | Sinalizar ao atendimento com o custo por lead e os leads que faltam |
| R08 | Gasto sem vínculo com o plano | atenção | Vincular (mostra a sugestão, se houver) ou justificar |
| R09 | Um conjunto com mais de 80% do gasto da linha e outro parado há 3 dias | info | Conferir a entrega dos parados ou concentrar a diária |
| R10 | 2 ou mais dias, nos últimos 7, com gasto acima de 150% da diária planejada | atenção | Alavanca da plataforma, com saldo e data de término |
| R11 | Conjunto gastando acima do orçamento diário configurado | info / atenção | Diz se o excesso está dentro do que a plataforma permite (compensa na semana ou no mês) ou não. Em flights com menos de 7 dias restantes, avisa que a compensação pode não ocorrer a tempo. Indica a alavanca da plataforma |
| R11u | Conjunto gastando menos de 50% do orçamento configurado por 3 dias | atenção | Checar o status de entrega, com o valor/dia sem uso e a sobra projetada |
| R12 | No mesmo flight e produto, uma linha com sobra projetada acima de 10% e outra no ritmo com custo ≤ plano | info | Mover R$ X de A para B, com as novas diárias de cada uma e o ganho estimado |
| R13 | Extração mais antiga que 36 h | crítico | Pedir a carga ao BI. Suspende R01–R03, R06, R07, R07b, R10–R12 e R15 |
| R14 | Desvio acima de ±10% sem justificativa registrada | info | Registrar causa + ação (exigência do plano) |
| R15 | Soma das diárias configuradas nos conjuntos ≠ diária necessária em mais de 10% | info / atenção | Ajustar a diária configurada para o valor necessário |

**Foco em pacing:** R06, R07 e R07b (custo unitário e resultado) continuam no motor, mas ficam
fora das telas e dos avisos (`regrasDeKpi` em `src/config/config.js`).

**Avisos no Google Chat:** regra própria, mais restrita que os alertas: só linha ativa fora de
±10% a 10 dias ou menos do fim, com dado em dia. Ver `docs/AVISOS.md`.

## Comportamento das plataformas (R11)

Os valores de referência estão em `PLATAFORMAS` (`src/config/config.js`) e todos aparecem como `validado: false`.
**Confirme na documentação oficial antes de usar em produção.**

| Plataforma | Over diário de referência | Teto |
|---|---|---|
| Meta Ads | até ~75% acima da diária | ~7× a diária na semana |
| Google Ads | até 2× a diária | ~30,4× a diária média no mês |
| TikTok, Pinterest | a pesquisar | a pesquisar |

## Decisões manuais

Cada alerta pode ser **aceito**, **adiado** (volta no dia seguinte) ou **descartado** com motivo.
A decisão fica registrada com data. O alerta mantém um ID estável (regra + entidade), então a
decisão continua valendo nos dias seguintes enquanto a situação persistir.
