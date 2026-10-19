"""Reconstrói o plano SEBRAE PE · EMPRETEC + LIDERE · Outubro 2026 REV3 como .xlsx de fixture.

Mantém o MESMO layout de células do plano original (blocos de cabeçalho, briefing, parâmetros,
tabela PLANO DE MÍDIA, TOTAL e RESUMO), com valores tipados (número, data, %), como sai do
export .xlsx do Google Sheets. Uso: python3 tools/gerar_fixture_sebrae.py
Substitua por um export real quando quiser testar com o arquivo de produção.
"""
from datetime import datetime
from openpyxl import Workbook

SEG = "Cidade da Turma, 30 anos ou mais, Interesse em Empreendedorismo"
T2_LIDERE = "20, 21, 27 e 28/10 - 1ª turma\n22, 23, 29 e 30/10 - 2ª turma"
T2_EMPRETEC = "TURMA 1 - 23 A 27/11 \nTURMA 2 - 30/11 A 04/12"


def d(s):
    return datetime.strptime(s, "%d/%m/%Y")


# (produto, codigo, praca, data_turma, inicio, fim, custo_unit, resultados,
#  bruto_cliente, bruto_veiculo, liquida, investimento_plataforma, diaria, pct, segmentacao)
ABAS = {
    "PERFORMANCE_SETEMBRO_1": dict(
        periodo=("01/09/2026", "22/09/2026"), bruta=24513.37, meta=775,
        total=(2618, 24513.37, 25013.64, 20010.91, 17579.59, 1037.66, 1.0),
        resumo=(19472.13, 15895.62, 13964.30),
        linhas=[
            ("LIDERE", "EV-122104", "RECIFE", "25, 26/09, 02 e 03/10 (Const. Civil)\n", "02/09/2026", "22/09/2026", 7.29, 20, 203.73, 207.89, 166.31, 146.10, 6.96, 0.008, "30a+, Interesse em Construção Civil"),
            ("EMPRETEC", "EV-76938", "GARANHUNS", "21 a 25/09", "01/09/2026", "22/09/2026", 5.73, 355, 2838.05, 2895.97, 2316.78, 2035.29, 92.51, 0.116, SEG),
            ("EMPRETEC", "EV-84514", "PETROLINA", "26 a 30/10", "02/09/2026", "22/09/2026", 5.73, 428, 3417.74, 3487.49, 2789.99, 2451.01, 116.71, 0.139, SEG),
            ("LIDERE", "TURMA 1 - EV-84693 \nTURMA 2 - EV-854167", "RECIFE", T2_LIDERE, "02/09/2026", "22/09/2026", 40.00, 32, 1793.39, 1829.99, 1463.99, 1286.12, 61.24, 0.073, SEG),
            ("EMPRETEC", "EV-84162", "RECIFE", "26 a 30/10", "02/09/2026", "22/09/2026", 5.73, 321, 2567.12, 2619.51, 2095.61, 1840.99, 87.67, 0.105, SEG),
            ("LIDERE", "EV-76994", "GARANHUNS", "19 e 20 \n26 e 27/10", "02/09/2026", "22/09/2026", 7.29, 180, 1827.78, 1865.08, 1492.07, 1310.78, 62.42, 0.075, SEG),
            ("LIDERE", "EV-99890", "PETROLINA", "04 e 05 \n09 e 10/11", "07/09/2026", "22/09/2026", 7.29, 205, 2086.82, 2129.41, 1703.53, 1496.55, 93.53, 0.085, SEG),
            ("LIDERE", "NAO DISPONÍVEL", "ARARIPINA", "04 e 05 \n24 e 25/11", "07/09/2026", "22/09/2026", 7.29, 152, 1543.70, 1575.20, 1260.16, 1107.05, 69.19, 0.063, SEG),
            ("LIDERE", "EV-823020", "AFOGADOS", "10 e 11 \n17 e 18/11", "08/09/2026", "22/09/2026", 7.29, 144, 1466.64, 1496.57, 1197.26, 1051.79, 70.12, 0.060, SEG),
            ("EMPRETEC", "EV-85474", "CARUARU", "09 a 13/11", "07/09/2026", "22/09/2026", 5.73, 216, 1727.16, 1762.41, 1409.93, 1238.62, 77.41, 0.070, SEG),
            ("EMPRETEC", "EV-775416", "ARARIPINA", "23 a 27/11", "14/09/2026", "22/09/2026", 5.73, 135, 1080.11, 1102.15, 881.72, 774.59, 86.07, 0.044, SEG),
            ("LIDERE", "EV-854237", "RECIFE", "17, 18, 24 e 25/11\n", "07/09/2026", "22/09/2026", 7.29, 124, 1258.75, 1284.44, 1027.55, 902.70, 56.42, 0.051, SEG),
            ("EMPRETEC", "TURMA 1 - EV-84164 \nTURMA 2 - EV-824137", "RECIFE", T2_EMPRETEC, "14/09/2026", "22/09/2026", 5.73, 184, 1472.08, 1502.12, 1201.70, 1055.69, 117.30, 0.060, SEG),
            ("LIDERE/EMPRETEC", "EXTRA", "GERAL", "-", "01/09/2026", "22/09/2026", 7.29, 121, 1230.30, 1255.41, 1004.33, 882.30, 40.10, 0.050, SEG),
        ]),
    "PERFORMANCE_SETEMBRO_2": dict(
        periodo=("23/09/2026", "30/09/2026"), bruta=12625.59, meta=373,
        total=(1282, 12625.59, 12883.26, 10306.60, 9054.35, 1142.75, 1.0),
        resumo=(7872.38, 6426.43, 5645.62),
        linhas=[
            ("EMPRETEC", "EV-84514", "PETROLINA", "26 a 30/10", "23/09/2026", "27/09/2026", 5.73, 25, 203.73, 207.8878, 166.31, 146.10, 29.22, 0.016, SEG),
            ("LIDERE", "EV-854167", "RECIFE", T2_LIDERE, "23/09/2026", "30/09/2026", 7.29, 48, 484.16, 494.0408, 395.23, 347.21, 43.40, 0.038, SEG),
            ("EMPRETEC", "EV-84162", "RECIFE", "26 a 30/10", "23/09/2026", "30/09/2026", 5.73, 224, 1789.48, 1826.0000, 1460.80, 1283.31, 160.41, 0.142, SEG),
            ("LIDERE", "EV-76994", "GARANHUNS", "19 e 20 \n26 e 27/10", "23/09/2026", "30/09/2026", 7.29, 142, 1439.67, 1469.0510, 1175.24, 1032.45, 129.06, 0.114, SEG),
            ("LIDERE", "EV-99890", "PETROLINA", "04 e 05 \n09 e 10/11", "23/09/2026", "30/09/2026", 7.29, 168, 1705.88, 1740.6939, 1392.56, 1223.36, 152.92, 0.135, SEG),
            ("LIDERE", "NAO DISPONÍVEL", "ARARIPINA", "04 e 05 \n24 e 25/11", "23/09/2026", "30/09/2026", 7.29, 127, 1286.28, 1312.5306, 1050.02, 922.45, 115.31, 0.102, SEG),
            ("EMPRETEC", "EV-85474", "CARUARU", "09 a 13/11", "23/09/2026", "30/09/2026", 5.73, 146, 1166.91, 1190.7245, 952.58, 836.84, 104.61, 0.092, SEG),
            ("LIDERE", "EV-823020", "AFOGADOS", "10 e 11 \n17 e 18/11", "23/09/2026", "30/09/2026", 7.29, 125, 1267.74, 1293.6122, 1034.89, 909.15, 113.64, 0.100, SEG),
            ("LIDERE", "EV-854237", "RECIFE", "17, 18, 24 e 25/11\n", "23/09/2026", "30/09/2026", 7.29, 102, 1036.84, 1058.0000, 846.40, 743.56, 92.95, 0.082, SEG),
            ("EMPRETEC", "EV-775416", "ARARIPINA", "23 a 27/11", "23/09/2026", "30/09/2026", 5.73, 122, 976.14, 996.0612, 796.85, 700.03, 87.50, 0.077, SEG),
            ("EMPRETEC", "EV-84164", "RECIFE", "TURMA 1 - 23 A 27/11 \n", "23/09/2026", "30/09/2026", 5.73, 79, 634.38, 647.3265, 517.86, 454.94, 56.87, 0.050, SEG),
            ("EMPRETEC", "EV-824137", "RECIFE", "TURMA 2 - 30/11 A 04/12", "23/09/2026", "30/09/2026", 5.73, 79, 634.38, 647.3265, 517.86, 454.94, 56.87, 0.050, SEG),
        ]),
    "PERFORMANCE_OUTUBRO": dict(
        periodo=("01/10/2026", "12/10/2026"), bruta=30236.04, meta=963,
        total=(3466, 30236.04, 30853.10, 24682.48, 21683.56, 1806.06, 1.0),
        resumo=(15879.62, 12962.95, 11387.95),
        linhas=[
            ("EMPRETEC", "EV-84162", "RECIFE", "26 a 30/10", "01/10/2026", "08/10/2026", 5.73, 519, 4143.89, 4228.4545, 3382.76, 2971.76, 371.47, 0.137, SEG),
            ("LIDERE", "EV-76994", "GARANHUNS", "19 e 20 \n26 e 27/10", "01/10/2026", "08/10/2026", 7.29, 171, 1739.06, 1774.5484, 1419.64, 1247.15, 155.89, 0.058, SEG),
            ("LIDERE", "EV-99890", "PETROLINA", "04 e 05 \n09 e 10/11", "01/10/2026", "11/10/2026", 7.29, 196, 1992.66, 2033.3267, 1626.66, 1429.02, 129.91, 0.066, SEG),
            ("LIDERE", "NAO DISPONÍVEL", "ARARIPINA", "04 e 05 \n24 e 25/11", "01/10/2026", "11/10/2026", 7.29, 294, 2988.99, 3049.9900, 2439.99, 2143.53, 194.87, 0.099, SEG),
            ("EMPRETEC", "EV-85474", "CARUARU", "09 a 13/11", "01/10/2026", "11/10/2026", 5.73, 499, 3985.32, 4066.6533, 3253.32, 2858.04, 259.82, 0.132, SEG),
            ("LIDERE", "EV-823020", "AFOGADOS", "10 e 11 \n17 e 18/11", "01/10/2026", "12/10/2026", 7.29, 101, 1029.70, 1050.7179, 840.57, 738.44, 61.54, 0.034, SEG),
            ("LIDERE", "EV-854237", "RECIFE", "17, 18, 24 e 25/11\n", "01/10/2026", "12/10/2026", 7.29, 405, 4118.81, 4202.8716, 3362.30, 2953.78, 246.15, 0.136, SEG),
            ("EMPRETEC", "EV-84164", "RECIFE", T2_EMPRETEC, "01/10/2026", "19/10/2026", 5.73, 447, 3574.26, 3647.2013, 2917.76, 2563.25, 134.91, 0.118, SEG),
            ("EMPRETEC", "EV-775416", "ARARIPINA", "23 a 27/11", "01/10/2026", "19/10/2026", 5.73, 387, 3089.11, 3152.1537, 2521.72, 2215.33, 116.60, 0.102, SEG),
            ("EMPRETEC", "EV-824137", "RECIFE", T2_EMPRETEC, "01/10/2026", "19/10/2026", 5.73, 447, 3574.24, 3647.1846, 2917.75, 2563.24, 134.91, 0.118, SEG),
        ]),
    "PERFORMANCE_OUTUBRO_Acrescimo": dict(
        periodo=("13/10/2026", "21/10/2026"), bruta=8000.00, meta=963,
        total=(867, 8000.00, 8163.27, 6530.61, 5737.14, 833.04, 0.625),
        resumo=(5000.00, 4081.63, 3585.71),
        linhas=[
            ("LIDERE", "EV-854167", "RECIFE", T2_LIDERE, "13/10/2026", "15/10/2026", 7.29, 148, 1500.00, 1530.6122, 1224.49, 1075.71, 358.57, 0.0, SEG),
            ("LIDERE", "EV-99890", "PETROLINA", "04 e 05 \n09 e 10/11", "13/10/2026", "21/10/2026", 7.29, 197, 2000.00, 2040.8163, 1632.65, 1434.29, 159.37, 0.25, SEG),
            ("LIDERE", "EV-823020", "AFOGADOS", "10 e 11 \n17 e 18/11", "13/10/2026", "21/10/2026", 7.29, 148, 1500.00, 1530.6122, 1224.49, 1075.71, 119.52, 0.188, SEG),
            ("EMPRETEC", "EV-85474", "CARUARU", "09 a 13/11", "13/10/2026", "23/10/2026", 5.73, 188, 1500.00, 1530.6122, 1224.49, 1075.71, 97.79, 0.0, SEG),
            ("EMPRETEC", "EV-84164", "RECIFE", T2_EMPRETEC, "13/10/2026", "23/10/2026", 5.73, 188, 1500.00, 1530.6122, 1224.49, 1075.71, 97.79, 0.188, SEG),
        ]),
}

