import {
  FeeEvmBased,
  PrivKey,
  SignatureId,
  TatumApi,
  TransactionHash,
} from "@tatumio/api-client";
import { IGenerateUserAddressParams, virtualAccount } from "../utils/types";
import axios from "axios";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { KeyManagementServiceClient } from "@google-cloud/kms";
import tronweb from "tronweb";
import { Crc32c } from "@aws-crypto/crc32c";
import { buildUrl } from "../helper";
import {
  calculateOptimalFeeLimit,
  calculateDynamicTRC20Fee,
  calculateDynamicTRXNativeFee,
  logCostSavings,
} from "../services/tronEnergyService";

// Type interfaces for blockchain transaction data
interface ERC20Transaction {
  to?: string;
  from?: string;
  value?: string;
  transactionHash?: string;
  txId?: string;
  hash?: string;
  timestamp?: number;
  blockTimestamp?: number;
}

interface UTXOOutput {
  address?: string;
  value?: string;
}

interface UTXOTransaction {
  hash?: string;
  outputs?: UTXOOutput[];
  time?: number;
}

interface BlockchainTxWithConfirmations {
  confirmations?: number;
  blockNumber?: number;
}

interface TronBlockInfo {
  block_header?: {
    raw_data?: {
      number?: number;
    };
  };
  blockNumber?: number;
}

// Type guard for TransactionHash (has txId)
const isTransactionHash = (result: TransactionHash | SignatureId): result is TransactionHash => {
  return 'txId' in result;
};

// Testnet configuration helper
const isTestnet = () => process.env.TATUM_TESTNET === 'true';
const getTestnetType = () => process.env.TATUM_TESTNET_TYPE || 'ethereum-sepolia';

// Get headers with optional testnet type
const getTatumHeaders = async () => {
  const tatumKey = await getTatumKey();
  const headers: Record<string, string> = {
    "x-api-key": tatumKey,
  };
  
  if (isTestnet()) {
    headers["x-testnet-type"] = getTestnetType();
    console.log(`[Tatum] Using TESTNET mode: ${getTestnetType()}`);
  }
  
  return headers;
};

// CRC32C helper using AWS Crypto library (pure JavaScript, works on all platforms)
const crc32c = {
  calculate: (data: Buffer | string): number => {
    const buffer = typeof data === 'string' ? Buffer.from(data) : data;
    const crc = new Crc32c();
    crc.update(buffer);
    return Number(crc.digest());
  }
};

const encryptSymmetric = async (dataToEncrypt, keyId) => {
  const plaintextBuffer = Buffer.from(dataToEncrypt);
  const projectId = process.env.PROJECT_ID;
  const locationId = process.env.LOCATION_ID;
  const keyRingId = process.env.KEY_RING_ID;

  // Properly format private key: ensure newlines are converted from \n to actual newlines
  const privateKey = process.env.GOOGLE_CLIENT_KEY?.replace(/\\n/g, '\n');

  const client = new KeyManagementServiceClient({
    credentials: {
      type: "service_account",
      project_id: projectId,
      private_key_id: process.env.PRIVATE_KEY_ID,
      private_key: privateKey,
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
    } as Record<string, unknown>,
  });

  const keyName = client.cryptoKeyPath(projectId, locationId, keyRingId, keyId);

  const plaintextCrc32c = crc32c.calculate(plaintextBuffer);
  const [encryptResponse] = await client.encrypt({
    name: keyName,
    plaintext: plaintextBuffer,
    plaintextCrc32c: {
      value: plaintextCrc32c,
    },
  });

  const ciphertext = encryptResponse.ciphertext;

  if (!encryptResponse.verifiedPlaintextCrc32c) {
    throw new Error("Encrypt: request corrupted in-transit");
  }
  if (
    crc32c.calculate(ciphertext as string) !==
    Number(encryptResponse.ciphertextCrc32c.value)
  ) {
    throw new Error("Encrypt: response corrupted in-transit");
  }

  return ciphertext.toString("base64");
};

async function decryptSymmetric(ciphertext, keyId) {
  const projectId = process.env.PROJECT_ID;
  const locationId = process.env.LOCATION_ID;
  const keyRingId = process.env.KEY_RING_ID;
  
  // Properly format private key: ensure newlines are converted from \n to actual newlines
  const privateKey = process.env.GOOGLE_CLIENT_KEY?.replace(/\\n/g, '\n');
  
  const client = new KeyManagementServiceClient({
    credentials: {
      type: "service_account",
      project_id: projectId,
      private_key_id: process.env.PRIVATE_KEY_ID,
      private_key: privateKey,
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
    } as Record<string, unknown>,
  });

  const buffer = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));

  const keyName = client.cryptoKeyPath(projectId, locationId, keyRingId, keyId);

  const ciphertextCrc32c = crc32c.calculate(buffer as Buffer);
  const [decryptResponse] = await client.decrypt({
    name: keyName,
    ciphertext: buffer,
    ciphertextCrc32c: {
      value: ciphertextCrc32c,
    },
  });
  if (
    crc32c.calculate(decryptResponse.plaintext as Buffer) !==
    Number(decryptResponse.plaintextCrc32c.value)
  ) {
    throw new Error("Decrypt: response corrupted in-transit");
  }

  const plaintext = decryptResponse.plaintext.toString();

  return plaintext;
}

let tatumSdkInitLogged = false;

const getTatumSDK = async () => {
  try {
    // Use testnet key if in testnet mode
    if (isTestnet() && process.env.TATUM_TESTNET_KEY) {
      if (!tatumSdkInitLogged) console.log('[getTatumSDK] Using TESTNET key');
      const tatumSdk = TatumApi(process.env.TATUM_TESTNET_KEY);
      tatumSdkInitLogged = true;
      return tatumSdk;
    }
    
    let tatumKey = process.env.TATUM_KEY || process.env.TATUM_SECRET_KEY;
    
    if (!tatumKey) {
      if (!tatumSdkInitLogged) console.log('[getTatumSDK] No Tatum key found in .env, attempting Secret Manager...');
      const privateKey = process.env.GOOGLE_CLIENT_KEY?.replace(/\\n/g, '\n');
      const client = new SecretManagerServiceClient({
        credentials: {
          type: "service_account",
          project_id: process.env.PROJECT_ID,
          private_key_id: process.env.PRIVATE_KEY_ID,
          private_key: privateKey,
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
        } as Record<string, unknown>,
      });
      const gcpProjectId = process.env.GCP_PROJECT_ID || process.env.PROJECT_ID || '163670787265';
      const [version] = await client.accessSecretVersion({
        name: `projects/${gcpProjectId}/secrets/Dynopay_Tatum/versions/latest`,
      });
      const payload = version.payload.data.toString();
      tatumKey = payload;
      if (!tatumSdkInitLogged) console.log('[getTatumSDK] Using key from Secret Manager');
    } else {
      if (!tatumSdkInitLogged) console.log('[getTatumSDK] Using key from .env file');
    }
    
    const tatumSdk = TatumApi(tatumKey);
    if (!tatumSdkInitLogged) console.log('[getTatumSDK] TatumApi initialized: true');
    tatumSdkInitLogged = true;
    return tatumSdk;
  } catch (e) {
    console.log('[getTatumSDK] ERROR:', e);
    throw e;
  }
};

const getTatumKey = async () => {
  try {
    // Use testnet key if in testnet mode
    if (isTestnet() && process.env.TATUM_TESTNET_KEY) {
      console.log('[getTatumKey] Using TESTNET key');
      return process.env.TATUM_TESTNET_KEY;
    }
    
    let tatumKey = process.env.TATUM_KEY || process.env.TATUM_SECRET_KEY;
    if (!tatumKey) {
      const privateKey = process.env.GOOGLE_CLIENT_KEY?.replace(/\\n/g, '\n');
      const client = new SecretManagerServiceClient({
        credentials: {
          type: "service_account",
          project_id: process.env.PROJECT_ID,
          private_key_id: process.env.PRIVATE_KEY_ID,
          private_key: privateKey,
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
        } as Record<string, unknown>,
      });
      const gcpProjectId = process.env.GCP_PROJECT_ID || process.env.PROJECT_ID || '1098360994708';
      const [version] = await client.accessSecretVersion({
        name: `projects/${gcpProjectId}/secrets/Dynopay_Tatum/versions/latest`,
      });
      const payload = version.payload.data.toString();
      tatumKey = payload;
    }
    return tatumKey;
  } catch (e) {
    console.log(e);
  }
};

const testingFunction = async () => {
  try {
    const tatumSdk = await getTatumSDK();
    const data = await tatumSdk.blockchain.bitcoin.btcGetBlockChainInfo();

    return data;
  } catch (e) {
    console.log(e);
  }
};

const generateWallet = async (currency) => {
  try {
    const tatumSdk = await getTatumSDK();
    let mnemonic, xpub, address, privateKey;
    if (currency === "BTC") {
      const wallet = await tatumSdk.blockchain.bitcoin.btcGenerateWallet();
      mnemonic = wallet.mnemonic;
      xpub = wallet.xpub;

      console.log("Mnemonic:", mnemonic);
      console.log("xPub:", xpub);

      const index = 0;
      address = (
        await tatumSdk.blockchain.bitcoin.btcGenerateAddress(xpub, index)
      ).address;
      console.log(`Derived Address [Index ${index}]:`, address);

      privateKey = (
        await tatumSdk.blockchain.bitcoin.btcGenerateAddressPrivateKey({
          mnemonic,
          index: 0,
        })
      ).key;
      console.log(`Derived Private Key [Index ${index}]:`, privateKey);
    } else if (currency === "ETH") {
      const wallet = await tatumSdk.blockchain.eth.ethGenerateWallet();
      mnemonic = wallet.mnemonic;
      xpub = wallet.xpub;

      console.log("Mnemonic:", mnemonic);
      console.log("xPub:", xpub);

      const index = 0;
      address = (await tatumSdk.blockchain.eth.ethGenerateAddress(xpub, index))
        .address;
      console.log(`Derived Address [Index ${index}]:`, address);

      privateKey = (
        await tatumSdk.blockchain.eth.ethGenerateAddressPrivateKey({
          mnemonic,
          index: 0,
        })
      ).key;
      console.log(`Derived Private Key [Index ${index}]:`, privateKey);
    } else if (currency === "TRX") {
      const wallet = await tatumSdk.blockchain.tron.generateTronwallet();
      mnemonic = wallet.mnemonic;
      xpub = wallet.xpub;

      console.log("Mnemonic:", mnemonic);
      console.log("xPub:", xpub);

      const index = 0;
      address = (
        await tatumSdk.blockchain.tron.tronGenerateAddress(xpub, index)
      ).address;
      console.log(`Derived Address [Index ${index}]:`, address);

      privateKey = (
        await tatumSdk.blockchain.tron.tronGenerateAddressPrivateKey({
          mnemonic,
          index: 0,
        })
      ).key;
      console.log(`Derived Private Key [Index ${index}]:`, privateKey);
    } else if (currency === "DOGE") {
      const wallet = await tatumSdk.blockchain.doge.dogeGenerateWallet();
      mnemonic = wallet.mnemonic;
      xpub = wallet.xpub;

      console.log("Mnemonic:", mnemonic);
      console.log("xPub:", xpub);

      const index = 0;
      address = (
        await tatumSdk.blockchain.doge.dogeGenerateAddress(xpub, index)
      ).address;
      console.log(`Derived Address [Index ${index}]:`, address);

      privateKey = (
        await tatumSdk.blockchain.doge.dogeGenerateAddressPrivateKey({
          mnemonic,
          index: 0,
        })
      ).key;
      console.log(`Derived Private Key [Index ${index}]:`, privateKey);
    } else if (currency === "LTC") {
      const wallet = await tatumSdk.blockchain.ltc.ltcGenerateWallet();
      mnemonic = wallet.mnemonic;
      xpub = wallet.xpub;

      console.log("Mnemonic:", mnemonic);
      console.log("xPub:", xpub);

      const index = 0;
      address = (await tatumSdk.blockchain.ltc.ltcGenerateAddress(xpub, index))
        .address;
      console.log(`Derived Address [Index ${index}]:`, address);

      privateKey = (
        await tatumSdk.blockchain.ltc.ltcGenerateAddressPrivateKey({
          mnemonic,
          index: 0,
        })
      ).key;
      console.log(`Derived Private Key [Index ${index}]:`, privateKey);
    } else if (currency === "BSC") {
      const wallet = await tatumSdk.blockchain.bsc.bscGenerateWallet();
      mnemonic = wallet.mnemonic;
      xpub = wallet.xpub;

      console.log("Mnemonic:", mnemonic);
      console.log("xPub:", xpub);

      const index = 0;
      address = (await tatumSdk.blockchain.bsc.bscGenerateAddress(xpub, index))
        .address;
      console.log(`Derived Address [Index ${index}]:`, address);

      privateKey = (
        await tatumSdk.blockchain.bsc.bscGenerateAddressPrivateKey({
          mnemonic,
          index: 0,
        })
      ).key;
      console.log(`Derived Private Key [Index ${index}]:`, privateKey);
    } else if (currency === "BCH") {
      const wallet = await tatumSdk.blockchain.bcash.bchGenerateWallet();
      mnemonic = wallet.mnemonic;
      xpub = wallet.xpub;

      console.log("Mnemonic:", mnemonic);
      console.log("xPub:", xpub);

      const index = 0;
      address = (
        await tatumSdk.blockchain.bcash.bchGenerateAddress(xpub, index)
      ).address;
      console.log(`Derived Address [Index ${index}]:`, address);

      privateKey = (
        await tatumSdk.blockchain.bcash.bchGenerateAddressPrivateKey({
          mnemonic,
          index: 0,
        })
      ).key;
      console.log(`Derived Private Key [Index ${index}]:`, privateKey);
    } else if (currency === "SOL") {
      // Solana: Non-HD — each wallet is a unique keypair
      const wallet = await tatumSdk.blockchain.solana.solanaGenerateWallet();
      address = wallet.address;
      privateKey = wallet.privateKey;
      mnemonic = "NON_HD";
      xpub = `NON_HD_SOL_${address.substring(0, 8)}`;
      console.log("SOL Address:", address);
    } else if (currency === "XRP") {
      // XRP: Non-HD — each wallet is account + secret
      const wallet = await tatumSdk.blockchain.xrp.xrpWallet();
      address = wallet.address;
      privateKey = wallet.secret;
      mnemonic = "NON_HD";
      xpub = `NON_HD_XRP_${address.substring(0, 8)}`;
      console.log("XRP Address:", address);
    } else if (currency === "POLYGON") {
      // Polygon: EVM-compatible, HD derivation like ETH
      const wallet = await tatumSdk.blockchain.polygon.polygonGenerateWallet();
      mnemonic = wallet.mnemonic;
      xpub = wallet.xpub;

      console.log("Mnemonic:", mnemonic);
      console.log("xPub:", xpub);

      const index = 0;
      address = (await tatumSdk.blockchain.polygon.polygonGenerateAddress(xpub, index))
        .address;
      console.log(`Derived Address [Index ${index}]:`, address);

      privateKey = (
        await tatumSdk.blockchain.polygon.polygonGenerateAddressPrivateKey({
          mnemonic,
          index: 0,
        })
      ).key;
      console.log(`Derived Private Key [Index ${index}]:`, privateKey);
    }
    return {
      mnemonic,
      xpub,
      address,
      privateKey,
    };
  } catch (error) {
    console.error("Error in wallet generation and key derivation:", error);
  }
};

