import test from 'node:test';
import assert from 'node:assert/strict';
import { classificar } from '../js/classify.js';

const c = descricao => classificar({ descricao });

test('marketplaces', () => {
  assert.equal(c('MERCADOLIVRE*MERCADOL').marketplace, 'Mercado Livre');
  assert.equal(c('MERCADO*OCAVARIEDADES').marketplace, 'Mercado Livre');
  assert.equal(c('EC *MERCADOLIVRE').marketplace, 'Mercado Livre');
  assert.equal(c('SHOPEE *BELLALOUHANACO').marketplace, 'Shopee');
  assert.equal(c('AMAZONMKTPLC*RODRIGODO').marketplace, 'Amazon');
  assert.equal(c('BRS*SHEINCOM').marketplace, 'Shein');
  assert.equal(c('EBN *TIKTOK SHOP').marketplace, 'TikTok Shop');
  assert.equal(c('DL*TIKTOK SHOP N').marketplace, 'TikTok Shop');
  assert.equal(c('MP *UNHAS').marketplace, null, 'maquininha do Mercado Pago não é marketplace');
  assert.equal(c('ST MARCHE').marketplace, null);
});

test('assinaturas vencem marketplace e categoria', () => {
  assert.equal(c('AMAZON PRIME CANAIS').assinatura, 'Amazon Prime');
  assert.equal(c('AMAZON PRIME CANAIS').marketplace, null);
  assert.equal(c('AMAZON PRIME CANAIS').categoria, 'Assinaturas');
  assert.equal(c('MP *MELIMAIS').assinatura, 'Meli+');
  assert.equal(c('APPLE COM/BILL').assinatura, 'Apple');
  assert.equal(c('UBER *ONE MEMBERSHIP U').assinatura, 'Uber One');
  assert.equal(c('DM*SPOTIFY P46E1').assinatura, 'Spotify');
});

test('categorias', () => {
  assert.equal(c('DL*UBERRIDES').categoria, 'Transporte');
  assert.equal(c('POSTO DE SERVICOS MODE').categoria, 'Transporte');
  assert.equal(c('DCAESTACIONAMENTO').categoria, 'Transporte');
  assert.equal(c('IFD*BERTOLUCCI CAFES L').categoria, 'Delivery');
  assert.equal(c('99FOOD *MATSUI E MUNIZ').categoria, 'Delivery');
  assert.equal(c('ST MARCHE').categoria, 'Mercado');
  assert.equal(c('SAO JORGE ATACADISTA').categoria, 'Mercado');
  assert.equal(c('RESTAURANTE NOV').categoria, 'Restaurante e lanche');
  assert.equal(c('EXTRA FARMA 7486').categoria, 'Saúde');
  assert.equal(c('HOSPITAL ALEMAO OSWALD').categoria, 'Saúde');
  assert.equal(c('METROPOLE PET SHOP').categoria, 'Pet');
  assert.equal(c('CASA FIORI SALAO DE CA').categoria, 'Beleza');
  assert.equal(c('ZARA VILA LOBOS').categoria, 'Vestuário e acessórios');
  assert.equal(c('MERCADOLIVRE*MERCADOL').categoria, 'Marketplaces');
  assert.equal(c('ANUIDADE DIFERENCIADA').categoria, 'Tarifas e juros');
  assert.equal(c('PIX CAROLINA CROVELLA SIMOe').categoria, 'Pix e transferências');
  assert.equal(c('XYZ QUALQUER COISA').categoria, 'Outros');
});

test('lojas online pequenas, suplementos e brinquedos', () => {
  assert.equal(c('NUV*LEBOTANIC').categoria, 'Lojas online');
  assert.equal(c('PG *NUVEM SPOILER').categoria, 'Lojas online');
  assert.equal(c('APP *LOJATKTX').categoria, 'Lojas online');
  assert.equal(c('MP *SLVSUPLEMENTOS').categoria, 'Saúde');
  assert.equal(c('RI HAPPY BRINQUEDOS LO').categoria, 'Lazer e viagem');
  assert.equal(c('NUCLEO XPTO').categoria, 'Outros', 'só NUV* conta, não qualquer NU…');
  assert.equal(c('APPX TECNOLOGIA').categoria, 'Outros', 'só "APP *" conta');
});

test('chave agrupa variações do mesmo lugar', () => {
  assert.equal(c('RESTAURANTE NOV').chave, c('RESTAURANTENOVA').chave);
  assert.equal(c('MAKIS VILA LEOPOLDINA').chave, c('MAKIS VILA LEOPOLD').chave);
  assert.equal(c('MERCADOLIVRE*CATSNDOG').chave, c('MERCADOLIVRE*MERCADOL').chave, 'marketplace agrupa pela plataforma');
  assert.notEqual(c('JIM COM* LUCIANA PAVA').chave, c('JIM COM* VITORIA STEF').chave);
  assert.equal(c('MERCADOLIVRE*CATSNDOG').nomeLoja, 'Mercado Livre');
  assert.equal(c('DL*UBERRIDES').nomeLoja, 'DL*UBERRIDES');
});
