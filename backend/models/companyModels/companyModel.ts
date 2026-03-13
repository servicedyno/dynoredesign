import { DataTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";

const companyModel = sequelize.define(
  "Company",
  {
    company_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "tbl_user",
        key: "user_id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    company_name: {
      type: DataTypes.STRING,
    },
    email: {
      type: DataTypes.STRING,
      validate: {
        isEmail: true,
      },
    },
    mobile: {
      type: DataTypes.STRING,
    },
    photo: {
      type: DataTypes.TEXT,
    },
    website: {
      type: DataTypes.TEXT,
    },
    // Phase 1: Address fields
    address_line1: {
      type: DataTypes.STRING(255),
    },
    address_line2: {
      type: DataTypes.STRING(255),
    },
    city: {
      type: DataTypes.STRING(100),
    },
    state: {
      type: DataTypes.STRING(100),
    },
    country: {
      type: DataTypes.STRING(100),
    },
    zip_code: {
      type: DataTypes.STRING(20),
    },
    // Phase 1: VAT fields
    vat_number: {
      type: DataTypes.STRING(50),
    },
    vat_type: {
      type: DataTypes.STRING(10),
    },
    vat_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // Webhook configuration
    webhook_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: "URL to receive payment webhook notifications",
    },
    webhook_secret: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Secret key for webhook signature verification",
    },
    // Payment settings
    overpayment_threshold_usd: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: null,
      comment: "Minimum overpayment amount in USD to trigger overpayment handling. Default $5 if not set.",
    },
    underpayment_threshold_usd: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: null,
      comment: "Maximum underpayment amount in USD to accept as full payment. Default $1 if not set.",
    },
    grace_period_minutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      comment: "Grace period in minutes for partial payment completion on Payment Links. Max 30, default 30 if not set. Does NOT apply to Direct API payments.",
    },
    // Multi-tenant: Company backend URL for webhooks
    backend_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: "Company's backend URL for Tatum webhook delivery (e.g., https://company1.mysite.com). If null, uses global SERVER_URL.",
    },
    // Auto-Stablecoin Conversion Settings
    auto_convert_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Enable auto-conversion of volatile crypto (BTC, ETH, etc.) to stablecoin via Binance",
    },
    settlement_currency: {
      type: DataTypes.STRING(10),
      allowNull: true,
      comment: "Target stablecoin for auto-conversion: USDT or USDC",
    },
    settlement_wallet_address: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: "Merchant's stablecoin wallet address for receiving converted funds",
    },
    settlement_chain: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: "Blockchain network for stablecoin withdrawal: ERC20, TRC20, POLYGON, BEP20, SOL",
    },
    // Phase 2: Fee-Free Trial Tracking
    cumulative_volume_usd: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
      comment: "Total transaction volume in USD processed by this company",
    },
    fee_free_remaining_usd: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 500,
      comment: "Remaining fee-free volume in USD (starts at FREE_TRIAL_VOLUME_USD, default 500)",
    },
    fee_tier: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "trial",
      comment: "Fee tier: trial (fee-free period), standard (normal fees), premium (volume discount)",
    },
  },
  {
    tableName: "tbl_company",
  }
);

// companyModel
//   .sync({ alter: false })
//   .then(() => console.log("tbl_company created"));

export default companyModel;