const generatePrivatekey = async (currency, index, mnemonic) => {
  let privateKey: PrivKey;
  const tatumSdk = await getTatumSDK();
  if (currency === "BTC") {
    privateKey = await tatumSdk.blockchain.bitcoin.btcGenerateAddressPrivateKey(
      {
        mnemonic,
        index,
      }
    );
  } else if (currency === "ETH" || currency === "USDT-ERC20" || currency === "RLUSD-ERC20") {
    privateKey = await tatumSdk.blockchain.eth.ethGenerateAddressPrivateKey({
      mnemonic,
      index,
    });
  } else if (currency === "TRX" || currency === "USDT-TRC20") {
    privateKey = await tatumSdk.blockchain.tron.tronGenerateAddressPrivateKey({
      mnemonic,
      index,
    });
  } else if (currency === "BSC") {
    privateKey = await tatumSdk.blockchain.bsc.bscGenerateAddressPrivateKey({
      mnemonic,
      index,
    });
  } else if (currency === "DOGE") {
    privateKey = await tatumSdk.blockchain.doge.dogeGenerateAddressPrivateKey({
      mnemonic,
      index,
    });
  } else if (currency === "LTC") {
    privateKey = await tatumSdk.blockchain.ltc.ltcGenerateAddressPrivateKey({
      mnemonic,
      index,
    });
  } else if (currency === "BCH") {
    privateKey = await tatumSdk.blockchain.bcash.bchGenerateAddressPrivateKey({
      mnemonic,
      index,
    });
  } else if (currency === "SOL" || currency === "RLUSD" || currency === "XRP") {
    // Non-HD chains: mnemonic IS the private key (stored directly)
    return mnemonic;
  } else if (currency === "POLYGON" || currency === "USDT-POLYGON") {
    privateKey = await tatumSdk.blockchain.polygon.polygonGenerateAddressPrivateKey({
      mnemonic,
      index,
    });
  }
  return privateKey.key;
};

const createVirtualAccount = async ({
  currency,
  xpub,
  customerId,
}: virtualAccount) => {
  console.log(currency, xpub, customerId);
  try {
    const tatumSdk = await getTatumSDK();
    const account = await tatumSdk.ledger.account.createAccount({
      currency,
      xpub,
      accountingCurrency: "USD",
      customer: {
        externalId: customerId,
      },
    });

    return { account };
  } catch (error) {
    console.error("Error in wallet generation and key derivation:", error);
  }
};

const getAllAccounts = async () => {
  try {
    const tatumSdk = await getTatumSDK();
    const accounts = await tatumSdk.ledger.account.getAccounts();
    return { accounts };
  } catch (error) {
    console.error("Error in wallet generation and key derivation:", error);
  }
};

const generateUserAddress = async ({
  currency,
  xpub,
  mnemonic,
  index = 0,
}: IGenerateUserAddressParams): Promise<
  { address: string; privateKey: string } | undefined
> => {
  try {
    const tatumSdk = await getTatumSDK();
    let address;
    let privateKey;

    // Import ethers for deriving address from private key (testnet compatibility)
    const { ethers } = require('ethers');

    switch (currency) {
      case "BTC":
        address = await tatumSdk.blockchain.bitcoin.btcGenerateAddress(
          xpub,
          index
        );
        privateKey =
          await tatumSdk.blockchain.bitcoin.btcGenerateAddressPrivateKey({
            mnemonic,
            index,
          });
        break;
      case "ETH":
      case "USDT-ERC20":
      case "USDC-ERC20":
      case "RLUSD-ERC20":
        // Generate private key first
        privateKey = await tatumSdk.blockchain.eth.ethGenerateAddressPrivateKey(
          { mnemonic, index }
        );
        
        // CRITICAL FIX: For testnet compatibility, derive address directly from private key
        // This ensures address and private key always match, regardless of testnet/mainnet
        if (isTestnet()) {
          const wallet = new ethers.Wallet(privateKey.key);
          address = { address: wallet.address };
          console.log(`[generateUserAddress] Testnet: Derived address ${wallet.address} from private key`);
        } else {
          address = await tatumSdk.blockchain.eth.ethGenerateAddress(xpub, index);
        }
        break;
      case "TRX":
      case "USDT-TRC20":
        address = await tatumSdk.blockchain.tron.tronGenerateAddress(
          xpub,
          index
        );
        privateKey =
          await tatumSdk.blockchain.tron.tronGenerateAddressPrivateKey({
            mnemonic,
            index,
          });
        break;
      case "DOGE":
        address = await tatumSdk.blockchain.doge.dogeGenerateAddress(
          xpub,
          index
        );
        privateKey =
          await tatumSdk.blockchain.doge.dogeGenerateAddressPrivateKey({
            mnemonic,
            index,
          });
        break;
      case "LTC":
        address = await tatumSdk.blockchain.ltc.ltcGenerateAddress(xpub, index);
        privateKey = await tatumSdk.blockchain.ltc.ltcGenerateAddressPrivateKey(
          { mnemonic, index }
        );
        break;
      case "BSC":
        // Generate private key first for BSC too (same derivation as ETH)
        privateKey = await tatumSdk.blockchain.bsc.bscGenerateAddressPrivateKey(
          { mnemonic, index }
        );
        
        // For testnet, derive address from private key
        if (isTestnet()) {
          const wallet = new ethers.Wallet(privateKey.key);
          address = { address: wallet.address };
          console.log(`[generateUserAddress] Testnet BSC: Derived address ${wallet.address} from private key`);
        } else {
          address = await tatumSdk.blockchain.bsc.bscGenerateAddress(xpub, index);
        }
        break;
      case "BCH":
        address = await tatumSdk.blockchain.bcash.bchGenerateAddress(
          xpub,
          index
        );
        privateKey =
          await tatumSdk.blockchain.bcash.bchGenerateAddressPrivateKey({
            mnemonic,
            index,
          });
        break;
      case "SOL": {
        // Non-HD: generate fresh keypair for each address
        const solWallet = await tatumSdk.blockchain.solana.solanaGenerateWallet();
        return { address: solWallet.address, privateKey: solWallet.privateKey };
      }
      case "XRP":
      case "RLUSD": {
        // Non-HD: generate fresh XRP account for each address
        const xrpWallet = await tatumSdk.blockchain.xrp.xrpWallet();
        return { address: xrpWallet.address, privateKey: xrpWallet.secret };
      }
      case "POLYGON":
      case "USDT-POLYGON":
        // Generate private key first for Polygon (same derivation pattern as ETH)
        privateKey = await tatumSdk.blockchain.polygon.polygonGenerateAddressPrivateKey(
          { mnemonic, index }
        );
        
        if (isTestnet()) {
          const wallet = new ethers.Wallet(privateKey.key);
          address = { address: wallet.address };
          console.log(`[generateUserAddress] Testnet POLYGON: Derived address ${wallet.address} from private key`);
        } else {
          address = await tatumSdk.blockchain.polygon.polygonGenerateAddress(xpub, index);
        }
        break;
      default:
        throw new Error("Unsupported currency");
    }
    return { address: address.address, privateKey: privateKey.key };
  } catch (error) {
    console.error("Error in address generation:", error);
  }
};

const deleteUserAddress = async (customerID, address) => {
  try {
    const tatumSdk = await getTatumSDK();
    const resData = await tatumSdk.virtualAccount.account.removeAddress(
      customerID,
      address
    );

    return { resData };
  } catch (error) {
    console.error("Error in wallet generation and key derivation:", error);
  }
};

const createSubscription = async (address, currency, onlyCrypto = false) => {
  try {
    const headers = await getTatumHeaders();

    const chain =
      currency === "USDT-ERC20" || currency === "USDC-ERC20" || currency === "RLUSD-ERC20"
        ? "ETH"
        : currency === "USDT-TRC20"
        ? "TRON"
        : currency === "TRX"
        ? "TRON"
        : currency === "RLUSD"
        ? "XRP"
        : currency === "POLYGON" || currency === "USDT-POLYGON"
        ? "MATIC"
        : currency === "SOL"
        ? "SOLANA"
        : currency;

    // Construct webhook URL properly
    const webhookPath = onlyCrypto ? "api/tatum-crypto-webhook" : "api/tatum-webhook";
    const url = buildUrl(webhookPath);
    
    console.log(`[createSubscription] Address: ${address}, Chain: ${chain}, Webhook URL: ${url}`);

    const { data } = await axios.get(
      "https://api.tatum.io/v4/subscription?pageSize=10&address=" + address,
      { headers }
    );
    let resData = { id: null };

    if (data?.length > 0) {
      resData = { id: data[0]?.id };
      const existingUrl = data[0]?.attr?.url;
      
      // ALWAYS update webhook URL to ensure it matches current SERVER_URL
      // This fixes issues where subscription was created with old URL
      console.log(`[createSubscription] Existing subscription ${resData.id}, URL: ${existingUrl}`);
      if (existingUrl !== url) {
        console.log(`[createSubscription] Updating webhook URL from ${existingUrl} to ${url}`);
      }
      await axios.put(
        "https://api.tatum.io/v4/subscription/" + resData.id,
        { url },
        { headers }
      );
      console.log(`[createSubscription] Webhook URL updated for subscription ${resData.id}`);
    } else {
      const { data } = await axios.post(
        "https://api.tatum.io/v4/subscription",
        {
          type: "ADDRESS_EVENT",
          attr: {
            address,
            chain,
            url,
          },
        },
        { headers }
      );
      console.log("[createSubscription] New Tatum subscription created:", data?.id);
      resData = data;
    }
    return resData;
  } catch (e) {
    console.log("[createSubscription] Tatum subscription error:", JSON.stringify(e.response?.data || e.message, null, 2));
    throw e;
  }
};

/**
 * Create subscription with custom webhook URL (for multi-tenant company pools)
 * This allows each company to have its own webhook endpoint
 */
