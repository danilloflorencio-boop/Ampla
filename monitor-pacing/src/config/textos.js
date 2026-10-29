// Textos dos alertas e recomendações. Edite aqui para mudar o tom ou o formato sem tocar
// na lógica (src/core/regras.js). Placeholders entre chaves são preenchidos pelo motor
// com valores já formatados (R$, %, datas). Regra de ouro: toda AÇÃO tem entidade,
// número e prazo — se um template perder isso, ele vira recomendação rasa.

export const TEXTOS = {
  R01: {
    titulo: 'Abaixo do ritmo · {entidade}',
    mensagem: 'Gastou {gasto} de {planejado} planejados até ontem (índice {indice}). Média dos últimos {janela} dias: {media}/dia contra diária planejada de {diaria}.',
    acao: 'Subir a diária configurada de {media} para {necessaria} (+{aumento}) pelos próximos {dias} dias, até {fim}, para fechar a linha em {investimento}.',
    acaoParado: 'O conjunto está sem gasto nos últimos dias. Conferir status de entrega no gerenciador hoje e configurar diária de {necessaria} até {fim} para fechar a linha em {investimento}.',
    catchUp: 'Catch-up arriscado: subir {aumento} de uma vez tende a reiniciar o aprendizado e piorar o custo. Alternativa: subir para {passo} hoje e reavaliar amanhã, e aceitar que a linha feche em torno de {fechamento}; se houver sugestão de remanejamento (R12) para esta linha, ela indica para onde levar a sobra.',
  },
  R02: {
    titulo: 'Acima do ritmo · {entidade}',
    mensagem: 'Gastou {gasto} contra {planejado} planejados até ontem (índice {indice}). No ritmo atual ({media}/dia) a verba acaba em {esgota}, {diasAntes} dia(s) antes do fim ({fim}).',
    acao: 'Reduzir a diária configurada de {media} para {necessaria} ({reducao}) a partir de hoje, até {fim}, para fechar a linha em {investimento}.',
    mensagemEsgotada: 'Gastou {gasto} contra {planejado} planejados até ontem (índice {indice}) e já passou do Investimento Plataforma da linha ({investimento}).',
    acaoEsgotada: 'O Investimento Plataforma da linha ({investimento}) já foi consumido ({gasto}). Pausar ou encerrar o conjunto hoje; o excedente de {excedente} precisa de justificativa no report.',
  },
  R03: {
    titulo: 'Ritmo recente acelerou · {entidade}',
    mensagem: 'O índice acumulado está no ritmo ({indice}), mas a média dos últimos {janela} dias ({media}/dia) esgota a verba em {esgota}, antes do fim ({fim}).',
    acao: 'Fixar a diária configurada em {necessaria} até {fim}.',
  },
  R04: {
    titulo: 'Sem veiculação · {entidade}',
    mensagem: 'A linha começou em {inicio} e não tem gasto vinculado há {dias} dias (prazo de setup do plano: D+{setup}).',
    acao: 'Cobrar hoje da agência parceira o setup da linha (código {codigo}) com diária de {necessaria} até {fim}. Se já está no ar, vincular o conjunto em Vínculos.',
  },
  R05: {
    titulo: 'Gasto fora do período · {entidade}',
    mensagem: 'O conjunto gastou {gasto} em {dias} dia(s) fora do período das linhas vinculadas (último dia: {ultimo}).',
    acao: 'Configurar a data de término do conjunto no fim da linha vinculada ({fimLinha}) ou vinculá-lo à linha correta. O valor fora do período não conta no pacing.',
  },
  R05b: {
    titulo: 'Veiculando depois do início da turma · {entidade}',
    mensagem: 'A turma começa em {turma} e a linha teve {gasto} de gasto a partir dessa data.',
    acao: 'Confirmar com o atendimento se a turma aceita inscrições após o início; se não, encerrar o conjunto e remanejar o saldo de {saldo}.',
  },
  R06: {
    titulo: 'Custo acima do plano · {entidade}',
    mensagem: '{kpi} real de {custoReal} contra {custoPlan} planejado ({variacao}). Projeção: {projetado} {rotulo} de {plano} planejados.',
    acao: 'O conjunto {conjunto} concentra {pctConjunto} do gasto da linha com {kpi} de {custoConjunto}: revisar segmentação e criativo desse conjunto esta semana.',
    acaoRemanejar: 'Remanejar {valor} desta linha para {destino} ({kpi} de {custoDestino}), que renderia cerca de {ganho} {rotulo} a mais.',
  },
  R07: {
    titulo: 'Resultado projetado abaixo do plano · {entidade}',
    mensagem: 'Projeção de {projetado} {rotulo} contra {plano} planejados ({pctMeta}).',
    acao: 'Sinalizar ao atendimento: ao custo atual de {custoReal}, bater o plano exigiria {verbaExtra} a mais de investimento em plataforma; sem isso, a entrega esperada é {projetado} {rotulo}.',
  },
  R07b: {
    titulo: 'Meta de inscritos em risco · {entidade}',
    mensagem: 'Leads projetados no flight: {projetado} contra meta de {meta} inscritos do briefing ({pctMeta}). Leads até ontem: {leads}.',
    acao: 'Sinalizar ao atendimento até {prazo}: ao custo por lead atual de {cpl}, faltam cerca de {falta} leads, o equivalente a {verba} de investimento em plataforma além do plano.',
    acaoEncerrado: 'Flight encerrado: registrar no report {leads} leads contra a meta de {meta} e levar o custo por lead real ({cpl}) para o planejamento do próximo flight.',
  },
  R08: {
    titulo: 'Gasto sem vínculo com o plano · {entidade}',
    mensagem: '{gasto} em {dias} dia(s) ({primeiro} a {ultimo}) sem linha do plano vinculada.',
    acao: 'Vincular o conjunto em Vínculos{sugestao}: são {gasto} que hoje não entram no pacing de nenhuma linha. Se for campanha fora do plano, registrar a justificativa até o report semanal.',
  },
  R09: {
    titulo: 'Gasto concentrado em um conjunto · {entidade}',
    mensagem: '{conjunto} concentra {pct} do gasto da linha; {parados} conjunto(s) sem gasto nos últimos 3 dias.',
    acao: 'Conferir status de entrega de {listaParados} (reprovação, aprendizado limitado ou público pequeno) e, se forem descontinuados, ajustar a diária de {conjunto} para {necessaria}.',
  },
  R10: {
    titulo: 'Picos diários acima do plano · {entidade}',
    mensagem: '{dias} dia(s) nos últimos 7 com gasto acima de {limite} (150% da diária planejada de {diaria}). Maior pico: {pico} em {dataPico}.',
    acao: '{alavanca}',
  },
  R11: {
    titulo: 'Over-delivery da plataforma · {entidade}',
    mensagem: '{dias} dia(s) com gasto acima do orçamento diário configurado ({orcamento}); maior: {pico} em {dataPico} ({excesso} acima). {comportamento}',
    acao: '{alavanca}',
  },
  R11u: {
    titulo: 'Entrega limitada pela plataforma · {entidade}',
    mensagem: 'Nos últimos {dias} dias o conjunto gastou em média {media}/dia, {pct} do orçamento configurado de {orcamento}.',
    acao: 'Abrir o conjunto no gerenciador hoje e checar o status de entrega: estão ficando {naoGasto}/dia sem uso, cerca de {sobra} até {fim} se nada mudar. Se estiver em "aprendizado limitado" ou com público pequeno, consolidar a verba em outro conjunto da mesma linha; se for lance/custo-alvo, afrouxar o limite.',
  },
  R12: {
    titulo: 'Remanejamento sugerido · {origem} → {destino}',
    mensagem: '{origem} deve fechar com sobra de {sobra}. {destino} está com {kpi} de {custoDestino} ({variacao} vs plano) e no ritmo.',
    acao: 'Mover {valor} de {origem} para {destino}: reduzir a diária de {origem} para {novaOrigem} e subir a de {destino} para {novaDestino} até {fim}. Ganho estimado: {ganho} {rotulo}.',
  },
  R13: {
    titulo: 'Dados desatualizados',
    mensagem: 'A extração mais recente é de {extracao}. Alertas de ritmo e custo foram suspensos até a próxima carga.',
    acao: 'Pedir ao BI a carga de {ontem} ou subir o CSV do dia.',
  },
  R14: {
    titulo: 'Desvio sem justificativa · {entidade}',
    mensagem: 'Desvio de {desvio} contra o planejado (limite do plano: ±10%) sem causa e ação registradas.',
    acao: 'Registrar causa + ação para o desvio de {desvio} ({valor} contra o planejado) no campo de justificativa da linha antes do report semanal.',
  },
  R15: {
    titulo: 'Orçamento configurado diferente do plano · {entidade}',
    mensagem: 'Soma das diárias configuradas nos conjuntos da linha: {configurado}. Diária necessária para fechar o plano: {necessaria} ({variacao}).',
    acao: 'Ajustar a diária configurada para {necessaria} até {fim}{detalhe}.',
  },

  // Avisos enviados pelo Google Chat (src/core/avisos.js). Mesmo princípio: entidade, número,
  // ação e prazo. Ícones: 🔺 acima do ritmo, 🔻 abaixo; 🟡 até 20% de desvio, 🔴 acima disso.
  // {link} já vem com o espaço e os parênteses: " (https://…)", ou vazio se não houver link.
  AVISO_ANALISTA: {
    abertura: 'Olá {nome}',
    conta: '📊 O pacing da conta {conta} {estado} (dados até {ontem}). Consulte o Monitor de pacing{link} para ver o andamento da conta. Se confirmado, ajuste na plataforma para garantir a normalidade até o fim de cada linha:',
    rodape: 'Este aviso só sai quando uma linha fica fora da margem de ±{margem} e faltam {janela} dias ou menos para ela acabar. Antes disso, a oscilação é natural e o ritmo ainda tem tempo de se acertar.',
  },
  AVISO_LIDERANCA: {
    abertura: 'Olá {nome}',
    resumo: '📊 Overview de pacing do seu time em {data} (dados até {ontem}): {n} conta(s) com linhas fora da margem de ±{margem} a {janela} dias ou menos do fim. Consulte o Monitor de pacing{link} para ver o andamento.',
    conta: '{icone} {conta} · analista {analista}\n   O pacing da conta {estado} · projeção {projecao} de {investimento} até {fim}',
    acao: '   Ação: alinhar com {analista} o ajuste de diária na plataforma de {nFora} linha(s) até amanhã ({amanha}).',
  },
  // Estado da conta no cabeçalho da mensagem.
  AVISO_ESTADO: {
    muitoAcima: 'está muito acima do previsto ({desvio})',
    acima: 'está acima do previsto ({desvio})',
    muitoAbaixo: 'está muito abaixo do previsto ({desvio})',
    abaixo: 'está abaixo do previsto ({desvio})',
    misto: 'está no ritmo no total ({desvio}), mas tem {n} linha(s) fora da margem de ±{margem}',
  },
  AVISO_LINHA: {
    item: '{icone} {entidade} · até {fim} ({prazo})\n   Gastou {gasto} de {planejado} previstos até ontem (índice {indice}, {desvio}).',
    diario: '   Ação: ajustar o orçamento diário de {atual} para {novo} ({variacao} por dia) a partir de hoje, até {fim}, para fechar a linha em {investimento}.',
    indefinido: '   Ação: ajustar o orçamento diário de {atual} para {novo} ({variacao} por dia) a partir de hoje, até {fim}, para fechar a linha em {investimento}. Se o conjunto usar orçamento total, ajuste o total para {total}.',
    total: '   Ação: ajustar hoje o orçamento total {conjuntos} para {total}, para fechar a linha em {investimento} até {fim} (equivale a {novo} por dia).',
    parado: '   Ação: conferir hoje a entrega no gerenciador; o conjunto está sem gasto. Configurar {novo} por dia até {fim} para fechar a linha em {investimento}.',
    esgotada: '   Ação: pausar hoje. O investimento de {investimento} já foi consumido ({gasto}); o excedente de {excedente} precisa de justificativa.',
  },
};

/** Preenche um template: t('R01', 'acao', { media: 'R$ 10,00' }). */
export function t(regra, campo, vars = {}) {
  const tpl = TEXTOS[regra]?.[campo] ?? '';
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] === undefined || vars[k] === null ? '—' : String(vars[k])));
}
