# Avisos de pacing no Google Chat

O monitor é consultivo: ninguém precisa abrir o app todo dia. Quem avisa é o chat, pelo
**Operações Bot**, e só quando algo está fora do normal perto do fim da linha.

## Quando sai um aviso

Uma linha do plano gera aviso quando, na data de referência:

1. está **em veiculação** (começou e ainda não acabou);
2. o índice de ritmo (usado até ontem ÷ previsto até ontem) está **fora da margem de ±10%**;
3. faltam **10 dias ou menos** para ela acabar, contando hoje;
4. o realizado do cliente está **em dia** (mesma condição da R13). Com dado parado, a conta
   aparece como "Dados desatualizados" no painel e não gera aviso, para evitar falso alarme.

Antes da janela final a oscilação é natural, e o ritmo ainda tem tempo de se acertar. Os dois
limites ficam em `src/config/config.js` (`avisos.margem` e `avisos.diasParaFim`).

## Quem recebe

| Para | Conteúdo |
|---|---|
| Analista da conta | Por conta: o estado do pacing e o link do monitor já aberto na conta. Por linha fora da margem: quanto gastou contra o previsto, o valor a configurar na plataforma e o prazo |
| Liderança direta do analista | Overview das contas do time com linhas fora da margem: estado da conta, projeção e quantas linhas ajustar até amanhã |

Quem não tem nada fora da margem não recebe mensagem. O cadastro de analistas e lideranças,
e o analista de cada cliente, ficam na tela **Equipe e avisos**.

## Valor do ajuste

O valor sai do orçamento que o conjunto usa na plataforma (coluna `tipo_orcamento` do realizado):

| Orçamento do conjunto | Ação recomendada |
|---|---|
| Diário | Orçamento diário de R$ atual (configurado, ou a média dos últimos dias) para a **diária necessária** = saldo ÷ dias restantes |
| Total (vitalício) | Orçamento total = gasto acumulado dos conjuntos até ontem + saldo da linha |
| Não informado | Assume diário e informa também o total equivalente |
| Verba já consumida | Pausar hoje e justificar o excedente |

## Integração com o Operações Bot

Hoje o monitor **gera** as mensagens; a entrega ainda depende da integração com o bot.

- Na tela: **Equipe e avisos › Exportar avisos (.json)**.
- Fora do navegador: `node tools/avisos.mjs workspace.json [--ref AAAA-MM-DD] [--link https://…]`,
  a partir do workspace exportado em **Exportar workspace completo**.

Formato:

```json
{
  "ref": "2026-10-19",
  "avisos": [
    { "para": "nome@ampla.com.br", "nome": "Nome Sobrenome", "papel": "analista", "texto": "Olá Nome Sobrenome\n\n📊 O pacing da conta…" }
  ],
  "semResponsavel": ["cliente|META ADS"],
  "desatualizadas": ["cliente|GOOGLE ADS"]
}
```

`para` é o e-mail Google da pessoa. `texto` já vem pronto, no tom do Operações Bot. `semResponsavel`
lista as contas com linha fora da margem e sem analista cadastrado. `desatualizadas` lista as contas
em veiculação cujo realizado está atrasado.

O link do aviso abre o monitor direto na conta (`#cliente=…&plataforma=…`). Enquanto os dados
ficarem no navegador de cada analista, o link só mostra a conta para quem já a tem carregada.