const createSubscriptionWithUrl = async (address: string, currency: string, customUrl: string) => {
  try {
    const headers = await getTatumHeaders();

    const chain =
      currency === "USDT-ERC20" || currency === "USDC-ERC20"
        ? "ETH"
        : currency === "USDT-TRC20"
        ? "TRON"
        : currency === "TRX"
        ? "TRON"
        : currency === "RLUSD"
        ? "XRP"
        : currency === "POLYGON" || currency === "USDT-POLYGON"
        ? "MATIC"
        : currency === "SOL"
        ? "SOLANA"
        : currency;

    console.log(`[createSubscriptionWithUrl] Address: ${address}, Chain: ${chain}, URL: ${customUrl}`);

    // Check for existing subscription
    const { data: existingData } = await axios.get(
      "https://api.tatum.io/v4/subscription?pageSize=10&address=" + address,
      { headers }
    );

    let resData = { id: null as string | null };

    if (existingData?.length > 0) {
      resData = { id: existingData[0]?.id };
      const existingUrl = existingData[0]?.attr?.url;
      
      console.log(`[createSubscriptionWithUrl] Existing subscription ${resData.id}, URL: ${existingUrl}`);
      
      // Update URL if different
      if (existingUrl !== customUrl) {
        console.log(`[createSubscriptionWithUrl] Updating URL: ${existingUrl} -> ${customUrl}`);
        await axios.put(
          "https://api.tatum.io/v4/subscription/" + resData.id,
          { url: customUrl },
          { headers }
        );
        console.log(`[createSubscriptionWithUrl] ✅ URL updated for subscription ${resData.id}`);
      }
    } else {
      // Create new subscription
      const { data: newData } = await axios.post(
        "https://api.tatum.io/v4/subscription",
        {
          type: "ADDRESS_EVENT",
          attr: {
            address,
            chain,
            url: customUrl,
          },
        },
        { headers }
      );
      console.log(`[createSubscriptionWithUrl] ✅ New subscription created: ${newData?.id}`);
      resData = newData;
    }
    
    return resData;
  } catch (e: unknown) {
    const error = e as { response?: { data?: unknown }; message?: string };
    console.log("[createSubscriptionWithUrl] Error:", JSON.stringify(error.response?.data || error.message, null, 2));
    throw e;
  }
};

/**
 * BlockBee Style: Create subscription with company_id encoded in webhook URL
 * This enables multi-tenant routing without per-company backends
 * 
 * URL Format: https://SERVER_URL/api/tatum-crypto-webhook?company_id=38&address_id=5&user_id=28
 */
const createSubscriptionBlockBeeStyle = async (
  address: string, 
  currency: string, 
  companyId: number,
  userId: number,
  addressId: number
) => {
  try {
    const headers = await getTatumHeaders();

    const chain =
      currency === "USDT-ERC20" || currency === "USDC-ERC20"
        ? "ETH"
        : currency === "USDT-TRC20"
        ? "TRON"
        : currency === "TRX"
        ? "TRON"
        : currency === "RLUSD"
        ? "XRP"
        : currency === "POLYGON" || currency === "USDT-POLYGON"
        ? "MATIC"
        : currency === "SOL"
        ? "SOLANA"
        : currency;

    // BlockBee Style: Encode company info in webhook URL
    const baseUrl = (process.env.SERVER_URL || '').replace(/\/$/, '');
    const webhookUrl = `${baseUrl}/api/tatum-crypto-webhook?company_id=${companyId}&user_id=${userId}&address_id=${addressId}`;
    
    console.log(`[createSubscriptionBlockBeeStyle] Address: ${address}, Chain: ${chain}`);
    console.log(`[createSubscriptionBlockBeeStyle] Webhook URL: ${webhookUrl}`);

    // Check for existing subscription
    const { data: existingData } = await axios.get(
      "https://api.tatum.io/v4/subscription?pageSize=10&address=" + address,
      { headers }
    );

    let resData = { id: null as string | null, url: webhookUrl };

    if (existingData?.length > 0) {
      resData.id = existingData[0]?.id;
      const existingUrl = existingData[0]?.attr?.url;
      
      console.log(`[createSubscriptionBlockBeeStyle] Existing subscription ${resData.id}`);
      console.log(`[createSubscriptionBlockBeeStyle] Current URL: ${existingUrl}`);
      
      // Always update URL to ensure company_id params are current
      if (existingUrl !== webhookUrl) {
        console.log(`[createSubscriptionBlockBeeStyle] Updating URL with new company info`);
        await axios.put(
          "https://api.tatum.io/v4/subscription/" + resData.id,
          { url: webhookUrl },
          { headers }
        );
        console.log(`[createSubscriptionBlockBeeStyle] ✅ URL updated`);
      }
    } else {
      // Create new subscription
      const { data: newData } = await axios.post(
        "https://api.tatum.io/v4/subscription",
        {
          type: "ADDRESS_EVENT",
          attr: {
            address,
            chain,
            url: webhookUrl,
          },
        },
        { headers }
      );
      console.log(`[createSubscriptionBlockBeeStyle] ✅ New subscription created: ${newData?.id}`);
      resData.id = newData?.id;
    }
    
    return resData;
  } catch (e: unknown) {
    const error = e as { response?: { data?: unknown }; message?: string };
    console.error("[createSubscriptionBlockBeeStyle] Error:", error.response?.data || error.message);
    throw e;
  }
};

const deleteSubscription = async (id: string | number | null): Promise<unknown> => {
  try {
    if (id) {
      const headers = await getTatumHeaders();
      const networkType = isTestnet() ? 'testnet' : 'mainnet';
      const resData = await axios.delete(
        `https://api.tatum.io/v4/subscription/${id}?type=${networkType}`,
        { headers }
      );
      console.log(resData.data);
      return resData.data;
    }
    return null;
  } catch (e: unknown) {
    console.log(e);
  }
};

/**
 * List all active subscriptions from Tatum
 * Cost: ~2 credits per call
 */
const listAllSubscriptions = async (): Promise<Array<Record<string, unknown>>> => {
  try {
    const headers = await getTatumHeaders();
    const allSubscriptions: Array<Record<string, unknown>> = [];
    let offset = 0;
    const pageSize = 50;
    
    // Paginate through all subscriptions
    while (true) {
      const { data } = await axios.get(
        `https://api.tatum.io/v4/subscription?pageSize=${pageSize}&offset=${offset}`,
        { headers }
      );
      
      if (!data || data.length === 0) break;
      
      allSubscriptions.push(...data);
      
      if (data.length < pageSize) break;
      offset += pageSize;
    }
    
    return allSubscriptions;
  } catch (e: unknown) {
    const error = e as { response?: { data?: unknown }; message?: string };
    console.error("Failed to list subscriptions:", error.response?.data || error.message);
    throw e;
  }
};

const sendFeeToAdmin = async (userId: string, adminID: string, amount: number | string): Promise<string | undefined> => {
  try {
    const tatumSdk = await getTatumSDK();
    const resData = await tatumSdk.ledger.transaction.sendTransaction({
      amount: amount.toString(),
      recipientAccountId: adminID,
      senderAccountId: userId,
    });
    console.log(resData.reference);
    return resData.reference;
  } catch (e: unknown) {
    console.log(e);
  }
};

const getBitcoinAddress = async (address) => {
  try {
    const tatumSdk = await getTatumSDK();
    const data = await tatumSdk.blockchain.bitcoin.btcGetBalanceOfAddress(
      address
    );
    console.log(data);
  } catch (e) {
    console.log(e);
  }
};

const feeEstimation = async (
  currency,
  fromAddress,
  toAddress,
  amount,
  _contractAddress = "",
  bchInputs = 1
) => {
  let fees;
  const tatumSdk = await getTatumSDK();
  if (["BTC", "LTC", "DOGE"].indexOf(currency) !== -1) {
    fees = await tatumSdk.fee.estimateFeeBlockchain({
      chain: currency,
      type: "TRANSFER",
      fromAddress: [fromAddress],
      to: [{ address: toAddress, value: Number(amount) }],
    });
  } else if (["ETH", "BSC", "USDT-ERC20", "USDC-ERC20", "RLUSD-ERC20"].indexOf(currency) !== -1) {
    const isERC20 = currency === "USDT-ERC20" || currency === "USDC-ERC20" || currency === "RLUSD-ERC20";
    const localAmount: number = Number(amount);
    // ERC-20 tokens (USDT/USDC/RLUSD) have 6 decimals; ETH has 18 — truncate to avoid BigNumber parse errors
    const decimals = isERC20 ? 6 : 8;
    const factor = Math.pow(10, decimals);
    const safeEstimateAmount = (Math.floor(localAmount * factor) / factor).toString();
    if (isERC20) {
      console.log(`[getGasFee] ${currency} amount for gas estimation: ${localAmount} → truncated to ${decimals} decimals: ${safeEstimateAmount}`);
    }
    const gasFees = (await tatumSdk.fee.estimateFeeBlockchain({
      chain: isERC20 ? "ETH" : currency,
      type: isERC20 ? "TRANSFER_ERC20" : "TRANSFER_NFT",
      sender: fromAddress,
      ...(isERC20 && {
        contractAddress: currency === "USDC-ERC20" ? process.env.USDC_CONTRACT
          : currency === "RLUSD-ERC20" ? process.env.RLUSD_ERC20_CONTRACT
          : process.env.ETH_CONTRACT,
      }),
      recipient: toAddress,
      amount: safeEstimateAmount,
    })) as FeeEvmBased;

    console.log(gasFees);

    // Gas price bounds — optimized for post-Dencun ETH (base fee often 1-2 Gwei in 2025-2026)
    // MIN: 1 Gwei (post-Dencun minimum), MAX: 30 Gwei (cost control)
    // Priority buffer: 15% + 0.5 Gwei (percentage-based, was flat +2 Gwei which doubled fees at low base)
    const MIN_GAS_PRICE = 1;
    const MAX_GAS_PRICE = 30;
    const rawGasPrice = Math.ceil(gasFees?.gasPrice || MIN_GAS_PRICE);
    let gasPrice = Math.max(MIN_GAS_PRICE, Math.min(MAX_GAS_PRICE, rawGasPrice));
    // Percentage-based buffer: 15% + 0.5 Gwei priority tip (replaces old flat +2 Gwei)
    const gas_fee_for_amount = Math.ceil(gasPrice * 1.15 + 0.5);
    console.log(`[EVM Gas] ⛽ Price: raw=${rawGasPrice}, capped=${gasPrice}, with buffer=${gas_fee_for_amount} Gwei (was ${gasPrice + 2} with flat +2)`);
    logCostSavings("EVM-GasBuffer", gasPrice + 2, gas_fee_for_amount, { currency, rawGasPrice });
    fees = {
      fast: Number(
        Number((gas_fee_for_amount * gasFees?.gasLimit) / 1000000000)
      ).toFixed(8),
      ...(!isERC20 && {
        medium: Number(
          Number(
            (gas_fee_for_amount * ((gasFees?.gasLimit * 50) / 100)) / 1000000000
          )
        ).toFixed(8),
        slow: Number(
          Number(
            (gas_fee_for_amount * ((gasFees?.gasLimit * 25) / 100)) / 1000000000
          )
        ).toFixed(8),
      }),
      gasPrice,
      gasLimit: isERC20
          ? gasFees.gasLimit
          : Math.floor((gasFees?.gasLimit * 25) / 100),
    };
  } else if (currency === "BCH") {
    const headers = await getTatumHeaders();
    const {
      data: { result },
    } = await axios.post(
      "https://api.tatum.io/v3/blockchain/node/BCH",
      {
        jsonrpc: "1.0",
        id: "1",
        method: "estimatefee",
        params: [],
      },
      { headers }
    );
    const bytes = (bchInputs + 1 * 148 + 2 * 34 + 10) / 1000;
    fees = {
      slow: (bytes * result).toFixed(8),
      medium: (bytes * result).toFixed(8),
      fast: (bytes * result).toFixed(8),
    };
  } else if (currency === "TRX") {
    // Dynamic TRX native fee: free with bandwidth, ~0.3 TRX otherwise (was hardcoded 10)
    try {
      const trxFee = await calculateDynamicTRXNativeFee(fromAddress);
      logCostSavings("feeEstimation-TRX", 10, trxFee.fast, { bandwidthFree: trxFee.bandwidthFree });
      fees = {
        fast: trxFee.fast,
        medium: trxFee.medium,
        slow: trxFee.slow,
      };
    } catch (_trxFeeError) {
      console.warn(`[feeEstimation] ⚠️ Dynamic TRX fee failed, using fallback 1 TRX`);
      fees = { fast: 1, medium: 1, slow: 1 };
    }
  } else if (currency === "USDT-TRC20") {
    // Dynamic TRC20 fee calculation using live TRON Energy price
    // Post Proposal #104 (Aug 2025): Energy reduced from 420 → 100 SUN/unit
    try {
      const dynamicFee = await calculateDynamicTRC20Fee(fromAddress);
      logCostSavings("feeEstimation", 20, dynamicFee.fast, {
        energyPrice: dynamicFee.energyPrice,
        energyAvailable: dynamicFee.energyAvailable,
        sender: fromAddress,
      });
      fees = {
        fast: dynamicFee.fast,
      };
    } catch (feeCalcError) {
      console.warn(`[feeEstimation] ⚠️ Dynamic TRC20 fee failed, using fallback 14 TRX:`, feeCalcError);
      // Fallback: 65k energy × 100 SUN + bandwidth ≈ 7 TRX, with buffer ≈ 14 TRX
      fees = {
        fast: 14,
      };
    }
  } else if (currency === "SOL") {
    // Solana: fixed low fee (typically 0.000005 SOL per signature, ~5000 lamports)
    fees = { fast: 0.00001, medium: 0.000005, slow: 0.000005 };
  } else if (currency === "XRP") {
    // XRP: very low fees (~12 drops = 0.000012 XRP)
    fees = { fast: 0.00005, medium: 0.000012, slow: 0.000012 };
  } else if (currency === "RLUSD") {
    // RLUSD on XRP Ledger: fee in XRP (~12 drops)
    fees = { fast: 0.00005 };
  } else if (currency === "POLYGON" || currency === "USDT-POLYGON") {
    // Polygon: EVM-compatible, use same fee estimation as ETH
    const isToken = currency === "USDT-POLYGON";
    const localAmount: number = Number(amount);
    const decimals = isToken ? 6 : 8;
    const factor = Math.pow(10, decimals);
    const safeEstimateAmount = (Math.floor(localAmount * factor) / factor).toString();
    try {
      const gasFees = (await tatumSdk.fee.estimateFeeBlockchain({
        chain: "MATIC",
        type: "TRANSFER_ERC20",
        sender: fromAddress,
        ...(isToken && {
          contractAddress: process.env.USDT_POLYGON_CONTRACT || "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
        }),
        recipient: toAddress,
        amount: safeEstimateAmount,
      })) as FeeEvmBased;

      let gasPrice = Math.max(1, Math.min(100, Math.ceil(gasFees?.gasPrice || 30)));
      const gas_fee_for_amount = Math.ceil(gasPrice * 1.15 + 0.5);
      fees = {
        fast: Number(
          Number((gas_fee_for_amount * gasFees?.gasLimit) / 1000000000)
        ).toFixed(8),
        gasPrice,
        gasLimit: isToken ? gasFees.gasLimit : Math.floor((gasFees?.gasLimit * 25) / 100),
      };
    } catch (_polyFeeError) {
      console.warn(`[feeEstimation] ⚠️ Polygon fee estimation failed, using fallback`);
      fees = { fast: isToken ? 0.01 : 0.001, gasPrice: 30, gasLimit: isToken ? 65000 : 21000 };
    }
  }

  return fees;
};

