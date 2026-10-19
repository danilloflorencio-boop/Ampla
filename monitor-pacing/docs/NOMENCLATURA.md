# Padrão de nomenclatura (proposta para aprovação)

O monitor liga cada conjunto da plataforma às linhas do plano. Com nomes padronizados, a
sugestão de vínculo sai com **confiança alta** e o analista só confirma. Sem padrão, o vínculo é
manual na tela "Vínculos".

## Padrão

```
Campanha:  {CLIENTE}_{PRODUTO}_{OBJETIVO}_{ANO}
Conjunto:  {CODIGO-DA-TURMA}_{PRACA}_{SEGMENTACAO}
```

| Parte | Regra | Exemplo |
|---|---|---|
| CLIENTE | sigla sem espaços | `SEBRAEPE` |
| PRODUTO | igual à coluna "Campanha / Produto" do plano; `-` no lugar de `/` | `EMPRETEC`, `LIDERE`, `LIDERE-EMPRETEC` |
| OBJETIVO | igual à coluna "Objetivo da Campanha" | `LEADS` |
| ANO | ano da campanha | `2026` |
| CODIGO-DA-TURMA | igual à coluna "Código da Turma", **sem espaço** | `EV-84162` |
| PRACA | igual à coluna "Praça", espaços viram `-` | `RECIFE`, `AFOGADOS` |
| SEGMENTACAO | livre e curta | `30A-EMPREEND` |

Exemplos:

```
SEBRAEPE_EMPRETEC_LEADS_2026  /  EV-84162_RECIFE_30A-EMPREEND
SEBRAEPE_LIDERE_LEADS_2026    /  EV-99890_PETROLINA_30A-EMPREEND
```

## Casos especiais

- **Turma sem código ("NAO DISPONÍVEL"):** use `{PRACA}_{PRODUTO}_{SEGMENTACAO}`, por exemplo `ARARIPINA_LIDERE_30A-EMPREEND`. A sugestão sai com confiança média (praça + produto); quando o código existir, renomeie.
- **Linha com duas turmas:** crie **um conjunto por código** (`EV-84164_…` e `EV-824137_…`). Os dois se ligam à mesma linha.
- **Verba EXTRA / GERAL:** `GERAL_{PRODUTO}_EXTRA`.
- **O mesmo conjunto em vários flights** (Set/1, Set/2, Out): **mantenha o mesmo conjunto**. O monitor distribui o gasto de cada dia para a linha do flight ativo naquele dia, então não é preciso duplicar conjuntos por flight.
- **Testes fora do plano** (A/B, criativo novo): use `TESTE` no nome. Eles aparecem como gasto sem vínculo até alguém vincular ou justificar.

## Como o monitor pontua (para entender as sugestões)

| Sinal | Pontos |
|---|---|
| código da turma igual | +50 (código diferente: −40) |
| praça | +20 |
| produto | +15 |
| datas com gasto sobrepõem o período da linha | +15 (sem sobreposição: −30) |

85 pontos ou mais dá confiança alta; de 50 a 84, média. Se algum candidato bate o código, só os que batem o código entram na sugestão. Sem código, a sugestão exige praça **e** produto.
