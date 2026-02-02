import { DataTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";

/**
 * Supported crypto types for company pool
 */
export const COMPANY_POOL_CRYPTO_TYPES = [
  'BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH',
  'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20'
];

/**
 * Chain categories for xpub derivation
 * Tokens use parent chain's xpub
 */
export const CHAIN_XPUB_MAPPING: Record<string, string> = {
  'BTC': 'BTC',
  'ETH': 'ETH',
  'LTC': 'LTC',
  'DOGE': 'DOGE',
  'TRX': 'TRX',
  'BCH': 'BCH',
  'USDT-TRC20': 'TRX',   // Uses TRX xpub
  'USDT-ERC20': 'ETH',   // Uses ETH xpub
  'USDC-ERC20': 'ETH',   // Uses ETH xpub
};

/**
 * Chain types for gas handling
 */
export const UTXO_CHAINS = ['BTC', 'LTC', 'DOGE', 'BCH'];
export const ACCOUNT_CHAINS = ['ETH', 'TRX'];
export const TOKEN_CHAINS = ['USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20'];

/**
 * Gas token mapping for account-based and token chains
 */
export const GAS_TOKEN_MAPPING: Record<string, string> = {
  'ETH': 'ETH',
  'TRX': 'TRX',
  'USDT-TRC20': 'TRX',
  'USDT-ERC20': 'ETH',
  'USDC-ERC20': 'ETH',
};

/**
 * Company Wallet Model
 * 
 * Stores xpub/mnemonic per COMPANY per chain.
 * Each company has its own wallet - TRUE MULTI-TENANT ISOLATION.
 * Generated lazily on first payment request for each chain.
 */
const companyWalletModel = sequelize.define(
  "Company_Wallet",
  {
    wallet_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "tbl_company",
        key: "company_id",
      },
      comment: "Company that owns this wallet",
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "tbl_user",
        key: "user_id",
      },
      comment: "Merchant user ID (company owner)",
    },
    wallet_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        isIn: [['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH']],
      },
      comment: "Base chain type (tokens use parent chain xpub)",
    },
    xpub: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: "Extended public key for HD derivation",
    },
    mnemonic: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: "Encrypted mnemonic (via KMS XPUB_KEY_ID)",
    },
    last_derivation_index: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: "Last used derivation index for addresses",
    },
  },
  {
    tableName: "tbl_company_wallet",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        unique: true,
        fields: ["company_id", "wallet_type"],
      },
    ],
  }
);

/**
 * Company Address Pool Model
 * 
 * Pool of addresses per COMPANY for receiving crypto payments.
 * Each company has its own addresses - complete isolation.
 * Addresses are derived from company's xpub and reused after payment completion.
 */