const batchFeeEstimation = async ({
  currency,
  fromAddresses,
  toAddresses,
  amount,
  _contractAddress = "",
  bchInputs = 1,
  totalAddress,
}) => {
  let fees;

  const tatumSdk = await getTatumSDK();
  // Handled Batch Transactions
  if (["BTC", "LTC", "DOGE"].indexOf(currency) !== -1) {
    console.log("###IF 1 BTC OR 1 LTC OR 1 DOGE###");
    console.log("###Payloads-->", {
      chain: currency,
      type: "TRANSFER",
      fromAddress: fromAddresses.map((address) => address.address),
      to: toAddresses.map((address) => ({
        ...address,
        value: Number(address.value),
      })),
    });
    fees = await tatumSdk.fee.estimateFeeBlockchain({
      chain: currency,
      type: "TRANSFER",
      fromAddress: fromAddresses.map((address) => address.address),
      to: toAddresses.map((address) => ({
        ...address,
        value: Number(address.value),
      })),
    });
    console.log("###BTC FEES--->", fees);
  } else if (["ETH", "BSC", "USDT-ERC20", "USDC-ERC20", "RLUSD-ERC20", "POLYGON", "USDT-POLYGON"].indexOf(currency) !== -1) {
    const isERC20 = ["USDT-ERC20", "USDC-ERC20", "RLUSD-ERC20", "USDT-POLYGON"].includes(currency);
    const chainId = ["POLYGON", "USDT-POLYGON"].includes(currency) ? "MATIC" : (isERC20 ? "ETH" : currency);
    // Handle Multiple Transactions
    const gasFeesArray = await Promise.all(
      fromAddresses.map(async (fromAddress) => {
        // ERC-20 tokens (USDT/USDC/RLUSD) have 6 decimals — truncate to avoid BigNumber parse errors
        const sweepDecimals = isERC20 ? 6 : 8;
        const sweepFactor = Math.pow(10, sweepDecimals);
        const safeSweepAmount = (Math.floor(Number(amount) * sweepFactor) / sweepFactor).toString();
        const gasFees = (await tatumSdk.fee.estimateFeeBlockchain({
          chain: chainId,
          type: isERC20 ? "TRANSFER_ERC20" : "TRANSFER_NFT",
          sender: fromAddress.address,
          ...(isERC20 && {
            contractAddress: currency === "USDC-ERC20" ? process.env.USDC_CONTRACT 
              : currency === "RLUSD-ERC20" ? process.env.RLUSD_ERC20_CONTRACT
              : currency === "USDT-POLYGON" ? (process.env.USDT_POLYGON_CONTRACT || "0xc2132D05D31c914a87C6611C10748AEb04B58e8F")
              : process.env.ETH_CONTRACT,
          }),
          recipient: toAddresses[0].address,
          amount: safeSweepAmount,
        })) as FeeEvmBased;

        return gasFees;
      })
    );

    const gasFees = gasFeesArray.reduce(
      (acc, gasFee) => {
        acc.gasPrice = Math.max(acc.gasPrice, gasFee.gasPrice);
        acc.gasLimit = Math.max(acc.gasLimit, gasFee.gasLimit);
        return acc;
      },
      { gasPrice: 0, gasLimit: 0 }
    );

    console.log({ gasFees });

    let gasPrice = Math.max(1, Math.min(30, gasFees?.gasPrice || 1));
    // Percentage-based buffer: 10% + 0.5 Gwei priority tip (was flat +1 Gwei)
    const batchGasBuffer = Math.ceil(gasPrice * 1.1 + 0.5);
    console.log(`[EVM Gas] ⛽ Batch price: ${gasPrice} Gwei, buffered=${batchGasBuffer} Gwei (was ${gasPrice + 1})`);

    fees = {
      fast: Number(
        Number(((batchGasBuffer) * gasFees?.gasLimit) / 1000000000) * totalAddress
      ).toFixed(8),
      ...(!isERC20 && {
        medium: Number(
          Number(
            ((batchGasBuffer) * ((gasFees?.gasLimit * 50) / 100)) / 1000000000
          ) * totalAddress
        ).toFixed(8),
        slow: Number(
          Number(
            ((batchGasBuffer) * ((gasFees?.gasLimit * 25) / 100)) / 1000000000
          ) * totalAddress
        ).toFixed(8),
      }),
      gasPrice,
      gasLimit: isERC20
          ? gasFees.gasLimit
          : Math.floor((gasFees?.gasLimit * 25) / 100),
    };
  } else if (currency === "BCH") {
    const headers = await getTatumHeaders();
    const {
      data: { result },
    } = await axios.post(
      "https://api.tatum.io/v3/blockchain/node/BCH",
      {
        jsonrpc: "1.0",
        id: "1",
        method: "estimatefee",
        params: [],
      },
      { headers }
    );
    const bytes = ((bchInputs + 1) * 148 + 2 * 34 + 10) / 1000;
    fees = {
      slow: (bytes * result).toFixed(8),
      medium: (bytes * result).toFixed(8),
      fast: (bytes * result).toFixed(8),
    };
  } else if (currency === "TRX") {
    // Dynamic TRX native batch fee: free with bandwidth, ~0.3 TRX/tx otherwise (was 3.5/tx)
    try {
      const trxFee = await calculateDynamicTRXNativeFee();
      const perAddressFee = trxFee.fast || 0.5;
      logCostSavings("batchFeeEstimation-TRX", totalAddress * 3.5, totalAddress * perAddressFee, { totalAddress });
      fees = {
        fast: totalAddress * perAddressFee,
        medium: totalAddress * perAddressFee,
        slow: totalAddress * perAddressFee,
      };
    } catch (_trxBatchError) {
      fees = { fast: totalAddress * 0.5, medium: totalAddress * 0.5, slow: totalAddress * 0.5 };
    }
  } else if (currency === "USDT-TRC20") {
    // Dynamic batch TRC20 fee using live TRON Energy price
    try {
      const dynamicFee = await calculateDynamicTRC20Fee();
      const batchFee = dynamicFee.fast * (totalAddress || 1);
      logCostSavings("batchFeeEstimation", 20, batchFee, { totalAddress });
      fees = {
        fast: batchFee,
      };
    } catch (_batchFeeError) {
      console.warn(`[batchFeeEstimation] ⚠️ Dynamic TRC20 fee failed, using fallback`);
      fees = {
        fast: 14 * (totalAddress || 1),
      };
    }
  }
  return fees;
};

