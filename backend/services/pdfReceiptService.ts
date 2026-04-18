/**
 * Dynopay PDF Receipt Service
 * Generates branded PDF receipts for customer payments
 */

import PDFDocument from "pdfkit";
import path from "path";
// fs import removed - not used

// Logo configuration - using local asset
// LOGO_PATH and LOGO_URL removed - not used

// Brand colors
const BRAND_COLORS = {
  primary: "#1034a6",      // Dynopay Blue
  accent: "#f47323",       // Dynopay Orange
  dark: "#1a1a2e",         // Footer dark
  text: "#4a4a4a",         // Body text
  lightBg: "#f8f9ff",      // Light background
  border: "#e5e7eb",       // Border color
};

interface ReceiptData {
  // Transaction details
  transactionId: string;
  transactionReference?: string;
  
  // Payment details
  amount: string;
  currency: string;
  cryptoAmount?: string;
  cryptoCurrency?: string;
  
  // Merchant details
  companyName: string;
  companyLogo?: string;
  
  // Customer details
  customerEmail: string;
  customerName?: string;
  
  // Dates
  paymentDate: Date;
  
  // Additional info
  description?: string;
  paymentMethod?: string;
  status?: string;
}

/**
 * Generate a branded PDF receipt for a payment
 * Returns a Buffer containing the PDF data
 */
