# Monitor de pacing multiplataforma · Ampla

Controle consultivo de verba para campanhas de mídia paga (Meta, Google, TikTok, Pinterest e
outras). O monitor compara o gasto real das plataformas com a coluna **"Investimento Plataforma R$"**
do plano de mídia Ampla e diz, para cada linha do plano, se ela está no ritmo, quanto vai fechar
e o que fazer, com valor e prazo. O foco é só pacing: custo unitário e resultado (KPI) ficam fora.

Duas peças:

- **Painel**: todas as contas da Ampla numa tela, como uma MCC (cliente › contas por plataforma ›
  linhas), em estilo de quadro de partidas, com filtro "Contas de" (analista) e "Time de" (liderança).
- **Avisos no Google Chat**: o Operações Bot avisa o analista e a liderança direta só quando uma
  linha sai da margem de ±10% a 10 dias ou menos do fim. Ver `docs/AVISOS.md`.

Ele **não mexe nas plataformas** (somente leitura) e **não usa IA**: o cálculo e as recomendações são
determinísticos, sem custo de tokens.

## Como rodar

```bash
cd monitor-pacing
npm install          # só para testes e build (o app em si não tem dependências)
npm test             # testes do núcleo
npm run dev          # servidor local em http://localhost:5173
npm run build        # gera dist/monitor-pacing.html (arquivo único, abre direto do disco)
```

Sem instalar nada, abra `dist/monitor-pacing.html` no navegador e clique em
**"Abrir demonstração (SEBRAE PE)"**. A demonstração abre o plano SEBRAE PE real e três clientes
fictícios ("Demo …"), com uma equipe fictícia, para mostrar o painel e os avisos.

### Publicar no GitHub Pages

O `index.html` usa caminhos relativos. Com o Pages ativado na branch principal do repositório,
o monitor fica em `https://<usuário>.github.io/<repo>/monitor-pacing/`.

## Fluxo de uso

1. **Importar plano (.xlsx)**: o export do Google Sheets no formato Ampla. Cada aba vira um flight.
   A tela "Plano e dados" mostra os problemas encontrados na planilha (períodos fora da aba,
   "% do plano" que não fecha, resumo por plataforma que não bate, métrica × KPI etc.).
2. **Subir realizado (.csv ou .xlsx)**: no contrato de `docs/CONTRATO_DADOS.md`. Recarregar o
   mesmo dia substitui os valores, sem duplicar.
3. **Vínculos**: confirmar quais conjuntos de anúncios atendem cada linha do plano. As sugestões
   saem do código da turma, da praça e do produto (`docs/NOMENCLATURA.md`).
4. **Equipe e avisos**: cadastrar analistas, lideranças diretas e o analista de cada cliente,
   e o link do monitor publicado. A tela mostra a prévia das mensagens do dia.
5. **Consultar**: o painel com todas as contas; clicar numa conta abre o cliente (visão geral,
   ritmo por linha, turmas e alertas). Cada alerta pode ser aceito, adiado ou descartado com motivo. O botão
   "Copiar ações abertas" monta o texto do review diário com a agência parceira.

Novas versões do plano (REV4…) mostram as diferenças antes de substituir e preservam os vínculos,
as justificativas e as notas das linhas que continuam.

## Estrutura

```
src/
  core/            lógica pura, sem DOM — testável em Node
    format.js      dinheiro em centavos, datas ISO, formatação pt-BR
    plano.js       importador do plano Ampla + validações V1–V13 + diff de versões
    realizado.js   contrato canônico, leitor de CSV, carga idempotente
    vinculo.js     sugestões de vínculo e alocação diária do gasto às linhas
    pacing.js      índice, projeções, fim do mês, séries dos gráficos, turmas
    painel.js      painel de todas as contas, margem dos avisos, ajuste diário ou total
    avisos.js      mensagens do Google Chat para analista e liderança
    regras.js      regras de alerta e recomendação
    mock.js        gerador de realizado de demonstração (determinístico)
  config/
    config.js      faixas de status, limiares das regras, KPIs, comportamento das plataformas
    textos.js      textos dos alertas (editáveis)
  ui/              interface (HTML + CSS + JS puro, Chart.js e SheetJS via CDN)
  demo/            plano SEBRAE já lido e os clientes fictícios do painel
docs/              contrato de dados, nomenclatura, regras, prompt de continuidade
fixtures/          plano SEBRAE REV3 (.xlsx) e realizado de exemplo (.csv)
tests/             node --test
tools/             build, geração da fixture e da demo
```

## Decisões tomadas e pendentes

| Tema | Hoje | Pendente |
|---|---|---|
| Fonte do realizado | upload de CSV/.xlsx no contrato canônico | conector do BI (só um adaptador novo) |
| Armazenamento | navegador (localStorage) + exportar/importar workspace .json | backend compartilhado entre analistas |
| Vínculo plano ↔ plataforma | sugestão + confirmação manual | aprovar `docs/NOMENCLATURA.md` com as parceiras |
| Tolerância | ±10% no ritmo, ±20% para crítico | ajustar por cliente em `config` do workspace |
| Remanejamento (R12) | só dentro do mesmo flight e produto | decidir se pode entre flights ou entre produtos |
| Limites de entrega das plataformas | valores de referência, `validado: false` | confirmar na documentação oficial |
| Meta de inscritos do Acréscimo | tratada como meta própria (963) | confirmar se é a mesma de Outubro repetida |
| IA | fora do núcleo | eventual botão de resumo sob demanda (desligado por padrão) |
| Avisos no chat | mensagens geradas no monitor (.json e `tools/avisos.mjs`) | entrega pelo Operações Bot e origem do cadastro da equipe |

## Importante sobre a fixture

`fixtures/plano_sebrae_empretec_lidere_out2026_REV3.xlsx` foi **reconstruído** a partir do conteúdo do
plano (`tools/gerar_fixture_sebrae.py`), com o mesmo layout de células. Troque pelo export real
do Google Sheets e rode `npm test`: se algo no layout real for diferente, o teste mostra onde.
