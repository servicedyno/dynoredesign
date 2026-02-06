import PDFDocument from "pdfkit";

interface InvoiceData {
  invoice_number: string;
  invoice_date: Date;
  provider_name: string;
  provider_address: string;
  provider_vat_id: string;
  customer_name: string;
  customer_address: string;
  customer_tax_id: string;
  description: string;
  unit_price: number;
  quantity: number;
  vat_rate: number;
  vat_amount: number;
  fixed_fee: number;
  transaction_fee_percent: number;
  blockchain_buffer_percent: number;
  total_usd: number;
  total_amount?: number; // Amount in base_currency (if different from USD)
  base_currency?: string; // Base currency code (e.g., EUR, GBP)
  total_crypto: number;
  crypto_currency: string;
  payment_terms: string;
  transaction_id: number;
}

/**
 * Get currency symbol for a given currency code
 */
const getCurrencySymbol = (currency: string): string => {
  const symbols: Record<string, string> = {
    USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$', CHF: 'CHF ',
    CNY: '¥', JPY: '¥', HKD: 'HK$', NZD: 'NZ$', SGD: 'S$',
    BRL: 'R$', NGN: '₦', ZAR: 'R', KES: 'KSh', MXN: 'MX$'
  };
  return symbols[currency?.toUpperCase()] || '';
};

/**
 * Generate PDF invoice
 * @param invoiceData - Invoice data to generate PDF from
 * @returns PDFKit.PDFDocument stream
 */