const assetToOtherAddress = async ({
  currency,
  fromAddress,
  toAddress,
  privateKey,
  amount,
  fee,
  _contractAddress = null,
  fromMaster = false,
  fromUTXO = [],
  toUTXO = [],
}) => {
  let transaction;
  const tatumSdk = await getTatumSDK();
  if (currency === "BTC") {
    // When toUTXO is provided (merchant + admin split), use multi-output; otherwise single output
    const btcOutputs = toUTXO.length > 0
      ? toUTXO.map((o: any) => ({ address: o.address, value: Number(Number(o.value).toFixed(8)) }))
      : [{ address: toAddress, value: Number(Number(amount).toFixed(8)) }];
    transaction = await tatumSdk.blockchain.bitcoin.btcTransferBlockchain({
      fromAddress: [{ address: fromAddress, privateKey }],
      to: btcOutputs,
      fee,
      changeAddress: toUTXO.length > 0 ? fromAddress : (fromMaster ? fromAddress : toAddress),
    });
  } else if (currency === "ETH" || currency === "USDT-ERC20" || currency === "USDC-ERC20" || currency === "RLUSD-ERC20") {
    // USDT/USDC ERC-20 have 6 decimals; ETH has 18 — truncate accordingly
    const isERC20Token = currency === "USDT-ERC20" || currency === "USDC-ERC20" || currency === "RLUSD-ERC20";
    const decimals = isERC20Token ? 6 : 8;
    const factor = Math.pow(10, decimals);
    const safeAmount = (Math.floor(Number(amount) * factor) / factor).toString();
    if (isERC20Token) {
      console.log(`[assetToOtherAddress] ${currency} amount: ${amount} → truncated to ${decimals} decimals: ${safeAmount}`);
    }
    if (currency === "RLUSD-ERC20") {
      // RLUSD is a custom ERC-20 not in Tatum's predefined list — use generic erc20Transfer
      transaction = await tatumSdk.fungibleToken.erc20Transfer({
        chain: "ETH",
        to: toAddress,
        contractAddress: process.env.RLUSD_ERC20_CONTRACT || "0x8292Bb45bf1Ee4d140127049757C2E0fF06317eD",
        amount: safeAmount,
        digits: 6,
        fromPrivateKey: privateKey,
        fee: {
          gasPrice: Math.ceil(fee?.gasPrice).toString(),
          gasLimit: fee?.gasLimit.toString(),
        },
      });
    } else {
      transaction = await tatumSdk.blockchain.eth.ethBlockchainTransfer({
        fromPrivateKey: privateKey,
        to: toAddress,
        amount: safeAmount,
        fee: {
          gasPrice: Math.ceil(fee?.gasPrice).toString(),
          gasLimit: fee?.gasLimit.toString(),
        },
        currency: currency === "ETH" ? "ETH" : (currency === "USDC-ERC20" ? "USDC" : "USDT"),
      });
    }
  } else if (currency === "TRX") {
    transaction = await tatumSdk.blockchain.tron.tronTransfer({
      fromPrivateKey: privateKey,
      to: toAddress,
      amount: Number(amount).toFixed(8).toString(),
    });
  } else if (currency === "USDT-TRC20") {
    // USDT TRC-20 has 6 decimals — truncate (not round) to avoid "callback is not defined" Tatum error
    const truncatedAmount = (Math.floor(Number(amount) * 1e6) / 1e6).toString();
    console.log(`[assetToOtherAddress] USDT-TRC20 amount: ${amount} → truncated to 6 decimals: ${truncatedAmount}`);

    // Dynamic feeLimit based on sender's Energy & current network price
    let optimalFeeLimit = 15; // Default fallback (was hardcoded 50)
    try {
      const feeLimitResult = await calculateOptimalFeeLimit(
        fromAddress,
        toAddress,
        process.env.TRX_CONTRACT
      );
      optimalFeeLimit = feeLimitResult.feeLimit;
      logCostSavings("assetToOtherAddress", 50, optimalFeeLimit, {
        energyDeficit: feeLimitResult.energyDeficit,
        isNewRecipient: feeLimitResult.isNewRecipient,
      });
    } catch (feeLimitError) {
      console.warn(`[assetToOtherAddress] ⚠️ Dynamic feeLimit failed, using fallback ${optimalFeeLimit} TRX`);
    }

    transaction = await tatumSdk.blockchain.tron.tronTransferTrc20({
      amount: truncatedAmount,
      feeLimit: optimalFeeLimit,
      fromPrivateKey: privateKey,
      to: toAddress,
      tokenAddress: process.env.TRX_CONTRACT,
    });
  } else if (currency === "BSC") {
    transaction = await tatumSdk.blockchain.bsc.bscBlockchainTransfer({
      currency,
      amount: Number(amount).toFixed(8).toString(),
      fromPrivateKey: privateKey,
      to: toAddress,
      fee: {
        gasPrice: Math.ceil(fee?.gasPrice).toString(),
        gasLimit: fee?.gasLimit.toString(),
      },
    });
  } else if (currency === "DOGE") {
    // When toUTXO is provided (merchant + admin split), use multi-output; otherwise single output
    const dogeOutputs = toUTXO.length > 0
      ? toUTXO.map((o: any) => ({ address: o.address, value: Number(Number(o.value).toFixed(8)) }))
      : [{ address: toAddress, value: Number(Number(amount).toFixed(8)) }];
    transaction = await tatumSdk.blockchain.doge.dogeTransferBlockchain({
      fromAddress: [{ address: fromAddress, privateKey }],
      to: dogeOutputs,
      fee,
      changeAddress: toUTXO.length > 0 ? fromAddress : (fromMaster ? fromAddress : toAddress),
    });
  } else if (currency === "LTC") {
    // When toUTXO is provided (merchant + admin split), use multi-output; otherwise single output
    const ltcOutputs = toUTXO.length > 0
      ? toUTXO.map((o: any) => ({ address: o.address, value: Number(Number(o.value).toFixed(8)) }))
      : [{ address: toAddress, value: Number(Number(amount).toFixed(8)) }];
    transaction = await tatumSdk.blockchain.ltc.ltcTransferBlockchain({
      fromAddress: [{ address: fromAddress, privateKey }],
      to: ltcOutputs,
      fee,
      changeAddress: toUTXO.length > 0 ? fromAddress : (fromMaster ? fromAddress : toAddress),
    });
  } else if (currency === "BCH") {
    transaction = await tatumSdk.blockchain.bcash.bchTransferBlockchain({
      fromUTXO,
      to: toUTXO,
      fee: fee,
      changeAddress: fromMaster
        ? fromAddress
        : toAddress?.includes("bitcoincash")
        ? toAddress
        : "bitcoincash:" + toAddress,
    });
  } else if (currency === "SOL") {
    // Solana native transfer
    transaction = await tatumSdk.blockchain.solana.solanaBlockchainTransfer({
      from: fromAddress,
      to: toAddress,
      amount: Number(amount).toFixed(9).toString(),
      fromPrivateKey: privateKey,
    });
  } else if (currency === "XRP") {
    // XRP native transfer
    transaction = await tatumSdk.blockchain.xrp.xrpTransferBlockchain({
      fromAccount: fromAddress,
      to: toAddress,
      amount: Number(amount).toFixed(6).toString(),
      fromSecret: privateKey,
    });
  } else if (currency === "RLUSD") {
    // RLUSD token transfer on XRP Ledger
    const rlusdIssuer = process.env.RLUSD_ISSUER || "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De";
    const rlusdCurrencyHex = process.env.RLUSD_CURRENCY_HEX || "524C555344000000000000000000000000000000";
    transaction = await tatumSdk.blockchain.xrp.xrpTransferBlockchain({
      fromAccount: fromAddress,
      to: toAddress,
      amount: Number(amount).toFixed(6).toString(),
      fromSecret: privateKey,
      issuerAccount: rlusdIssuer,
      token: rlusdCurrencyHex,
    } as any);
  } else if (currency === "POLYGON") {
    // Polygon native transfer (POL)
    transaction = await tatumSdk.blockchain.polygon.polygonBlockchainTransfer({
      fromPrivateKey: privateKey,
      to: toAddress,
      amount: Number(amount).toFixed(8).toString(),
      currency: "MATIC",
      fee: fee ? {
        gasPrice: Math.ceil(fee?.gasPrice).toString(),
        gasLimit: fee?.gasLimit.toString(),
      } : undefined,
    });
  } else if (currency === "USDT-POLYGON") {
    // USDT on Polygon (ERC-20 token) — use smart contract invocation
    const usdtPolygonContract = process.env.USDT_POLYGON_CONTRACT || "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";
    const truncatedAmount = (Math.floor(Number(amount) * 1e6) / 1e6).toString();
    // USDT on Polygon has 6 decimals
    const amountInSmallestUnit = String(Math.floor(Number(truncatedAmount) * 1e6));
    
    try {
      transaction = await tatumSdk.blockchain.polygon.polygonBlockchainSmartContractInvocation({
        fromPrivateKey: privateKey,
        contractAddress: usdtPolygonContract,
        methodName: "transfer",
        methodABI: {
          inputs: [
            { name: "recipient", type: "address" },
            { name: "amount", type: "uint256" },
          ],
          name: "transfer",
          outputs: [{ name: "", type: "bool" }],
          stateMutability: "nonpayable",
          type: "function",
        },
        params: [toAddress, amountInSmallestUnit],
        fee: fee ? {
          gasPrice: Math.ceil(fee?.gasPrice).toString(),
          gasLimit: (fee?.gasLimit || 65000).toString(),
        } : undefined,
      });
    } catch (polyTokenErr) {
      console.error(`[assetToOtherAddress] USDT-POLYGON smart contract transfer failed:`, polyTokenErr?.message);
      throw polyTokenErr;
    }
  }
  return transaction;
};

const assetBatchAddressesToOtherAddress = async ({
  currency,
  fromAddress,
  toAddress,
  fee,
  _contractAddress = null,
  permanentUserWalletAddress = null,
  fromUTXO = [],
  toUTXO = [],
}) => {
  let transactions = [];
  const tatumSdk = await getTatumSDK();

  const destinationAddress = toAddress[0].address;

  if (currency === "BTC") {
    console.log("#######BTC PAYLOAD ####", {
      fromAddress: fromAddress.map((address) => ({
        address: address.address,
        privateKey: address.privateKey,
      })),
      to: toAddress.map((address) => ({
        ...address,
        value: Number(Number(address.value).toFixed(8)),
      })),
      fee,
      changeAddress: permanentUserWalletAddress
        ? permanentUserWalletAddress
        : destinationAddress,
    });

    // Send assets to address and handle extra assets in user's paremanent address
    const result = await tatumSdk.blockchain.bitcoin.btcTransferBlockchain(
      {
        fromAddress: fromAddress.map((address) => ({
          address: address.address,
          privateKey: address.privateKey,
        })),
        to: toAddress.map((address) => ({
          ...address,
          value: Number(Number(address.value).toFixed(8)),
        })),
        fee,
        changeAddress: permanentUserWalletAddress
          ? permanentUserWalletAddress
          : destinationAddress,
      }
    );
    console.log("###result", result);
    const txId = isTransactionHash(result) ? result.txId : (result as SignatureId).signatureId;
    fromAddress.forEach((fromAdd) => {
      transactions.push({
        txId: txId,
        status: "success",
        reason: null,
        fromAddress: fromAdd,
      });
    });
    console.log("###transactions", transactions);
  } else if (currency === "ETH" || currency === "USDT-ERC20" || currency === "RLUSD-ERC20") {
    let transactionResponse: Array<{ txId: string; status: string; reason: string | null; fromAddress: unknown; toAddress?: string; errorMessage?: string; error?: string; cause?: string }> = [];
    // Send assets from all addresses to one address
    await Promise.allSettled(
      fromAddress.map(async (fromAddr) => {
        try {
          console.log("####ETH Paylaod:", {
            fromPrivateKey: fromAddr.privateKey,
            to: destinationAddress,
            amount: Number(fromAddr.value).toFixed(8).toString(),
            fee: {
              gasPrice: Math.ceil(fee?.gasPrice).toString(),
              gasLimit: fee?.gasLimit.toString(),
            },
            currency: currency,
          });
          let result;
          if (currency === "RLUSD-ERC20") {
            // RLUSD is a custom ERC-20 — use generic erc20Transfer with contract address
            result = await tatumSdk.fungibleToken.erc20Transfer({
              chain: "ETH",
              to: destinationAddress,
              contractAddress: process.env.RLUSD_ERC20_CONTRACT || "0x8292Bb45bf1Ee4d140127049757C2E0fF06317eD",
              amount: (Math.floor(Number(fromAddr.value) * 1e6) / 1e6).toString(),
              digits: 6,
              fromPrivateKey: fromAddr.privateKey,
              fee: {
                gasPrice: Math.ceil(fee?.gasPrice).toString(),
                gasLimit: fee?.gasLimit.toString(),
              },
            });
          } else {
            result = await tatumSdk.blockchain.eth.ethBlockchainTransfer({
              fromPrivateKey: fromAddr.privateKey,
              to: destinationAddress,
              amount: Number(fromAddr.value).toFixed(8).toString(),
              fee: {
                gasPrice: Math.ceil(fee?.gasPrice).toString(),
                gasLimit: fee?.gasLimit.toString(),
              },
              currency: currency === "ETH" ? "ETH" : "USDT",
            });
          }
          const ethTxId = isTransactionHash(result) ? result.txId : (result as SignatureId).signatureId;
          transactionResponse.push({
            txId: ethTxId,
            status: "success",
            reason: null,
            fromAddress: fromAddr,
          });
        } catch (error: unknown) {
          const err = error as { body?: { message?: string; cause?: string }; message?: string };
          console.log("###error: ", error);
          transactionResponse.push({
            txId: '',
            fromAddress: fromAddr.address,
            toAddress: destinationAddress,
            status: "failed",
            errorMessage: err.body?.message || '',
            error: err.message || '',
            cause: err.body?.cause || '',
            reason: err.message || null,
          });
        }
      })
    );
    transactions = transactionResponse;
  } else if (currency === "TRX") {
    let transactionResponse: Array<{ txId: string; status: string; reason: string | null; fromAddress: unknown; toAddress?: string; errorMessage?: string; error?: string; cause?: string }> = [];
    // Send assets from all addresses to one address
    await Promise.allSettled(
      fromAddress.map(async (fromAddr) => {
        try {
          console.log("###TRX PAYLOAD: ", {
            fromPrivateKey: fromAddr.privateKey,
            to: destinationAddress,
            amount: Number(fromAddr.value).toFixed(8).toString(),
          });
          const result = await tatumSdk.blockchain.tron.tronTransfer({
            fromPrivateKey: fromAddr.privateKey,
            to: destinationAddress,
            amount: Number(fromAddr.value).toFixed(8).toString(),
          });
          console.log("###result", result);
          const ethTxId = isTransactionHash(result) ? result.txId : (result as SignatureId).signatureId;
          transactionResponse.push({
            txId: ethTxId,
            status: "success",
            reason: null,
            fromAddress: fromAddr,
          });
        } catch (error: unknown) {
          const err = error as { body?: { message?: string; cause?: string }; message?: string };
          console.log("###error: ", error);
          transactionResponse.push({
            txId: '',
            fromAddress: fromAddr.address,
            toAddress: destinationAddress,
            status: "failed",
            errorMessage: err.body?.message || '',
            error: err.message || '',
            cause: err.body?.cause || '',
            reason: err.message || null,
          });
        }
      })
    );
    console.log("###transactionResponse", transactionResponse);
    transactions = transactionResponse;
  } else if (currency === "USDT-TRC20") {
    let transactionResponse: Array<{ txId: string; status: string; reason: string | null; fromAddress: unknown; toAddress?: string; errorMessage?: string; error?: string; cause?: string }> = [];

    // Calculate dynamic feeLimit once for the batch (destination is the same)
    let batchFeeLimit = 15; // Default fallback (was hardcoded 50)
    try {
      const feeLimitResult = await calculateOptimalFeeLimit(
        fromAddress[0]?.address || destinationAddress,
        destinationAddress,
        process.env.TRX_CONTRACT
      );
      batchFeeLimit = feeLimitResult.feeLimit;
      logCostSavings("batchTRC20Transfer", 50, batchFeeLimit, {
        addressCount: fromAddress.length,
        energyDeficit: feeLimitResult.energyDeficit,
      });
    } catch (feeLimitError) {
      console.warn(`[assetBatchAddressesToOtherAddress] ⚠️ Dynamic feeLimit failed, using fallback ${batchFeeLimit} TRX`);
    }

    // Send assets from all addresses to one address
    await Promise.allSettled(
      fromAddress.map(async (fromAddr) => {
        try {
          console.log("###USDT-TRC20 PAYLOAD: ", {
            amount: Number(fromAddr.value).toFixed(2).toString(),
            feeLimit: batchFeeLimit,
            fromPrivateKey: fromAddr.privateKey,
            to: destinationAddress,
            tokenAddress: process.env.TRX_CONTRACT,
          });
          const result = await tatumSdk.blockchain.tron.tronTransferTrc20({
            amount: Number(fromAddr.value).toFixed(2).toString(),
            feeLimit: batchFeeLimit,
            fromPrivateKey: fromAddr.privateKey,
            to: destinationAddress,
            tokenAddress: process.env.TRX_CONTRACT,
          });
          console.log("###result", result);
          const trc20TxId = isTransactionHash(result) ? result.txId : (result as SignatureId).signatureId;
          transactionResponse.push({
            txId: trc20TxId,
            status: "success",
            reason: null,
            fromAddress: fromAddr,
          });
        } catch (error: unknown) {
          const err = error as { body?: { message?: string; cause?: string }; message?: string };
          console.log("###error: ", error);
          transactionResponse.push({
            txId: '',
            fromAddress: fromAddr.address,
            toAddress: destinationAddress,
            status: "failed",
            errorMessage: err.body?.message || '',
            error: err.message || '',
            cause: err.body?.cause || '',
            reason: err.message || null,
          });
        }
      })
    );
    transactions = transactionResponse;
  } else if (currency === "BSC") {
    let transactionResponse: Array<{ txId: string; status: string; reason: string | null; fromAddress: unknown; toAddress?: string; errorMessage?: string; error?: string; cause?: string }> = [];
    // Send assets from all addresses to one address
    await Promise.allSettled(
      fromAddress.map(async (fromAddr) => {
        try {
          console.log("#######BSC PAYLOAD ####", {
            currency,
            amount: Number(fromAddr.value).toFixed(8).toString(),
            fromPrivateKey: fromAddr.privateKey,
            to: destinationAddress,
            fee: {
              gasPrice: Math.ceil(fee?.gasPrice).toString(),
              gasLimit: fee?.gasLimit.toString(),
            },
          });
          const result = await tatumSdk.blockchain.bsc.bscBlockchainTransfer({
              currency,
              amount: Number(fromAddr.value).toFixed(8).toString(),
              fromPrivateKey: fromAddr.privateKey,
              to: destinationAddress,
              fee: {
                gasPrice: Math.ceil(fee?.gasPrice).toString(),
                gasLimit: fee?.gasLimit.toString(),
              },
            });

          console.log("###result", result);
          const bscTxId = isTransactionHash(result) ? result.txId : (result as SignatureId).signatureId;
          transactionResponse.push({
            txId: bscTxId,
            status: "success",
            reason: null,
            fromAddress: fromAddr,
          });
        } catch (error: unknown) {
          const err = error as { body?: { message?: string; cause?: string }; message?: string };
          console.log("###error: ", error);
          transactionResponse.push({
            txId: '',
            fromAddress: fromAddr.address,
            toAddress: destinationAddress,
            status: "failed",
            errorMessage: err.body?.message || '',
            error: err.message || '',
            cause: err.body?.cause || '',
            reason: err.message || null,
          });
        }
      })
    );
    transactions = transactionResponse;
  } else if (currency === "DOGE") {
    console.log("###DODGE Payload ###", {
      fromAddress: fromAddress.map((address) => ({
        address: address.address,
        privateKey: address.privateKey,
      })),
      to: toAddress.map((address) => ({
        ...address,
        value: Number(Number(address.value).toFixed(8)),
      })),
      fee,
      changeAddress: permanentUserWalletAddress
        ? permanentUserWalletAddress
        : destinationAddress,
    });
    const result = await tatumSdk.blockchain.doge.dogeTransferBlockchain({
      fromAddress: fromAddress.map((address) => ({
        address: address.address,
        privateKey: address.privateKey,
      })),
      to: toAddress.map((address) => ({
        ...address,
        value: Number(Number(address.value).toFixed(8)),
      })),
      fee,
      changeAddress: permanentUserWalletAddress
        ? permanentUserWalletAddress
        : destinationAddress,
    });
    const dogeTxId = isTransactionHash(result) ? result.txId : (result as SignatureId).signatureId;
    fromAddress.forEach((fromAdd) => {
      transactions.push({
        txId: dogeTxId,
        status: "success",
        reason: null,
        fromAddress: fromAdd,
      });
    });
  } else if (currency === "LTC") {
    console.log("#####LTC Payload", {
      fromAddress: fromAddress.map((address) => ({
        address: address.address,
        privateKey: address.privateKey,
      })),
      to: toAddress.map((address) => ({
        ...address,
        value: Number(Number(address.value).toFixed(8)),
      })),
      fee,
      changeAddress: permanentUserWalletAddress
        ? permanentUserWalletAddress
        : destinationAddress,
    });
    const result = await tatumSdk.blockchain.ltc.ltcTransferBlockchain({
      fromAddress: fromAddress.map((address) => ({
        address: address.address,
        privateKey: address.privateKey,
      })),
      to: toAddress.map((address) => ({
        ...address,
        value: Number(Number(address.value).toFixed(8)),
      })),
      fee,
      changeAddress: permanentUserWalletAddress
        ? permanentUserWalletAddress
        : destinationAddress,
    });
    const ltcTxId = isTransactionHash(result) ? result.txId : (result as SignatureId).signatureId;
    fromAddress.forEach((fromAdd) => {
      transactions.push({
        txId: ltcTxId,
        status: "success",
        reason: null,
        fromAddress: fromAdd,
      });
    });
  } else if (currency === "BCH") {
    console.log("###BCH Payload###", {
      fromUTXO,
      to: toUTXO,
      fee: fee,
      changeAddress: permanentUserWalletAddress
        ? permanentUserWalletAddress
        : destinationAddress?.includes("bitcoincash")
        ? destinationAddress
        : "bitcoincash:" + destinationAddress,
    });
    const result = await tatumSdk.blockchain.bcash.bchTransferBlockchain({
      fromUTXO,
      to: toUTXO,
      fee: fee,
      changeAddress: permanentUserWalletAddress
        ? permanentUserWalletAddress
        : destinationAddress?.includes("bitcoincash")
        ? destinationAddress
        : "bitcoincash:" + destinationAddress,
    });
    const bchTxId = isTransactionHash(result) ? result.txId : (result as SignatureId).signatureId;
    fromAddress.forEach((fromAdd) => {
      transactions.push({
        txId: bchTxId,
        status: "success",
        reason: null,
        fromAddress: fromAdd,
      });
    });
  }
  return transactions;
};

