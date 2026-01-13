import PDFDocument from "pdfkit";
import path from "path";
import { PassThrough } from "stream";

export interface InvoiceData {
  invoiceNo: string;
  date: string;
  billedTo: {
    name: string;
    addressLine1: string;
    city: string;
    state: string;
    pincode: string;
  };
  item: {
    description: string;
    quantity: number;
    price: number;
  };
  discount: number;
  gstRate: number; // e.g. 18
  paymentMethod: string;
}

export function generateInvoicePDF(data: InvoiceData): InstanceType<typeof PDFDocument> {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const pageWidth = doc.page.width;
  
    // ✅ SAFE NORMALIZATION
    const quantity = Number(data.item?.quantity ?? 1);
    const price = Number(data.item?.price ?? 0);
    const discount = Number(data.discount ?? 0);
    const gstRate = Number(data.gstRate ?? 0);
  
    /* ---------- HEADER ---------- */
    const logoPath = path.join(__dirname, "../assets/ethmumbai-logo.png");
    doc.image(logoPath, 50, 45, { width: 120 });
  
    doc.fontSize(26).font("Helvetica-Bold")
       .text("TAX INVOICE", pageWidth - 250, 50);
  
    /* ---------- ISSUER DETAILS ---------- */
    doc.fontSize(10).font("Helvetica")
      .text("Issued by:", pageWidth - 250, 100)
      .font("Helvetica-Bold")
      .text("ETHMumbai Private Limited", pageWidth - 150, 100)
      .font("Helvetica")
      .text("GSTIN:", pageWidth - 250, 118)
      .text("27AAJCE3338F1ZO", pageWidth - 150, 118)
      .text("PAN:", pageWidth - 250, 136)
      .text("AAJCE3338F", pageWidth - 150, 136)
      .text("Invoice No:", pageWidth - 250, 154)
      .text(String(data.invoiceNo ?? ""), pageWidth - 150, 154)
      .text("Date:", pageWidth - 250, 172)
      .text(String(data.date ?? ""), pageWidth - 150, 172);
  
    /* ---------- BILLED TO ---------- */
    doc.font("Helvetica-Bold").fontSize(11)
      .text("Billed to:", 50, 110)
      .font("Helvetica")
      .text(data.billedTo?.name ?? "", 50, 130)
      .text(data.billedTo?.addressLine1 ?? "", 50, 146)
      .text(
        `${data.billedTo?.city ?? ""}, ${data.billedTo?.state ?? ""}`,
        50,
        162
      )
      .text(`India ${data.billedTo?.pincode ?? ""}`, 50, 178);
  
    /* ---------- TABLE ---------- */
    let tableTop = 240;
  
    doc.moveTo(50, tableTop).lineTo(pageWidth - 50, tableTop).stroke();
  
    doc.font("Helvetica-Bold")
      .text("DESCRIPTION", 50, tableTop + 10)
      .text("QTY", 350, tableTop + 10)
      .text("PRICE", 420, tableTop + 10)
      .text("TOTAL", 500, tableTop + 10);
  
    doc.moveTo(50, tableTop + 30)
       .lineTo(pageWidth - 50, tableTop + 30)
       .stroke();
  
    const itemTotal = quantity * price;
  
    doc.font("Helvetica")
      .text(data.item?.description ?? "", 50, tableTop + 45)
      .text(String(quantity), 350, tableTop + 45)
      .text(`INR ${price.toLocaleString()}`, 420, tableTop + 45)
      .text(`INR ${itemTotal.toLocaleString()}`, 500, tableTop + 45);
  
    doc.moveTo(50, tableTop + 80)
       .lineTo(pageWidth - 50, tableTop + 80)
       .stroke();
  
    /* ---------- TOTALS ---------- */
    const discountedTotal = itemTotal - discount;
    const gstAmount = discountedTotal * (gstRate / 100);
    const gstHalf = gstAmount / 2;
  
    let totalsTop = tableTop + 110;
  
    doc.font("Helvetica")
      .text("SUB TOTAL", 350, totalsTop)
      .text(`INR ${itemTotal.toLocaleString()}`, 500, totalsTop)
      .text("DISCOUNT", 350, totalsTop + 20)
      .text(`INR ${discount.toLocaleString()}`, 500, totalsTop + 20);
  
    doc.moveTo(350, totalsTop + 45)
       .lineTo(pageWidth - 50, totalsTop + 45)
       .stroke();
  
    doc.font("Helvetica-Bold")
      .text("TOTAL", 350, totalsTop + 60)
      .text(`INR ${discountedTotal.toLocaleString()}`, 500, totalsTop + 60);
  
    /* ---------- GST ---------- */
    let gstTop = totalsTop + 110;
  
    doc.font("Helvetica")
      .text("EXCLUDING GST", 350, gstTop)
      .text(`INR ${(discountedTotal - gstAmount).toFixed(2)}`, 500, gstTop)
      .text("CGST 9%", 350, gstTop + 20)
      .text(`INR ${gstHalf.toFixed(2)}`, 500, gstTop + 20)
      .text("SGST 9%", 350, gstTop + 40)
      .text(`INR ${gstHalf.toFixed(2)}`, 500, gstTop + 40);
  
    /* ---------- FOOTER ---------- */
    doc.font("Helvetica")
      .text(`Payment Method:\n${data.paymentMethod ?? ""}`, 50, 720);
  
    doc.font("Helvetica-Bold")
      .fillColor("#E11D48")
      .fontSize(18)
      .text(
        "See you at the\nBEST Ethereum\nConference",
        pageWidth - 250,
        710,
        { align: "right" }
      );
  
    doc.end();
  return doc;
}

export function generateInvoicePDFBuffer(
  invoiceData: InvoiceData
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = generateInvoicePDF(invoiceData);

    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

