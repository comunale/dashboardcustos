// Itens inventados no mesmo layout da fatura Santander (coordenadas reais do layout, dados fictícios).
const D = 293.8; // deslocamento da coluna direita
const L = (p, x, y, s) => ({ p, x, y, w: s.length * 4, s });

export function itensSinteticos({ trocar = {} } = {}) {
  const itens = [
    // Página 1: cabeçalho e histórico
    L(1, 19.2, 56.7, 'Olá, Ana! Esta é a fatura do seu cartão SANTANDER'),
    L(1, 19.2, 85.5, 'realizados até 18/09.'),
    L(1, 312.8, 80.5, 'Total a Pagar'), L(1, 412.4, 80.5, 'Vencimento'), L(1, 510.7, 80.5, 'Seu limite é'),
    L(1, 301, 93.7, 'R$ 1.722,54'), L(1, 401.4, 93.7, '25/09/2026'), L(1, 497.5, 93.7, 'R$10.000,00'),
    L(1, 311.1, 134.4, 'Limite utilizado'), L(1, 406, 134.4, 'Limite Disponível:'),
    L(1, 302, 147.5, 'R$2.000,00'), L(1, 402.5, 147.5, 'R$8.000,00'),
    L(1, 289.1, 224.5, 'AGO.'), L(1, 356.8, 223.1, 'R$ 900,00'), L(1, 420.9, 221.9, 'R$850,00'),
    L(1, 289.1, 241.7, 'SET.'), L(1, 344.9, 241.2, 'R$ 1.722,54'), L(1, 420.9, 240.6, 'Esta Fatura'),
    L(1, 311.1, 400, 'Limite utilizado'), L(1, 400, 400, 'R$0,00'), // SuperCrédito: não pode ser confundido

    // Página 2: detalhamento, coluna esquerda
    L(2, 14.2, 305.4, 'Detalhamento da Fatura'),
    L(2, 8.5, 325.2, 'ANA SOUZA LIMA - 5228 XXXX XXXX 1111'),
    L(2, 9.6, 346.2, 'Pagamento e Demais Créditos'),
    L(2, 9.6, 357.5, 'Compra'), L(2, 34.9, 357.5, 'Data'), L(2, 52.2, 357.5, 'Descrição'),
    L(2, 166.1, 357.5, 'Parcela'), L(2, 218.9, 357.5, 'R$'), L(2, 241.6, 357.5, 'US$'),
    L(2, 33.4, 370.3, '10/09 PAGAMENTO DE FATURA-INTERNET'), L(2, 198.6, 370.3, '-850,00'),
    L(2, 9.6, 390, 'Parcelamentos'),
    L(2, 16.8, 401.3, '3'), L(2, 33.4, 400, '16/01 LOJA DE MOVEIS'), L(2, 168.1, 400, '09/10'), L(2, 210.9, 400, '100,00'),
    L(2, 33.4, 412, '20/11 CURSO ONLINE'), L(2, 168.1, 412, '10/10'), L(2, 210.9, 412, '50,00'),
    L(2, 9.6, 430, 'Despesas'),
    L(2, 33.4, 442, '21/08 DL*UBERRIDES'), L(2, 210.9, 442, '25,00'),
    L(2, 33.4, 454, '22/08 DL*UBERRIDES'), L(2, 210.9, 454, '30,00'),
    L(2, 33.4, 466, '23/08 DL*UBERRIDES'), L(2, 210.9, 466, '20,00'),
    L(2, 33.4, 478, '24/08 MERCADOLIVRE*LOJA X'), L(2, 210.9, 478, trocar.ml ?? '80,00'),
    L(2, 33.4, 490, '25/08 EBN *TIKTOK SHOP'), L(2, 213, 490, '-10,00'),
    L(2, 34, 505, 'VALOR TOTAL'), L(2, 205, 505, '305,00'), L(2, 241, 505, '0,00'),

    // Página 2: coluna direita
    L(2, 8.4 + D, 325.2, '@ BRUNO LIMA - 5480 XXXX XXXX 2222'),
    L(2, 9.6 + D, 346, 'Parcelamentos'),
    L(2, 33.4 + D, 358, '07/08 PIX'), L(2, 65 + D, 358, 'FULANO DE TAL'),
    L(2, 168.1 + D, 358, '02/03'), L(2, 208.8 + D, 358, '77,64'),
    L(2, 52.1 + D, 367, '*Juros = 18,01 / IOF = 0,46'),
    L(2, 9.6 + D, 385, 'Despesas'),
    L(2, 33.4 + D, 397, '02/09 APPLE COM/BILL'), L(2, 210.8 + D, 397, '99,90'),
    L(2, 33.4 + D, 409, '03/09 SHOPEE *LOJA'), L(2, 202.7 + D, 409, '1.200,00'),
    L(2, 33.9 + D, 425, 'VALOR TOTAL'), L(2, 202.7 + D, 425, '1.377,54'), L(2, 240.5 + D, 425, '0,00'),

    // Página 3: resumo; nada depois de "Resumo da Fatura" pode virar lançamento
    L(3, 14.2, 30, 'Detalhamento da Fatura'),
    L(3, 14.2, 600, 'Resumo da Fatura'),
    L(3, 32.3, 632, 'Saldo Anterior'), L(3, 210, 632, '900,00'),
    L(3, 32.3, 644, '(+) Juros de Crédito Rotativo'), L(3, 214, 644, '0,00'),
    L(3, 32.3, 656, '(+) IOF'), L(3, 214, 656, '0,00'),
    L(3, 32.3, 668, '(+) Total Despesas/Débitos no Brasil'), L(3, 205, 668, '1.682,54'),
    L(3, 32.3, 680, 'Total de encargos + IOF dos parcelamentos'), L(3, 190, 680, 'Juros: 18,01 | IOF 0,46'),
    L(3, 32.3, 692, '(+) Total Despesas/Débitos no Exterior'), L(3, 214, 692, '0,00'),
    L(3, 32.3, 704, '(-) Total de pagamentos'), L(3, 210, 704, '850,00'),
    L(3, 32.3, 716, '(-) Total de créditos'), L(3, 212, 716, '10,00'),
    L(3, 32.3, 728, '(=) Saldo Desta Fatura'), L(3, 205, 728, '1.722,54'),
    L(3, 32.3, 760, 'Compras parceladas com e sem juros: operações de'), L(3, 210, 760, '177,64'),
    L(3, 33.4, 790, '01/01 NAO DEVE SER LIDO'), L(3, 210, 790, '999,00'),
  ];
  // embaralha a ordem para provar que o leitor não depende da ordem do conteúdo do PDF
  return itens.map((it, i) => ({ it, k: (i * 7919) % itens.length })).sort((a, b) => a.k - b.k).map(o => o.it);
}