const validateTronAddress = (address) => {
  const status = tronweb.utils.address.isAddress(address);
  if (status) {
    return status;
  } else {
    throw { message: "please enter a valid TRX address!" };
  }
};

const getAddressBalance = async (address: string, currency: string) => {
  const tatumSdk = await getTatumSDK();
  let res;
  if (currency === "BTC") {
    res = await tatumSdk.blockchain.bitcoin.btcGetBalanceOfAddress(address);
  } else if (currency === "ETH") {
    res = await tatumSdk.blockchain.eth.ethGetBalance(address);
  } else if (currency === "USDT-ERC20") {
    const tempRes = await tatumSdk.fungibleToken.erc20GetBalance(
      "ETH",
      address,
      process.env.ETH_CONTRACT
    );
    res = { balance: Number(tempRes.balance) / 1000000 };
  } else if (currency === "USDC-ERC20") {
    const tempRes = await tatumSdk.fungibleToken.erc20GetBalance(
      "ETH",
      address,
      process.env.USDC_CONTRACT
    );
    res = { balance: Number(tempRes.balance) / 1000000 };
  } else if (currency === "RLUSD-ERC20") {
    const tempRes = await tatumSdk.fungibleToken.erc20GetBalance(
      "ETH",
      address,
      process.env.RLUSD_ERC20_CONTRACT
    );
    res = { balance: Number(tempRes.balance) / 1000000 };
  } else if (currency === "TRX") {
    try {
      res = await tatumSdk.blockchain.tron.tronGetAccount(address);
    } catch (e: unknown) {
      const err = e as { message?: string };
      if ((err.message || '').includes('account.not.found') || (err.message || '').includes('not.found')) {
        res = { balance: '0' };
      } else { throw e; }
    }
  } else if (currency === "USDT-TRC20") {
    try {
      const tempRes = await tatumSdk.blockchain.tron.tronGetAccount(address);
      if (tempRes && tempRes?.trc20) {
        if (tempRes.trc20.length > 0) {
          console.log(`[getAddressBalance] TRC20 tokens found: ${tempRes.trc20.length} entries`);
        }
        res = {
          balance: Number(tempRes.trc20[0]?.[process.env.TRX_CONTRACT]) / 1000000,
        };
      } else {
        res = { balance: '0' };
      }
    } catch (e: unknown) {
      const err = e as { message?: string };
      if ((err.message || '').includes('account.not.found') || (err.message || '').includes('not.found')) {
        res = { balance: '0' };
      } else { throw e; }
    }
  } else if (currency === "LTC") {
    res = await tatumSdk.blockchain.ltc.ltcGetBalanceOfAddress(address);
  } else if (currency === "DOGE") {
    res = await tatumSdk.blockchain.doge.dogeGetBalanceOfAddress(address);
  } else if (currency === "BSC") {
    res = await tatumSdk.blockchain.bsc.bscGetBalance(address);
  } else if (currency === "BCH") {
    res = await tatumSdk.blockchain.bcash.bchGetTxByAddress(address);
  } else if (currency === "SOL") {
    const solRes = await tatumSdk.blockchain.solana.solanaGetBalance(address);
    res = { balance: solRes?.balance || '0' };
  } else if (currency === "XRP") {
    try {
      const xrpRes = await tatumSdk.blockchain.xrp.xrpGetAccountBalance(address);
      // XRP balance is in drops, convert to XRP
      const xrpBalance = xrpRes?.balance ? (Number(xrpRes.balance) / 1000000).toString() : '0';
      res = { balance: xrpBalance };
    } catch (e: unknown) {
      const err = e as { message?: string; body?: any };
      if ((err.message || '').includes('not.found') || (err.body?.error_message || '').includes('not found')) {
        res = { balance: '0' };
      } else { throw e; }
    }
  } else if (currency === "RLUSD") {
    try {
      const xrpRes = await tatumSdk.blockchain.xrp.xrpGetAccountBalance(address);
      // Find RLUSD trust line balance from obligations
      const rlusdIssuer = (process.env.RLUSD_ISSUER || "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De").toLowerCase();
      let rlusdBalance = '0';
      const xrpResAny = xrpRes as any;
      if (xrpResAny?.obligations) {
        for (const obligation of xrpResAny.obligations) {
          if ((obligation.currency || '').toUpperCase() === 'RLUSD' || 
              (obligation.currency || '').toUpperCase().startsWith('524C5553')) {
            rlusdBalance = obligation.value || '0';
            break;
          }
        }
      }
      // Also check assets (some versions return balance in assets)
      if (rlusdBalance === '0' && xrpResAny?.assets) {
        for (const asset of xrpResAny.assets) {
          if ((asset.currency || '').toUpperCase() === 'RLUSD' || 
              (asset.currency || '').toUpperCase().startsWith('524C5553')) {
            rlusdBalance = (asset as any).value || '0';
            break;
          }
        }
      }
      res = { balance: rlusdBalance };
    } catch (e: unknown) {
      const err = e as { message?: string; body?: any };
      if ((err.message || '').includes('not.found') || (err.body?.error_message || '').includes('not found')) {
        res = { balance: '0' };
      } else { throw e; }
    }
  } else if (currency === "POLYGON") {
    res = await tatumSdk.blockchain.polygon.polygonGetBalance(address);
  } else if (currency === "USDT-POLYGON") {
    const tempRes = await tatumSdk.fungibleToken.erc20GetBalance(
      "MATIC",
      address,
      process.env.USDT_POLYGON_CONTRACT || "0xc2132D05D31c914a87C6611C10748AEb04B58e8F"
    );
    res = { balance: Number(tempRes.balance) / 1000000 };
  }
  return res;
};

