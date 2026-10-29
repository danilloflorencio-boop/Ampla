// Configuração central do monitor. Tudo que é "regra de negócio ajustável" mora aqui,
// para o time de mídia mudar sem mexer na lógica. Valores por cliente podem sobrescrever
// estes padrões (ver `configDoCliente`).

export const CONFIG_PADRAO = {
  // O valor monitorado é a coluna "Investimento Plataforma R$" do plano Ampla.
  colunaMonitorada: 'Investimento Plataforma R$',

  // Faixas de status do índice de pacing (gasto realizado ÷ planejado até ontem).
  // ±10% vem da regra do próprio plano: desvio acima de ±10% precisa de justificativa.
  status: {
    noRitmo: 0.10,   // |índice − 1| ≤ 10%  → no ritmo
    atencao: 0.20,   // 10% < |índice − 1| ≤ 20% → atenção; acima → crítico
  },

  // Prazo de setup do plano: "upload e setup concluídos em D+3".
  diasSetup: 3,

  // Janela da média móvel usada nas projeções.
  janelaMediaDias: 7,

  // Limiares do motor de regras (ver src/core/regras.js e docs/REGRAS.md).
  regras: {
    minDiasParaCusto: 3,           // dias fechados mínimos antes de julgar custo unitário
    minResultadosParaCusto: 30,    // resultados mínimos (cliques, leads…) antes de julgar custo
    custoAcimaDoPlano: 0.20,       // custo real > plano em 20% → alerta
    metaProjetadaMinima: 0.90,     // resultado projetado < 90% do plano → alerta
    catchUpArriscado: 0.50,        // diária necessária > 150% da média atual → catch-up arriscado
    concentracaoConjunto: 0.80,    // um conjunto com > 80% do gasto da linha, havendo outro parado
    picoDiarioVsPlano: 0.50,       // dia com gasto > 150% da diária planejada
    diasPicoParaAlerta: 2,         // quantos dias de pico (últimos 7) disparam alerta
    orcamentoDivergente: 0.10,     // orçamento diário configurado difere do plano em > 10%
    dadosDesatualizadosHoras: 36,  // extração mais antiga que isso suspende regras
    sobraParaRemanejar: 0.10,      // sobra projetada > 10% da linha é candidata a remanejamento
  },

  // Remanejamento (R12): só sugere mover verba entre linhas do MESMO flight e MESMO produto.
  // [DECISÃO em aberto] pode virar 'produto' (entre flights) ou 'cliente' (livre).
  escopoRemanejamento: 'flight+produto',

  // Painel e avisos no Google Chat. O monitor é consultivo: o chat só avisa quando uma linha
  // ativa sai da margem e já está perto do fim. Antes disso, o ritmo ainda tem tempo de se acertar.
  avisos: {
    margem: 0.10,       // |índice − 1| acima de 10% = fora da margem
    diasParaFim: 10,    // só avisa quando faltam até 10 dias (contando hoje) para a linha acabar
    linkPainel: '',     // endereço do painel publicado, citado no fim da mensagem (vazio = não cita)
  },

  // Foco 100% em pacing: regras de KPI (custo unitário e resultado) ficam fora do painel e dos avisos.
  regrasDeKpi: ['R06', 'R07', 'R07b'],
};

// KPI / Tipo de compra → qual métrica realizada conta como "resultado" e como calcular custo.
export const KPIS = {
  CPC: { resultado: 'cliquesLink', fallback: 'cliques', rotulo: 'cliques no link', porMil: false },
  CPL: { resultado: 'leads', fallback: 'conversoes', rotulo: 'leads', porMil: false },
  CPA: { resultado: 'conversoes', fallback: 'leads', rotulo: 'conversões', porMil: false },
  CPM: { resultado: 'impressoes', fallback: null, rotulo: 'impressões', porMil: true },
  CPV: { resultado: 'visualizacoes', fallback: null, rotulo: 'visualizações', porMil: false },
  CPE: { resultado: 'engajamentos', fallback: null, rotulo: 'engajamentos', porMil: false },
};

// Comportamento de entrega das plataformas. ATENÇÃO: valores de referência para o motor
// distinguir "over normal da plataforma" de "over contra o plano". VALIDAR na documentação
// oficial de cada plataforma antes de usar em produção (campo `validado`).
export const PLATAFORMAS = {
  'META ADS': {
    nome: 'Meta Ads',
    overDiarioMax: 0.75,          // pode gastar até ~75% acima da diária em um dia
    tetoSemanalMultiplo: 7,       // não passa de ~7× a diária na semana
    tetoMensalMultiplo: null,
    validado: false,
    alavancas: [
      'Trocar orçamento diário por orçamento vitalício com data de término igual ao fim do flight',
      'Definir limite de gasto da campanha (campaign spending limit) no valor do Investimento Plataforma da linha',
      'Configurar a data de término no conjunto em vez de pausar manualmente',
      'Evitar ajustes de orçamento grandes de uma vez (reiniciam a fase de aprendizado); preferir passos menores',
    ],
  },
  'GOOGLE ADS': {
    nome: 'Google Ads',
    overDiarioMax: 1.0,           // pode gastar até 2× a diária em um dia
    tetoSemanalMultiplo: null,
    tetoMensalMultiplo: 30.4,     // teto mensal ≈ 30,4× a diária média
    validado: false,
    alavancas: [
      'Usar orçamento total da campanha (quando disponível no tipo de campanha) igual ao Investimento Plataforma',
      'Definir data de término da campanha igual ao fim do flight',
      'Lembrar que o teto é mensal: em flights curtos a compensação pode não ocorrer dentro do flight — reduzir a diária configurada',
      'Programação de anúncios para concentrar a entrega nos horários de melhor custo',
    ],
  },
  'TIKTOK ADS': {
    nome: 'TikTok Ads', overDiarioMax: null, tetoSemanalMultiplo: null, tetoMensalMultiplo: null, validado: false,
    alavancas: ['Preferir orçamento vitalício com data de término do flight', 'Validar na documentação oficial o comportamento de over-delivery'],
  },
  'LINKEDIN ADS': {
    nome: 'LinkedIn Ads', overDiarioMax: null, tetoSemanalMultiplo: null, tetoMensalMultiplo: null, validado: false,
    alavancas: ['Preferir orçamento vitalício com data de término do flight', 'Validar na documentação oficial o comportamento de over-delivery'],
  },
  'PINTEREST ADS': {
    nome: 'Pinterest Ads', overDiarioMax: null, tetoSemanalMultiplo: null, tetoMensalMultiplo: null, validado: false,
    alavancas: ['Preferir orçamento vitalício com data de término do flight', 'Validar na documentação oficial o comportamento de over-delivery'],
  },
};

export function configPlataforma(nome) {
  const chave = String(nome || '').toUpperCase().trim();
  return PLATAFORMAS[chave] || {
    nome: nome || 'Plataforma', overDiarioMax: null, tetoSemanalMultiplo: null, tetoMensalMultiplo: null,
    validado: false, alavancas: ['Preferir orçamento vitalício/total com data de término igual ao fim do flight'],
  };
}

/** Mescla overrides por cliente (ex.: faixas de status diferentes) com o padrão. */
export function configDoCliente(overrides = {}) {
  return {
    ...CONFIG_PADRAO,
    ...overrides,
    status: { ...CONFIG_PADRAO.status, ...(overrides.status || {}) },
    regras: { ...CONFIG_PADRAO.regras, ...(overrides.regras || {}) },
    avisos: { ...CONFIG_PADRAO.avisos, ...(overrides.avisos || {}) },
  };
}
