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
      allowNull: true,
      comment: "Hashed token for claiming funds (bcrypt hash of raw token) — legacy",
    },
    creator_email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Email of the link creator (provided at creation for management link)",
    },
    management_token_hash: {
      type: DataTypes.STRING(128),
      allowNull: true,
      comment: "SHA-256 hash of the management token sent via email",
    },
    claim_email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Email entered when claiming funds (null until claimed)",
    },
    settlement_wallet_address: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Merchant's wallet address for settling funds (matching paid_currency)",
    },
    // ── Provisional account fields (link trial → real payment infra) ──
    checkout_ref: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "The uniqueRef for the internal payment link (key into Redis customer-{ref})",
    },
    payment_link_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "FK → tbl_payment_links.link_id created for this trial",
    },
    checkout_url: {
      type: DataTypes.STRING(512),
      allowNull: true,
      comment: "Full checkout URL the payer should be redirected to",
    },
    provisional_user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "User row created with status=trial (activated on claim)",
    },
    provisional_company_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Company row created for the provisional user",
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