const getCurrentPaymentStatus = async (address: string, currency) => {
  const tatumSdk = await getTatumSDK();
  let res = {
    paymentStatus: "not_found",
    status: 500,
    transaction_id: null,
    message: "We did not received the payment!",
  };

  if (currency === "BTC") {
    const tempData = await tatumSdk.blockchain.bitcoin.btcGetTxByAddress(
      address,
      10,
      0,
      null,
      null,
      "incoming"
    );

    for (let i = 0; i < tempData.length; i++) {
      const currentBlock = tempData[i];
      const blockTime =
        currentBlock.time.toString().length > 10
          ? currentBlock.time
          : currentBlock.time * 1000;
      const todayDate = new Date().toISOString().slice(0, 10);
      const blockDate = new Date(blockTime).toISOString().slice(0, 10);
      console.log(todayDate, blockDate, todayDate === blockDate);
      const checkOutput = currentBlock.inputs[0].coin.address === address;
      if (
        todayDate === blockDate &&
        !checkOutput &&
        !currentBlock.blockNumber
      ) {
        res = {
          paymentStatus: "detected",
          status: 200,
          transaction_id: currentBlock.hash,
          message: "payment detected, please wait for confirmation!",
        };

        console.log("currentTransactionBlock===========>", res);
      }
    }
  }
  if (currency === "LTC") {
    const tempData = await tatumSdk.blockchain.ltc.ltcGetTxByAddress(
      address,
      10,
      0,
      null,
      null,
      "incoming"
    );

    for (let i = 0; i < tempData.length; i++) {
      const currentBlock = tempData[i];
      const blockTime =
        currentBlock.time.toString().length > 10
          ? currentBlock.time
          : currentBlock.time * 1000;
      const todayDate = new Date().toISOString().slice(0, 10);
      const blockDate = new Date(blockTime).toISOString().slice(0, 10);
      console.log(todayDate, blockDate, todayDate === blockDate);
      const checkOutput = currentBlock.inputs[0].coin.address === address;
      if (
        todayDate === blockDate &&
        !checkOutput &&
        !currentBlock.blockNumber
      ) {
        res = {
          paymentStatus: "detected",
          status: 200,
          transaction_id: currentBlock.hash,
          message: "payment detected, please wait for confirmation!",
        };
        console.log("currentTransactionBlock===========>", res);
      }
    }
  }
  if (currency === "DOGE") {
    const tempData = await tatumSdk.blockchain.doge.dogeGetTxByAddress(
      address,
      10,
      0,
      null,
      null,
      "incoming"
    );

    for (let i = 0; i < tempData.length; i++) {
      const currentBlock = tempData[i];
      const blockTime =
        currentBlock.time.toString().length > 10
          ? currentBlock.time
          : currentBlock.time * 1000;
      const todayDate = new Date().toISOString().slice(0, 10);
      const blockDate = new Date(blockTime).toISOString().slice(0, 10);
      console.log(todayDate, blockDate, todayDate === blockDate);
      const checkOutput = currentBlock.inputs[0].coin.address === address;
      if (
        todayDate === blockDate &&
        !checkOutput &&
        !currentBlock.blockNumber
      ) {
        res = {
          paymentStatus: "detected",
          status: 200,
          transaction_id: currentBlock.hash,
          message: "payment detected, please wait for confirmation!",
        };
        console.log("currentTransactionBlock===========>", res);
      }
    }
  }
  if (currency === "TRON") {
    const { transactions } = await tatumSdk.blockchain.tron.tronAccountTx(
      address,
      null,
      null,
      true
    );

    if (transactions.length > 0) {
      const currentBlock = transactions[0];
      const blockTime =
        currentBlock.rawData.timestamp.toString().length > 10
          ? currentBlock.rawData.timestamp
          : currentBlock.rawData.timestamp * 1000;
      const todayDate = new Date().toISOString().slice(0, 10);
      const blockDate = new Date(blockTime).toISOString().slice(0, 10);
      console.log(todayDate, blockDate, todayDate === blockDate);
      if (todayDate === blockDate) {
        res = {
          paymentStatus: "detected",
          status: 200,
          transaction_id: currentBlock.txID,
          message: "payment detected, please wait for confirmation!",
        };

        console.log("currentTransactionBlock===========>", res);
      }
    }
  }

  if (currency === "USDT-TRC20") {
    const { transactions } = await tatumSdk.blockchain.tron.tronAccountTx20(
      address,
      null,
      null,
      true
    );

    if (transactions.length > 0) {
      const currentBlock = transactions[0];

      res = {
        paymentStatus: "detected",
        status: 200,
        transaction_id: currentBlock.txID,

        message: "payment detected, please wait for confirmation!",
      };

      console.log("currentTransactionBlock===========>", res);
    }
  }
  if (currency === "USDT-ERC20") {
    const contractAddress = process.env.ETH_CONTRACT;
    const transactions =
      await tatumSdk.fungibleToken.erc20GetTransactionByAddress(
        "ETH",
        address,
        contractAddress,
        10,
        null,
        null,
        null,
        "DESC"
      );

    for (let i = 0; i < transactions.length; i++) {
      const currentBlock = transactions[i];

      if (!currentBlock.blockNumber) {
        res = {
          paymentStatus: "detected",
          status: 200,
          transaction_id: currentBlock.txId,

          message: "payment detected, please wait for confirmation!",
        };

        console.log("currentTransactionBlock===========>", res);
      }
    }
  }

  return res;
};

/**
 * Get incoming transactions for an address to detect missed payments
 * Returns the most recent incoming transaction with txId and amount
 */
const getIncomingTransactions = async (
  address: string, 
  currency: string,
  limit: number = 10
): Promise<{ txId: string; amount: number; timestamp: number }[]> => {
  const tatumSdk = await getTatumSDK();
  const transactions: { txId: string; amount: number; timestamp: number }[] = [];

  // Define interfaces for transaction data
  interface BTCTransaction {
    hash?: string;
    outputs?: Array<{ address?: string; value?: string | number }>;
    time?: number;
  }

  interface ETHTransaction {
    hash?: string;
    to?: string;
    value?: string | number;
    blockNumber?: number;
    timestamp?: number;
  }

  interface TRXTransaction {
    hash?: string;
    txID?: string;
    to?: string;
    raw_data?: { contract?: Array<{ parameter?: { value?: { to_address?: string; amount?: number } } }> };
    block_timestamp?: number;
    ret?: Array<{ contractRet?: string }>;
  }

  try {
    if (currency === "BTC") {
      const txData = await tatumSdk.blockchain.bitcoin.btcGetTxByAddress(
        address, limit, 0
      ) as BTCTransaction[] | undefined;
      for (const tx of txData || []) {
        // Find the output for our address
        let receivedAmount = 0;
        for (const output of tx.outputs || []) {
          if (output.address === address) {
            receivedAmount += parseFloat(String(output.value || '0'));
          }
        }
        if (receivedAmount > 0) {
          transactions.push({
            txId: tx.hash || '',
            amount: receivedAmount,
            timestamp: tx.time ? (String(tx.time).length > 10 ? tx.time : tx.time * 1000) : Date.now()
          });
        }
      }
    } else if (currency === "ETH") {
      // Note: ethGetAccountTransactions may not exist in newer SDK - use alternative
      interface EthBlockchain {
        ethGetAccountTransactions?: (address: string, offset?: number, limit?: number) => Promise<ETHTransaction[]>;
        ethGetTransaction: (hash: string) => Promise<unknown>;
      }
      const ethApi = tatumSdk.blockchain.eth as unknown as EthBlockchain;
      const txData = await ethApi.ethGetAccountTransactions?.(
        address, 0, limit
      ) || [];
      for (const tx of txData as ETHTransaction[] || []) {
        // Only incoming transactions (where we are the recipient)
        if (tx.to?.toLowerCase() === address.toLowerCase() && parseFloat(String(tx.value || '0')) > 0) {
          transactions.push({
            txId: tx.hash || '',
            amount: parseFloat(String(tx.value || '0')) / 1e18, // Convert wei to ETH
            timestamp: tx.timestamp || Date.now()
          });
        }
      }
    } else if (currency === "TRX") {
      interface TronTxResult {
        transactions?: TRXTransaction[];
      }
      const result = await tatumSdk.blockchain.tron.tronAccountTx(
        address, undefined, undefined, true
      ) as TronTxResult;
      for (const tx of result?.transactions || []) {
        // Check if this is a TRX transfer to our address
        const contract = tx.raw_data?.contract?.[0];
        if (contract) {
          const params = contract.parameter?.value;
          if (params?.to_address === address) {
            const amount = (params.amount || 0) / 1e6; // Convert sun to TRX
            if (amount > 0) {
              transactions.push({
                txId: tx.txID || '',
                amount,
                timestamp: tx.block_timestamp || Date.now()
              });
            }
          }
        }
      }
    } else if (currency === "USDT-TRC20") {
      interface TRC20Transaction {
        to?: string;
        value?: string | number;
        txID?: string;
        transaction_id?: string;
        block_timestamp?: number;
      }
      interface TRC20TxResult {
        transactions?: TRC20Transaction[];
      }
      const result = await tatumSdk.blockchain.tron.tronAccountTx20(
        address, undefined, undefined, true
      ) as TRC20TxResult;
      for (const tx of result?.transactions || []) {
        // TRC20 transfers
        if (tx.to === address && parseFloat(String(tx.value || '0')) > 0) {
          transactions.push({
            txId: tx.txID || tx.transaction_id || '',
            amount: parseFloat(String(tx.value || '0')) / 1e6, // USDT has 6 decimals
            timestamp: tx.block_timestamp || Date.now()
          });
        }
      }
    } else if (currency === "USDT-ERC20") {
      const contractAddress = process.env.ETH_CONTRACT;
      const txData = await tatumSdk.fungibleToken.erc20GetTransactionByAddress(
        "ETH", address, contractAddress, limit
      );
      for (const tx of (txData as ERC20Transaction[]) || []) {
        if (tx.to?.toLowerCase() === address.toLowerCase() && parseFloat(tx.value || '0') > 0) {
          transactions.push({
            txId: tx.transactionHash || tx.txId || tx.hash || '',
            amount: parseFloat(tx.value || '0') / 1e6, // USDT has 6 decimals
            timestamp: tx.timestamp || tx.blockTimestamp || Date.now()
          });
        }
      }
    } else if (currency === "USDC-ERC20") {
      const contractAddress = process.env.USDC_CONTRACT;
      const txData = await tatumSdk.fungibleToken.erc20GetTransactionByAddress(
        "ETH", address, contractAddress, limit
      );
      for (const tx of (txData as ERC20Transaction[]) || []) {
        if (tx.to?.toLowerCase() === address.toLowerCase() && parseFloat(tx.value || '0') > 0) {
          transactions.push({
            txId: tx.transactionHash || tx.txId || tx.hash || '',
            amount: parseFloat(tx.value || '0') / 1e6, // USDC has 6 decimals
            timestamp: tx.timestamp || tx.blockTimestamp || Date.now()
          });
        }
      }
    } else if (currency === "RLUSD-ERC20") {
      const contractAddress = process.env.RLUSD_ERC20_CONTRACT;
      const txData = await tatumSdk.fungibleToken.erc20GetTransactionByAddress(
        "ETH", address, contractAddress, limit
      );
      for (const tx of (txData as ERC20Transaction[]) || []) {
        if (tx.to?.toLowerCase() === address.toLowerCase() && parseFloat(tx.value || '0') > 0) {
          transactions.push({
            txId: tx.transactionHash || tx.txId || tx.hash || '',
            amount: parseFloat(tx.value || '0') / 1e6, // RLUSD has 6 decimals
            timestamp: tx.timestamp || tx.blockTimestamp || Date.now()
          });
        }
      }
    } else if (currency === "LTC") {
      const txData = await tatumSdk.blockchain.ltc.ltcGetTxByAddress(
        address, limit, 0
      );
      for (const tx of (txData as UTXOTransaction[]) || []) {
        let receivedAmount = 0;
        for (const output of tx.outputs || []) {
          if (output.address === address) {
            receivedAmount += parseFloat(output.value || '0');
          }
        }
        if (receivedAmount > 0) {
          transactions.push({
            txId: tx.hash || '',
            amount: receivedAmount,
            timestamp: tx.time && tx.time.toString().length > 10 ? tx.time : (tx.time || 0) * 1000
          });
        }
      }
    } else if (currency === "DOGE") {
      const txData = await tatumSdk.blockchain.doge.dogeGetTxByAddress(
        address, limit, 0
      );
      for (const tx of (txData as UTXOTransaction[]) || []) {
        let receivedAmount = 0;
        for (const output of tx.outputs || []) {
          if (output.address === address) {
            receivedAmount += parseFloat(output.value || '0');
          }
        }
        if (receivedAmount > 0) {
          transactions.push({
            txId: tx.hash || '',
            amount: receivedAmount,
            timestamp: tx.time && tx.time.toString().length > 10 ? tx.time : (tx.time || 0) * 1000
          });
        }
      }
    } else if (currency === "BCH") {
      const txData = await tatumSdk.blockchain.bcash.bchGetTxByAddress(
        address, limit
      );
      for (const tx of (txData as UTXOTransaction[]) || []) {
        let receivedAmount = 0;
        for (const output of tx.outputs || []) {
          if (output.address === address) {
            receivedAmount += parseFloat(output.value || '0');
          }
        }
        if (receivedAmount > 0) {
          transactions.push({
            txId: tx.hash || '',
            amount: receivedAmount,
            timestamp: tx.time && tx.time.toString().length > 10 ? tx.time : (tx.time || 0) * 1000
          });
        }
      }
    } else if (currency === "SOL") {
      // Solana incoming transactions
      const solTx = await tatumSdk.blockchain.solana.solanaGetTransaction(address);
      if (solTx) {
        transactions.push({
          txId: typeof solTx === 'string' ? solTx : (solTx as any)?.txId || address,
          amount: 0,
          timestamp: Date.now()
        });
      }
    } else if (currency === "XRP") {
      // XRP account transactions
      try {
        const xrpTxData = await tatumSdk.blockchain.xrp.xrpGetAccountTx(address, undefined, undefined);
        const xrpTxs = (xrpTxData as any)?.transactions || [];
        for (const tx of xrpTxs) {
          const meta = tx.meta || tx.metaData;
          const delivered = meta?.delivered_amount;
          if (delivered && typeof delivered === 'string') {
            const amount = Number(delivered) / 1e6;
            if (amount > 0) {
              transactions.push({
                txId: tx.tx?.hash || '',
                amount,
                timestamp: tx.tx?.date ? (tx.tx.date + 946684800) * 1000 : Date.now()
              });
            }
          }
        }
      } catch (_xrpErr) {
        console.warn(`[getIncomingTransactions] XRP tx fetch failed for ${address}`);
      }
    } else if (currency === "RLUSD") {
      // RLUSD on XRP - same as XRP but filter for RLUSD token
      try {
        const xrpTxData = await tatumSdk.blockchain.xrp.xrpGetAccountTx(address, undefined, undefined);
        const xrpTxs = (xrpTxData as any)?.transactions || [];
        for (const tx of xrpTxs) {
          const meta = tx.meta || tx.metaData;
          const delivered = meta?.delivered_amount;
          if (delivered && typeof delivered === 'object' && (delivered.currency === 'RLUSD' || (delivered.currency || '').startsWith('524C5553'))) {
            const amount = Number(delivered.value || 0);
            if (amount > 0) {
              transactions.push({
                txId: tx.tx?.hash || '',
                amount,
                timestamp: tx.tx?.date ? (tx.tx.date + 946684800) * 1000 : Date.now()
              });
            }
          }
        }
      } catch (_rlusdErr) {
        console.warn(`[getIncomingTransactions] RLUSD tx fetch failed for ${address}`);
      }
    } else if (currency === "POLYGON") {
      // Polygon native transactions
      const txData = await tatumSdk.blockchain.polygon.polygonGetTransactionByAddress(
        address, limit, 0
      );
      for (const tx of (txData as ERC20Transaction[]) || []) {
        if (tx.to?.toLowerCase() === address.toLowerCase() && parseFloat(String(tx.value || '0')) > 0) {
          transactions.push({
            txId: tx.transactionHash || tx.txId || tx.hash || '',
            amount: parseFloat(String(tx.value || '0')) / 1e18,
            timestamp: tx.timestamp || tx.blockTimestamp || Date.now()
          });
        }
      }
    } else if (currency === "USDT-POLYGON") {
      const contractAddress = process.env.USDT_POLYGON_CONTRACT || "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";
      const txData = await tatumSdk.fungibleToken.erc20GetTransactionByAddress(
        "MATIC", address, contractAddress, limit
      );
      for (const tx of (txData as ERC20Transaction[]) || []) {
        if (tx.to?.toLowerCase() === address.toLowerCase() && parseFloat(tx.value || '0') > 0) {
          transactions.push({
            txId: tx.transactionHash || tx.txId || tx.hash || '',
            amount: parseFloat(tx.value || '0') / 1e6,
            timestamp: tx.timestamp || tx.blockTimestamp || Date.now()
          });
        }
      }
    }
  } catch (error) {
    console.error(`[getIncomingTransactions] Error fetching transactions for ${currency}:`, error.message);
  }

  // Sort by timestamp descending (most recent first)
  return transactions.sort((a, b) => b.timestamp - a.timestamp);
};

