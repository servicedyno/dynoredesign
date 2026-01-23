import express from "express";
import { customerModel, customerWalletModel } from "../models";
import {
  errorResponseHelper,
  getErrorMessage,
  successResponseHelper,
} from "../helper";
import { customerLogger } from "../utils/loggers";
import jwt from "jsonwebtoken";
import Crypto from "crypto";
import { setRedisItem } from "../utils/redisInstance";
import customerTransactionModel from "../models/customerTransactionModel";
import sequelize from "../utils/dbInstance";
import { QueryTypes } from "sequelize";
import axios from "axios";
import { Authorization } from "../utils/types";

const createUser = async (req: express.Request, res: express.Response) => {
  try {
    const { name, email, mobile } = req.body;
    const data = res.locals.apiKeyData;

    const isExists = await customerModel
      .findOne({
        where: {
          email,
        },
      })
      .then((token) => token !== null)
      .then((isExists) => isExists);

    console.log("isExists====>", isExists);
    if (isExists) {
      errorResponseHelper(res, 503, "Account Already Exists!!!");
    } else {
      const createdUser = await customerModel.create({
        id: Crypto.randomUUID(),
        customer_name: name,
        email,
        mobile,
        company_id: data?.company_id,
      });

      await customerWalletModel.create({
        id: Crypto.randomUUID(),
        customer_id: createdUser.dataValues.customer_id,
        wallet_type: data.base_currency,
      });

      const resData = await getAccessToken(createdUser.dataValues.customer_id);

      successResponseHelper(res, 200, "Registered Successful!", resData);
    }
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    customerLogger.error(errorMessage, new Error(e));
    errorResponseHelper(res, 500, errorMessage);
  }
};

const getAccessToken = async (id) => {
  const user = await customerModel.findOne({
    where: {
      customer_id: id,
    },
  });

  const tokenSecret = process.env.ACCESS_TOKEN_SECRET;

  const { customer_id, ...userData } = user.dataValues;
  console.log(userData);
  if (tokenSecret) {
    const token = jwt.sign(userData, tokenSecret);
    const resData = { token, customer_id: userData.id };
    return resData;
  }
};

const createPayment = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as any;
  try {
    const { amount, redirect_uri, meta_data } = req.body;

    const data = res.locals.apiKeyData;

    const customerData = await customerModel.findOne({
      where: {
        id: userData.id,
      },
    });

    const redisPayload = {
      customer_id: customerData.dataValues.customer_id,
      company_id: data.company_id,
      adm_id: data.adm_id,
      base_currency: data.base_currency,
      amount: amount,
      redirect_uri,
      pathType: "createPayment",
      ...(meta_data && { meta_data: JSON.stringify(meta_data) }),
    };

    const transactionId = Crypto.randomBytes(24).toString("hex");

    console.log(
      data,
      amount,
      customerData,
      redisPayload,
      "customer-" + transactionId
    );

    await setRedisItem("customer-" + transactionId, redisPayload);

    const redirect_url = process.env.CHECKOUT_URL + "/pay?d=" + transactionId;

    successResponseHelper(res, 200, "Link Generated!", { redirect_url });
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    customerLogger.error(
      errorMessage,
      { id: userData.id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, errorMessage);
  }
};

const getSupportedCurrency = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as any;
  try {
    const data = res.locals.apiKeyData;
    const tempData = await sequelize.query(
      "select wallet_type from tbl_admin_wallet where currency_type='CRYPTO'",
      { type: QueryTypes.SELECT }
    );

    const currencyList = tempData.map((x: any) => x.wallet_type);

    successResponseHelper(res, 200, "", [...currencyList]);
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    customerLogger.error(
      errorMessage,
      { id: userData.id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, errorMessage);
  }
};