export const generateInvoicePDF = (invoiceData: InvoiceData): PDFKit.PDFDocument => {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  
  // Determine the display currency
  const displayCurrency = invoiceData.base_currency || 'USD';
  const displayAmount = invoiceData.total_amount || invoiceData.total_usd;
  const currencySymbol = getCurrencySymbol(displayCurrency);

  // Helper function to format currency
  const formatCurrency = (amount: number, currency: string = displayCurrency): string => {
    const symbol = getCurrencySymbol(currency);
    return `${symbol}${amount.toFixed(2)} ${currency}`;
  };

  // Helper function to format date
  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  // --- Header ---
  doc
    .fontSize(20)
    .font("Helvetica-Bold")
    .text("INVOICE", 50, 50, { align: "right" })
    .fontSize(10)
    .font("Helvetica")
    .text(`Invoice #: ${invoiceData.invoice_number}`, 50, 80, { align: "right" })
    .text(`Date: ${formatDate(invoiceData.invoice_date)}`, 50, 95, {
      align: "right",
    });

  // --- Provider (From) ---
  doc
    .fontSize(12)
    .font("Helvetica-Bold")
    .text("From:", 50, 140)
    .fontSize(10)
    .font("Helvetica")
    .text(invoiceData.provider_name, 50, 160)
    .text(invoiceData.provider_address.replace(/\n/g, ", "), 50, 175, {
      width: 250,
    })
    .text(`VAT ID: ${invoiceData.provider_vat_id}`, 50, 205);

  // --- Customer (Bill To) ---
  doc
    .fontSize(12)
    .font("Helvetica-Bold")
    .text("Bill To:", 320, 140)
    .fontSize(10)
    .font("Helvetica")
    .text(invoiceData.customer_name, 320, 160)
    .text(invoiceData.customer_address.replace(/\n/g, ", "), 320, 175, {
      width: 230,
    });

  if (invoiceData.customer_tax_id) {
    doc.text(`Tax ID: ${invoiceData.customer_tax_id}`, 320, 205);
  }

  // --- Line ---
  doc
    .moveTo(50, 250)
    .lineTo(550, 250)
    .stroke();

  // --- Table Header ---
  const tableTop = 270;
  doc
    .fontSize(10)
    .font("Helvetica-Bold")
    .text("Description", 50, tableTop)
    .text("Qty", 300, tableTop, { width: 50, align: "right" })
    .text("Price", 360, tableTop, { width: 80, align: "right" })
    .text("Amount", 450, tableTop, { width: 100, align: "right" });

  // --- Table Line ---
  doc
    .moveTo(50, tableTop + 15)
    .lineTo(550, tableTop + 15)
    .stroke();

  // --- Line Items ---
  let yPosition = tableTop + 25;
  doc
    .fontSize(9)
    .font("Helvetica")
    .text(invoiceData.description, 50, yPosition, { width: 240 })
    .text(invoiceData.quantity.toString(), 300, yPosition, {
      width: 50,
      align: "right",
    })
    .text(formatCurrency(invoiceData.unit_price), 360, yPosition, {
      width: 80,
      align: "right",
    })
    .text(
      formatCurrency(invoiceData.unit_price * invoiceData.quantity),
      450,
      yPosition,
      { width: 100, align: "right" }
    );

  yPosition += 25;

  // --- Processing Fee (Combined - no internal breakdown) ---
  doc.fontSize(8).font("Helvetica-Oblique");

  // Calculate total processing fee (fixed + transaction % + buffer %)
  const txFeeAmount = invoiceData.transaction_fee_percent > 0 
    ? (invoiceData.unit_price * invoiceData.transaction_fee_percent) / 100 
    : 0;
  const bufferAmount = invoiceData.blockchain_buffer_percent > 0 
    ? (invoiceData.unit_price * invoiceData.blockchain_buffer_percent) / 100 
    : 0;
  const totalProcessingFee = (invoiceData.fixed_fee || 0) + txFeeAmount + bufferAmount;

  if (totalProcessingFee > 0) {
    doc.text(`Processing Fee`, 50, yPosition, { width: 240 }).text(
      formatCurrency(totalProcessingFee),
      450,
      yPosition,
      { width: 100, align: "right" }
    );
    yPosition += 15;
  }

  // --- Subtotal ---
  yPosition += 10;
  const subtotal = invoiceData.total_usd - invoiceData.vat_amount;
  doc
    .font("Helvetica")
    .text("Subtotal:", 360, yPosition, { width: 80, align: "right" })
    .text(formatCurrency(subtotal), 450, yPosition, {
      width: 100,
      align: "right",
    });

  // --- VAT ---
  if (invoiceData.vat_amount > 0) {
    yPosition += 20;
    doc
      .text(`VAT (${invoiceData.vat_rate}%):`, 360, yPosition, {
        width: 80,
        align: "right",
      })
      .text(formatCurrency(invoiceData.vat_amount), 450, yPosition, {
        width: 100,
        align: "right",
      });
  }

  // --- Total Line ---
  yPosition += 15;
  doc
    .moveTo(360, yPosition)
    .lineTo(550, yPosition)
    .stroke();

  // --- Total ---
  yPosition += 10;
  doc
    .fontSize(12)
    .font("Helvetica-Bold")
    .text("Total:", 360, yPosition, { width: 80, align: "right" })
    .text(formatCurrency(invoiceData.total_usd), 450, yPosition, {
      width: 100,
      align: "right",
    });

  // --- Crypto Amount ---
  if (invoiceData.total_crypto && invoiceData.crypto_currency) {
    yPosition += 20;
    doc
      .fontSize(9)
      .font("Helvetica")
      .text("Crypto Equivalent:", 360, yPosition, { width: 80, align: "right" })
      .text(
        `${invoiceData.total_crypto.toFixed(8)} ${invoiceData.crypto_currency}`,
        450,
        yPosition,
        { width: 100, align: "right" }
      );
  }

  // --- Payment Terms ---
  yPosition += 50;
  if (yPosition > 650) {
    // Add new page if needed
    doc.addPage();
    yPosition = 50;
  }

  doc
    .fontSize(10)
    .font("Helvetica-Bold")
    .text("Payment Terms:", 50, yPosition)
    .fontSize(9)
    .font("Helvetica")
    .text(invoiceData.payment_terms, 50, yPosition + 15, { width: 500 });

  // --- Footer ---
  doc
    .fontSize(8)
    .font("Helvetica-Oblique")
    .text(
      `Transaction ID: ${invoiceData.transaction_id}`,
      50,
      750,
      { align: "center" }
    )
    .text("Thank you for your business!", 50, 765, { align: "center" })
    .text("Generated by DynoPay - dynopay.com", 50, 780, { align: "center" });

  // Finalize PDF
  doc.end();

  return doc;
};

export default {
  generateInvoicePDF,
};