/**
 * Wait for a transaction to be confirmed on the blockchain
 * Returns true if confirmed within timeout, false if still pending
 */
const waitForTransactionConfirmation = async (
  txHash: string,
  currency: string,
  maxWaitMs: number = 60000, // Default 60 seconds
  pollIntervalMs: number = 5000 // Check every 5 seconds
): Promise<{ confirmed: boolean; blockNumber?: number }> => {
  const startTime = Date.now();
  const tatumSdk = await getTatumSDK();
  
  while (Date.now() - startTime < maxWaitMs) {
    try {
      let txData: Record<string, unknown> | null = null;
      
      if (currency === "ETH" || currency === "USDT-ERC20" || currency === "USDC-ERC20" || currency === "RLUSD-ERC20") {
        txData = await tatumSdk.blockchain.eth.ethGetTransaction(txHash);
      } else if (currency === "BSC") {
        txData = await tatumSdk.blockchain.bsc.bscGetTransaction(txHash);
      } else if (currency === "TRX" || currency === "USDT-TRC20") {
        txData = await tatumSdk.blockchain.tron.tronGetTransaction(txHash);
      } else if (currency === "POLYGON" || currency === "USDT-POLYGON") {
        txData = await tatumSdk.blockchain.polygon.polygonGetTransaction(txHash);
      } else if (currency === "SOL") {
        // Solana: transactions are confirmed nearly instantly
        return { confirmed: true, blockNumber: 0 };
      } else if (currency === "XRP" || currency === "RLUSD") {
        // XRP: transactions are confirmed in ~4 seconds
        const xrpTx = await tatumSdk.blockchain.xrp.xrpGetTransaction(txHash);
        if (xrpTx && (xrpTx as any).validated) {
          return { confirmed: true, blockNumber: (xrpTx as any).ledger_index || 0 };
        }
        txData = xrpTx as Record<string, unknown>;
      }
      
      if (txData && txData.blockNumber) {
        console.log(`[waitForTransactionConfirmation] TX ${txHash} confirmed in block ${txData.blockNumber}`);
        return { confirmed: true, blockNumber: txData.blockNumber as number };
      }
      
      console.log(`[waitForTransactionConfirmation] TX ${txHash} still pending, waiting...`);
    } catch (error) {
      console.log(`[waitForTransactionConfirmation] Error checking TX: ${error.message}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }
  
  console.log(`[waitForTransactionConfirmation] TX ${txHash} not confirmed within ${maxWaitMs}ms`);
  return { confirmed: false };
};

/**
 * Check if a transaction has enough confirmations to be safely processed
 * Different blockchains require different confirmation counts:
 * - BTC: 1 confirmation (10 min avg block time)
 * - LTC: 3 confirmations (2.5 min avg block time)
 * - DOGE: 6 confirmations (1 min avg block time)
 * - BCH: 1 confirmation (10 min avg block time)
 * - ETH: 12 confirmations (12 sec avg block time)
 * - TRX: 19 confirmations (3 sec avg block time)
 * 
 * Returns: { confirmed: boolean, confirmations: number, required: number }
 */
const getTransactionConfirmations = async (
  txHash: string,
  currency: string
): Promise<{ confirmed: boolean; confirmations: number; required: number }> => {
  const tatumSdk = await getTatumSDK();
  
  // Required confirmations per blockchain
  const REQUIRED_CONFIRMATIONS: { [key: string]: number } = {
    'BTC': 1,
    'LTC': 3,
    'DOGE': 6,
    'BCH': 1,
    'ETH': 12,
    'USDT-ERC20': 12,
    'USDC-ERC20': 12,
    'TRX': 19,
    'USDT-TRC20': 19,
  };
  
  const required = REQUIRED_CONFIRMATIONS[currency] || 1;
  
  try {
    let confirmations = 0;
    
    if (currency === 'BTC') {
      const txData = await tatumSdk.blockchain.bitcoin.btcGetRawTransaction(txHash) as BlockchainTxWithConfirmations & { blockNumber?: number };
      if (txData && txData.confirmations !== undefined) {
        confirmations = txData.confirmations;
      } else if (txData && txData.blockNumber) {
        // If confirmations not directly available, calculate from block height
        const blockInfo = await tatumSdk.blockchain.bitcoin.btcGetBlockChainInfo();
        confirmations = blockInfo.blocks - txData.blockNumber + 1;
      }
    } else if (currency === 'LTC') {
      const txData = await tatumSdk.blockchain.ltc.ltcGetRawTransaction(txHash) as BlockchainTxWithConfirmations;
      if (txData && txData.confirmations !== undefined) {
        confirmations = txData.confirmations;
      }
    } else if (currency === 'DOGE') {
      const txData = await tatumSdk.blockchain.doge.dogeGetRawTransaction(txHash) as BlockchainTxWithConfirmations;
      if (txData && txData.confirmations !== undefined) {
        confirmations = txData.confirmations;
      }
    } else if (currency === 'BCH') {
      const txData = await tatumSdk.blockchain.bcash.bchGetRawTransaction(txHash) as BlockchainTxWithConfirmations;
      if (txData && txData.confirmations !== undefined) {
        confirmations = txData.confirmations;
      }
    } else if (currency === 'ETH' || currency === 'USDT-ERC20' || currency === 'USDC-ERC20') {
      const txData = await tatumSdk.blockchain.eth.ethGetTransaction(txHash);
      if (txData && txData.blockNumber) {
        const currentBlock = await (tatumSdk.blockchain.eth as { ethGetBlockNumber?: () => Promise<number> }).ethGetBlockNumber?.() || 0;
        if (currentBlock) {
          confirmations = Number(currentBlock) - txData.blockNumber + 1;
        }
      }
    } else if (currency === 'TRX' || currency === 'USDT-TRC20') {
      const txData = await tatumSdk.blockchain.tron.tronGetTransaction(txHash);
      if (txData && txData.blockNumber) {
        const blockInfo = await tatumSdk.blockchain.tron.tronGetCurrentBlock() as TronBlockInfo;
        const currentBlockNumber = blockInfo?.block_header?.raw_data?.number || blockInfo?.blockNumber || 0;
        confirmations = currentBlockNumber - txData.blockNumber + 1;
      }
    }
    
    console.log(`[getTransactionConfirmations] ${currency} TX ${txHash}: ${confirmations}/${required} confirmations`);
    
    return {
      confirmed: confirmations >= required,
      confirmations,
      required
    };
  } catch (error) {
    console.error(`[getTransactionConfirmations] Error checking ${currency} TX ${txHash}:`, error.message);
    // If we can't check, assume not confirmed to be safe
    return { confirmed: false, confirmations: 0, required };
  }
};

/**
 * Fetch actual on-chain gas cost for a confirmed transaction.
 * Returns gas cost in the native token (ETH for ERC20, TRX for TRC20, etc.)
 */
const getTransactionGasCost = async (
  txHash: string,
  currency: string
): Promise<{ gasCostNative: number; gasToken: string }> => {
  const tatumSdk = await getTatumSDK();

  try {
    if (currency === "ETH" || currency === "USDT-ERC20" || currency === "USDC-ERC20" || currency === "RLUSD-ERC20") {
      const txData = await tatumSdk.blockchain.eth.ethGetTransaction(txHash) as Record<string, unknown>;
      const gasUsed = Number(txData?.gasUsed || 0);
      const gasPriceWei = Number(txData?.gasPrice || 0);
      const gasCostEth = (gasUsed * gasPriceWei) / 1e18;
      console.log(`[getTransactionGasCost] ETH TX ${txHash}: gasUsed=${gasUsed}, gasPrice=${gasPriceWei} wei, cost=${gasCostEth} ETH`);
      return { gasCostNative: gasCostEth, gasToken: "ETH" };
    }

    if (currency === "TRX" || currency === "USDT-TRC20") {
      const txData = await tatumSdk.blockchain.tron.tronGetTransaction(txHash) as Record<string, unknown>;
      const ret = (txData?.ret as Array<Record<string, unknown>>) || [];
      const feeSun = Number(ret[0]?.fee || 0);
      const gasCostTrx = feeSun / 1_000_000;
      console.log(`[getTransactionGasCost] TRX TX ${txHash}: fee=${feeSun} SUN, cost=${gasCostTrx} TRX`);
      return { gasCostNative: gasCostTrx, gasToken: "TRX" };
    }

    console.log(`[getTransactionGasCost] Unsupported currency ${currency} for gas cost lookup`);
    return { gasCostNative: 0, gasToken: currency };
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.warn(`[getTransactionGasCost] Failed to fetch gas cost for ${txHash}: ${err.message}`);
    return { gasCostNative: 0, gasToken: currency };
  }
};

/**
 * Set up XRP Trust Line for RLUSD token on a new XRP address
 * Required before the address can receive RLUSD tokens
 */
const setupXrpTrustLine = async (
  fromAccount: string,
  fromSecret: string,
  issuerAccount: string,
  token: string,
  limit: string = "999999999"
) => {
  const tatumSdk = await getTatumSDK();
  try {
    const result = await tatumSdk.blockchain.xrp.xrpTrustLineBlockchain({
      fromAccount,
      fromSecret,
      issuerAccount,
      token,
      limit,
    });
    console.log(`[setupXrpTrustLine] Trust line set for ${fromAccount} → ${issuerAccount} (${token})`);
    return result;
  } catch (error) {
    console.error(`[setupXrpTrustLine] Failed:`, error?.message || error);
    throw error;
  }
};

export default {
  generateWallet,
  createVirtualAccount,
  getAllAccounts,
  generateUserAddress,
  createSubscription,
  createSubscriptionWithUrl,
  createSubscriptionBlockBeeStyle,
  getBitcoinAddress,
  deleteUserAddress,
  sendFeeToAdmin,
  deleteSubscription,
  listAllSubscriptions,
  feeEstimation,
  batchFeeEstimation,
  generatePrivatekey,
  assetToOtherAddress,
  assetBatchAddressesToOtherAddress,
  testingFunction,
  getAddressBalance,
  validateTronAddress,
  getCurrentPaymentStatus,
  getIncomingTransactions,
  getTransactionConfirmations,
  encryptSymmetric,
  decryptSymmetric,
  waitForTransactionConfirmation,
  getTransactionGasCost,
  setupXrpTrustLine,
};
