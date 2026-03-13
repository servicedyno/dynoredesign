import { DataTypes } from "sequelize";
import sequelize from "../utils/dbInstance";

/**
 * Trial Payment Link Model
 * 
 * Stores payment links created by visitors without an account.
 * Flow: create link → share → customer pays → visitor claims funds → account created
 */
const trialPaymentLinkModel = sequelize.define(
  "Trial_Payment_Link",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    slug: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
      comment: "Short unique identifier for the trial link URL",
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      comment: "Payment amount in fiat currency",
    },
    fiat_currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: "USD",
      comment: "Fiat currency code (USD, EUR, GBP, etc.)",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Optional description for the payment",
    },
    qr_code_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "QR code image URL or base64 data",
    },
    claim_token: {
      type: DataTypes.STRING(128),
      allowNull: false,
      comment: "Hashed token for claiming funds (bcrypt hash of raw token)",
    },
    claim_email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Email entered when claiming funds (null until claimed)",
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: "active",
      allowNull: false,
      comment: "active=awaiting payment, paid=payment received, claimed=funds released, expired=timed out, refunded",
    },
    paid_amount_crypto: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: true,
      comment: "Amount of crypto received",
    },
    paid_currency: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: "Cryptocurrency used for payment (BTC, ETH, etc.)",
    },
    paid_tx_hash: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Blockchain transaction hash of the payment",
    },
    deposit_address: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Crypto deposit address assigned from merchant pool",
    },
    temp_address_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Reference to tbl_merchant_temp_address for pool management",
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
      comment: "IP address of the link creator",
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: "When the unpaid link expires (24h from creation)",
    },
    claim_expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When unclaimed funds expire (72h after payment confirmed)",
    },
    claimed_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When funds were claimed by the merchant",
    },
    paid_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When payment was confirmed on-chain",
    },
    // After claim: references to created user/company
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "User ID created during claim (null until claimed)",
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Company ID created during claim (null until claimed)",
    },
    accepted_currencies: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: "BTC,ETH,USDT-TRC20,USDT-ERC20",
      comment: "Comma-separated list of accepted cryptocurrencies",
    },
  },
  {
    tableName: "tbl_trial_payment_links",
  }
);

export default trialPaymentLinkModel;
