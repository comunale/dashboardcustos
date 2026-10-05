// Classificação de lançamentos por palavras-chave na descrição da fatura.
// Para ajustar, edite as listas abaixo. A ordem importa: a primeira expressão que casar vence.

export const ASSINATURAS = [
  ['Apple', /APPLE\.?COM\/BILL|APPLE COM/],
  ['Netflix', /NETFLIX/],
  ['Spotify', /SPOTIFY/],
  ['Disney+', /DISNEY/],
  ['Amazon Prime', /AMAZON PRIME/],
  ['YouTube Premium', /YOUTUBE/],
  ['Smiles', /SMILES/],
  ['TotalPass', /TOTAL ?PASS/],
  ['Uber One', /UBER \*?ONE/],
  ['Meli+', /MELIMAIS/],
  ['Globoplay', /GLOBOPLAY/],
  ['Max', /\bHBO/],
  ['Paramount+', /PARAMOUNT/],
  ['Deezer', /DEEZER/],
  ['ChatGPT', /OPENAI|CHATGPT/],
];

export const MARKETPLACES = [
  ['Mercado Livre', /MERCADO ?LIVRE|^MERCADO\*/],
  ['Shopee', /SHOPEE/],
  ['Amazon', /AMAZON/],
  ['Shein', /SHEIN/],
  ['TikTok Shop', /TIKTOK/],
  ['Temu', /TEMU/],
  ['AliExpress', /ALIEXPRESS|ALIPAY/],
  ['Magalu', /MAGALU|MAGAZINE ?LUIZA/],
];

export const CATEGORIAS = [
  ['Tarifas e juros', /ANUIDADE|SCP BASICO|TARIFA|^IOF|JUROS|ENCARGOS/],
  ['Delivery', /^IFD\*|IFOOD|99FOOD|RAPPI|ZE DELIVERY/],
  ['Transporte', /UBER|\b99\b|POSTO|AUTOPOSTO|ESTACION|ESTAPAR|^ZUL |SEM PARAR|CONECTCAR|VELOE|SHELL|IPIRANGA|AUTO ?CENTER|BUSER|BILHETE/],
  ['Saúde', /DROGA|FARMA|HOSPITAL|CLINICA|LABORAT|ODONTO|RAIA|PACHECO|CICATRIBEM|MEDIC|OTICA|SUPLEMENT/],
  ['Beleza', /SALAO|UNHAS|BARBEAR|ESTETICA|DEPILA|LASER|BOTICARIO|WEPINK|SEPHORA|NATURA|LOCCITANE|PERFUM|MAKE|COSMETI|SKIN|BELEZA/],
  ['Pet', /\bPET|COBASI|PETZ|CATSNDOG/],
  ['Mercado', /SUPERMERC|ATACAD|ST MARCHE|HORTIFRUTI|CARREFOUR|PAO DE ACUCAR|ASSAI|NUTRICAR|EMPORIO|PADARIA|DELICIA DE PAO|MAMBO|PRATICO|OXXO/],
  ['Restaurante e lanche', /RESTAURANTE|^REST |LANCH|^BAR |BAR E |BARDO|PIZZ|BURG|SUSHI|PASTE|SORVET|GELAT|ACAI|DONUT|PUDIM|CAFE|CONFEI|DOCE|CHOCOLATE|APPLEBEES|PRETZEL|PIPOCA|ROTISS|FAST FOO|GLAZED|PADOCA|QUEIJO|BOLOS|GRILL|CHURRASC|OUTBACK|MADERO|MCDONALD|HABIB|STARBUCKS/],
  ['Vestuário e acessórios', /ZARA|RENNER|RIACHUELO|YOUCOM|CAEDU|ADIDAS|NIKE|CENTAURO|DECATHLON|SCHUTZ|AREZZO|CALCAD|MODA|CONFEC|ROUPA|CROCS|FARFETCH|VIVARA|BIJU|DREAM ?RETAIL|NETSHOES|HERING|PANDORA|SPORTS/],
  ['Casa', /CASAS BAHIA|LEROY|TOK ?STOK|ETNA|KALUNGA|UTILID|ARMARINHO|EMBALAGE|DRYWASH|CLEAN|MOVEIS|ELETRO|FLORES/],
  ['Lazer e viagem', /CINEMA|INGRESSO|PARK|SHOPPING|TEATRO|HOTZONE|ZIGPAY|ORBITALL|PALMEIRAS|LATAM|HOTEL|AIRBNB|BOOKING|DECOLAR|PRAIA|BRINQUEDO/],
  ['Educação e esporte', /ESCOLA|NATACAO|ACADEMIA|CURSO|HOTMART|COLEGIO|FACULDADE|LIVRARIA|TATOO|TATTOO/],
  ['Pix e transferências', /^PIX /],
  ['Lojas online', /^NUV\*|NUVEM|^APP \*|ECOMMERCE/],
];

const encontrar = (lista, texto) => lista.find(([, re]) => re.test(texto))?.[0] ?? null;
const cache = new Map();

export function classificar({ descricao }) {
  if (cache.has(descricao)) return cache.get(descricao);
  const d = descricao.toUpperCase();
  const assinatura = encontrar(ASSINATURAS, d);
  const marketplace = assinatura ? null : encontrar(MARKETPLACES, d);
  const categoria = assinatura ? 'Assinaturas' : marketplace ? 'Marketplaces' : encontrar(CATEGORIAS, d) ?? 'Outros';
  const chave = assinatura ? `assinatura:${assinatura}`
    : marketplace ? `marketplace:${marketplace}`
    : d.replace(/[^A-Z]/g, '').slice(0, 14) || d;
  const r = { categoria, marketplace, assinatura, chave, nomeLoja: assinatura ?? marketplace ?? descricao };
  cache.set(descricao, r);
  return r;
}
