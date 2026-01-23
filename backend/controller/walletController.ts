import express from "express";
import jwt from "jsonwebtoken";
import {
  FW_API_Response,
  IAdminWallet,
  IFundData,
  IUserType,
  IVerifyResponse,
} from "../utils/types";
import sequelize from "../utils/dbInstance";
import { Op, QueryTypes, where } from "sequelize";
import {
  arraySorting,
  currencyConvert,
  decrypt,
  errorResponseHelper,
  getErrorMessage,
  sendEmail,
  successResponseHelper,
} from "../helper";
import crypto, { hash } from "crypto";
import flw from "../apis/flutterwaveApi";
import {
  deleteRedisItem,
  getRedisItem,
  setRedisItem,
} from "../utils/redisInstance";
import { paymentTypes } from "../utils/enums";
import axios from "axios";
import QR_Code from "qrcode";
import { adminWalletModel, userWalletModel } from "../models";
import { walletLogger } from "../utils/loggers";
import {
  selfTransactionModel,
  userExchangeModel,
  userModel,
  userTransactionModel,
  userWalletAddressModel,
  userTempAddressModel,
} from "../models/userModels";
import tatumApi from "../apis/tatumApi";
import localStorage from "../utils/localStorage";
import blockchairApi from "../apis/blockchairApi";
import { getTransactionFee, getBlockchainFee } from ".";
import mailTransporter from "../utils/mailTransporter";
import { getAdminWalletAddress } from "../utils/adminUtils";

