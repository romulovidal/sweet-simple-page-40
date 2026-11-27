import { batismoDb } from "@/lib/batismo";

/**
 * Geração do certificado em PDF (client-side, no admin):
 * desenha a imagem-modelo (bucket 'certificados', path 'modelo.png'),
 * cobre os placeholders impressos e escreve nome, data e QR Code único.
 *
 * A imagem-modelo tem 1920×1280 px; a página é 297×198 mm
 * (escala uniforme de 0,1547 mm/px). Coordenadas abaixo em mm,
 * medidas sobre o modelo aprovado.
 */
const POS = {
  // Nome do aluno (modelo v2 já vem sem régua e sem placeholder)
  nome: { x: 148.5, y: 109 },
  // Linha "Fortaleza, __ de ____ de __" (centros medidos nos blanks do modelo)
  dataY: 146.5,
  dataDiaX: 115.94,
  dataMesX: 156.62,
  dataAnoX: 200.63,
  // Canto do QR de exemplo a cobrir
  qrCover: { x: 262, y: 165, w: 28, h: 27 },
  qr: { x: 266, y: 167.5, size: 20 },
  qrCodigo: { x: 276, y: 190.5 },
};

const COR_TEXTO: [number, number, number] = [26, 42, 74]; // azul-marinho do modelo

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export interface GerarCertificadoParams {
  nome: string;
  codigo: string;
  dataEmissao: Date;
}

/** Gera o PDF do certificado e devolve o Blob. */
export async function gerarCertificadoPdf({
  nome,
  codigo,
  dataEmissao,
}: GerarCertificadoParams): Promise<Blob> {
  const [{ jsPDF }, QRCode] = await Promise.all([import("jspdf"), import("qrcode")]);

  // 1) Baixa a imagem-modelo do bucket
  const { data: signed, error: signedError } = await batismoDb()
    .storage.from("certificados")
    .createSignedUrl("modelo.png", 60 * 5);
  if (signedError || !signed?.signedUrl) {
    throw new Error(
      "Imagem-modelo do certificado não encontrada no bucket 'certificados' (path 'modelo.png').",
    );
  }
  const resp = await fetch(signed.signedUrl);
  if (!resp.ok) throw new Error("Falha ao baixar a imagem-modelo do certificado.");
  const modeloDataUrl = await blobToDataUrl(await resp.blob());

  // 2) Monta o PDF
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [297, 198] });
  doc.addImage(modeloDataUrl, "PNG", 0, 0, 297, 198);

  // Cobre o QR de exemplo impresso no modelo
  doc.setFillColor(255, 255, 255);
  doc.rect(POS.qrCover.x, POS.qrCover.y, POS.qrCover.w, POS.qrCover.h, "F");

  doc.setTextColor(...COR_TEXTO);

  // Nome do aluno (diminui a fonte se for muito longo)
  doc.setFont("times", "bold");
  let tamanho = 28;
  doc.setFontSize(tamanho);
  while (doc.getTextWidth(nome) > 160 && tamanho > 14) {
    tamanho -= 1;
    doc.setFontSize(tamanho);
  }
  doc.text(nome, POS.nome.x, POS.nome.y, { align: "center" });

  // Data: "Fortaleza, 12 de dezembro de 2026"
  doc.setFont("times", "normal");
  doc.setFontSize(14);
  doc.text(String(dataEmissao.getDate()), POS.dataDiaX, POS.dataY, { align: "center" });
  doc.text(MESES[dataEmissao.getMonth()], POS.dataMesX, POS.dataY, { align: "center" });
  doc.text(String(dataEmissao.getFullYear()), POS.dataAnoX, POS.dataY, { align: "center" });

  // QR Code único de validação
  const urlValidacao = `https://biblia.atalaias.online/validar-certificado?codigo=${encodeURIComponent(codigo)}`;
  const qrDataUrl = await QRCode.toDataURL(urlValidacao, { width: 400, margin: 1 });
  doc.addImage(qrDataUrl, "PNG", POS.qr.x, POS.qr.y, POS.qr.size, POS.qr.size);
  doc.setFontSize(7);
  doc.text("Verifique a autenticidade", POS.qrCodigo.x, POS.qrCodigo.y, { align: "center" });
  doc.text(`Código: ${codigo}`, POS.qrCodigo.x, POS.qrCodigo.y + 3.5, { align: "center" });

  return doc.output("blob");
}

/** Sobe o PDF gerado no bucket 'certificados' e devolve o path. */
export async function subirCertificadoPdf(codigo: string, pdf: Blob): Promise<string> {
  const path = `${codigo}.pdf`;
  const { error } = await batismoDb()
    .storage.from("certificados")
    .upload(path, pdf, { contentType: "application/pdf", upsert: true });
  if (error) throw error;
  return path;
}
