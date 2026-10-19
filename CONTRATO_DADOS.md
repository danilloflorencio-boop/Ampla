# Contrato de dados do realizado (para o time de BI)

O monitor não se conecta às plataformas. Ele recebe o **realizado** em um formato único,
venha de onde vier: conector agregador, API própria ou export manual. Este documento é o
que o conector do BI precisa entregar.

## Granularidade

Uma linha por **dia × conta × campanha × conjunto de anúncios** (ad set no Meta, ad group no
Google, ad group no TikTok). O nível de anúncio não é necessário.

O dia é o dia civil no fuso **America/Sao_Paulo**. Use o fuso da conta quando for o mesmo; se não for, converta antes de entregar.

## Colunas

| Coluna | Obrigatória | Tipo | Observação |
|---|---|---|---|
| `data` | sim | `AAAA-MM-DD` | também aceita `dd/mm/aaaa` |
| `plataforma` | sim* | texto | `META ADS`, `GOOGLE ADS`, `TIKTOK ADS`, `PINTEREST ADS`, `LINKEDIN ADS` (variações como `facebook`, `google_ads` são normalizadas) |
| `conta_id` | sim | texto | ID da conta de anúncios |
| `conta_nome` | não | texto | |
| `campanha_id` | sim | texto | |
| `campanha_nome` | sim | texto | usado na vinculação automática (ver NOMENCLATURA.md) |
| `conjunto_id` | sim | texto | chave principal do vínculo com o plano |
| `conjunto_nome` | sim | texto | usado na vinculação automática |
| `moeda` | não | texto | o monitor assume BRL e avisa se vier outra |
| `gasto` | sim | decimal | valor gasto **na plataforma** (é o que se compara à coluna "Investimento Plataforma R$" do plano) |
| `impressoes` | não | inteiro | |
| `alcance` | não | inteiro | não é somável entre dias; só informativo |
| `cliques` | não | inteiro | todos os cliques |
| `cliques_link` | recomendado | inteiro | resultado das linhas com KPI = CPC |
| `leads` | recomendado | inteiro | resultado das linhas com KPI = CPL e meta de inscritos |
| `conversoes` | não | inteiro | KPI = CPA |
| `engajamentos` | não | inteiro | KPI = CPE |
| `visualizacoes_video` | não | inteiro | KPI = CPV |
| `orcamento_diario_config` | recomendado | decimal | orçamento diário configurado no conjunto (ou na campanha, se CBO) naquele dia. Liga as regras de over/under da plataforma (R11, R11u, R15) |
| `tipo_orcamento` | não | `diario` / `vitalicio` | |
| `status_entrega` | não | texto | status de entrega do conjunto |
| `data_extracao` | recomendado | ISO 8601 com hora | momento da extração. Se faltar por mais de 36 h, o monitor suspende alertas de ritmo |

\* Se o arquivo não tiver coluna de plataforma, o monitor pergunta qual é no momento do upload.

Nomes alternativos de colunas também são aceitos, como exports do Meta em português e nomes comuns de conectores (`spend`, `adset_name`, `Valor usado (BRL)` etc.). A lista completa está em `src/core/realizado.js` (`ALIASES`).

## Regras de carga

- **Idempotente:** reenviar o mesmo dia × conjunto substitui o valor anterior e não duplica.
  O conector pode reenviar os últimos 3 dias a cada carga, para pegar as atribuições tardias das plataformas.
- **Separador:** vírgula, ponto e vírgula ou tab. Decimal com ponto (`1234.56`). O formato BR (`1.234,56`) também é aceito.
- **Dia corrente:** pode vir. O monitor não usa esse dia nas médias nem nas projeções.
- **Exemplo pronto:** `fixtures/realizado_exemplo_canonico.csv`. O botão "Exportar CSV canônico" da tela "Plano e dados" gera o mesmo formato.

## Como plugar o conector

Hoje a carga é feita por upload, pelo botão "Subir realizado". Quando o conector existir, basta
um adaptador que produza os registros deste contrato e chame `normalizarRealizado` e
`mesclarRealizado` (`src/core/realizado.js`). Nada mais no monitor precisa mudar.
