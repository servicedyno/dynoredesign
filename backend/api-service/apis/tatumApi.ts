import { TatumApi } from "@tatumio/api-client";
import { virtualAccount } from "../utils/types";
import axios from "axios";

const tatumSdk = TatumApi(process.env.TATUM_SECRET_KEY);

const generateWallet = async () => {
  try {
    // Step 1: Generate a new Bitcoin wallet
    const wallet = await tatumSdk.blockchain.bcash.bchGenerateWallet();
    const mnemonic = wallet.mnemonic;
    const xpub = wallet.xpub;

    console.log("Mnemonic:", mnemonic);
    console.log("xPub:", xpub);

    // Step 2: Derive a Bitcoin address
    const index = 0; // Example index
    const address = await tatumSdk.blockchain.bcash.bchGenerateAddress(
      xpub,
      index
    );
    console.log(`Derived Address [Index ${index}]:`, address);

    // Step 3: Derive the private key for the address
    const privateKey =
      await tatumSdk.blockchain.bcash.bchGenerateAddressPrivateKey({
        mnemonic,
        index: 0,
      });
    console.log(`Derived Private Key [Index ${index}]:`, privateKey);

    return { mnemonic, xpub, address, privateKey };
  } catch (error) {
    console.error("Error in wallet generation and key derivation:", error);
  }
};

const createVirtualAccount = async ({
  currency,
  xpub,
  customerId,
}: virtualAccount) => {
  console.log(currency, xpub, customerId);
  try {
    const account = await tatumSdk.ledger.account.createAccount({
      currency,
      xpub,
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
    const accounts = await tatumSdk.ledger.account.getAccounts();
    return { accounts };
  } catch (error) {
    console.error("Error in wallet generation and key derivation:", error);
  }
};

const generateUserAddress = async (customerID) => {
  try {
    const address =
      await tatumSdk.virtualAccount.account.generateDepositAddress(customerID);

    return { address };
  } catch (error) {
    console.error("Error in wallet generation and key derivation:", error);
  }
};

const createSubscription = async (accountID) => {
  try {
    const resData = await axios.post(
      "https://api.tatum.io/v3/subscription",
      {
        type: "ACCOUNT_INCOMING_BLOCKCHAIN_TRANSACTION",
        attr: {
          id: accountID,
          url: "https://a001-49-36-81-133.ngrok-free.app/api/tatum-webhook",
        },
      },
      {
        headers: {
          "x-api-key": process.env.TATUM_SECRET_KEY,
        },
      }
    );
    console.log(resData.data);
  } catch (e) {
    console.log(e);
  }
};

const getBitcoinAddress = async (address) => {
  try {
    const data = await tatumSdk.blockchain.bitcoin.btcGetBalanceOfAddress(
      address
    );
    console.log(data);
  } catch (e) {
    console.log(e);
  }
};

export default {
  generateWallet,
  createVirtualAccount,
  getAllAccounts,
  generateUserAddress,
  createSubscription,
  getBitcoinAddress,
};
