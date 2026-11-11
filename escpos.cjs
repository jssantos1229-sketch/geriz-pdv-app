// Cupom em ESC/POS (a "língua" das impressoras térmicas: Epson, Elgin,
// Bematech...). Recebe as linhas montadas pelo site (cupom-texto.ts) e devolve
// os bytes: letra em negrito/grande, acentos (página PC850), corte e gaveta.
const ESC = 0x1b;
const GS = 0x1d;

// Página de código PC850 (ESC t 2): acentos do português.
const CP850 = {
  "Ç": 0x80, "ü": 0x81, "é": 0x82, "â": 0x83, "ä": 0x84, "à": 0x85, "ç": 0x87,
  "ê": 0x88, "ë": 0x89, "è": 0x8a, "ï": 0x8b, "î": 0x8c, "Ä": 0x8e, "É": 0x90,
  "ô": 0x93, "ö": 0x94, "ò": 0x95, "û": 0x96, "ù": 0x97, "Ö": 0x99, "Ü": 0x9a,
  "á": 0xa0, "í": 0xa1, "ó": 0xa2, "ú": 0xa3, "ñ": 0xa4, "Ñ": 0xa5, "ª": 0xa6,
  "º": 0xa7, "Á": 0xb5, "Â": 0xb6, "À": 0xb7, "ã": 0xc6, "Ã": 0xc7, "Ê": 0xd2,
  "Í": 0xd6, "Ó": 0xe0, "Ô": 0xe2, "õ": 0xe4, "Õ": 0xe5, "Ú": 0xe9, "°": 0xf8,
};

function codificar(texto) {
  const out = [];
  for (const ch of String(texto || "").normalize("NFC")) {
    const c = ch.charCodeAt(0);
    if (ch === " " || ch === " ") out.push(0x20);
    else if (c >= 0x20 && c < 0x7f) out.push(c);
    else if (CP850[ch] !== undefined) out.push(CP850[ch]);
    else {
      const base = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
      const b = base.charCodeAt(0);
      out.push(b >= 0x20 && b < 0x7f ? b : 0x3f);
    }
  }
  return out;
}

function montarEscPos(cupom) {
  const colunas = Math.max(16, Math.min(64, Number(cupom.colunas) || 48));
  const b = [ESC, 0x40, ESC, 0x74, 2]; // inicia + página PC850
  if (cupom.abrirGaveta) b.push(ESC, 0x70, 0, 25, 250); // gaveta (pino 2)
  for (const l of cupom.linhas || []) {
    // Código de barras CODE128 feito pela própria impressora (ex.: papel da
    // venda em espera: o caixa bipa e a compra volta).
    if (l && typeof l.codigoBarras === "string" && /^[\x20-\x7e]{1,40}$/.test(l.codigoBarras)) {
      const dados = codificar(`{B${l.codigoBarras}`);
      b.push(ESC, 0x61, 1); // centro
      b.push(GS, 0x68, 80); // altura
      b.push(GS, 0x77, 2); // largura das barras
      b.push(GS, 0x48, 2); // texto embaixo
      b.push(GS, 0x66, 0); // fonte do texto
      b.push(GS, 0x6b, 73, dados.length, ...dados, 0x0a);
      continue;
    }
    if (l && l.separador) {
      b.push(ESC, 0x61, 0, ...codificar("-".repeat(colunas)), 0x0a);
      continue;
    }
    const alinhar = l.alinhar === "centro" ? 1 : l.alinhar === "dir" ? 2 : 0;
    const tamanho = l.tamanho === "grande" ? 0x11 : l.tamanho === "alto" ? 0x01 : 0x00;
    b.push(ESC, 0x61, alinhar, ESC, 0x45, l.negrito ? 1 : 0, GS, 0x21, tamanho);
    b.push(...codificar(l.texto), 0x0a);
    b.push(GS, 0x21, 0, ESC, 0x45, 0);
  }
  b.push(ESC, 0x61, 0, ESC, 0x64, 5); // avança o papel até a lâmina
  if (cupom.cortar) b.push(GS, 0x56, 0x42, 0x00); // corte parcial
  return Buffer.from(b);
}

function soGaveta() {
  return Buffer.from([ESC, 0x40, ESC, 0x70, 0, 25, 250]);
}

module.exports = { montarEscPos, soGaveta, codificar };