const getWallet = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const walletData = await userWalletModel.findAll({
      attributes: {
        exclude: [
          "wallet_id",
          "privateKey",
          "subscription_id",
          "wallet_account_id",
          "xpub",
          "mnemonic",
        ],
      },
      where: {
        user_id: userData.user_id,
      },
    });

    const currencyList = [];

    for (let i = 0; i < walletData.length; i++) {
      currencyList.push(walletData[i].dataValues.wallet_type);
    }

    const currencyData = await currencyConvert({
      currency: currencyList,
      sourceCurrency: "USD",
      fixedDecimal: false,
      amount: 1,
    });

    const returnData = [];

    for (let i = 0; i < currencyData.length; i++) {
      const currentIndex = walletData.findIndex(
        (x) => x.dataValues.wallet_type === currencyData[i].currency
      );
      console.log(currentIndex);
      const currentWallet = walletData[currentIndex].dataValues;
      const finalAmount = Number(
        currentWallet.amount / currencyData[i].transferRate
      );
      const amount_in_usd = Number(finalAmount).toFixed(2);
      returnData.push({
        ...currentWallet,
        amount_in_usd,
        transfer_rate: currencyData[i].transferRate,
      });
    }

    successResponseHelper(res, 200, "", returnData);
  } catch (e) {
    const message = getErrorMessage(e);
    walletLogger.error(
      message,
      { user_id: userData.user_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

const getWalletTransactions = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const id = req.params.id;
    const { rowsPerPage, page, filters } = req.body;
    let column,
      sortType,
      offset = -1,
      limit;
    if (filters) {
      column = filters?.column ?? "createdAt";
      sortType = !filters?.asc ? "DESC" : "ASC";
    }
    if (rowsPerPage && page) {
      offset = (page - 1) * rowsPerPage;
      limit = rowsPerPage;
    }
    const walletData = await userWalletModel.findOne({
      where: {
        id,
      },
    });

    const wallet_id = walletData.dataValues.wallet_id;
    const selfData = await selfTransactionModel.findAll({
      attributes: { exclude: ["wallet_id", "transaction_id"] },
      where: {
        wallet_id,
      },
      ...(column && sortType && { order: [[column, sortType]] }),
      ...(offset !== -1 && limit && { offset, limit }),
    });
    console.log(offset, limit);
    const tempData = await sequelize.query(
      `
      select ut.*,c.customer_name,c.email,cm.company_name,cm.company_id from tbl_user_transaction ut 
      join tbl_customer c on c.customer_id=ut.customer_id
      join tbl_company cm on cm.company_id=c.company_id where ut.wallet_id=${wallet_id}
      ${column && sortType ? `order by ${column} ${sortType}` : ``} 
      ${offset !== -1 && limit ? `offset ${offset} limit ${limit}` : ``}
      `,
      { type: QueryTypes.SELECT }
    );

    const customer_data = tempData.map((x) => {
      const { wallet_id, transaction_id, ...rest }: any = x;
      return rest;
    });

    successResponseHelper(res, 200, "", {
      customers_transactions: customer_data,
      self_transactions: selfData,
    });
  } catch (e) {
    const message = getErrorMessage(e);
    walletLogger.error(
      message,
      { user_id: userData.user_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

const estimateFees = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  const { address, amount, currency } = req.body;
  try {
    const contractAddress =
      currency === "USDT-TRC20"
        ? process.env.TRX_CONTRACT
        : currency === "USDT-ERC20"
          ? process.env.ETH_CONTRACT
          : null;
    let data;
    console.log("##address", address);
    if (currency === "TRX" || currency === "USDT-TRC20") {
      data = tatumApi.validateTronAddress(address);
    } else {
      data = await tatumApi.getAddressBalance(address, currency);
    }
    console.log(data);

    let tempAmount = 0,
      inputCount = 0;

    // Get Temporary Addresses
    const { fromAddress, toAddress, totalSendAmount } =
      await getTempAddressBatches(
        userData.user_id,
        currency,
        amount,
        address,
        0
      );

    console.log("####Transaction Details ---->", {
      fromAddress,
      toAddress,
      totalSendAmount,
    });

    if (currency === "BCH") {
      fromAddress.forEach(async (address) => {
        const utxo = await blockchairApi.getBitcoinCashUTXO(address.address);

        utxo.sort((a, b) => b.value - a.value);

        for (let i = 0; i < utxo.length; i++) {
          if (tempAmount < amount) {
            inputCount++;
            tempAmount += utxo[i].value / 100000000;
          }
        }
      });
    }

    // Get Fees for batch transactions
    const batchFees = await tatumApi.batchFeeEstimation({
      currency,
      fromAddresses: fromAddress,
      toAddresses: toAddress,
      amount: totalSendAmount,
      contractAddress,
      totalAddress: fromAddress.length,
      bchInputs: inputCount,
    });
    console.log("###fromAddress", fromAddress);
    const tempFees = {};
    const keys = Object.keys(batchFees);
    const tempCurrency = currency === "USDT-ERC20" ? "ETH" : currency;
    const currentAmount = await currencyConvert({
      currency: ["USD"],
      sourceCurrency: tempCurrency,
      amount: 1,
      fixedDecimal: true,
    });
    for (let i = 0; i < keys.length; i++) {
      if (currency === "USDT-ERC20") {
        if (["fast"].indexOf(keys[i]) !== -1) {
          tempFees[keys[i] + "_in_usd"] = Number(
            batchFees[keys[i]] * currentAmount[0].amount
          ).toFixed(2);
          tempFees[keys[i]] = Number(
            batchFees[keys[i]] * currentAmount[0].amount
          ).toFixed(2);
        } else {
          tempFees[keys[i]] = batchFees[keys[i]];
        }
      } else if (currency === "USDT-TRC20") {
        tempFees[keys[i] + "_in_usd"] = Number(batchFees[keys[i]]).toFixed(2);
        tempFees[keys[i]] = Number(batchFees[keys[i]]).toFixed(2);
      } else {
        if (["fast", "medium", "slow"].indexOf(keys[i]) !== -1) {
          tempFees[keys[i] + "_in_usd"] = Number(
            batchFees[keys[i]] * currentAmount[0].amount
          ).toFixed(2);
        }
        tempFees[keys[i]] = batchFees[keys[i]];
      }
    }

    successResponseHelper(res, 200, "", tempFees);
  } catch (e) {
    console.log("#############Error", e);
    const message = getErrorMessage(e);
    walletLogger.error(
      message,
      { user_id: userData.user_id, email: userData.email },
      new Error(e)
    );
    const returnMessage =
      e.message === "Insufficient funds!"
        ? e.message
        : `Please add a valid ${currency} address!`;
    errorResponseHelper(res, 500, returnMessage);
  }
};

const getAllTransactions = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { rowsPerPage, page, filters } = req.body;
    let column, sortType, offset, limit;
    if (filters) {
      column = filters?.column ?? "createdAt";
      sortType = !filters?.asc ? "desc" : "asc";
    } else {
      column = "createdAt";
      sortType = "desc";
    }
    if (rowsPerPage && page) {
      offset = (page - 1) * rowsPerPage;
      limit = rowsPerPage;
    }
    const selfData = await selfTransactionModel.findAll({
      attributes: { exclude: ["wallet_id", "transaction_id"] },
      where: {
        user_id: userData.user_id,
      },
      ...(column && sortType && { order: [[column, sortType]] }),
      ...(offset !== -1 && limit && { offset, limit }),
    });

    const tempData = await sequelize.query(
      `
      select ut.*,c.customer_name,c.email,cm.company_name,cm.company_id from tbl_user_transaction ut 
      join tbl_customer c on c.customer_id=ut.customer_id
      join tbl_company cm on cm.company_id=c.company_id where ut.user_id=${userData.user_id
      }
       ${column && sortType ? `order by "${column}" ${sortType}` : ``} 
      ${offset !== -1 && limit ? `offset ${offset} limit ${limit}` : ``}
      `,
      { type: QueryTypes.SELECT }
    );
    const customer_data = tempData.map((x) => {
      const { wallet_id, transaction_id, ...rest }: any = x;
      return rest;
    });

    successResponseHelper(res, 200, "", {
      customers_transactions: customer_data,
      self_transactions: selfData,
    });
  } catch (e) {
    const message = getErrorMessage(e);
    walletLogger.error(
      message,
      { user_id: userData.user_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

const addFunds = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { data } = req.body;
    const userData = jwt.decode(res.locals.token) as IUserType;
    if (data) {
      const value: IFundData = JSON.parse(decrypt(data));
      if (typeof value === "object") {
        let finalRes;
        if (value.paymentType === paymentTypes.CARD) {
          const { paymentRes, uniqueRef } = await cardPayment(value, userData);
          console.log(paymentRes);
          if (paymentRes.status !== "successful") {
            finalRes = { ...paymentRes.meta.authorization, hash: uniqueRef };

            if (paymentRes.meta.authorization.mode !== "redirect") {
              await setRedisItem("flw-txt-" + uniqueRef, {
                hash: data,
                mode: paymentTypes.CARD,
              });
            } else {
              await setRedisItem("flw-txt-" + uniqueRef, {
                id: paymentRes.data.id,
                mode: paymentTypes.CARD,
              });
            }
          }
        }

        if (value.paymentType === paymentTypes.BANK_TRANSFER) {
          const { paymentRes, uniqueRef } = await bankTransfer(value, userData);
          console.log("paymentRes=============>", paymentRes, uniqueRef);
          const { transfer_reference, ...rest } = paymentRes.meta.authorization;
          finalRes = { hash: uniqueRef, ...rest };
          await setRedisItem("flw-txt-" + uniqueRef, {
            mode: paymentTypes.BANK_TRANSFER,
          });
        }

        if (value.paymentType === paymentTypes.USSD) {
          const { paymentRes, uniqueRef } = await USSD(value, userData);
          console.log("paymentRes=============>", paymentRes, uniqueRef);
          const { note } = paymentRes.meta.authorization;
          const { payment_code } = paymentRes.data;
          finalRes = { hash: uniqueRef, note, payment_code };
          await setRedisItem("flw-txt-" + uniqueRef, {
            mode: paymentTypes.USSD,
          });
        }

        if (value.paymentType === paymentTypes.MOBILE_MONEY) {
          const { paymentRes, uniqueRef } = await MobileMoney(value, userData);
          console.log("paymentRes=============>", paymentRes, uniqueRef);
          if (value.currency === "KES") {
            finalRes = { hash: uniqueRef };
          } else {
            finalRes = { hash: uniqueRef, ...paymentRes?.meta?.authorization };
          }
          await setRedisItem("flw-txt-" + uniqueRef, {
            mode: paymentTypes.MOBILE_MONEY,
          });
        }
        if (value.paymentType === paymentTypes.BANK_ACCOUNT) {
          const { paymentRes, uniqueRef } = await bankAccount(value, userData);
          console.log(
            "paymentRes=============>",
            paymentRes,
            uniqueRef,
            paymentRes.data?.meta
          );
          finalRes = {
            hash: uniqueRef,
            ...paymentRes.data?.meta?.authorization,
          };
          await setRedisItem("flw-txt-" + uniqueRef, {
            mode: paymentTypes.BANK_ACCOUNT,
          });
        }
        if (value.paymentType === paymentTypes.QR_CODE) {
          const { paymentRes, uniqueRef } = await QRCode(value, userData);
          console.log(
            "paymentRes=============>",
            paymentRes,
            uniqueRef,
            paymentRes.data?.meta
          );
          finalRes = { hash: uniqueRef, ...paymentRes?.meta?.authorization };
          await setRedisItem("flw-txt-" + uniqueRef, {
            mode: paymentTypes.QR_CODE,
          });
        }

        if (value.paymentType === paymentTypes.CRYPTO) {
          const { paymentRes, uniqueRef } = await Crypto(value, userData);
          console.log("paymentRes=============>", paymentRes, uniqueRef);
          finalRes = { hash: uniqueRef, ...paymentRes };
          await setRedisItem("crypto-" + paymentRes.address, {
            mode: paymentTypes.CRYPTO,
            amount: value.amount,
            status: "pending",
            ref: uniqueRef,
            currency: value.currency,
            walletType: "user",
          });
        }

        if (
          value.paymentType === paymentTypes.GOOGLE_PAY ||
          value.paymentType === paymentTypes.APPLE_PAY
        ) {
          const { paymentRes, uniqueRef } = await googleApplePay(
            value,
            userData
          );
          console.log(
            "paymentRes=============>",
            paymentRes,
            uniqueRef,
            paymentRes.data?.meta
          );
          finalRes = {
            hash: uniqueRef,
            ...paymentRes.data?.meta?.authorization,
          };
          await setRedisItem("flw-txt-" + uniqueRef, {
            mode: paymentTypes.GOOGLE_PAY,
          });
        }
        successResponseHelper(res, 200, "fund ", finalRes);
      } else {
        throw { message: "Please enter valid data!" };
      }
    } else {
      throw { message: "Please enter valid data!" };
    }
  } catch (e) {
    const message = getErrorMessage(e);
    walletLogger.error(
      message,
      { user_id: userData.user_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

const authStep = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { data } = req.body;
    const value: IFundData = JSON.parse(decrypt(data));
    if (typeof value === "object") {
      let finalRes;
      if (value.paymentType === paymentTypes.CARD) {
        const tempData = await getRedisItem("flw-txt-" + value.uniqueRef);

        await deleteRedisItem("flw-txt-" + value.uniqueRef);

        console.log("flw-txt-" + value.uniqueRef);
        if (value.mode === "otp") {
          const flw_ref = tempData?.flw_ref;
          const res = await flw.Charge.validate({
            otp: value.otp,
            flw_ref,
          });

          console.log(res);
          const transactionId = res.data.id;
          const { data }: IVerifyResponse = await flw.Transaction.verify({
            id: transactionId,
          });
          finalRes = {
            id: data.id,
            flwRef: data.flw_ref,
            status: data.status,
          };
        } else {
          const cardData: IFundData = JSON.parse(decrypt(tempData?.hash));
          const { paymentRes, uniqueRef } = await cardPayment(
            { ...value, ...cardData },
            userData,
            true
          );
          console.log(paymentRes);
          if (
            paymentRes.status !== "error" &&
            paymentRes.data?.status !== "successful"
          ) {
            finalRes = { ...paymentRes.meta.authorization, hash: uniqueRef };
            if (paymentRes.meta.authorization.mode !== "redirect") {
              await setRedisItem("flw-txt-" + uniqueRef, {
                flw_ref: paymentRes.data.flw_ref,
              });
            } else {
              await setRedisItem("flw-txt-" + uniqueRef, {
                id: paymentRes.data.id,
              });
            }
          } else if (paymentRes.data?.status === "successful") {
            finalRes = {
              id: paymentRes.data.id,
              flwRef: paymentRes.data.flw_ref,
              status: paymentRes.data.status,
            };
            deleteRedisItem("flw-txt-" + uniqueRef);
          } else {
            finalRes = paymentRes;
          }
        }
      }

      successResponseHelper(res, 200, "fund ", finalRes);
    } else {
      throw { message: "Please enter valid data!" };
    }
  } catch (e) {
    const message = getErrorMessage(e);
    walletLogger.error(
      message,
      { user_id: userData.user_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

const verifyPayment = async (req: express.Request, res: express.Response) => {
  try {
    const { uniqueRef } = req.body;

    const tempData = await getRedisItem("flw-txt-" + uniqueRef);

    let finalRes;
    console.log(tempData, uniqueRef);
    const transactionId = tempData?.id;
    if (transactionId) {
      // await deleteRedisItem("flw-txt-" + uniqueRef);
      const { data }: IVerifyResponse = await flw.Transaction.verify({
        id: transactionId,
      });
      console.log(data);
      finalRes = {
        txRef: uniqueRef,
      };
      successResponseHelper(res, 200, "transaction successful! ", finalRes);
    } else {
      errorResponseHelper(res, 500, "Transaction still in progress!");
    }
  } catch (e) {
    const message = getErrorMessage(e);
    walletLogger.error(message, new Error(e));
    errorResponseHelper(res, 500, message);
  }
};

const confirmPayment = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  const transaction = await sequelize.transaction();
  try {
    const { uniqueRef } = req.body;

    const tempData = await getRedisItem("flw-txt-" + uniqueRef);

    console.log(tempData, uniqueRef);
    const transactionId = tempData?.id;
    if (transactionId) {
      if (tempData.mode !== paymentTypes.CRYPTO) {
        const { data }: IVerifyResponse = await flw.Transaction.verify({
          id: transactionId,
        });
        console.log(data);
        const walletData = await userWalletModel.findOne({
          where: {
            user_id: userData.user_id,
            wallet_type: data.currency,
          },
          transaction,
        });
        console.log(walletData);
        const transaction_fee = await getTransactionFee();
        const blockchain_fee = await getBlockchainFee();
        const platformCharge = (data.amount * Number(transaction_fee)) / 100;
        const blockchainCharge = (data.amount * Number(blockchain_fee)) / 100;

        const adminWallet = await adminWalletModel.increment("fee", {
          by: platformCharge + blockchainCharge,
          where: { wallet_type: data.currency },
        });

        console.log(adminWallet[0]);

        const userSettledAmount = Number(
          data.amount_settled - platformCharge - blockchainCharge
        ).toFixed(2);

        await userWalletModel.increment("amount", {
          by: Number(userSettledAmount),
          where: {
            wallet_id: walletData.dataValues.wallet_id,
          },
          transaction,
        });

        const userPayload = {
          id: uniqueRef,
          wallet_id: walletData.dataValues.wallet_id,
          user_id: walletData.dataValues.user_id,
          payment_mode: tempData.mode,
          base_amount: userSettledAmount,
          base_currency: data.currency,
          transaction_reference: data.flw_ref,
          transaction_type: "CREDIT",
          status: data.status,
        };

        await selfTransactionModel.create({ ...userPayload }, { transaction });

        transaction.commit();
        const returnData = {
          transaction_reference: data.flw_ref,
          status: data.status,
        };
        await deleteRedisItem(uniqueRef);
        successResponseHelper(res, 200, "transaction verified!", returnData);
      }
    } else {
      transaction.rollback();
      errorResponseHelper(
        res,
        500,
        "Transaction Not found! Please contact support"
      );
    }
  } catch (e) {
    const message = getErrorMessage(e);
    transaction.rollback();
    walletLogger.error(
      message,
      { customer_id: userData.customer_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

const verifyCryptoPayment = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  const transaction = await sequelize.transaction();
  try {
    const { address } = req.body;

    const tempData = await getRedisItem("crypto-" + address);

    console.log(tempData, address);
    const transactionId = tempData?.txId;

    const adminWalletData = await adminWalletModel.findOne({
      where: {
        wallet_type: tempData.currency,
      },
    });

    const adminWalletAddress = getAdminWalletAddress(tempData.currency) || adminWalletData?.dataValues.wallet_address;

    if (!adminWalletAddress) {
      throw new Error(
        `Admin wallet address not configured for ${tempData.currency} in environment variables or database.`
      );
    }

    if (transactionId) {
      const walletData = await userWalletModel.findOne({
        where: {
          user_id: userData.user_id,
          wallet_type: tempData.currency,
          wallet_address: address,
        },
        transaction,
      });
      console.log(walletData);
      const transaction_fee = await getTransactionFee();
      const blockchain_fee = await getBlockchainFee();
      const receivedAmount = tempData?.receivedAmount ?? tempData?.amount;
      const platformCharge =
        (Number(receivedAmount) * Number(transaction_fee)) / 100;
      const blockchainCharge =
        (Number(receivedAmount) * Number(blockchain_fee)) / 100;
      const admin_wallet_id = adminWalletData.dataValues.wallet_account_id;
      console.log(
        "platformCharge=========>",
        admin_wallet_id,
        walletData.dataValues.wallet_account_id,
        platformCharge + blockchainCharge
      );
      // const ref = await tatumApi.sendFeeToAdmin(
      //   walletData.dataValues.wallet_account_id,
      //   admin_wallet_id,
      //   platformCharge
      // );

      const adminWallet = await adminWalletModel.increment("fee", {
        by: platformCharge + blockchainCharge,
        where: { wallet_type: tempData.currency },
      });

      const userSettledAmount = Number(
        Number(receivedAmount) - platformCharge - blockchainCharge
      ).toFixed(8);

      console.log(adminWallet[0], userSettledAmount);

      let fees,
        sendAmount: any = Number(receivedAmount);
      let transactionDetails;
      if (["USDT-TRC20", "USDT-ERC20"].indexOf(tempData.currency) === -1) {
        if (["BTC", "LTC", "DOGE"].indexOf(tempData.currency) !== -1) {
          fees = (
            await tatumApi.feeEstimation(
              tempData.currency,
              address,
              adminWalletAddress,
              Number(receivedAmount)
            )
          )?.slow;

          sendAmount = Number(
            Number(Number(receivedAmount) - Number(fees)).toFixed(8)
          );
        }

        if (["ETH", "BSC", "USDT-ERC20"].indexOf(tempData.currency) !== -1) {
          fees = await tatumApi.feeEstimation(
            tempData.currency,
            address,
            adminWalletAddress,
            Number(receivedAmount)
          );

          sendAmount = Number(
            Number(receivedAmount) - Number(fees?.slow)
          ).toFixed(8);
        }

        if (tempData.currency === "BCH") {
          fees = await tatumApi.feeEstimation(
            tempData.currency,
            "bitcoincash" + address,
            adminWalletAddress,
            Number(receivedAmount)
          );
          sendAmount = (
            Number(receivedAmount) -
            Number(fees?.slow) -
            0.00005
          ).toFixed(8);
        }

        console.log(fees);

        try {
          const fromUTXO = [],
            toUTXO = [];

          if (tempData.currency === "BCH") {
            const utxo = await blockchairApi.getBitcoinCashUTXO(address);

            for (let i = 0; i < utxo.length; i++) {
              if (utxo[i].value > 100000) {
                fromUTXO.push({
                  txHash: utxo[i]?.transaction_hash,
                  index: utxo[i]?.index,
                  privateKey: walletData.dataValues.privateKey,
                });
              }
            }
            toUTXO.push({
              address: adminWalletAddress,
              value: Number(sendAmount),
            });
          }
          const finalFees =
            ["ETH", "BSC", "USDT-ERC20"].indexOf(tempData.currency) !== -1
              ? fees
              : fees?.slow;

          transactionDetails = await tatumApi.assetToOtherAddress({
            currency: tempData.currency,
            fromAddress: address,
            toAddress: adminWalletAddress,
            privateKey: walletData.dataValues.privateKey,
            amount: sendAmount,
            fee: finalFees,
            fromUTXO,
            toUTXO,
          });

          console.log(transactionDetails);
        } catch (e) {
          console.log(e);
          const message = getErrorMessage(e);
          walletLogger.error(message, new Error(e));
        }
      }
      await userWalletModel.increment("amount", {
        by: Number(userSettledAmount),
        where: {
          wallet_id: walletData.dataValues.wallet_id,
        },
        transaction,
      });

      const userPayload = {
        id: tempData.ref,
        wallet_id: walletData.dataValues.wallet_id,
        user_id: walletData.dataValues.user_id,
        payment_mode: tempData.mode,
        base_amount: userSettledAmount,
        base_currency: tempData.currency,
        transaction_reference: transactionId,
        transaction_type: "CREDIT",
        status: tempData.status,
      };

      await selfTransactionModel.create({ ...userPayload }, { transaction });

      transaction.commit();
      const returnData = {
        transaction_reference: transactionId,
        status: tempData.status,
      };
      await deleteRedisItem("crypto-" + address);
      successResponseHelper(res, 200, "transaction verified!", returnData);
    } else {
      errorResponseHelper(res, 500, "We did not received the payment!");
    }
  } catch (e) {
    const message = getErrorMessage(e);
    transaction.rollback();
    walletLogger.error(message, new Error(e));
    errorResponseHelper(res, 500, message);
  }
};

const cardPayment = async (
  data: IFundData,
  tokenData: IUserType,
  revalidate = false
) => {
  const expiry = data.expiry.split("/");
  const uniqueRef = crypto.randomBytes(24).toString("hex");
  console.log("from card=============>", data);
  const payload = {
    card_number: data.number,
    expiry_month: expiry[0],
    expiry_year: expiry[1],
    cvv: data.cvc,
    currency: data.currency ?? "USD",
    amount: data.amount,
    email: tokenData.email,
    fullname: tokenData.name,
    tx_ref: uniqueRef,
    enckey: process.env.FLW_ENCRYPTION_KEY,
    ...(revalidate && {
      authorization: {
        mode: data.mode,
        ...(data.mode === "pin"
          ? { pin: data.pin }
          : {
            city: data.city,
            address: data.address,
            state: data.state,
            country: "IN",
            zipcode: data.zipcode,
          }),
      },
    }),
    redirect_url: "http://localhost:3000/payment/verify",
  };

  console.log("payload==========>", payload);

  const paymentRes: FW_API_Response = await flw.Charge.card(payload);

  return { paymentRes, uniqueRef };
};

const bankTransfer = async (data: IFundData, tokenData: IUserType) => {
  const uniqueRef = crypto.randomBytes(24).toString("hex");
  const payload = {
    currency: data.currency,
    amount: data.amount,
    email: tokenData.email,
    fullname: tokenData.name,
    tx_ref: uniqueRef,
  };

  console.log("payload==========>", payload);

  const paymentRes: FW_API_Response = await flw.Charge.bank_transfer(payload);

  return { paymentRes, uniqueRef };
};

const bankAccount = async (data: IFundData, tokenData: IUserType) => {
  const uniqueRef = crypto.randomBytes(24).toString("hex");
  const payload = {
    currency: data.currency,
    amount: data.amount,
    email: tokenData.email,
    fullname: tokenData.name,
    tx_ref: uniqueRef,
  };

  console.log("payload==========>", payload);

  let paymentRes: FW_API_Response;

  if (payload.currency === "NGN") {
    paymentRes = await flw.Charge.ng(payload);
  } else {
    paymentRes = await axios.post(
      "https://api.flutterwave.com/v3/charges?type=account-ach-uk",
      {
        ...payload,
        is_token_io: 1,
      },
      {
        headers: {
          Authorization: "Bearer " + process.env.FLW_SECRET_KEY,
        },
      }
    );
  }

  return { paymentRes, uniqueRef };
};

const googleApplePay = async (data: IFundData, tokenData: IUserType) => {
  const uniqueRef = crypto.randomBytes(24).toString("hex");
  const payload = {
    currency: data.currency,
    amount: data.amount,
    email: tokenData.email,
    fullname: tokenData.name,
    tx_ref: uniqueRef + "_success_mock",
  };

  console.log("payload==========>", payload);

  const type =
    data.paymentType === paymentTypes.GOOGLE_PAY ? "googlepay" : "applepay";

  const response = await axios.post(
    "https://api.flutterwave.com/v3/charges?type=" + type,
    {
      ...payload,
    },
    {
      headers: {
        Authorization: "Bearer " + process.env.FLW_SECRET_KEY,
      },
    }
  );
  const paymentRes = response.data;

  return { paymentRes, uniqueRef };
};

const USSD = async (data: IFundData, tokenData: IUserType) => {
  const uniqueRef = crypto.randomBytes(24).toString("hex");
  const payload = {
    currency: "NGN",
    account_bank: data.account_number,
    amount: 200,
    email: tokenData.email,
    fullname: tokenData.name,
    tx_ref: uniqueRef,
  };

  console.log("payload==========>", payload);

  const paymentRes = await flw.Charge.ussd(payload);

  return { paymentRes, uniqueRef };
};

const MobileMoney = async (data: IFundData, tokenData: IUserType) => {
  const uniqueRef = crypto.randomBytes(24).toString("hex");
  console.log(tokenData);
  const payload = {
    currency: data.currency,
    amount: data.amount,
    ...((data.currency === "UGX" || data.currency === "GHS") && {
      network: data.network,
    }),
    ...(data.currency === "RWF" && {
      order_id: uniqueRef,
    }),
    email: tokenData.email,
    phone_number: data.mobile,
    fullname: tokenData.name,
    tx_ref: uniqueRef,
    ...(data.currency !== "KES" && {
      redirect_url: "http://localhost:3000/payment/verify",
    }),
  };

  console.log("payload==========>", payload);
  let paymentRes;
  if (data.currency === "KES")
    paymentRes = await flw.MobileMoney.mpesa(payload);
  else if (data.currency === "GHS")
    paymentRes = await flw.MobileMoney.ghana(payload);
  else if (data.currency === "UGX")
    paymentRes = await flw.MobileMoney.uganda(payload);
  else if (data.currency === "RWF")
    paymentRes = await flw.MobileMoney.rwanda(payload);

  return { paymentRes, uniqueRef };
};

const QRCode = async (data: IFundData, tokenData: IUserType) => {
  const uniqueRef = crypto.randomBytes(24).toString("hex");
  const payload = {
    currency: "NGN",
    amount: 200,
    email: tokenData.email,
    phone_number: tokenData.mobile,
    fullname: tokenData.name,
    tx_ref: uniqueRef,
    is_nqr: "1",
  };

  console.log("payload==========>", payload);

  const resData = await axios.post(
    "https://api.flutterwave.com/v3/charges?type=qr",
    {
      ...payload,
    },
    {
      headers: {
        Authorization: "Bearer " + process.env.FLW_SECRET_KEY,
      },
    }
  );

  const paymentRes = resData.data;

  return { paymentRes, uniqueRef };
};

const getCurrencyRates = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { source, amount, currencyList, fixedDecimal = true } = req.body;

    const currencyRateList = await currencyConvert({
      sourceCurrency: source,
      currency: currencyList,
      amount,
      fixedDecimal,
    });

    successResponseHelper(res, 200, "", currencyRateList);
  } catch (e) {
    const message = getErrorMessage(e);
    walletLogger.error(message, new Error(e));
    errorResponseHelper(res, 500, message);
  }
};

const Crypto = async (data: IFundData, tokenData: IUserType) => {
  const uniqueRef = crypto.randomBytes(24).toString("hex");
  const currency = data.currency;
  const walletDetails = await (
    await userWalletModel.findOne({
      where: {
        wallet_type: currency,
        user_id: tokenData.user_id,
      },
    })
  ).dataValues;
  let cryptoData = walletDetails.wallet_address;
  if (currency === "BCH") {
    cryptoData = walletDetails.wallet_address.split(":")[1];
    console.log(cryptoData);
  }
  let qr_code;

  if (cryptoData) {
    const url = await QR_Code.toDataURL(cryptoData, { width: 300 });
    qr_code = url;
  }

  const paymentRes = { qr_code, address: cryptoData };

  return { paymentRes, uniqueRef };
};

const sendConfirmationOTP = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { address, amount, currency } = req.body;
    const email = userData.email;
    const isExists = await userModel
      .findOne({
        where: {
          email,
        },
      })
      .then((token) => token !== null)
      .then((isExists) => isExists);
    if (isExists) {
      const randomNumberOTP = Math.floor(100000 + Math.random() * 900000);
      await sendEmail(
        email,
        userData.name,
        "OTP for withdrawal",
        `You are about to withdraw ${amount} ${currency} \n 
        to following wallet address: ${address}.\n
        To proceed further please provide this code: ${randomNumberOTP} \n
        this code will expire in 5 minutes.`
      );

      await setRedisItem(email + "-withdrawal-otp", {
        otp: randomNumberOTP.toString(),
        expiresAt: new Date().getTime() + 5 * 60 * 1000,
      });

      successResponseHelper(res, 200, "OTP sent successfully!");
    } else {
      errorResponseHelper(res, 500, "Please enter a registered email!");
    }
  } catch (e) {
    const message = getErrorMessage(e);
    walletLogger.error(
      message,
      { user_id: userData.user_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

const getTempAddressBatches = async (
  user_id: number,
  currency: string,
  sendAmount: number,
  address: string,
  fees: number
) => {
  // Step 1: Fetch all temporary addresses and paremanent user address for the user in descending order
  const userWallet = await userWalletModel.findOne({
    where: {
      user_id: user_id,
      wallet_type: currency,
    },
  });

  let addressBalance;

  if (currency === "TRX") {
    addressBalance = tatumApi.validateTronAddress(address);
  } else {
    addressBalance = await tatumApi.getAddressBalance(
      userWallet.dataValues?.wallet_address,
      userWallet.dataValues?.wallet_type
    );
  }

  console.log("####addressBalance", addressBalance);

  let tempAddresses = await userTempAddressModel.findAll({
    where: {
      user_id: user_id,
      wallet_type: currency,
      amount: {
        [Op.gt]: 0,
      },
    },
    order: [["amount", "DESC"]],
  });

  let tempAddressBalances = [];

  if (addressBalance?.balance && Number(addressBalance?.balance) > 0) {
    const tempData: any = {
      dataValues: {
        ...userWallet.dataValues,
        amount: Number(addressBalance?.balance),
      },
    };
    tempAddressBalances.push(tempData);
  } else if (addressBalance?.incoming && addressBalance?.outgoing) {
    const amount =
      Number(addressBalance?.incoming) - Number(addressBalance?.outgoing);
    console.log("amount============>", amount);
    if (amount > 0) {
      const tempData: any = {
        dataValues: {
          ...userWallet.dataValues,
          amount,
        },
      };
      tempAddressBalances.push(tempData);
    }
  }
  console.log("###tempAddressBalances", tempAddressBalances);
  if (["USDT-TRC20", "USDT-ERC20", "ETH", "TRX"].indexOf(currency) === -1) {
    for (let address of tempAddresses) {
      if (currency === "TRX") {
        addressBalance = tatumApi.validateTronAddress(
          address.dataValues.wallet_address
        );
      } else {
        addressBalance = await tatumApi.getAddressBalance(
          address.dataValues?.wallet_address,
          address.dataValues?.wallet_type
        );
      }

      if (addressBalance?.balance && Number(addressBalance?.balance) > 0) {
        const tempData: any = {
          dataValues: {
            ...address.dataValues,
            amount: Number(addressBalance?.balance),
          },
        };
        tempAddressBalances.push(tempData);
      } else if (addressBalance?.incoming && addressBalance?.outgoing) {
        const amount =
          Number(addressBalance?.incoming) - Number(addressBalance?.outgoing);
        console.log("amount============>", amount);
        if (amount > 0) {
          const tempData: any = {
            dataValues: {
              ...address.dataValues,
              amount,
            },
          };
          tempAddressBalances.push(tempData);
        }
      }
    }
  }

  // Step 2: Combine user wallet and temporary addresses
  const allUserAddress = [...tempAddressBalances].sort(
    (a, b) => b.dataValues.amount - a.dataValues.amount
  );
  console.log(
    "###allUserAddress",
    allUserAddress.map((a) => ({
      amount: a.dataValues.amount,
      address: a.dataValues.wallet_address,
    }))
  );

  // Step 3: Calculate the total amount available in all addresses
  let totalTempAmount = allUserAddress.reduce(
    (acc, addr) => acc + addr.dataValues.amount,
    0
  );
  console.log("###totalTempAmount=======>", { totalTempAmount, sendAmount });

  // Step 4: Check if the total amount is sufficient for the withdrawal
  if (totalTempAmount < sendAmount) {
    throw { message: "Insufficient funds!" };
  }

  // Step 5: Create batches from temporary addresses to the user-provided address
  let remainingAmountToSend = sendAmount;
  let fromAddress = [],
    toAddress = [];
  for (let address of allUserAddress) {
    if (remainingAmountToSend <= 0) break;
    let transferAmount = Math.min(
      address.dataValues.amount,
      remainingAmountToSend
    );
    fromAddress.push({
      address: address.dataValues.wallet_address,
      privateKey: decrypt(address.dataValues.privateKey),
      value: transferAmount,
    });

    remainingAmountToSend -= transferAmount;
  }
  toAddress.push({
    address: address,
    value: sendAmount,
  });
  const singleFee = Number(fees) / fromAddress.length;
  fromAddress = fromAddress.map((address) => ({
    ...address,
    value: Number(address.value) - singleFee,
  }));

  const totalSendAmount = sendAmount;
  return {
    fromAddress,
    toAddress,
    totalSendAmount,
    permanentUserWalletAddress: userWallet.dataValues.wallet_address,
    tempAddresses,
    userWallet,
  };
};

const withdrawAssets = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { currency, amount, address, feeType, feeToPay, otp, saveAddress } =
      req.body;
    console.log(req.body);
    const storedOtp = await getRedisItem(userData.email + "-withdrawal-otp");
    console.log(storedOtp);
    if (storedOtp.otp != otp) {
      errorResponseHelper(res, 500, "OTP did not match!");
    } else {
      if (new Date().getTime() > Number(storedOtp?.expiresAt)) {
        throw { message: "OTP expired!" };
      }

      const walletData = await userWalletModel.findOne({
        where: {
          user_id: userData.user_id,
          wallet_type: currency,
        },
      });

      let fees = feeToPay,
        sendAmount: any =
          feeType === "wallet"
            ? amount
            : walletData?.dataValues.wallet_type.includes("USDT")
              ? Number(amount - feeToPay).toFixed(2)
              : amount - feeToPay;

      // Fetch Transaction Information
      const {
        fromAddress,
        toAddress,
        totalSendAmount,
        permanentUserWalletAddress,
        tempAddresses,
        userWallet,
      } = await getTempAddressBatches(
        userData.user_id,
        currency,
        sendAmount,
        address,
        fees
      );

      if (
        ["ETH", "BSC", "USDT-ERC20"].indexOf(
          walletData?.dataValues.wallet_type
        ) !== -1
      ) {
        const tempFees = await tatumApi.batchFeeEstimation({
          currency,
          fromAddresses: fromAddress,
          toAddresses: toAddress,
          amount: totalSendAmount,
          totalAddress: fromAddress.length,
        });

        fees = { gasPrice: tempFees?.gasPrice, gasLimit: tempFees?.gasLimit };
      }

      const fromUTXO = [],
        toUTXO = [];

      if (walletData?.dataValues.wallet_type === "BCH") {
        for (let j = 0; j < fromAddress.length; j++) {
          const utxo = await blockchairApi.getBitcoinCashUTXO(
            fromAddress[j].address
          );

          utxo.sort((a, b) => b.value - a.value);

          let tempAmount = 0;

          for (let i = 0; i < utxo.length; i++) {
            if (tempAmount < amount) {
              fromUTXO.push({
                txHash: utxo[i]?.transaction_hash,
                index: utxo[i]?.index,
                privateKey: fromAddress[j].privateKey,
              });
              tempAmount += utxo[i].value / 100000000;
            }
          }

          toUTXO.push({
            address: address.includes("bitcoincash")
              ? address
              : "bitcoincash:" + address,
            value: Number(sendAmount),
          });
        }
      }

      // Transfer assets from temporary addresses to the user's address
      const transactionDetails =
        await tatumApi.assetBatchAddressesToOtherAddress({
          currency: currency,
          fromAddress: fromAddress,
          toAddress: toAddress,
          fee: fees,
          permanentUserWalletAddress,
          fromUTXO,
          toUTXO,
        });

      console.log("###transactionDetails", transactionDetails);

      // if (transactionDetails) {
      //   // Step 5: Deduct the amount from temporary addresses and user's wallet
      //   for (let address of fromAddress) {

      //     // Fetch the current amount
      //     const tempAddr = tempAddresses.find(tmpaddress => tmpaddress.dataValues.wallet_address === address.address);
      //     const newAmount = tempAddr.dataValues.amount - address.value;

      //     if (tempAddr) {
      //       // Update the amount
      //       await userTempAddressModel.update(
      //         { amount: newAmount },
      //         { where: { temp_id: tempAddr.dataValues.temp_id } }
      //       );
      //     }
      //   }
      //   await userWalletModel.decrement("amount", {
      //     by:
      //       feeType === "wallet"
      //         ? Number(amount) + Number(feeToPay)
      //         : Number(amount),
      //     where: {
      //       wallet_id: userWallet.dataValues.wallet_id,
      //     },
      //   });
      // }

      let transactionIds = [];

      if (transactionDetails) {
        // Step 5: Deduct the amount from temporary addresses and user's wallet
        for (let transaction of transactionDetails) {
          if (transaction.status !== "failed") {
            const address = fromAddress.find(
              (addr) => addr.address === transaction.fromAddress.address
            );
            if (address) {
              if (!walletData.dataValues.wallet_address === address.address) {
                const tempAddr = tempAddresses.find(
                  (tmpaddress) =>
                    tmpaddress.dataValues.wallet_address === address.address
                );
                const newAmount = tempAddr.dataValues.amount - address.value;

                if (tempAddr) {
                  // Update the amount
                  await userTempAddressModel.update(
                    { amount: newAmount },
                    { where: { temp_id: tempAddr.dataValues.temp_id } }
                  );
                }
              }
            }
            if (transactionIds.length > 0) {
              const index = transactionIds.findIndex(
                (x) => x?.txId === transaction?.txId
              );
              if (index === -1) {
                transactionIds.push({
                  txId: transaction?.txId,
                  status: "success",
                  reason: null,
                });
              }
            } else {
              transactionIds.push({
                txId: transaction?.txId,
                status: "success",
                reason: null,
              });
            }
          }
        }

        // Deduct the total amount from the user's wallet based on successful transactions
        const totalAmountToDeduct = transactionDetails.reduce(
          (acc, transaction) => {
            return transaction.status !== "failed"
              ? acc + Number(transaction.fromAddress.value)
              : acc;
          },
          0
        );

        await userWalletModel.decrement("amount", {
          by:
            feeType === "wallet"
              ? totalAmountToDeduct + Number(feeToPay)
              : totalAmountToDeduct,
          where: {
            wallet_id: userWallet.dataValues.wallet_id,
          },
        });
      } else {
        throw { message: "Transaction did not proceed!" };
      }

      // let transactionRefrenceIds = "";
      // if (Array.isArray(transactionDetails)) {
      //   transactionDetails.forEach((element) => {
      //     transactionRefrenceIds += element.txId + ",";
      //   });
      // } else {
      //   transactionRefrenceIds = transactionDetails?.txId;
      // }
      // Prepare transaction reference IDs
      let transactionRefrenceIds = transactionIds[0]?.txId;

      const userPayload = {
        id: crypto.randomUUID(),
        wallet_id: walletData.dataValues.wallet_id,
        user_id: walletData.dataValues.user_id,
        payment_mode: "CRYPTO",
        base_amount: amount,
        base_currency: currency,
        transaction_reference: transactionRefrenceIds,
        transaction_type: "DEBIT",
        status: "success",
      };
      console.log(userPayload);

      await selfTransactionModel.create({ ...userPayload });
      if (saveAddress) {
        const isExists = await userWalletAddressModel
          .findOne({
            where: {
              wallet_address: address,
              currency,
            },
          })
          .then((token) => token !== null)
          .then((isExists) => isExists);

        if (!isExists) {
          await userWalletAddressModel.create({
            wallet_address: address,
            currency,
            label: currency,
            user_id: userData.user_id,
          });
        }
      }
      await deleteRedisItem(userData.email + "-withdrawal-otp");
      await sendEmail(
        userData.email,
        userData.name,
        "Withdrawal success!",
        `You're withdrawal of ${amount} ${currency} \n 
          to following wallet address: ${address} is in progress. \n
          for further details please check this transaction reference: ${transactionRefrenceIds} \n`
      );
      successResponseHelper(res, 200, "Amount withdrawed!", transactionIds);
    }
  } catch (e) {
    console.log("###Error: ", e);
    const message = getErrorMessage(e);
    walletLogger.error(
      message,
      { user_id: userData.user_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

const getWalletAddresses = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const user_id = userData.user_id;
    const resData = await userWalletAddressModel.findAll({
      where: {
        user_id,
      },
    });
    successResponseHelper(res, 200, "", resData);
  } catch (e) {
    const message = getErrorMessage(e);
    walletLogger.error(
      message,
      { user_id: userData.user_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

const addWalletAddress = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { wallet_address, currency, label } = req.body;
    try {
      const user_id = userData.user_id;

      let balance;
      if (currency === "TRX" || currency === "USDT-TRC20") {
        balance = await tatumApi.validateTronAddress(wallet_address);
      } else {
        balance = await tatumApi.getAddressBalance(wallet_address, currency);
      }
      console.log(balance);
      const isExists = await userWalletAddressModel
        .findOne({
          where: {
            wallet_address,
            currency,
          },
        })
        .then((token) => token !== null)
        .then((isExists) => isExists);

      if (isExists) {
        errorResponseHelper(
          res,
          500,
          `This address with ${currency} currency is already exists!`
        );
      } else {
        const resData = await userWalletAddressModel.create({
          wallet_address,
          currency,
          label: label ?? currency,
          user_id,
        });
        successResponseHelper(res, 200, "Address added successfully!", resData);
      }
    } catch (e) {
      errorResponseHelper(
        res,
        500,
        `please enter a valid ${currency} address!`
      );
    }
  } catch (e) {
    const message = getErrorMessage(e);
    walletLogger.error(
      message,
      { user_id: userData.user_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

const exchangeCreate = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const {
      mobile,
      email,
      customer_id,
      username,
      identifier,
      wallet_address,
      req_currency,
      exchange_currency,
      amount_in_usd,
    } = req.body;

    let where, secondUser;
    if (identifier !== "WALLET_ADDRESS") {
      if (identifier === "MOBILE") {
        where = {
          mobile,
        };
      } else if (identifier === "EMAIL") {
        where = {
          email,
        };
      } else if (identifier === "USERNAME") {
        where = {
          username,
        };
      } else if (identifier === "CUSTOMER_ID") {
        where = {
          customer_id,
        };
      }
      console.log(
        "secondUser=============>",
        mobile,
        email,
        customer_id,
        username
      );
      secondUser = await userModel.findOne({
        where,
      });
    } else {
      const tempUser = await userWalletModel.findOne({
        where: {
          wallet_type: exchange_currency,
          wallet_address,
        },
      });
      if (tempUser) {
        secondUser = await userModel.findOne({
          where: {
            user_id: tempUser.dataValues.user_id,
          },
        });
      } else {
        errorResponseHelper(res, 500, "user not found!");
        return;
      }
    }
    if (secondUser) {
      if (secondUser?.dataValues.user_id === userData.user_id) {
        errorResponseHelper(
          res,
          500,
          "please check provided details as user can not exchange with their own account!"
        );
      } else {
        const user1Wallet = await userWalletModel.findOne({
          where: {
            user_id: userData.user_id,
            wallet_type: exchange_currency,
          },
        });

        const user2Wallet = await userWalletModel.findOne({
          where: {
            user_id: secondUser?.dataValues.user_id,
            wallet_type: req_currency,
          },
        });

        const wallet1_balance = await currencyConvert({
          currency: ["USD"],
          sourceCurrency: user1Wallet.dataValues.wallet_type,
          amount: user1Wallet.dataValues.amount,
          fixedDecimal: true,
        });

        const wallet2_balance = await currencyConvert({
          currency: ["USD"],
          sourceCurrency: user2Wallet.dataValues.wallet_type,
          amount: user2Wallet.dataValues.amount,
          fixedDecimal: true,
        });

        console.log("wallet_1", wallet1_balance, "wallet_2", wallet2_balance);

        if (wallet1_balance[0].amount < amount_in_usd) {
          errorResponseHelper(
            res,
            500,
            `balance in your ${exchange_currency} wallet is not enough to make exchange of ${amount_in_usd}$.`
          );
          return;
        } else if (wallet2_balance[0].amount < amount_in_usd) {
          errorResponseHelper(
            res,
            500,
            `balance in ${secondUser?.dataValues?.name}'s ${req_currency} wallet is not enough to make exchange of ${amount_in_usd}$.`
          );
          return;
        }

        const randomNumberOTP1 = Math.floor(100000 + Math.random() * 900000);
        const randomNumberOTP2 = Math.floor(100000 + Math.random() * 900000);
        await sendEmail(
          userData.email,
          userData.name,
          "OTP for Exchange",
          `You are about to exchange ${amount_in_usd}$ from ${exchange_currency} \n
          to ${amount_in_usd}$ in ${req_currency} with following user: ${secondUser?.dataValues?.name}.\n
          To proceed further please provide this code: ${randomNumberOTP1} \n
          this code will expire in 5 minutes.`
        );

        await sendEmail(
          secondUser?.dataValues.email,
          secondUser?.dataValues.name,
          "OTP for Exchange",
          `You are about to exchange ${amount_in_usd}$ from ${req_currency} \n
          to ${amount_in_usd}$ in ${exchange_currency} with following user: ${userData.name}.\n
          To proceed further please provide this code: ${randomNumberOTP2} \n
          this code will expire in 5 minutes.`
        );
        const id = crypto.randomUUID();
        const expiresAt = new Date().getTime() + 5 * 60 * 1000;
        const payload = {
          transaction_id: id,
          user2_id: secondUser?.dataValues.user_id,
          user2_name: secondUser?.dataValues.name,
          req_currency,
          exchange_currency,
          amount_in_usd,
          otp1: randomNumberOTP1,
          otp2: randomNumberOTP2,
          expiresAt,
        };

        await userExchangeModel.create({
          transaction_id: id,
          user1_id: userData.user_id,
          user2_id: secondUser?.dataValues.user_id,
          req_currency,
          exchange_currency,
          amount_in_usd,
          expiresAt,
        });

        await setRedisItem("exchange-" + payload.transaction_id, payload);

        successResponseHelper(res, 200, "Exchange create successfully!", {
          transaction_id: id,
        });
      }
    } else {
      errorResponseHelper(res, 500, "user not found!");
    }
  } catch (e) {
    console.log(e);
    const message = getErrorMessage(e);
    walletLogger.error(
      message,
      { user_id: userData.user_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

const getExchange = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const resData = await sequelize.query(
      `
      select ux.*,u1.email as user1_email, u2.email as user2_email, 
      u1.name as user1_name,u2.name as user2_name
      from tbl_user_exchange ux 
      join tbl_user u1 on ux.user1_id=u1.user_id 
      join tbl_user u2 on ux.user2_id=u2.user_id 
      where ux.user1_id=${userData.user_id} or ux.user2_id=${userData.user_id}
      `,
      { type: QueryTypes.SELECT }
    );
    successResponseHelper(res, 200, "Exchange fetched successfully!", resData);
  } catch (e) {
    console.log(e);
    const message = getErrorMessage(e);
    walletLogger.error(
      message,
      { user_id: userData.user_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

const confirmExchange = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  const transaction = await sequelize.transaction();
  try {
    const { otp1, otp2, id } = req.body;
    const data = await getRedisItem("exchange-" + id);
    if (data) {
      if (new Date().getTime() > Number(data.expiresAt)) {
        await userExchangeModel.update(
          {
            status: "expired",
          },
          {
            where: {
              transaction_id: id,
            },
          }
        );

        throw {
          message: "This exchange is expired, please create a new exchange.",
          ignore: true,
        };
      } else {
        const {
          exchange_currency,
          req_currency,
          amount_in_usd,
          user2_id,
          user2_name,
        } = data;

        if (otp1 == data.otp1 && otp2 == data.otp2) {
          const user1_exchange_wallet = await userWalletModel.findOne({
            where: {
              user_id: userData.user_id,
              wallet_type: exchange_currency,
            },
          });
          const user1_request_wallet = await userWalletModel.findOne({
            where: {
              user_id: userData.user_id,
              wallet_type: req_currency,
            },
          });

          const user2_request_wallet = await userWalletModel.findOne({
            where: {
              user_id: user2_id,
              wallet_type: exchange_currency,
            },
          });
          const user2_exchange_wallet = await userWalletModel.findOne({
            where: {
              user_id: user2_id,
              wallet_type: req_currency,
            },
          });

          const wallet1_balance = await currencyConvert({
            currency: ["USD"],
            sourceCurrency: user1_exchange_wallet.dataValues.wallet_type,
            amount: user1_exchange_wallet.dataValues.amount,
            fixedDecimal: true,
          });

          const wallet2_balance = await currencyConvert({
            currency: ["USD"],
            sourceCurrency: user2_exchange_wallet.dataValues.wallet_type,
            amount: user2_exchange_wallet.dataValues.amount,
            fixedDecimal: true,
          });

          console.log("wallet_1", wallet1_balance, "wallet_2", wallet2_balance);

          if (wallet1_balance[0].amount < Number(amount_in_usd)) {
            throw {
              message: `balance in your ${exchange_currency} wallet is not enough to make exchange of ${amount_in_usd}$.`,
              ignore: true,
            };
          } else if (wallet2_balance[0].amount < Number(amount_in_usd)) {
            throw {
              message: `balance in ${user2_name}'s ${req_currency} wallet is not enough to make exchange of ${amount_in_usd}$.`,
              ignore: true,
            };
          }

          const decimal1 =
            user1_exchange_wallet.dataValues.currency_type === "FIAT" ? 2 : 8;
          const decimal2 =
            user2_exchange_wallet.dataValues.currency_type === "FIAT" ? 2 : 8;

          const req_amount = (
            Number(amount_in_usd) / wallet2_balance[0].transferRate
          ).toFixed(decimal2);

          const exchange_amount = (
            Number(amount_in_usd) / wallet1_balance[0].transferRate
          ).toFixed(decimal1);

          /**
           *
           * User 1 Wallet and transaction updates
           *
           */

          await userWalletModel.update(
            {
              amount:
                user1_request_wallet.dataValues.amount + Number(req_amount),
              wallet_type: req_currency,
            },
            {
              where: {
                wallet_id: user1_request_wallet.dataValues.wallet_id,
              },
              transaction,
            }
          );

          const user1Payload1 = {
            id: crypto.randomUUID(),
            wallet_id: user1_request_wallet.dataValues.wallet_id,
            user_id: userData.user_id,
            payment_mode: "CRYPTO",
            base_amount: req_amount,
            base_currency: req_currency,
            transaction_reference: id,
            transaction_type: "CREDIT",
            status: "success",
          };
          console.log(user1Payload1);

          await selfTransactionModel.create(
            { ...user1Payload1 },
            { transaction }
          );

          await userWalletModel.update(
            {
              amount:
                user1_exchange_wallet.dataValues.amount -
                Number(exchange_amount),
              wallet_type: exchange_currency,
            },
            {
              where: {
                wallet_id: user1_exchange_wallet.dataValues.wallet_id,
              },
              transaction,
            }
          );

          const user1Payload2 = {
            id: crypto.randomUUID(),
            wallet_id: user1_exchange_wallet.dataValues.wallet_id,
            user_id: userData.user_id,
            payment_mode: "CRYPTO",
            base_amount: exchange_amount,
            base_currency: exchange_currency,
            transaction_reference: id,
            transaction_type: "DEBIT",
            status: "success",
          };
          console.log(user1Payload2);

          await selfTransactionModel.create(
            { ...user1Payload2 },
            { transaction }
          );

          /**
           *
           * User 1 Wallet and transaction updates
           *
           */

          /**
           *
           * User 2 Wallet and transaction updates
           *
           */

          await userWalletModel.update(
            {
              amount:
                user2_request_wallet.dataValues.amount +
                Number(exchange_amount),
              wallet_type: exchange_currency,
            },
            {
              where: {
                wallet_id: user2_request_wallet.dataValues.wallet_id,
              },
              transaction,
            }
          );

          const user2Payload1 = {
            id: crypto.randomUUID(),
            wallet_id: user2_request_wallet.dataValues.wallet_id,
            user_id: user2_id,
            payment_mode: "CRYPTO",
            base_amount: exchange_amount,
            base_currency: exchange_currency,
            transaction_reference: id,
            transaction_type: "CREDIT",
            status: "success",
          };
          console.log(user2Payload1);

          await selfTransactionModel.create(
            { ...user2Payload1 },
            { transaction }
          );

          await userWalletModel.update(
            {
              amount:
                user2_exchange_wallet.dataValues.amount - Number(req_amount),
              wallet_type: req_currency,
            },
            {
              where: {
                wallet_id: user2_exchange_wallet.dataValues.wallet_id,
              },
              transaction,
            }
          );

          const user2Payload2 = {
            id: crypto.randomUUID(),
            wallet_id: user2_exchange_wallet.dataValues.wallet_id,
            user_id: user2_id,
            payment_mode: "CRYPTO",
            base_amount: req_amount,
            base_currency: req_currency,
            transaction_reference: id,
            transaction_type: "DEBIT",
            status: "success",
          };
          console.log(user2Payload2);

          await selfTransactionModel.create(
            { ...user2Payload2 },
            { transaction }
          );

          /**
           *
           * User 1 Wallet and transaction updates
           *
           */

          await userExchangeModel.update(
            {
              status: "successful",
            },
            {
              where: {
                transaction_id: id,
              },
              transaction,
            }
          );
          await deleteRedisItem("exchange-" + id);
          transaction.commit();
          successResponseHelper(res, 200, "exchange completed successfully!", {
            transaction_id: id,
            status: "successful",
          });
        } else {
          throw {
            message: "OTP did not match!.",
            ignore: true,
          };
        }
      }
    } else {
      const exchangeData = await userExchangeModel.findOne({
        where: {
          transaction_id: id,
        },
      });
      if (exchangeData.dataValues) {
        await userExchangeModel.update(
          {
            status: "expired",
          },
          {
            where: {
              transaction_id: id,
            },
          }
        );
      }
      throw {
        message: "This exchange is expired, please create a new exchange.",
        ignore: true,
      };
    }
  } catch (e) {
    console.log(e);
    const message = getErrorMessage(e);
    transaction.rollback();
    if (!e?.ignore) {
      walletLogger.error(
        message,
        { user_id: userData.user_id, email: userData.email },
        new Error(e)
      );
    }
    errorResponseHelper(res, 500, message);
  }
};

const getUserAnalytics = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const {
      periodType,
      year = new Date().getFullYear(),
      month = new Date().getMonth() + 1,
    } = req.body;

    const totalTransactionsIncoming = (
      await userTransactionModel.findAndCountAll({
        where: { user_id: userData.user_id },
      })
    ).count;

    const totalTransactionOutgoing = (
      await selfTransactionModel.findAndCountAll({
        where: {
          transaction_type: "DEBIT",
          user_id: userData.user_id,
        },
      })
    ).count;

    let where = "";
    if (periodType === "YEAR") {
      where = `where extract(year from ut."createdAt")=${year} and ut.user_id=${userData.user_id}`;
    } else if (periodType === "MONTH") {
      where = `where extract(year from ut."createdAt")=${year} and extract(month from ut."createdAt")=${month} and ut.user_id=${userData.user_id}`;
    } else {
      where = `where ut.user_id=${userData.user_id}`;
    }

    const popularCurrency = await sequelize.query(
      `select aw.wallet_type,count(ut.base_currency) as transaction_count,aw.currency_type from tbl_admin_wallet aw 
      left join tbl_user_transaction ut on  aw.wallet_type=ut.base_currency
      ${where} group by ut.base_currency,aw.wallet_type,aw.currency_type order by transaction_count desc`,
      { type: QueryTypes.SELECT }
    );

    const paymentSuccessRates = await sequelize.query(
      `select count(*) filter (where status='successful') as successful_payments,
      count(*) filter (where status = 'failed') as failed_payments,
	  count(*) filter (where status = 'pending') as pending_payments
    from tbl_user_transaction ut ${where}`,
      {
        type: QueryTypes.SELECT,
      }
    );

    const historicalTrends = {};

    const tempTrends: any[] = await sequelize.query(
      `select 
        to_char("createdAt", 'Month') as month_name,
		extract(month from "createdAt") as month,
        count(*) as invoice_count, 
        sum(base_amount) as amount,
		base_currency
      from tbl_user_transaction ut
      where ${where && `extract(year from ut."createdAt")=${year} and`
      } ut.user_id=${userData.user_id}
      group by month,month_name,base_currency 
      order by month`,
      {
        type: QueryTypes.SELECT,
      }
    );

    for (let i = 0; i < tempTrends.length; i++) {
      const keys = Object.keys(historicalTrends);
      if (keys.indexOf(tempTrends[i].month_name) !== -1) {
        const { month_name, ...restData } = tempTrends[i];
        const tempArray = [...historicalTrends[month_name]];
        historicalTrends[month_name] = [...tempArray, restData];
      } else {
        const { month_name, ...restData } = tempTrends[i];
        historicalTrends[month_name] = [restData];
      }
    }

    const revenue_performance = [];
    const totalIncome: any[] = await sequelize.query(
      `select base_currency,sum(base_amount) as amount from tbl_user_transaction ut ${where} group by base_currency`,
      { type: QueryTypes.SELECT }
    );
    const totalFee: any[] = await sequelize.query(
      `
      select wallet_type,sum(blockchain_fee) as fee_amount from tbl_user_temp_address ut ${where} group by wallet_type
      `,
      {
        type: QueryTypes.SELECT,
      }
    );

    for (let i = 0; i < totalIncome.length; i++) {
      const feeIndex = totalFee.findIndex(
        (x: any) => x.wallet_type === totalIncome[i]?.base_currency
      );
      const currencyData = await currencyConvert({
        sourceCurrency: totalIncome[i]?.base_currency,
        currency: ["USD"],
        amount: totalIncome[i].amount,
        fixedDecimal: true,
      });
      const { fee_amount } = totalFee[feeIndex];
      revenue_performance.push({
        ...totalIncome[i],
        amount_in_usd: currencyData[0].amount,
        fee_amount: Number(fee_amount).toFixed(8),
        fee_in_usd: Number(fee_amount * currencyData[0].transferRate).toFixed(
          2
        ),
      });
    }

    const returnData = {
      totalTransactionsIncoming,
      totalTransactionOutgoing,
      popularCurrency,
      paymentSuccessRates,
      historicalTrends,
      revenue_performance,
    };

    successResponseHelper(res, 200, "", returnData);
  } catch (e) {
    console.log(e);
    const message = getErrorMessage(e);
    walletLogger.error(
      message,
      { user_id: userData.user_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

async function updateOtp(userData, wallet_address, currency) {
  const randomNumberOTP = Math.floor(100000 + Math.random() * 900000);
  // Send email
  await mailTransporter({
    to: userData.email,
    name: userData.name,
    subject: "OTP for Wallet Address Validation",
    body: `You are validating a new wallet address: ${wallet_address} for ${currency} currency.\n
To proceed with adding this address, please provide this code: ${randomNumberOTP}\n
This code will expire in 5 minutes.`,
  });

  // Update OTP in DB
  await userModel.update(
    {
      verified_otp: randomNumberOTP.toString(),
      otp_expired: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
    },
    {
      where: { user_id: userData.user_id },
    }
  );

  return true;
}


const validateWallet = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { wallet_address, currency } = req.body;
    try {
      const user_id = userData.user_id;
      let balance;
      if (currency === "TRX" || currency === "USDT-TRC20") {
        balance = await tatumApi.validateTronAddress(wallet_address);
      } else {
        balance = await tatumApi.getAddressBalance(wallet_address, currency);
      }
      console.log(balance);
      // Check if the address already exists
      const existingWallet = await userWalletModel.findOne({
        where: {
          wallet_address: { [Op.not]: null },
          wallet_type: currency,
          user_id: user_id
        },
      });
      if (existingWallet) {
        return errorResponseHelper(
          res,
          400,
          `This address with ${currency} currency already exists!`
        );
      }

      await updateOtp(userData, wallet_address, currency);

      // Success response
      return successResponseHelper(
        res,
        200,
        "Address is a valid address and saved successfully!",
        { valid: true, wallet_address }
      );
    } catch (e) {
      errorResponseHelper(
        res,
        500,
        `please enter a valid ${currency} address!`
      );
    }
  } catch (e) {
    const message = getErrorMessage(e);
    walletLogger.error(
      message,
      { user_id: userData.user_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

const verifyOtp = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { otp, wallet_address, currency, currency_type } = req.body;

    if (!otp) {
      return errorResponseHelper(res, 400, "OTP is required!");
    }
    const user_id = userData.user_id;

    // Find the wallet with OTP
    const walletWithOtp = await userModel.findOne({
      where: {
        user_id: user_id,
        verified_otp: otp,
      },
    });

    if (!walletWithOtp) {
      console.log("inside this");
      return errorResponseHelper(
        res,
        400,
        "Please enter a valid OTP!"
      );
    }

    // Check if OTP is expired
    if (new Date() > walletWithOtp.dataValues.otp_expired) {
      return errorResponseHelper(
        res,
        400,
        "OTP has expired! Please request a new one."
      );
    }

    // If OTP is valid, clear it and mark as verified
    await userModel.update(
      {
        verified_otp: null,
        otp_expired: null,
      },
      {
        where: {
          user_id: user_id,
        },
      }
    );

    await userWalletModel.update(
      {
        wallet_address
      },
      {
        where: {
          user_id,
          wallet_type: currency,
        },
      }
    );


    successResponseHelper(res, 200, "OTP verified successfully!", {
      verified: true,
    });
  } catch (e) {
    const message = getErrorMessage(e);
    walletLogger.error(
      message,
      { user_id: userData.user_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

const deleteWalletAddress = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { currency } = req.body;
    if (!currency || typeof currency !== "string") {
      return errorResponseHelper(res, 400, "Currency is required!");
    }

    const user_id = userData.user_id;

    await userWalletModel.update(
      { wallet_address: null },
      {
        where: {
          user_id,
          wallet_type: currency,
        },
      }
    );

    return successResponseHelper(res, 200, "Wallet address removed successfully!", {
      removed: true,
      currency,
    });
  } catch (e) {
    const message = getErrorMessage(e);
    walletLogger.error(
      message,
      { user_id: userData.user_id, email: userData.email },
      new Error(e)
    );
    return errorResponseHelper(res, 500, message);
  }
};

export default {
  getWallet,
  addFunds,
  authStep,
  verifyPayment,
  estimateFees,
  getCurrencyRates,
  verifyCryptoPayment,
  getWalletTransactions,
  confirmPayment,
  getAllTransactions,
  sendConfirmationOTP,
  withdrawAssets,
  getWalletAddresses,
  addWalletAddress,
  exchangeCreate,
  getExchange,
  confirmExchange,
  getUserAnalytics,
  validateWallet,
  verifyOtp,
  deleteWalletAddress,
};
