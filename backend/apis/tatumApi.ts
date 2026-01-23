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
import crc32c from "fast-crc32c";

const encryptSymmetric = async (dataToEncrypt, keyId) => {
  const plaintextBuffer = Buffer.from(dataToEncrypt);
  const projectId = process.env.PROJECT_ID;
  const locationId = process.env.LOCATION_ID;
  const keyRingId = process.env.KEY_RING_ID;

  const client = new KeyManagementServiceClient({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_CLIENT_KEY,
    },
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
  const client = new KeyManagementServiceClient({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_CLIENT_KEY,
    },
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
    crc32c.calculate(decryptResponse.plaintext as string) !==
    Number(decryptResponse.plaintextCrc32c.value)
  ) {
    throw new Error("Decrypt: response corrupted in-transit");
  }

  const plaintext = decryptResponse.plaintext.toString();

  return plaintext;
}

const getTatumSDK = async () => {
  try {
    let tatumKey = process.env.TATUM_KEY;
    if (!tatumKey) {
      const client = new SecretManagerServiceClient({
        credentials: {
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
          private_key: process.env.GOOGLE_CLIENT_KEY,
        },
      });
      const [version] = await client.accessSecretVersion({
        name: "projects/163670787265/secrets/DynoPay_Tatum/versions/latest",
      });
      const payload = version.payload.data.toString();
      // tatumKey = payload;
      tatumKey = process.env.TATUM_SECRET_KEY;
    }
    const tatumSdk = TatumApi(tatumKey);
    return tatumSdk;
  } catch (e) {
    console.log(e);
  }
};

const getTatumKey = async () => {
  try {
    let tatumKey = process.env.TATUM_KEY;
    if (!tatumKey) {
      const client = new SecretManagerServiceClient({
        credentials: {
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
          private_key: process.env.GOOGLE_CLIENT_KEY,
        },
      });
      const [version] = await client.accessSecretVersion({
        name: "projects/1098360994708/secrets/DynoPay_Tatum/versions/latest",
      });
      const payload = version.payload.data.toString();
      // tatumKey = payload;
      tatumKey = process.env.TATUM_SECRET_KEY;
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
  } else if (currency === "ETH" || currency === "USDT-ERC20") {
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
        address = await tatumSdk.blockchain.eth.ethGenerateAddress(xpub, index);
        privateKey = await tatumSdk.blockchain.eth.ethGenerateAddressPrivateKey(
          { mnemonic, index }
        );
        break;
      case "USDT-ERC20":
        address = await tatumSdk.blockchain.eth.ethGenerateAddress(xpub, index);
        privateKey = await tatumSdk.blockchain.eth.ethGenerateAddressPrivateKey(
          { mnemonic, index }
        );
        break;
      case "TRX":
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
        address = await tatumSdk.blockchain.bsc.bscGenerateAddress(xpub, index);
        privateKey = await tatumSdk.blockchain.bsc.bscGenerateAddressPrivateKey(
          { mnemonic, index }
        );
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
    const tatumKey = await getTatumKey();

    const chain =
      currency === "USDT-ERC20"
        ? "ETH"
        : currency === "USDT-TRC20"
        ? "TRON"
        : currency === "TRX"
        ? "TRON"
        : currency;

    const url =
      process.env.SERVER_URL +
      (onlyCrypto ? "api/tatum-crypto-webhook" : "api/tatum-webhook");

    // const url = process.env.SERVER_URL + "api/tatum-webhook";

    const { data } = await axios.get(
      "https://api.tatum.io/v4/subscription?pageSize=10&address=" + address,
      {
        headers: {
          "x-api-key": tatumKey,
        },
      }
    );
    let resData = { id: null };

    if (data?.length > 0) {
      resData = { id: data[0]?.id };
      await axios.put(
        "https://api.tatum.io/v4/subscription/" + resData.id,
        {
          url,
        },
        {
          headers: {
            "x-api-key": tatumKey,
          },
        }
      );
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
        {
          headers: {
            "x-api-key": tatumKey,
          },
        }
      );
      resData = data;
    }
    return resData;
  } catch (e) {
    console.log(e);
  }
};

const deleteSubscription = async (id) => {
  try {
    if (id) {
      const tatumKey = await getTatumKey();
      const resData = await axios.delete(
        `https://api.tatum.io/v4/subscription/${id}?type=mainnet`,
        {
          headers: {
            "x-api-key": tatumKey,
          },
        }
      );
      console.log(resData.data);
      return resData.data;
    }
    return null;
  } catch (e) {
    console.log(e);
  }
};

const sendFeeToAdmin = async (userId, adminID, amount) => {
  try {
    const tatumSdk = await getTatumSDK();
    const resData = await tatumSdk.ledger.transaction.sendTransaction({
      amount: amount.toString(),
      recipientAccountId: adminID,
      senderAccountId: userId,
    });
    console.log(resData.reference);
    return resData.reference;
  } catch (e) {
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
  contractAddress = "",
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
  } else if (["ETH", "BSC", "USDT-ERC20"].indexOf(currency) !== -1) {
    const localAmount: any = Number(amount);
    const gasFees = (await tatumSdk.fee.estimateFeeBlockchain({
      chain: currency === "USDT-ERC20" ? "ETH" : currency,
      type: currency === "USDT-ERC20" ? "TRANSFER_ERC20" : "TRANSFER_NFT",
      sender: fromAddress,
      ...(currency === "USDT-ERC20" && {
        contractAddress: process.env.ETH_CONTRACT,
      }),
      recipient: toAddress,
      amount: localAmount.toString(),
    })) as FeeEvmBased;

    console.log(gasFees);

    let gasPrice = Math.ceil(gasFees?.gasPrice > 30 ? 30 : gasFees.gasPrice);
    const gas_fee_for_amount = gasPrice < 3 ? 4 : gasPrice + 1;
    fees = {
      fast: Number(
        Number((gas_fee_for_amount * gasFees?.gasLimit) / 1000000000)
      ).toFixed(8),
      ...(currency !== "USDT-ERC20" && {
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
      gasLimit:
        currency === "USDT-ERC20"
          ? gasFees.gasLimit
          : Math.floor((gasFees?.gasLimit * 25) / 100),
    };
  } else if (currency === "BCH") {
    const tatumKey = await getTatumKey();
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
      {
        headers: {
          "x-api-key": tatumKey,
        },
      }
    );
    const bytes = (bchInputs + 1 * 148 + 2 * 34 + 10) / 1000;
    fees = {
      slow: (bytes * result).toFixed(8),
      medium: (bytes * result).toFixed(8),
      fast: (bytes * result).toFixed(8),
    };
  } else if (currency === "TRX") {
    fees = {
      fast: 10,
      medium: 5,
      slow: 3,
    };
  } else if (currency === "USDT-TRC20") {
    fees = {
      fast: 5,
    };
  }

  return fees;
};

const batchFeeEstimation = async ({
  currency,
  fromAddresses,
  toAddresses,
  amount,
  contractAddress = "",
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
  } else if (["ETH", "BSC", "USDT-ERC20"].indexOf(currency) !== -1) {
    // Handle Multiple Transactions
    const gasFeesArray = await Promise.all(
      fromAddresses.map(async (fromAddress) => {
        const gasFees = (await tatumSdk.fee.estimateFeeBlockchain({
          chain: currency === "USDT-ERC20" ? "ETH" : currency,
          type: currency === "USDT-ERC20" ? "TRANSFER_ERC20" : "TRANSFER_NFT",
          sender: fromAddress.address,
          ...(currency === "USDT-ERC20" && {
            contractAddress: process.env.ETH_CONTRACT,
          }),
          recipient: toAddresses[0].address,
          amount: amount.toString(),
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

    let gasPrice = gasFees?.gasPrice > 30 ? 30 : gasFees?.gasPrice;

    fees = {
      fast: Number(
        Number(((gasPrice + 1) * gasFees?.gasLimit) / 1000000000) * totalAddress
      ).toFixed(8),
      ...(currency !== "USDT-ERC20" && {
        medium: Number(
          Number(
            ((gasPrice + 1) * ((gasFees?.gasLimit * 50) / 100)) / 1000000000
          ) * totalAddress
        ).toFixed(8),
        slow: Number(
          Number(
            ((gasPrice + 1) * ((gasFees?.gasLimit * 25) / 100)) / 1000000000
          ) * totalAddress
        ).toFixed(8),
      }),
      gasPrice,
      gasLimit:
        currency === "USDT-ERC20"
          ? gasFees.gasLimit
          : Math.floor((gasFees?.gasLimit * 25) / 100),
    };
  } else if (currency === "BCH") {
    const tatumKey = await getTatumKey();
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
      {
        headers: {
          "x-api-key": tatumKey,
        },
      }
    );
    const bytes = ((bchInputs + 1) * 148 + 2 * 34 + 10) / 1000;
    fees = {
      slow: (bytes * result).toFixed(8),
      medium: (bytes * result).toFixed(8),
      fast: (bytes * result).toFixed(8),
    };
  } else if (currency === "TRX") {
    fees = {
      fast: totalAddress * 3.5,
      medium: totalAddress * 2.5,
      slow: totalAddress * 1.5,
    };
  } else if (currency === "USDT-TRC20") {
    fees = {
      fast: 5,
    };
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
  contractAddress = null,
  fromMaster = false,
  fromUTXO = [],
  toUTXO = [],
}) => {
  let transaction;
  const tatumSdk = await getTatumSDK();
  if (currency === "BTC") {
    transaction = await tatumSdk.blockchain.bitcoin.btcTransferBlockchain({
      fromAddress: [{ address: fromAddress, privateKey }],
      to: [{ address: toAddress, value: Number(Number(amount).toFixed(8)) }],
      fee,
      changeAddress: fromMaster ? fromAddress : toAddress,
    });
  } else if (currency === "ETH" || currency === "USDT-ERC20") {
    transaction = await tatumSdk.blockchain.eth.ethBlockchainTransfer({
      fromPrivateKey: privateKey,
      to: toAddress,
      amount: Number(amount).toFixed(8).toString(),
      fee: {
        gasPrice: Math.ceil(fee?.gasPrice).toString(),
        gasLimit: fee?.gasLimit.toString(),
      },
      currency: currency === "ETH" ? "ETH" : "USDT",
    });
  } else if (currency === "TRX") {
    transaction = await tatumSdk.blockchain.tron.tronTransfer({
      fromPrivateKey: privateKey,
      to: toAddress,
      amount: Number(amount).toFixed(8).toString(),
    });
  } else if (currency === "USDT-TRC20") {
    transaction = await tatumSdk.blockchain.tron.tronTransferTrc20({
      amount: Number(amount).toString(),
      feeLimit: 50,
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
    transaction = await tatumSdk.blockchain.doge.dogeTransferBlockchain({
      fromAddress: [{ address: fromAddress, privateKey }],
      to: [{ address: toAddress, value: Number(Number(amount).toFixed(8)) }],
      fee,
      changeAddress: fromMaster ? fromAddress : toAddress,
    });
  } else if (currency === "LTC") {
    transaction = await tatumSdk.blockchain.ltc.ltcTransferBlockchain({
      fromAddress: [{ address: fromAddress, privateKey }],
      to: [{ address: toAddress, value: Number(Number(amount).toFixed(8)) }],
      fee,
      changeAddress: fromMaster ? fromAddress : toAddress,
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
  }
  return transaction;
};

const assetBatchAddressesToOtherAddress = async ({
  currency,
  fromAddress,
  toAddress,
  fee,
  contractAddress = null,
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
    const result: any = await tatumSdk.blockchain.bitcoin.btcTransferBlockchain(
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
    fromAddress.forEach((fromAdd) => {
      transactions.push({
        txId: result?.txId,
        status: "success",
        reason: null,
        fromAddress: fromAdd,
      });
    });
    console.log("###transactions", transactions);
  } else if (currency === "ETH" || currency === "USDT-ERC20") {
    let transactionResponse = [];
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
            currency: currency === "ETH" ? "ETH" : "USDT",
          });
          const result: any =
            await tatumSdk.blockchain.eth.ethBlockchainTransfer({
              fromPrivateKey: fromAddr.privateKey,
              to: destinationAddress,
              amount: Number(fromAddr.value).toFixed(8).toString(),
              fee: {
                gasPrice: Math.ceil(fee?.gasPrice).toString(),
                gasLimit: fee?.gasLimit.toString(),
              },
              currency: currency === "ETH" ? "ETH" : "USDT",
            });
          transactionResponse.push({
            txId: result?.txId,
            status: "success",
            reason: null,
            fromAddress: fromAddr,
          });
        } catch (error) {
          console.log("###error: ", error);
          transactionResponse.push({
            fromAddress: fromAddr.address,
            toAddress: destinationAddress,
            status: "failed",
            errorMessage: error.body.message,
            error: error.message,
            cause: error.body.cause,
          });
        }
      })
    );
    transactions = transactionResponse;
  } else if (currency === "TRX") {
    let transactionResponse = [];
    // Send assets from all addresses to one address
    await Promise.allSettled(
      fromAddress.map(async (fromAddr) => {
        try {
          console.log("###TRX PAYLOAD: ", {
            fromPrivateKey: fromAddr.privateKey,
            to: destinationAddress,
            amount: Number(fromAddr.value).toFixed(8).toString(),
          });
          const result: any = await tatumSdk.blockchain.tron.tronTransfer({
            fromPrivateKey: fromAddr.privateKey,
            to: destinationAddress,
            amount: Number(fromAddr.value).toFixed(8).toString(),
          });
          console.log("###result", result);
          transactionResponse.push({
            txId: result?.txId,
            status: "success",
            reason: null,
            fromAddress: fromAddr,
          });
        } catch (error) {
          console.log("###error: ", error);
          transactionResponse.push({
            fromAddress: fromAddr.address,
            toAddress: destinationAddress,
            status: "failed",
            errorMessage: error.body.message,
            error: error.message,
            cause: error.body.cause,
          });
        }
      })
    );
    console.log("###transactionResponse", transactionResponse);
    transactions = transactionResponse;
  } else if (currency === "USDT-TRC20") {
    let transactionResponse = [];
    // Send assets from all addresses to one address
    await Promise.allSettled(
      fromAddress.map(async (fromAddr) => {
        try {
          console.log("###USDT-TRC20 PAYLOAD: ", {
            amount: Number(fromAddr.value).toFixed(2).toString(),
            feeLimit: 50,
            fromPrivateKey: fromAddr.privateKey,
            to: destinationAddress,
            tokenAddress: process.env.TRX_CONTRACT,
          });
          const result: any = await tatumSdk.blockchain.tron.tronTransferTrc20({
            amount: Number(fromAddr.value).toFixed(2).toString(),
            feeLimit: 50,
            fromPrivateKey: fromAddr.privateKey,
            to: destinationAddress,
            tokenAddress: process.env.TRX_CONTRACT,
          });
          console.log("###result", result);
          transactionResponse.push({
            txId: result?.txId,
            status: "success",
            reason: null,
            fromAddress: fromAddr,
          });
        } catch (error) {
          console.log("###error: ", error);
          transactionResponse.push({
            fromAddress: fromAddr.address,
            toAddress: destinationAddress,
            status: "failed",
            errorMessage: error.body.message,
            error: error.message,
            cause: error.body.cause,
          });
        }
      })
    );
    transactions = transactionResponse;
  } else if (currency === "BSC") {
    let transactionResponse = [];
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
          const result: any =
            await tatumSdk.blockchain.bsc.bscBlockchainTransfer({
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
          transactionResponse.push({
            txId: result?.txId,
            status: "success",
            reason: null,
            fromAddress: fromAddr,
          });
        } catch (error) {
          console.log("###error: ", error);
          transactionResponse.push({
            fromAddress: fromAddr.address,
            toAddress: destinationAddress,
            status: "failed",
            errorMessage: error.body.message,
            error: error.message,
            cause: error.body.cause,
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
    const result: any = await tatumSdk.blockchain.doge.dogeTransferBlockchain({
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
    fromAddress.forEach((fromAdd) => {
      transactions.push({
        txId: result?.txId,
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
    const result: any = await tatumSdk.blockchain.ltc.ltcTransferBlockchain({
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
    fromAddress.forEach((fromAdd) => {
      transactions.push({
        txId: result?.txId,
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
    const result: any = await tatumSdk.blockchain.bcash.bchTransferBlockchain({
      fromUTXO,
      to: toUTXO,
      fee: fee,
      changeAddress: permanentUserWalletAddress
        ? permanentUserWalletAddress
        : destinationAddress?.includes("bitcoincash")
        ? destinationAddress
        : "bitcoincash:" + destinationAddress,
    });
    fromAddress.forEach((fromAdd) => {
      transactions.push({
        txId: result?.txId,
        status: "success",
        reason: null,
        fromAddress: fromAdd,
      });
    });
  }
  return transactions;
};

const validateTronAddress = (address) => {
  try {
  } catch (e) {
    const status = tronweb.utils.address.isAddress(address);
    if (status) {
      return status;
    } else {
      throw { message: "please enter a valid TRX address!" };
    }
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
  } else if (currency === "TRX") {
    res = await tatumSdk.blockchain.tron.tronGetAccount(address);
  } else if (currency === "USDT-TRC20") {
    const tempRes = await tatumSdk.blockchain.tron.tronGetAccount(address);
    if (tempRes && tempRes?.trc20) {
      console.log(tempRes?.trc20, tempRes.trc20[0]);
      res = {
        balance: Number(tempRes.trc20[0]?.[process.env.TRX_CONTRACT]) / 1000000,
      };
    }
  } else if (currency === "LTC") {
    res = await tatumSdk.blockchain.ltc.ltcGetBalanceOfAddress(address);
  } else if (currency === "DOGE") {
    res = await tatumSdk.blockchain.doge.dogeGetBalanceOfAddress(address);
  } else if (currency === "BSC") {
    res = await tatumSdk.blockchain.bsc.bscGetBalance(address);
  } else if (currency === "BCH") {
    res = await tatumSdk.blockchain.bcash.bchGetTxByAddress(address);
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

    let currentTransactionBlock;
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

export default {
  generateWallet,
  createVirtualAccount,
  getAllAccounts,
  generateUserAddress,
  createSubscription,
  getBitcoinAddress,
  deleteUserAddress,
  sendFeeToAdmin,
  deleteSubscription,
  feeEstimation,
  batchFeeEstimation,
  generatePrivatekey,
  assetToOtherAddress,
  assetBatchAddressesToOtherAddress,
  testingFunction,
  getAddressBalance,
  validateTronAddress,
  getCurrentPaymentStatus,
  encryptSymmetric,
  decryptSymmetric,
};
