import { DataTypes } from "sequelize";
import sequelize from "../utils/dbInstance";

const invoiceModel = sequelize.define(
  "Invoice",
  {
    invoice_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    invoice_number: {
      type: DataTypes.STRING(50),
      unique: true,
    },
    transaction_id: {
      type: DataTypes.INTEGER,
    },
    company_id: {
      type: DataTypes.INTEGER,
      references: {
        model: "tbl_company",
        key: "company_id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    // Provider (Dynotech) info
    provider_name: {
      type: DataTypes.STRING(100),
      defaultValue: "Dynotech Innovations, LDA",
    },
    provider_address: {
      type: DataTypes.TEXT,
    },
    provider_vat_id: {
      type: DataTypes.STRING(50),
    },
    // Customer info
    customer_name: {
      type: DataTypes.STRING(100),
    },
    customer_address: {
      type: DataTypes.TEXT,
    },
    customer_tax_id: {
      type: DataTypes.STRING(50),
    },
    // Invoice details
    description: {
      type: DataTypes.TEXT,
    },
    unit_price: {
      type: DataTypes.DECIMAL(18, 8),
    },
    quantity: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    // VAT/Tax
    vat_rate: {
      type: DataTypes.DECIMAL(5, 2),
    },
    vat_amount: {
      type: DataTypes.DECIMAL(18, 2),
    },
    // Fee breakdown
    fixed_fee: {
      type: DataTypes.DECIMAL(18, 2),
    },
    transaction_fee_percent: {
      type: DataTypes.DECIMAL(5, 2),
    },
    blockchain_buffer_percent: {
      type: DataTypes.DECIMAL(5, 2),
    },
    // Totals
    // Note: total_usd stores the total in the company's preferred currency (not necessarily USD)
    // The actual currency is indicated by crypto_currency field
    total_usd: {
      type: DataTypes.DECIMAL(18, 2),
    },
    total_crypto: {
      type: DataTypes.DECIMAL(18, 8),
    },
    crypto_currency: {
      type: DataTypes.STRING(20),
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: "generated",
    },
    // Terms
    payment_terms: {
      type: DataTypes.TEXT,
    },
    invoice_date: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "tbl_invoice",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
  }
);

export default invoiceModel;