export const generatePaymentReceipt = async (data: ReceiptData): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
        info: {
          Title: `Payment Receipt - ${data.transactionId}`,
          Author: "Dynopay",
          Subject: "Payment Receipt",
          Creator: "Dynopay Payment Gateway",
        },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const pageWidth = doc.page.width - 100; // Account for margins

      // ============================================
      // HEADER SECTION
      // ============================================
      
      // Header background
      doc.rect(0, 0, doc.page.width, 120).fill(BRAND_COLORS.primary);

      // Dynopay Logo/Text
      doc.fontSize(28)
        .fillColor("#ffffff")
        .text("Dyno", 50, 45, { continued: true })
        .fillColor(BRAND_COLORS.accent)
        .text("Pay", { continued: false });

      // Receipt label
      doc.fontSize(12)
        .fillColor("#ffffff")
        .text("PAYMENT RECEIPT", 50, 80);

      // Receipt number on right
      doc.fontSize(10)
        .fillColor("#ffffff")
        .text(`Receipt #${data.transactionId.substring(0, 8).toUpperCase()}`, 400, 50, { align: "right", width: 150 });

      // Date on right
      const formattedDate = data.paymentDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      doc.text(formattedDate, 400, 70, { align: "right", width: 150 });

      // ============================================
      // STATUS BANNER
      // ============================================
      doc.rect(0, 120, doc.page.width, 40).fill("#10b981"); // Green for success
      doc.fontSize(14)
        .fillColor("#ffffff")
        .text("✓ PAYMENT SUCCESSFUL", 50, 132, { align: "center", width: pageWidth });

      // ============================================
      // MAIN CONTENT
      // ============================================
      let yPos = 190;

      // Payment Amount Section
      doc.roundedRect(50, yPos, pageWidth, 100, 8)
        .fillAndStroke(BRAND_COLORS.lightBg, BRAND_COLORS.border);

      doc.fontSize(12)
        .fillColor(BRAND_COLORS.text)
        .text("AMOUNT PAID", 70, yPos + 15);

      doc.fontSize(36)
        .fillColor(BRAND_COLORS.primary)
        .text(`${data.amount} ${data.currency}`, 70, yPos + 35);

      if (data.cryptoAmount && data.cryptoCurrency) {
        doc.fontSize(14)
          .fillColor(BRAND_COLORS.text)
          .text(`Crypto: ${data.cryptoAmount} ${data.cryptoCurrency}`, 70, yPos + 75);
      }

      yPos += 120;

      // ============================================
      // TRANSACTION DETAILS
      // ============================================
      doc.fontSize(14)
        .fillColor(BRAND_COLORS.primary)
        .text("Transaction Details", 50, yPos);

      yPos += 25;

      // Details table
      const details = [
        { label: "Transaction ID", value: data.transactionId },
        ...(data.transactionReference ? [{ label: "Reference", value: data.transactionReference }] : []),
        { label: "Payment Method", value: data.paymentMethod || "Cryptocurrency" },
        { label: "Status", value: data.status || "Completed" },
        { label: "Date & Time", value: data.paymentDate.toLocaleString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZoneName: "short",
        })},
      ];

      details.forEach((item, index) => {
        const rowY = yPos + (index * 30);
        
        // Alternating background
        if (index % 2 === 0) {
          doc.rect(50, rowY - 5, pageWidth, 28).fill("#fafafa");
        }
        
        doc.fontSize(11)
          .fillColor(BRAND_COLORS.text)
          .text(item.label, 60, rowY + 3);
        
        doc.fontSize(11)
          .fillColor(BRAND_COLORS.dark)
          .text(item.value, 250, rowY + 3, { width: 280, align: "left" });
      });

      yPos += details.length * 30 + 20;

      // ============================================
      // MERCHANT & CUSTOMER INFO
      // ============================================
      doc.moveTo(50, yPos).lineTo(50 + pageWidth, yPos).stroke(BRAND_COLORS.border);
      yPos += 20;

      // Two columns
      const colWidth = (pageWidth - 30) / 2;

      // Merchant column
      doc.fontSize(12)
        .fillColor(BRAND_COLORS.primary)
        .text("Paid To", 50, yPos);
      
      doc.fontSize(14)
        .fillColor(BRAND_COLORS.dark)
        .text(data.companyName, 50, yPos + 20);

      // Customer column
      doc.fontSize(12)
        .fillColor(BRAND_COLORS.primary)
        .text("Customer", 50 + colWidth + 30, yPos);
      
      doc.fontSize(14)
        .fillColor(BRAND_COLORS.dark)
        .text(data.customerName || data.customerEmail, 50 + colWidth + 30, yPos + 20);

      if (data.customerName) {
        doc.fontSize(11)
          .fillColor(BRAND_COLORS.text)
          .text(data.customerEmail, 50 + colWidth + 30, yPos + 40);
      }

      yPos += 80;

      // ============================================
      // DESCRIPTION (if provided)
      // ============================================
      if (data.description) {
        doc.moveTo(50, yPos).lineTo(50 + pageWidth, yPos).stroke(BRAND_COLORS.border);
        yPos += 20;

        doc.fontSize(12)
          .fillColor(BRAND_COLORS.primary)
          .text("Description", 50, yPos);
        
        doc.fontSize(11)
          .fillColor(BRAND_COLORS.text)
          .text(data.description, 50, yPos + 20, { width: pageWidth });

        yPos += 60;
      }

      // ============================================
      // FOOTER
      // ============================================
      const footerY = doc.page.height - 120;

      doc.rect(0, footerY, doc.page.width, 120).fill(BRAND_COLORS.dark);

      doc.fontSize(16)
        .fillColor("#ffffff")
        .text("Dyno", 50, footerY + 25, { continued: true })
        .fillColor(BRAND_COLORS.accent)
        .text("Pay", { continued: false });

      doc.fontSize(10)
        .fillColor("#9ca3af")
        .text("Secure Crypto Payment Gateway", 50, footerY + 50);

      doc.fontSize(9)
        .fillColor("#9ca3af")
        .text(`© ${new Date().getFullYear()} Dynopay. All rights reserved.`, 50, footerY + 70);

      doc.text("This receipt was generated automatically.", 50, footerY + 85);

      // Links on right
      doc.fontSize(9)
        .fillColor("#9ca3af")
        .text("dynopay.com", 400, footerY + 50, { align: "right", width: 150, link: "https://dynopay.com" })
        .text("support@dynopay.com", 400, footerY + 65, { align: "right", width: 150, link: "mailto:support@dynopay.com" });

      // End document
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Get receipt filename
 */
export const getReceiptFilename = (transactionId: string): string => {
  const date = new Date().toISOString().split("T")[0];
  return `Dynopay_Receipt_${transactionId.substring(0, 8)}_${date}.pdf`;
};

export default {
  generatePaymentReceipt,
  getReceiptFilename,
};