const companyAddressPoolModel = sequelize.define(
  "Company_Address_Pool",
  {
    address_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "tbl_company",
        key: "company_id",
      },
      comment: "Company that owns this address - PERMANENT",
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "tbl_user",
        key: "user_id",
      },
      comment: "Merchant user ID (company owner)",
    },
    wallet_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        isIn: [COMPANY_POOL_CRYPTO_TYPES],
      },
      comment: "Crypto type: BTC, ETH, USDT-TRC20, etc.",
    },
    wallet_address: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    private_key: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: "Encrypted via KMS (TEMP_KEY_ID)",
    },
    derivation_index: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Index used for HD wallet derivation",
    },
    subscription_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Tatum webhook subscription ID",
    },
    webhook_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: "The webhook URL this subscription points to",
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: "AVAILABLE",
      validate: {
        isIn: [['AVAILABLE', 'RESERVED', 'IN_USE', 'PROCESSING', 'SWEEPING', 'DISABLED']],
      },
      comment: "AVAILABLE=ready, RESERVED=waiting (30min), IN_USE=payment done waiting sweep, PROCESSING=received, SWEEPING=being swept",
    },
    admin_fee_balance: {
      type: DataTypes.DECIMAL(20, 8),
      defaultValue: 0,
      comment: "Accumulated admin fees in this address",
    },
    gas_balance: {
      type: DataTypes.DECIMAL(20, 8),
      defaultValue: 0,
      comment: "Remaining gas (TRX/ETH) for transfers",
    },
    total_transactions: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    // Current reservation (temporary, cleared after payment)
    current_payment_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Current payment using this address",
    },
    expected_amount: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: true,
      comment: "Expected crypto amount for current payment",
    },
    received_amount: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: true,
      defaultValue: 0,
      comment: "Amount received so far (for partial payment)",
    },
    is_partial_payment: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "True if partial payment received",
    },
    partial_payment_timestamp: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When partial payment was received (30 min grace)",
    },
    reserved_until: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Reservation expires at this time",
    },
    locked_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Timestamp when address was locked",
    },
    last_used_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_swept_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_merchant_payout: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Timestamp when merchant was last paid (for time-based sweep)",
    },
  },
  {
    tableName: "tbl_company_address_pool",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["company_id", "wallet_type", "status"],
      },
      {
        unique: true,
        fields: ["wallet_address"],
      },
    ],
  }
);

/**
 * Company Pool Transaction Model
 * 
 * Audit trail for all payments processed through company pool addresses.
 */
const companyPoolTransactionModel = sequelize.define(
  "Company_Pool_Transaction",
  {
    pool_tx_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    address_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "tbl_company_address_pool",
        key: "address_id",
      },
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Company for this payment",
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Merchant who owns the company",
    },
    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    payment_reference: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Unique payment reference/ID",
    },
    wallet_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    payment_amount: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      comment: "Total crypto received from customer",
    },
    merchant_amount: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      comment: "Crypto sent to merchant",
    },
    admin_fee_amount: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      comment: "Crypto retained as admin fee",
    },
    gas_funded: {
      type: DataTypes.DECIMAL(20, 8),
      defaultValue: 0,
      comment: "Gas funded for this transaction",
    },
    gas_used: {
      type: DataTypes.DECIMAL(20, 8),
      defaultValue: 0,
      comment: "Actual gas consumed",
    },
    incoming_tx_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Blockchain TX ID of incoming payment",
    },
    merchant_tx_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Blockchain TX ID of merchant transfer",
    },
    gas_funding_tx_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Blockchain TX ID of gas funding",
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: "pending",
      validate: {
        isIn: [['pending', 'gas_funded', 'merchant_sent', 'completed', 'failed', 'below_threshold']],
      },
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "tbl_company_pool_transaction",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["company_id", "wallet_type"],
      },
    ],
  }
);

/**
 * Company Pool Sweep Model
 * 
 * Records of admin fee sweeps from company pool addresses to admin wallet.
 */
const companyPoolSweepModel = sequelize.define(
  "Company_Pool_Sweep",
  {
    sweep_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    address_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "tbl_company_address_pool",
        key: "address_id",
      },
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Company that owns the pool address",
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Merchant who owns the company",
    },
    wallet_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    amount_swept: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      comment: "Crypto amount swept to admin wallet",
    },
    gas_funded: {
      type: DataTypes.DECIMAL(20, 8),
      defaultValue: 0,
    },
    gas_used: {
      type: DataTypes.DECIMAL(20, 8),
      defaultValue: 0,
    },
    sweep_tx_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Blockchain TX ID of sweep",
    },
    gas_funding_tx_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    admin_wallet: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: "Destination admin wallet",
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: "pending",
      validate: {
        isIn: [['pending', 'gas_funded', 'completed', 'failed']],
      },
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "tbl_company_pool_sweep",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["company_id", "wallet_type"],
      },
    ],
  }
);

export {
  companyWalletModel,
  companyAddressPoolModel,
  companyPoolTransactionModel,
  companyPoolSweepModel,
};
