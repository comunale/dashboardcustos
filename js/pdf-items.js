// Converte um PDF (com senha opcional) em itens de texto posicionados.
// Recebe a biblioteca pdf.js como parâmetro para funcionar no navegador e no Node.

export class PdfSenhaError extends Error {
  constructor(motivo) {
    super(motivo === 'incorreta' ? 'Senha do PDF incorreta.' : 'Este PDF pede senha.');
    this.motivo = motivo;
  }
}

const arred1 = n => Math.round(n * 10) / 10;

export async function extrairItens(pdfjs, dados, senha) {
  let doc;
  try {
    // slice(): o pdf.js transfere o buffer; a cópia permite tentar de novo com outra senha.
    doc = await pdfjs.getDocument({ data: dados.slice(), password: senha || undefined, isEvalSupported: false }).promise;
  } catch (e) {
    if (e?.name === 'PasswordException') throw new PdfSenhaError(e.code === 2 ? 'incorreta' : 'necessaria');
    throw e;
  }
  const itens = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const pagina = await doc.getPage(p);
    const altura = pagina.getViewport({ scale: 1 }).height;
    const { items } = await pagina.getTextContent();
    for (const it of items) {
      const s = it.str.trim();
      if (!s) continue;
      itens.push({ p, x: arred1(it.transform[4]), y: arred1(altura - it.transform[5]), w: arred1(it.width), s });
    }
  }
  await doc.destroy();
  return itens;
}