const cryptoPayment = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as any;
  try {
    const {
      amount,
      meta_data,
      topUp = false,
      currency,
      redirect_uri,
    } = req.body;

    const data = res.locals.apiKeyData;

    const customerData = await customerModel.findOne({
      where: {
        id: userData.id,
      },
    });

    const localCurrency = currency.includes("USDT") ? "usdt" : currency;

    const currencyData = await axios.post(
      process.env.SERVER_URL + "/api/pay/getCurrencyRates",
      {
        source: data.base_currency,
        amount: amount,
        currencyList: [localCurrency],
        fixedDecimal: false,
      },
      {
        headers: {
          Authorization: req.headers.authorization,
        },
      }
    );

    const redisPayload = {
      customer_id: customerData.dataValues.customer_id,
      company_id: data.company_id,
      adm_id: data.adm_id,
      base_currency: data.base_currency,
      amount: amount,
      pathType: topUp ? "addFund" : "cryptoPayment",
      redirect_uri,
      ...(meta_data && { meta_data: JSON.stringify(meta_data) }),
    };

    const transactionId = Crypto.randomBytes(24).toString("hex");

    console.log(
      data,
      amount,
      customerData,
      redisPayload,
      currencyData.data.data,
      "customer-" + transactionId
    );

    await setRedisItem("customer-" + transactionId, redisPayload);

    const payload = {
      uniqueRef: transactionId,
      amount: currencyData.data.data[0].amount,
      currency,
    };

    const {
      data: {
        data: { qr_code, address, transaction_id },
      },
    } = await axios.post(
      process.env.SERVER_URL + "/api/pay/createCryptoPayment",
      payload,
      {
        headers: {
          Authorization: req.headers.authorization,
        },
      }
    );

    successResponseHelper(res, 200, "Payment Created!", {
      transaction_id,
      qr_code,
      address: currency === "BCH" ? "bitcoincash:" + address : address,
      crypto_amount: currencyData.data.data[0].amount,
    });
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    customerLogger.error(
      errorMessage,
      { id: userData.id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, errorMessage);
  }
};

const getCryptoTransaction = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as any;
  try {
    const { address } = req.params;
    if (address) {
      const count = await sequelize.query(
        `select * from tbl_user_temp_address where wallet_address='${address}'`,
        {
          type: QueryTypes.SELECT,
        }
      );
      if (count.length > 0) {
        const {
          data: { data, message },
        } = await axios.post(
          process.env.SERVER_URL + "/api/pay/verifyCryptoPayment",
          { address },
          {
            headers: {
              Authorization: req.headers.authorization,
            },
          }
        );

        successResponseHelper(res, 200, message, data);
      } else {
        errorResponseHelper(res, 500, "please add valid address!");
      }
    } else {
      errorResponseHelper(res, 500, "please add address!");
    }
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    customerLogger.error(
      errorMessage,
      { id: userData.id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, errorMessage);
  }
};

const addFunds = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as any;
  try {
    const { amount, redirect_uri } = req.body;

    const data = res.locals.apiKeyData;

    const customerData = await customerModel.findOne({
      where: {
        id: userData.id,
      },
    });

    const redisPayload = {
      customer_id: customerData.dataValues.customer_id,
      company_id: data.company_id,
      adm_id: data.adm_id,
      base_currency: data.base_currency,
      amount: amount,
      redirect_uri,
      pathType: "addFund",
    };

    const transactionId = Crypto.randomBytes(24).toString("hex");

    console.log(
      data,
      amount,
      customerData,
      redisPayload,
      "customer-" + transactionId
    );

    await setRedisItem("customer-" + transactionId, redisPayload);

    const redirect_url = process.env.CHECKOUT_URL + "/pay?d=" + transactionId;

    successResponseHelper(res, 200, "Link Generated!", { redirect_url });
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    customerLogger.error(
      errorMessage,
      { id: userData.id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, errorMessage);
  }
};