HEADERS = ["Plataforma", "Campanha / Produto", "Código da Turma", "Etapa do Funil", "Objetivo da Campanha",
           "Formato", "Segmentação", "Praça", "Destino (URL com UTM)", "Data da Turma", "Início Veiculação",
           "Fim Veiculação", "Alcance Est.", "Freq. Est.", "Impressões Est.", "Cobertura", "CPM Est.",
           "Métrica (Objetivo PI)", "KPI / Tipo de Compra", "Custo Unit. R$", "Resultados Est.",
           "Verba Bruta Cliente R$", "Bruto Veículo R$", "Verba Líquida R$", "Investimento Plataforma R$",
           "Verba Diária Plataforma R$", "% do Plano", "OBSERVAÇÕES PI (liberação)"]
BRL = '"R$" #,##0.00'


def put(ws, r, c, v, fmt=None):
    cell = ws.cell(row=r + 1, column=c + 1, value=v)
    if fmt:
        cell.number_format = fmt
    return cell


wb = Workbook()
wb.remove(wb.active)
for nome, aba in ABAS.items():
    ws = wb.create_sheet(nome)
    ini, fim = aba["periodo"]
    put(ws, 0, 0, "EMPRETEC + LIDERE"); put(ws, 0, 24, "Planejamento: Mídia Ampla")
    put(ws, 1, 0, "PERFORMANCE · OUTUBRO 2026")
    bruta_txt = f"{aba['bruta']:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    put(ws, 2, 0, f"Cliente: SEBRAE PE  ·  Veículo: RedMídia  ·  Veiculação: {ini} a {fim}  ·  Verba bruta: R$ {bruta_txt}")
    put(ws, 4, 0, "PÚBLICO POTENCIAL"); put(ws, 4, 4, "BRIEFING DA CAMPANHA (atendimento → mídia)")
    put(ws, 4, 13, "PARÂMETROS"); put(ws, 4, 21, "COMO USAR")
    briefing = [("Campanha / evento", "EMPRETEC + LIDERE"), ("Data do evento / turma", "19/10"),
                ("Período de veiculação", f"{ini} a {fim}"), ("Target", SEG),
                ("Verba bruta (cliente)", (aba["bruta"], BRL)),
                ("Objetivo primário (engajamento, alcance ou leads)", "TRAFEGO NO SITE"),
                ("Meta de inscritos / resultado", aba["meta"])]
    params = [("Bruto veículo = bruto cliente ÷", 0.98, "0.0%"), ("Comissão sobre bruto veículo", 0.20, "0.0%"),
              ("Desconto p/ investimento em plataforma", 0.1215, "0.00%"),
              ("Connect rate (cliques → sessões)", 0.50, "0.0%"), ("Conversão (sessões → leads)", 0.10, "0.0%"),
              ("CPC médio estimado (projeção)", 8.00, BRL)]
    put(ws, 5, 0, "Região"); put(ws, 5, 2, "Público Estimado"); put(ws, 6, 0, "RECIFE"); put(ws, 8, 0, "Total")
    for i, (rot, val) in enumerate(briefing):
        put(ws, 5 + i, 4, rot)
        if isinstance(val, tuple):
            put(ws, 5 + i, 7, val[0], val[1])
        else:
            put(ws, 5 + i, 7, val)
    for i, (rot, val, fmt) in enumerate(params):
        put(ws, 5 + i, 13, rot); put(ws, 5 + i, 19, val, fmt)
    put(ws, 13, 0, "PLANO DE MÍDIA")
    for c, g in [(0, "IDENTIFICAÇÃO"), (9, "PERÍODO"), (12, "ENTREGA ESTIMADA"), (17, "RESULTADO"), (21, "FINANCEIRO"), (27, "LIBERAÇÃO")]:
        put(ws, 14, c, g)
    for c, h in enumerate(HEADERS):
        put(ws, 15, c, h)
    r = 16
    for (prod, cod, praca, turma, li, lf, cu, res, bc, bv, liq, inv, dia, pct, seg) in aba["linhas"]:
        vals = ["META ADS", prod, cod, "Fundo · conversão", "LEADS", "ADVANTAGE +", seg, praca, None, turma]
        for c, v in enumerate(vals):
            put(ws, r, c, v)
        put(ws, r, 10, d(li), "dd/mm/yyyy"); put(ws, r, 11, d(lf), "dd/mm/yyyy")
        put(ws, r, 17, "LEADS"); put(ws, r, 18, "CPC")
        put(ws, r, 19, cu, BRL); put(ws, r, 20, res)
        for c, v in zip(range(21, 26), (bc, bv, liq, inv, dia)):
            put(ws, r, c, v, BRL)
        put(ws, r, 26, pct, "0.0%")
        put(ws, r, 27, f"VEICULO: REDMEDIA\nCÓDIGO DA TURMA: {cod}\nCliente: SEBRAE\nCampanha: {prod}\nPraça: {praca}\n"
                        f"Meta: R$ {inv:.2f}\nVerba líquida + 12%")
        r += 1
    t = aba["total"]
    put(ws, r, 0, "TOTAL DO PLANO"); put(ws, r, 12, 0); put(ws, r, 14, 0); put(ws, r, 20, t[0])
    for c, v in zip(range(21, 26), t[1:6]):
        put(ws, r, c, v, BRL)
    put(ws, r, 26, t[6], "0.0%")
    r += 2
    put(ws, r, 0, "RESUMO POR PLATAFORMA"); put(ws, r, 7, "PROJEÇÃO DE RESULTADO VS. META (funil)")
    r += 1
    put(ws, r, 0, "Plataforma"); put(ws, r, 2, "Verba Bruta"); put(ws, r, 3, "Verba Líquida")
    put(ws, r, 4, "Invest. Plataforma"); put(ws, r, 5, "% do Plano")
    rs = aba["resumo"]
    put(ws, r + 1, 0, "META ADS"); [put(ws, r + 1, c, v, BRL) for c, v in zip((2, 3, 4), rs)]; put(ws, r + 1, 5, 1.0, "0.0%")
    put(ws, r + 2, 0, "GOOGLE ADS"); [put(ws, r + 2, c, 0, BRL) for c in (2, 3, 4)]; put(ws, r + 2, 5, 0.0, "0.0%")
    put(ws, r + 3, 0, "Total"); [put(ws, r + 3, c, v, BRL) for c, v in zip((2, 3, 4), rs)]; put(ws, r + 3, 5, 1.0, "0.0%")

wb.save("fixtures/plano_sebrae_empretec_lidere_out2026_REV3.xlsx")
print("ok")
