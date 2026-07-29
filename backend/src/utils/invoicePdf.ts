import PDFDocument from "pdfkit";

interface InvoiceItem {
  product_name: string;
  sku: string;
  unit_price: string | number;
  quantity: number;
}

interface InvoiceData {
  challan_number: string;
  status: string;
  created_at: string;
  customer_name: string;
  business_name: string | null;
  mobile: string;
  created_by_name: string | null;
  items: InvoiceItem[];
}

const INK = "#16211c";
const ACCENT = "#0d6e5f";
const MUTED = "#6b7770";
const LINE = "#d8d5cd";

/**
 * Builds a challan/invoice PDF and streams it into the provided writable
 * (the Express response). Returns when the document has been finalized.
 */
export function buildInvoicePdf(data: InvoiceData, stream: NodeJS.WritableStream): void {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  doc.pipe(stream);

  const money = (n: number) =>
    "Rs " + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ---- Header ----
  doc.fillColor(INK).fontSize(22).font("Helvetica-Bold").text("ERP + CRM Portal", 50, 50);
  doc.fillColor(MUTED).fontSize(9).font("Helvetica")
    .text("Wholesale & Distribution Operations", 50, 76);

  doc.fillColor(ACCENT).fontSize(16).font("Helvetica-Bold")
    .text("DELIVERY CHALLAN", 50, 50, { align: "right" });
  doc.fillColor(INK).fontSize(11).font("Helvetica")
    .text(data.challan_number, 50, 72, { align: "right" });
  doc.fillColor(MUTED).fontSize(9)
    .text(`Status: ${data.status}`, 50, 88, { align: "right" });

  doc.moveTo(50, 110).lineTo(545, 110).strokeColor(LINE).lineWidth(1).stroke();

  // ---- Meta: billed-to + details ----
  const metaTop = 128;
  doc.fillColor(MUTED).fontSize(9).font("Helvetica-Bold").text("BILLED TO", 50, metaTop);
  doc.fillColor(INK).fontSize(11).font("Helvetica-Bold")
    .text(data.customer_name, 50, metaTop + 14);
  doc.fillColor(INK).fontSize(10).font("Helvetica");
  let y = metaTop + 30;
  if (data.business_name) { doc.text(data.business_name, 50, y); y += 14; }
  doc.text(`Mobile: ${data.mobile}`, 50, y);

  doc.fillColor(MUTED).fontSize(9).font("Helvetica-Bold").text("DETAILS", 340, metaTop);
  doc.fillColor(INK).fontSize(10).font("Helvetica");
  const issued = new Date(data.created_at).toLocaleString("en-IN", {
    dateStyle: "medium", timeStyle: "short",
  });
  doc.text(`Issued: ${issued}`, 340, metaTop + 14, { width: 205 });
  doc.text(`Prepared by: ${data.created_by_name || "-"}`, 340, metaTop + 30, { width: 205 });

  // ---- Items table ----
  const tableTop = metaTop + 78;
  const cols = { item: 50, sku: 250, price: 340, qty: 420, total: 480 };

  doc.fillColor(ACCENT).rect(50, tableTop, 495, 22).fill();
  doc.fillColor("#ffffff").fontSize(9).font("Helvetica-Bold");
  doc.text("PRODUCT", cols.item + 6, tableTop + 7);
  doc.text("SKU", cols.sku, tableTop + 7);
  doc.text("PRICE", cols.price, tableTop + 7, { width: 70, align: "right" });
  doc.text("QTY", cols.qty, tableTop + 7, { width: 40, align: "right" });
  doc.text("TOTAL", cols.total, tableTop + 7, { width: 59, align: "right" });

  let rowY = tableTop + 22;
  let grandTotal = 0;
  doc.font("Helvetica").fontSize(10);

  data.items.forEach((it, i) => {
    const price = Number(it.unit_price);
    const lineTotal = price * it.quantity;
    grandTotal += lineTotal;

    if (i % 2 === 1) {
      doc.fillColor("#f4f3ef").rect(50, rowY, 495, 20).fill();
    }
    doc.fillColor(INK);
    doc.text(it.product_name, cols.item + 6, rowY + 6, { width: 190, ellipsis: true });
    doc.fillColor(MUTED).text(it.sku, cols.sku, rowY + 6, { width: 85, ellipsis: true });
    doc.fillColor(INK);
    doc.text(money(price), cols.price, rowY + 6, { width: 70, align: "right" });
    doc.text(String(it.quantity), cols.qty, rowY + 6, { width: 40, align: "right" });
    doc.text(money(lineTotal), cols.total, rowY + 6, { width: 59, align: "right" });
    rowY += 20;
  });

  doc.moveTo(50, rowY).lineTo(545, rowY).strokeColor(LINE).lineWidth(1).stroke();

  // ---- Total ----
  rowY += 12;
  doc.fillColor(INK).fontSize(12).font("Helvetica-Bold");
  doc.text("Grand Total", cols.price - 60, rowY, { width: 140, align: "right" });
  doc.fillColor(ACCENT).text(money(grandTotal), cols.total, rowY, { width: 59, align: "right" });

  // ---- Footer ----
  const footY = 760;
  doc.moveTo(50, footY).lineTo(545, footY).strokeColor(LINE).lineWidth(1).stroke();
  doc.fillColor(MUTED).fontSize(8).font("Helvetica")
    .text(
      "This is a system-generated delivery challan. Prices reflect the values captured at the time the challan was created.",
      50, footY + 8, { width: 495, align: "center" }
    );

  doc.end();
}