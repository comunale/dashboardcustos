# Fatura da Família

Painel da fatura do cartão Santander: parceladas, hábitos, valores altos e marketplaces.
A fatura é lida no navegador; o que é publicado fica criptografado com a senha da família.

## Uso no dia a dia

**Quem publica:** abrir o site → **Subir fatura** → escolher o PDF e digitar a senha do PDF →
conferir o painel → **Publicar para a família**.

**Quem vê:** abrir o link → digitar a senha da família (pode marcar "lembrar neste aparelho").

## Configuração única

1. **Token do GitHub (só para quem publica):**
   GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** →
   *Generate new token*. Repository access: **Only select repositories** → `dashboardcustos`.
   Permissions → Repository → **Contents: Read and write**. Validade: 1 ano.
   Copie o token e cole no site em **Configurações**.
2. **Senha da família:** na primeira publicação o site pede para criar. Use 4 palavras aleatórias.
   Combine com quem vai ver pessoalmente (não mande pelo WhatsApp junto com o link).
   Se for esquecida, os dados publicados não podem ser recuperados: basta subir as faturas de novo.

## Segurança

- Só os lançamentos extraídos são publicados, em `data/familia.enc.json`, criptografados
  (PBKDF2-SHA256 600 mil iterações + AES-GCM). O PDF, o endereço e a senha do PDF nunca saem do aparelho.
- O site só executa código próprio (bibliotecas copiadas em `vendor/` e uma Content-Security-Policy).
- **Risco aceito:** este site divide o endereço-base `comunale.github.io` com os outros sites do
  GitHub Pages da conta. O token e a senha "lembrada" ficam no armazenamento do navegador desse
  endereço. Não coloque scripts de terceiros (analytics, widgets) nos outros sites da conta. Para
  isolar de vez, mova o repositório para uma organização própria do GitHub.

## Para desenvolver

    npm install
    npm run serve               # http://localhost:8080
    FATURA_SENHA=... npm test   # testes; os da fatura real leem faturas/*.pdf (nunca versionado)

O leitor do Santander fica em `js/parsers/santander.js`. As categorias, marketplaces e assinaturas
ficam em `js/classify.js` e são listas simples de palavras-chave, fáceis de ampliar.
Se o banco mudar o layout, o site avisa que os totais não bateram e bloqueia a publicação.
