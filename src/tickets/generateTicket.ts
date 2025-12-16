import PDFDocument from "pdfkit";
import path from "path";
import { PassThrough } from "stream";

interface TicketData {
  name: string;
  ticketId: string;
  qrImage: Buffer;
}

export function generateTicketPDF(data: TicketData): InstanceType<typeof PDFDocument> {
  const doc = new PDFDocument({
    size: [375, 667],
    margins: { top: 0, left: 0, right: 0, bottom: 0 },
  });

  const pageWidth = doc.page.width;

  const fontRegular = path.join(
    __dirname,
    "../assets/fonts/MPLUSRounded1c-Light.ttf"
  );
  const fontBold = path.join(
    __dirname,
    "../assets/fonts/MPLUSRounded1c-Black.ttf"
  );

  doc.registerFont("Regular", fontRegular);
  doc.registerFont("Bold", fontBold);

  // Background
  doc.rect(0, 0, pageWidth, doc.page.height).fill("#FFFFFF");

  // Header pill
  const pillWidth = 220;
  const pillHeight = 48;
  const pillX = (pageWidth - pillWidth) / 2;
  const pillY = 40;

  doc.roundedRect(pillX, pillY, pillWidth, pillHeight, 24).fill("#E23B2E");

  const logoPath = path.join(__dirname, "../assets/ethmumbai-logo.png");
  doc.image(logoPath, pillX + 16, pillY + 10, { width: 28 });

  doc
    .font("Bold")
    .fontSize(18)
    .fillColor("#FFFFFF")
    .text("ETHMUMBAI", pillX + 52, pillY + 14);

  // Hey {name}
  doc
    .font("Bold")
    .fontSize(30)
    .fillColor("#000000")
    .text(`Hey ${data.name}`, 0, 120, { align: "center" });

  doc
    .font("Regular")
    .fontSize(16)
    .text(
      "This is your ticket to the\nETHMumbai Conference",
      0,
      170,
      { align: "center" }
    );

  // QR
  const qrSize = 200;
  const qrX = (pageWidth - qrSize) / 2;
  const qrY = 260;

  doc
    .roundedRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20, 12)
    .lineWidth(4)
    .stroke("#E23B2E");

  doc.image(data.qrImage, qrX, qrY, {
    width: qrSize,
    height: qrSize,
  });

  const detailY = qrY + qrSize + 40;

  doc.font("Bold").fontSize(16).text("Name", 0, detailY, { align: "center" });
  doc
    .font("Regular")
    .fontSize(16)
    .text(data.name, 0, detailY + 20, { align: "center" });

  doc
    .font("Bold")
    .fontSize(16)
    .text("Ticket ID", 0, detailY + 60, { align: "center" });
  doc
    .font("Regular")
    .fontSize(16)
    .text(data.ticketId, 0, detailY + 80, { align: "center" });

  doc.font("Bold").fontSize(16).text("Date", 0, detailY + 120, {
    align: "center",
  });
  doc
    .font("Regular")
    .fontSize(16)
    .text("12 March 2026", 0, detailY + 140, {
      align: "center",
    });

  doc.end();
  return doc;
}

export async function generateTicketPDFBuffer(data: {
  name: string;
  ticketId: string;
  qrImage: Buffer;
}): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = generateTicketPDF(data);

    const stream = new PassThrough();
    const chunks: Buffer[] = [];

    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));

    doc.pipe(stream);
  });
}