const getTransactions = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as any;
  try {
    const customer = await customerModel.findOne({
      where: {
        id: userData.id,
      },
    });

    const customerData = await customerTransactionModel.findAll({
      where: {
        customer_id: customer.dataValues.customer_id,
      },
    });

    const transferData = [];

    for (let i = 0; i < customerData.length; i++) {
      const {
        transaction_id,
        company_id,
        customer_id,
        updatedAt,
        ...transferDetails
      } = customerData[i].dataValues;
      transferData.push(transferDetails);
    }

    successResponseHelper(
      res,
      200,
      "Balance Fetched Successfully!",
      transferData
    );
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    customerLogger.error(
      errorMessage,
      { id: userData.id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, errorMessage);
  }
};

const getBalance = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as any;
  try {
    const customer = await customerModel.findOne({
      where: {
        id: userData.id,
      },
    });

    const customerData = await customerWalletModel.findOne({
      where: {
        customer_id: customer.dataValues.customer_id,
      },
    });

    const { amount, wallet_type, ...rest } = customerData.dataValues;

    successResponseHelper(res, 200, "Balance Fetched Successfully!", {
      amount: amount.toFixed(2),
      currency: wallet_type,
    });
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    customerLogger.error(
      errorMessage,
      { id: userData.id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, errorMessage);
  }
};

const getSingleTransaction = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as any;
  try {
    const id = req.params?.id;
    if (id) {
      const customer = await customerModel.findOne({
        where: {
          id: userData.id,
        },
      });

      const customerData = await customerTransactionModel.findOne({
        where: {
          customer_id: customer.dataValues.customer_id,
          id,
        },
      });
      if (customerData) {
        const {
          transaction_id,
          company_id,
          customer_id,
          updatedAt,
          ...transferDetails
        } = customerData.dataValues;

        successResponseHelper(
          res,
          200,
          "Balance Fetched Successfully!",
          transferDetails
        );
      } else {
        throw { message: "Please provide a valid transaction_id!" };
      }
    } else {
      errorResponseHelper(res, 500, "Please provide a valid transaction_id!");
    }
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    customerLogger.error(
      errorMessage,
      { id: userData.id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, errorMessage);
  }
};

const useWallet = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as any;
  try {
    const { amount } = req.body;
    if (amount) {
      const tempData = res.locals.apiKeyData;

      const customerData = await customerModel.findOne({
        where: {
          id: userData.id,
        },
      });

      const customer_id = customerData.dataValues.customer_id;

      const companyData: any[] = await sequelize.query(
        "select * from tbl_company where company_id=" + tempData.company_id,
        { type: QueryTypes.SELECT }
      );
      const walletData = (
        await customerWalletModel.findOne({
          where: { customer_id },
        })
      ).dataValues;
      let newAmount;
      if (walletData.amount < amount) {
        throw { message: "Insufficient Balance!" };
      } else {
        newAmount = Number(Number(walletData.amount) - Number(amount)).toFixed(
          2
        );

        await customerWalletModel.update(
          {
            amount: newAmount,
          },
          {
            where: { customer_id },
          }
        );
      }

      const customerPayload = {
        id: Crypto.randomUUID(),
        company_id: Number(tempData.company_id),
        customer_id: Number(customerData.dataValues?.customer_id),
        payment_mode: "WALLET",
        base_amount: Number(amount).toFixed(2),
        base_currency: tempData.base_currency,
        paid_amount: Number(amount).toFixed(2),
        paid_currency: tempData.base_currency,
        transaction_type: "DEBIT",
        transaction_details:
          "wallet transaction on " + companyData[0].company_name,
        transaction_reference: Crypto.randomUUID(),
        status: "successful",
      };

      await customerTransactionModel.create({ ...customerPayload });

      successResponseHelper(res, 200, "amount debited successfully!", {
        new_balance: newAmount,
        transaction_id: customerPayload.id,
      });
    } else {
      throw { message: "Please add amount!" };
    }
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    customerLogger.error(
      errorMessage,
      { id: userData.id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, errorMessage);
  }
};

export default {
  createUser,
  createPayment,
  cryptoPayment,
  getAccessToken,
  getTransactions,
  getBalance,
  addFunds,
  getSingleTransaction,
  getCryptoTransaction,
  getSupportedCurrency,
  useWallet,
};
