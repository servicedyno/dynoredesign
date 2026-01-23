import express from "express";
import {
  currencyConvert,
  decrypt,
  encrypt,
  errorResponseHelper,
  getErrorMessage,
  sendEmail,
  successResponseHelper,
} from "../helper";
import { apiLogger, cronLogger, webhookLogs } from "../utils/loggers";
import {
  deleteRedisItem,
  getRedisItem,
  setRedisItem,
} from "../utils/redisInstance";
import sequelize from "../utils/dbInstance";
import { QueryTypes } from "sequelize";
import jwt from "jsonwebtoken";
import {
  adminFeeModel,
  adminFeeTransactionModel,
  adminWalletModel,
  companyModel,
  customerModel,
  customerTransactionModel,
  customerWalletModel,
  userModel,
  userWalletModel,
} from "../models";
import {
  FW_API_Response,
  IFundData,
  ITemporaryAddress,
  IUserType,
  IVerifyResponse,
} from "../utils/types";
import { paymentTypes } from "../utils/enums";
import flw from "../apis/flutterwaveApi";
import crypto from "crypto";
import axios from "axios";

import {
  userTempAddressModel,
  userTransactionModel,
  paymentLinkModel,
} from "../models";
import QR_Code from "qrcode";
import tatumApi from "../apis/tatumApi";
import blockchairApi from "../apis/blockchairApi";
import { getAdminWalletAddress } from "../utils/adminUtils";
import {
  getTransactionFee,
  getBlockchainFee,
  calculateTransactionFees,
} from ".";

const getData = async (req: express.Request, res: express.Response) => {
  try {
    const { data } = req.body;

    const item = await getRedisItem("customer-" + data);

    console.log("item=======>", item, data);
    let payload;
    if (item.pathType === "createLink") {
      payload = {
        amount: item.base_amount,
        base_currency: item.base_currency,
        token: await getLinkAccessToken(
          item.email,
          data,
          item.pathType,
          item.transaction_id
        ),
        payment_mode: item.pathType,
        allowedModes: item.allowedModes,
      };
    } else {
      payload = {
        amount: item.amount,
        base_currency: item.base_currency,
        token: await getAccessToken(item.customer_id, data),
        payment_mode: item.pathType,
      };
    }

    console.log(payload);
    successResponseHelper(res, 200, "", payload);
  } catch (e) {
    const message = getErrorMessage(e);
    apiLogger.error(message, new Error(e));
    errorResponseHelper(res, 500, "Sorry! No transaction found");
  }
};

const getLinkAccessToken = async (email, ref, pathType, id) => {
  const tokenSecret = process.env.ACCESS_TOKEN_SECRET;

  if (tokenSecret) {
    const token = jwt.sign({ email, ref, pathType, id }, tokenSecret);
    return token;
  }
};

const getAccessToken = async (id, ref) => {
  const user = await customerModel.findOne({
    where: {
      customer_id: id,
    },
  });

  const tokenSecret = process.env.ACCESS_TOKEN_SECRET;

  const { customer_id, company_id, ...userData } = user.dataValues;
  console.log(userData);
  if (tokenSecret) {
    const token = jwt.sign({ ...userData, ref, pathType: "" }, tokenSecret);
    return token;
  }
};

const addPayment = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;

  try {
    const { data } = req.body;
    const userData = jwt.decode(res.locals.token) as IUserType;
    if (data) {
      const value: IFundData = JSON.parse(decrypt(data));
      if (typeof value === "object") {
        let finalRes;
        const items = await getRedisItem("customer-" + userData.ref);
        if (value.paymentType === paymentTypes.CARD) {
          const { paymentRes, uniqueRef } = await cardPayment(value, userData);
          console.log(paymentRes);
          if (paymentRes.status !== "successful") {
            finalRes = { ...paymentRes.meta.authorization, hash: uniqueRef };
            if (paymentRes.meta.authorization.mode !== "redirect") {
              await setRedisItem(uniqueRef, {
                ...items,
                hash: data,
                mode: paymentTypes.CARD,
              });
            } else {
              await setRedisItem(uniqueRef, {
                ...items,
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
          await setRedisItem(uniqueRef, {
            ...items,
            mode: paymentTypes.BANK_TRANSFER,
          });
        }

        if (value.paymentType === paymentTypes.USSD) {
          const { paymentRes, uniqueRef } = await USSD(value, userData);
          console.log("paymentRes=============>", paymentRes, uniqueRef);
          const { note } = paymentRes.meta.authorization;
          const { payment_code } = paymentRes.data;
          finalRes = { hash: uniqueRef, note, payment_code };
          await setRedisItem(uniqueRef, {
            ...items,
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
          await setRedisItem(uniqueRef, {
            ...items,
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
          await setRedisItem(uniqueRef, {
            ...items,
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
          await setRedisItem(uniqueRef, {
            ...items,
            mode: paymentTypes.QR_CODE,
          });
        }
        if (value.paymentType === paymentTypes.WALLET) {
          const status = await userWallet(value, userData);

          await setRedisItem("customer-" + userData.ref, {
            ...items,
            mode: paymentTypes.WALLET,
            status: status ? "successful" : "failed",
            paid_amount: value.amount,
            paid_currency: value.currency,
            id: userData.ref,
          });

          finalRes = {
            status: status ? "successful" : "failed",
            txRef: "customer-" + userData.ref,
          };
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
          await setRedisItem(uniqueRef, {
            ...items,
            mode: value.paymentType,
          });
        }
        if (value.paymentType === paymentTypes.CRYPTO) {
          const { paymentRes, uniqueRef } = await Crypto(value, {
            ...userData,
            adm_id: items.adm_id,
            customer_id: items.customer_id,
          });
          console.log("paymentRes=============>", paymentRes, uniqueRef);
          finalRes = { hash: uniqueRef, ...paymentRes };
          await setRedisItem("crypto-" + paymentRes.address, {
            mode: paymentTypes.CRYPTO,
            amount: value.amount,
            status: "pending",
            ref: uniqueRef,
            currency: value.currency,
            unique_tx_id: paymentRes.transaction_id,
            walletType: "customer",
            temp_id: paymentRes.temp_id,
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
    apiLogger.error(
      message,
      { customer_id: userData.customer_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

const createCryptoPayment = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const data: IFundData = req.body;
    if (data) {
      let finalRes;
      const items = await getRedisItem("customer-" + data.uniqueRef);

      const tokenData: any = {
        ref: data.uniqueRef,
        adm_id: items.adm_id,
        customer_id: items.customer_id,
      };
      const { paymentRes, uniqueRef } = await Crypto(data, tokenData, true);
      finalRes = { hash: uniqueRef, ...paymentRes };
      console.log("paymentRes=============>", paymentRes, uniqueRef, {
        mode: paymentTypes.CRYPTO,
        amount: data.amount,
        status: "pending",
        ref: uniqueRef,
        currency: data.currency,
        walletType: "customer",
      });

      await setRedisItem("crypto-" + paymentRes.address, {
        mode: paymentTypes.CRYPTO,
        amount: data.amount,
        status: "pending",
        ref: uniqueRef,
        currency: data.currency,
        unique_tx_id: paymentRes.transaction_id,
        walletType: "customer",
        temp_id: paymentRes.temp_id,
      });
      successResponseHelper(res, 200, "payment created! ", finalRes);
    } else {
      throw { message: "Please enter valid currency!" };
    }
  } catch (e) {
    console.log("####e", e);
    const message = getErrorMessage(e);
    apiLogger.error(
      message,
      { customer_id: userData.customer_id, email: userData.email },
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
        const tempData = await getRedisItem("customer-" + userData.ref);

        console.log(value.uniqueRef);
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
              await setRedisItem(uniqueRef, {
                flw_ref: paymentRes.data.flw_ref,
                ...tempData,
              });
            } else {
              await setRedisItem(uniqueRef, {
                id: paymentRes.data.id,
                ...tempData,
              });
            }
          } else if (paymentRes.data?.status === "successful") {
            finalRes = {
              flwRef: paymentRes.data.flw_ref,
              txRef: uniqueRef,
            };
          } else {
            finalRes = { ...paymentRes, txRef: uniqueRef };
          }
        }
      }

      successResponseHelper(res, 200, "fund ", finalRes);
    } else {
      throw { message: "Please enter valid data!" };
    }
  } catch (e) {
    console.log(e);
    const message = getErrorMessage(e);
    apiLogger.error(
      message,
      { customer_id: userData.customer_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

const verifyPayment = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { uniqueRef } = req.body;

    const tempData = await getRedisItem(uniqueRef);

    let finalRes;
    console.log(tempData, uniqueRef);
    const transactionId = tempData?.id;
    if (transactionId) {
      //   await deleteRedisItem(uniqueRef);
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
    apiLogger.error(
      message,
      { customer_id: userData.customer_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

const confirmPayment = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  const transaction = await sequelize.transaction();
  try {
    const { uniqueRef } = req.body;

    const tempData = await getRedisItem(uniqueRef);

    console.log(tempData, uniqueRef);
    const transactionId = tempData?.id;
    if (transactionId) {
      if (tempData?.pathType === "createLink") {
        const { data }: IVerifyResponse = await flw.Transaction.verify({
          id: transactionId,
        });
        console.log(data);

        const linkData = (
          await paymentLinkModel.findOne({
            where: { transaction_id: tempData?.transaction_id },
          })
        ).dataValues;

        const walletData = await userWalletModel.findOne({
          where: {
            user_id: Number(linkData.user_id),
            wallet_type: data.currency,
          },
          transaction,
        });

        const transaction_fee = await getTransactionFee();
        const blockchain_fee = await getBlockchainFee();
        const platformCharge = (data.amount * Number(transaction_fee)) / 100;
        const blockchainCharge = (data.amount * Number(blockchain_fee)) / 100;

        await adminWalletModel.increment("fee", {
          by: platformCharge + blockchainCharge,
          where: { wallet_type: data.currency },
        });

        await userWalletModel.update(
          {
            amount: Number(
              walletData.dataValues.amount +
              data.amount_settled -
              platformCharge -
              blockchainCharge
            ).toFixed(2),
          },
          {
            where: {
              wallet_id: walletData.dataValues.wallet_id,
            },
            transaction,
          }
        );
        // await adminWalletModel.increment("amount", {
        //   by: data.amount_settled - platformCharge,
        //   where: { wallet_type: data.currency },
        // });

        await paymentLinkModel.update(
          {
            paid_currency: data.currency,
            paid_amount: data.amount,
            status: data.status,
            wallet_id: walletData.dataValues.wallet_id,
            transaction_reference: data.flw_ref,
            payment_mode: tempData.mode,
          },
          {
            where: {
              transaction_id: tempData?.transaction_id,
            },
          }
        );

        transaction.commit();
        const returnData = {
          transaction_reference: data.flw_ref,
          status: data.status,
          redirect: false,
        };
        await deleteRedisItem(uniqueRef);
        successResponseHelper(res, 200, "transaction successful!", returnData);
      } else {
        const company_data = (
          await companyModel.findOne({
            where: { company_id: tempData.company_id },
          })
        ).dataValues;

        let product_name;

        if (tempData?.meta_data) {
          const meta_data = JSON.parse(tempData?.meta_data);
          product_name = meta_data?.product_name ?? meta_data?.product;
        }

        if (tempData.mode !== paymentTypes.WALLET) {
          const { data }: IVerifyResponse = await flw.Transaction.verify({
            id: transactionId,
          });
          console.log(data);

          const customerPayload = {
            id: crypto.randomUUID(),
            company_id: Number(tempData.company_id),
            customer_id: Number(tempData.customer_id),
            payment_mode: tempData.mode,
            base_amount: Number(tempData.amount).toFixed(2),
            base_currency: tempData.base_currency,
            paid_amount: data.amount.toFixed(2),
            paid_currency: data.currency,
            transaction_reference: data.flw_ref,
            transaction_type: tempData?.pathType.includes("addFund")
              ? "CREDIT"
              : "PAYMENT",
            ...(!tempData?.pathType.includes("addFund") && {
              transaction_details: product_name
                ? "Made payment for " +
                product_name +
                " on " +
                company_data?.company_name
                : "Made payment for " +
                (company_data?.company_name || "Company") +
                " product",
            }),
            status: data.status,
          };

          const walletData = await userWalletModel.findOne({
            where: {
              user_id: Number(tempData.adm_id),
              wallet_type: data.currency,
            },
            transaction,
          });

          const transaction_fee = await getTransactionFee();
          const blockchain_fee = await getBlockchainFee();
          const platformCharge = (data.amount * Number(transaction_fee)) / 100;
          const blockchainCharge = (data.amount * Number(blockchain_fee)) / 100;

          await adminWalletModel.increment("fee", {
            by: platformCharge + blockchainCharge,
            where: { wallet_type: data.currency },
          });

          const customerWalletData = await customerWalletModel.findOne({
            where: {
              customer_id: Number(tempData.customer_id),
            },
          });

          await userWalletModel.update(
            {
              amount: Number(
                walletData.dataValues.amount +
                data.amount_settled -
                platformCharge -
                blockchainCharge
              ).toFixed(2),
            },
            {
              where: {
                wallet_id: walletData.dataValues.wallet_id,
              },
              transaction,
            }
          );

          const userPayload = {
            id: uniqueRef,
            wallet_id: walletData.dataValues.wallet_id,
            user_id: walletData.dataValues.user_id,
            payment_mode: tempData.mode,
            base_amount: (
              data.amount_settled -
              platformCharge -
              blockchainCharge
            ).toFixed(2),
            base_currency: data.currency,
            transaction_reference: data.flw_ref,
            transaction_type: "CREDIT",
            status: data.status,
            customer_id: Number(tempData.customer_id),
          };

          await customerTransactionModel.create(
            { ...customerPayload },
            { transaction }
          );
          await userTransactionModel.create(
            { ...userPayload },
            { transaction }
          );
          if (tempData?.pathType.includes("addFund")) {
            await customerWalletModel.update(
              {
                amount: Number(
                  customerWalletData.dataValues.amount + Number(tempData.amount)
                ).toFixed(2),
              },
              {
                where: {
                  customer_id: Number(tempData.customer_id),
                },
                transaction,
              }
            );
          }
          transaction.commit();

          const redirect_uri =
            tempData.redirect_uri +
            `?transaction_id=${customerPayload.id}&status=${customerPayload.status
            }&meta_data=${tempData?.meta_data ?? null}&payment_type=${tempData.mode
            }`;

          const returnData = {
            transaction_id: customerPayload.id,
            status: customerPayload.status,
            redirect: true,
            redirect_uri,
          };
          await deleteRedisItem(uniqueRef);
          successResponseHelper(
            res,
            200,
            "transaction successful!",
            returnData
          );
        } else {
          const customerPayload = {
            id: crypto.randomUUID(),
            company_id: Number(tempData.company_id),
            customer_id: Number(tempData.customer_id),
            payment_mode: tempData.mode,
            base_amount: Number(tempData.amount).toFixed(2),
            base_currency: tempData.base_currency,
            paid_amount: Number(tempData.paid_amount).toFixed(2),
            paid_currency: tempData.paid_currency,
            transaction_reference: tempData.id,
            transaction_type: "DEBIT",
            transaction_details: product_name
              ? "Made payment for " +
              product_name +
              " on " +
              company_data?.company_name
              : "Made payment for " +
              (company_data?.company_name || "Company") +
              " product",

            status: tempData.status,
          };

          await customerTransactionModel.create(
            { ...customerPayload },
            { transaction }
          );

          transaction.commit();
          const redirect_uri =
            tempData.redirect_uri +
            `?transaction_id=${customerPayload.id}&status=${customerPayload.status
            }&meta_data=${tempData?.meta_data ?? null}&payment_type=${tempData.mode
            }`;

          const returnData = {
            transaction_id: customerPayload.id,
            status: customerPayload.status,
            redirect: true,
            redirect_uri,
          };
          await deleteRedisItem(uniqueRef);
          successResponseHelper(
            res,
            200,
            "transaction successful!",
            returnData
          );
        }
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
    apiLogger.error(
      message,
      { customer_id: userData.customer_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

const cardPayment = async (
  data: IFundData,
  tokenData: IUserType,
  revalidate = false
) => {
  const expiry = data.expiry.split("/");
  const uniqueRef = "customer-" + tokenData.ref;
  console.log("from card=============>", data);
  const payload = {
    card_number: data.number,
    expiry_month: expiry[0],
    expiry_year: expiry[1],
    cvv: data.cvc,
    currency: data.currency ?? "USD",
    amount: data.amount,
    email: tokenData.email,
    fullname: tokenData?.customer_name,
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
    redirect_url: process.env.CHECKOUT_URL + "/pay/verify",
  };

  console.log("payload==========>", payload);

  const paymentRes: FW_API_Response = await flw.Charge.card(payload);

  return { paymentRes, uniqueRef };
};

const bankTransfer = async (data: IFundData, tokenData: IUserType) => {
  const uniqueRef = "customer-" + tokenData.ref;
  const payload = {
    currency: data.currency,
    amount: data.amount,
    email: tokenData.email,
    fullname: tokenData?.customer_name,
    tx_ref: uniqueRef,
  };

  console.log("payload==========>", payload);

  const paymentRes: FW_API_Response = await flw.Charge.bank_transfer(payload);

  return { paymentRes, uniqueRef };
};

const bankAccount = async (data: IFundData, tokenData: IUserType) => {
  const uniqueRef = "customer-" + tokenData.ref;
  const payload = {
    currency: data.currency,
    amount: data.amount,
    email: tokenData.email,
    fullname: tokenData?.customer_name,
    tx_ref: uniqueRef,
  };

  console.log("payload==========>", payload);

  let paymentRes: FW_API_Response;

  if (payload.currency === "NGN") {
    paymentRes = await flw.Charge.ng(payload);
  } else {
    try {
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
    } catch (e) {
      console.log(e);
    }
  }

  return { paymentRes, uniqueRef };
};

const googleApplePay = async (data: IFundData, tokenData: IUserType) => {
  const uniqueRef = "customer-" + tokenData.ref;
  const payload = {
    currency: data.currency,
    amount: data.amount,
    email: tokenData.email,
    fullname: tokenData?.customer_name,
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
  const uniqueRef = "customer-" + tokenData.ref;
  const payload = {
    currency: "NGN",
    account_bank: data.account_number,
    amount: data.amount,
    email: tokenData.email,
    fullname: tokenData?.customer_name,
    tx_ref: uniqueRef,
  };

  console.log("payload==========>", payload);

  const paymentRes = await flw.Charge.ussd(payload);

  return { paymentRes, uniqueRef };
};

const MobileMoney = async (data: IFundData, tokenData: IUserType) => {
  const uniqueRef = "customer-" + tokenData.ref;
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
    phone_number: data?.mobile,
    fullname: tokenData?.customer_name,
    tx_ref: uniqueRef,
    ...(data.currency !== "KES" && {
      redirect_url: process.env.CHECKOUT_URL + "/pay/verify",
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
  const uniqueRef = "customer-" + tokenData.ref;
  const payload = {
    currency: "NGN",
    amount: data.amount,
    email: tokenData.email,
    phone_number: tokenData?.mobile,
    fullname: tokenData?.customer_name,
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

const Crypto = async (
  data: IFundData,
  tokenData: IUserType,
  onlyCrypto = false
) => {
  const uniqueRef = "customer-" + tokenData.ref;
  const currency = data.currency;
  const walletDetails = await (
    await adminWalletModel.findOne({
      where: {
        wallet_type: currency,
      },
    })
  ).dataValues;

  if (Object.keys(walletDetails).length > 0) {
    const decrytedData = await tatumApi.decryptSymmetric(
      walletDetails.xpub_mnemonic,
      process.env.XPUB_KEY_ID
    );
    const walletData = JSON.parse(decrytedData);

    const userXPub = walletData.xpub;
    const userMnemonic = walletData.mnemonic;
    const latestIndex = Number(walletDetails.last_index) + 1;

    let { address, privateKey } = await tatumApi.generateUserAddress({
      currency,
      xpub: userXPub,
      index: latestIndex,
      mnemonic: userMnemonic,
    });

    if (currency === "BCH") {
      address = address.split(":")[1];
      console.log(address);
    }

    console.log("address: ", address);

    const { id } = await tatumApi.createSubscription(
      address,
      walletDetails.wallet_type,
      onlyCrypto
    );

    const cipherText = await tatumApi.encryptSymmetric(
      privateKey,
      process.env.TEMP_KEY_ID
    );

    const tempPayload = {
      user_id: tokenData.adm_id,
      wallet_type: walletDetails.wallet_type,
      wallet_address: address,
      subscription_id: id,
      privateKey: cipherText,
    };

    const tempData = await userTempAddressModel.create({ ...tempPayload });

    let qr_code;

    if (address) {
      const url = await QR_Code.toDataURL(address, {
        width: 300,
      });
      qr_code = url;
    }
    const userPayload = {
      id: crypto.randomUUID(),
      wallet_id: walletDetails.wallet_id,
      user_id: tokenData.adm_id,
      payment_mode: "CRYPTO",
      base_amount: data.amount,
      base_currency: currency,
      transaction_type: "CREDIT",
      status: "pending",
      customer_id: Number(tokenData.customer_id),
    };
    console.log(userPayload);

    await userTransactionModel.create({ ...userPayload });
    await adminWalletModel.update(
      {
        last_index: latestIndex,
      },
      {
        where: {
          wallet_id: walletDetails.wallet_id,
        },
      }
    );
    const paymentRes = {
      qr_code,
      address: address,
      transaction_id: userPayload.id,
      temp_id: tempData.dataValues.temp_id,
    };

    return { paymentRes, uniqueRef };
  } else {
    throw { message: "Please enter valid currency!" };
  }
};

const settleCryptoTransaction = async ({
  tempAddressData,
  receivedAmount,
  currency,
  transactionId,
  userAmount,
  userAddress,
}: {
  tempAddressData: any;
  receivedAmount: number;
  currency: string;
  transactionId: string;
  userAmount?: number;
  userAddress?: string;
}) => {
  try {
    const adminWalletAddress = getAdminWalletAddress(currency);

    if (!adminWalletAddress) {
      throw new Error(
        `Admin wallet address not configured for ${currency} in environment variables.`
      );
    }

    const privateKey = await tatumApi.decryptSymmetric(
      tempAddressData.privateKey,
      process.env.TEMP_KEY_ID
    );

    let fees;
    let adminSendAmount = Number(receivedAmount);
    let adminTransactionDetails;
    let userTransactionDetails;
    let totalBlockchainFee = 0;

    if (currency === "USDT-TRC20" || currency === "USDT-ERC20") {
      const wallet_type = currency === "USDT-ERC20" ? "ETH" : "TRX";
      const adminFeeWallet = await adminFeeModel.findOne({
        where: { wallet_type },
      });

      if (!adminFeeWallet) {
        throw new Error(
          `Admin fee wallet not found for ${wallet_type}.`
        );
      }

      let feeAmount;
      if (currency === "USDT-ERC20") {
        const usdtFees = await tatumApi.feeEstimation(
          currency,
          tempAddressData.wallet_address,
          adminWalletAddress,
          Number(receivedAmount),
          process.env.ETH_CONTRACT
        );
        feeAmount = Number(Number(usdtFees?.fast)).toFixed(8);

        fees = await tatumApi.feeEstimation(
          "ETH",
          adminFeeWallet.dataValues.wallet_address,
          tempAddressData.wallet_address,
          Number(feeAmount)
        );
      } else {
        feeAmount = 50;
        fees = null;
      }

      const requiredBalance = Number(feeAmount) + Number(fees?.slow ?? 0);
      if (adminFeeWallet.dataValues.amount < requiredBalance) {
        const errorMsg = `CRITICAL: Insufficient ${wallet_type} in admin fee wallet. Required: ${requiredBalance}, Available: ${adminFeeWallet.dataValues.amount}. Payment sweep paused.`;
        apiLogger.error(errorMsg);
        throw new Error(errorMsg);
      }

      const adminPrivateKey = await tatumApi.decryptSymmetric(
        adminFeeWallet.dataValues.privateKey,
        process.env.TEMP_KEY_ID
      );

      const feeTransaction = await tatumApi.assetToOtherAddress({
        currency: wallet_type,
        fromAddress: adminFeeWallet.dataValues.wallet_address,
        toAddress: tempAddressData.wallet_address,
        privateKey: adminPrivateKey,
        amount: feeAmount,
        fee: fees,
      });

      let usd;
      try {
        const finalAmount = await currencyConvert({
          sourceCurrency: wallet_type,
          currency: ["USD"],
          amount: requiredBalance,
          fixedDecimal: false,
        });
        usd = Number(Number(finalAmount[0].amount).toFixed(2));
      } catch (e) {
        console.log(e);
        usd = 0;
      }

      await adminFeeTransactionModel.create({
        wallet_address: tempAddressData.wallet_address,
        amount: requiredBalance,
        amount_in_usd: usd,
        wallet_type,
        transaction_id: feeTransaction?.txId,
        status: "successful",
        blockchain_fee: fees?.slow ?? 0,
        amount_to_be_paid: Number(receivedAmount),
      });

      await adminFeeModel.update(
        { amount: Number(adminFeeWallet.dataValues.amount - requiredBalance) },
        { where: { wallet_type } }
      );

      await new Promise((resolve) => setTimeout(resolve, 3000));

      adminTransactionDetails = await tatumApi.assetToOtherAddress({
        currency,
        fromAddress: tempAddressData.wallet_address,
        toAddress: adminWalletAddress,
        privateKey: privateKey,
        amount: Number(receivedAmount).toString(),
        fee: currency === "USDT-TRC20" ? 50 : null,
      });

      if (userAmount && userAmount > 0 && userAddress) {
        await new Promise((resolve) => setTimeout(resolve, 3000));

        userTransactionDetails = await tatumApi.assetToOtherAddress({
          currency,
          fromAddress: tempAddressData.wallet_address,
          toAddress: userAddress,
          privateKey: privateKey,
          amount: Number(userAmount).toString(),
          fee: currency === "USDT-TRC20" ? 50 : null,
        });
      }

      totalBlockchainFee = requiredBalance;
    } else {
      const canUseSingleUTXO = ["BTC", "LTC", "DOGE", "BCH"].includes(currency);

      if (canUseSingleUTXO && userAmount && userAmount > 0 && userAddress) {
        fees = await tatumApi.feeEstimation(
          currency,
          tempAddressData.wallet_address,
          adminWalletAddress,
          Number(receivedAmount) + Number(userAmount)
        );

        const totalAmount = Number(receivedAmount) + Number(userAmount);
        const feeToDeduct = fees?.fast ?? 0;
        adminSendAmount = Number(receivedAmount);
        const userSendAmount = Number(userAmount) - Number(feeToDeduct);

        const feeParam = String(fees.fast);

        adminTransactionDetails = await tatumApi.assetToOtherAddress({
          currency,
          fromAddress: tempAddressData.wallet_address,
          toAddress: adminWalletAddress,
          privateKey: privateKey,
          amount: adminSendAmount,
          fee: feeParam,
          fromUTXO: [
            {
              txHash: transactionId,
              index: 0,
            },
          ],
          toUTXO: [
            {
              address: adminWalletAddress,
              value: Number(adminSendAmount),
            },
            {
              address: userAddress,
              value: Number(userSendAmount),
            },
          ],
        });

        totalBlockchainFee = feeToDeduct;
      } else {
        fees = await tatumApi.feeEstimation(
          currency,
          tempAddressData.wallet_address,
          adminWalletAddress,
          Number(receivedAmount)
        );

        if (currency === "ETH" || currency === "TRX" || currency === "BSC") {
          adminSendAmount = Number(receivedAmount);
          totalBlockchainFee = 0;
        } else {
          adminSendAmount = Number(
            (Number(receivedAmount) - Number(fees?.fast)).toFixed(8)
          );
          totalBlockchainFee = fees?.fast ?? 0;
        }

        const feeParam =
          currency === "ETH" || currency === "TRX" || currency === "BSC"
            ? fees
            : String(fees.fast);

        adminTransactionDetails = await tatumApi.assetToOtherAddress({
          currency,
          fromAddress: tempAddressData.wallet_address,
          toAddress: adminWalletAddress,
          privateKey: privateKey,
          amount: adminSendAmount,
          fee: feeParam,
        });

        if (userAmount && userAmount > 0 && userAddress) {
          const userFees = await tatumApi.feeEstimation(
            currency,
            tempAddressData.wallet_address,
            userAddress,
            Number(userAmount)
          );

          let userSendAmount;
          if (currency === "ETH" || currency === "TRX" || currency === "BSC") {
            userSendAmount = Number(
              (Number(userAmount) - Number(userFees?.slow)).toFixed(6)
            );
            totalBlockchainFee += userFees?.slow ?? 0;
          } else {
            userSendAmount = Number(
              (Number(userAmount) - Number(userFees?.fast)).toFixed(8)
            );
            totalBlockchainFee += userFees?.fast ?? 0;
          }

          const userFeeParam =
            currency === "ETH" || currency === "TRX" || currency === "BSC"
              ? userFees
              : String(userFees.fast);

          userTransactionDetails = await tatumApi.assetToOtherAddress({
            currency,
            fromAddress: tempAddressData.wallet_address,
            toAddress: userAddress,
            privateKey: privateKey,
            amount: userSendAmount,
            fee: userFeeParam,
          });
        }
      }
    }

    return {
      transactionDetails: adminTransactionDetails,
      userTransactionDetails,
      sendAmount: adminSendAmount,
      blockchainFee: totalBlockchainFee,
    };
  } catch (error) {
    const message = getErrorMessage(error);
    apiLogger.error(
      "Failed to transfer funds",
      {
        currency,
        tempAddress: tempAddressData.wallet_address,
        receivedAmount,
        error: message,
      },
      new Error(error)
    );
    throw error;
  }
};

const verifyCryptoPayment = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { address } = req.body;
    const result = await cryptoVerification(address, false);
    console.log("result===========>", result, address);
    const { message, status } = result;
    if (status === 500) {
      errorResponseHelper(res, status, message);
    } else {
      const returnData =
        typeof result === "object" && result !== null && "resData" in result
          ? (result as any).resData
          : result;
      successResponseHelper(res, status, "Success", returnData);
    }
  } catch (e) {
    const message = getErrorMessage(e);
    apiLogger.error(message, new Error(e));
    errorResponseHelper(res, 500, message);
  }
};

const cryptoVerification = async (address, webhook = true) => {
  const transaction = await sequelize.transaction();

  try {
    let customerData;
    const tempData = await getRedisItem("crypto-" + address);

    if (tempData && Object.keys(tempData).length > 0) {
      customerData = await getRedisItem(tempData?.ref);
    }
    const transactionId = tempData?.txId;
    const tempCurrency = tempData?.currency;

    if (transactionId) {
      // const adminWalletData = await adminWalletModel.findOne({
      //   where: { wallet_type: tempCurrency },
      // });

      const walletData = await userWalletModel.findOne({
        where: {
          user_id: customerData.adm_id,
          wallet_type: tempCurrency,
        },
        transaction,
      });
      console.log(walletData);
      const receivedAmount = tempData?.receivedAmount ?? tempData?.amount;

      let product_name;

      if (customerData?.meta_data) {
        const meta_data = JSON.parse(customerData?.meta_data);
        product_name = meta_data?.product_name ?? meta_data?.product;
      }

      const company_data = (
        await companyModel.findOne({
          where: { company_id: customerData.company_id },
        })
      ).dataValues;

      const finalAmount = await currencyConvert({
        sourceCurrency: tempData?.currency,
        currency: [customerData?.base_currency],
        amount: receivedAmount,
        fixedDecimal: false,
      });

      console.log("finalAmount=========>", finalAmount[0]);

      const customerPayload = {
        id: tempData?.incomplete
          ? tempData?.customerInternalRef
          : crypto.randomUUID(),
        company_id: Number(customerData.company_id),
        customer_id: Number(customerData.customer_id),
        payment_mode: "CRYPTO",
        base_amount: Number(finalAmount[0].amount).toFixed(2),
        base_currency: customerData.base_currency,
        paid_amount: Number(receivedAmount).toFixed(6),
        paid_currency: tempCurrency,
        transaction_reference: transactionId,
        transaction_type: customerData?.pathType.includes("addFund")
          ? "CREDIT"
          : "PAYMENT",
        ...(!customerData?.pathType.includes("addFund") && {
          transaction_details: product_name
            ? "Made payment for " + product_name + " on " + company_data?.company_name
            : "Made payment for " + (company_data?.company_name || "Company") + " product",
        }),
        status: tempData.status,
      };

      await customerTransactionModel.create(
        { ...customerPayload },
        { transaction }
      );

      let tempAddressData;
      if (tempData.temp_id) {
        tempAddressData = await userTempAddressModel.findOne({
          where: { temp_id: tempData.temp_id },
        });
      } else {
        const tempAddressDataArray = await userTempAddressModel.findAll({
          where: {
            wallet_address: address,
            wallet_type: tempCurrency,
          },
        });
        tempAddressData = tempAddressDataArray[tempAddressDataArray.length - 1].dataValues;
      }

      const isFullPayment = Number(receivedAmount) >= Number(tempData?.amount);
      const isPartialPayment = Number(receivedAmount) < Number(tempData?.amount) && !webhook;

      if (isPartialPayment) {
        const pendingAmount = (Number(tempData?.amount) - Number(receivedAmount)).toFixed(8);

        await userTempAddressModel.update(
          {
            txId: tempAddressData.txId ? tempAddressData.txId + "," + transactionId : transactionId,
            status: "partial",
            amount: receivedAmount,
            partial_payment_timestamp: tempAddressData.partial_payment_timestamp ?? new Date(),
          },
          { where: { temp_id: tempAddressData.temp_id } }
        );

        const { txId, ...rest } = tempData;
        const redisPayload = {
          ...rest,
          amount: pendingAmount,
          previousAmount: receivedAmount,
          previousTxId: transactionId,
          customerInternalRef: customerPayload.id,
          userInternalRef: tempData.unique_tx_id,
          incomplete: "true",
          partialPaymentTimestamp: new Date().toISOString(),
        };

        await deleteRedisItem("crypto-" + address);
        await setRedisItem("crypto-" + address, redisPayload);

        transaction.commit();

        throw {
          status: 200,
          paymentStatus: "incomplete",
          amount: pendingAmount,
          currency: tempCurrency,
          message: `Partial payment detected! Please pay remaining ${pendingAmount} ${tempCurrency} to complete this payment. You have 30 minutes to complete the payment.`,
          commit: true,
        };
      }

      if (isFullPayment || webhook) {
        const totalAmountReceived = tempData?.incomplete && tempData?.previousAmount
          ? Number(tempData.previousAmount) + Number(receivedAmount)
          : Number(receivedAmount);

        const { totalDeduction, minForwarding } = await calculateTransactionFees(
          tempCurrency,
          Number(totalAmountReceived)
        );

        let adminAmountToSend, userAmountToSend;
        if (Number(totalAmountReceived) < Number(minForwarding)) {
          adminAmountToSend = Number(totalAmountReceived);
          userAmountToSend = 0;
        } else {
          adminAmountToSend = Number(totalDeduction);
          userAmountToSend = Number(totalAmountReceived) - Number(totalDeduction);
        }

        const adminTransferResult = await settleCryptoTransaction({
          tempAddressData: tempAddressData,
          receivedAmount: Number(adminAmountToSend),
          currency: tempCurrency,
          transactionId,
          ...(userAmountToSend > 0 && {
            userAmount: Number(userAmountToSend),
            userAddress: walletData.dataValues.wallet_address,
          }),
        });

        await adminWalletModel.increment("fee", {
          by: adminAmountToSend,
          where: { wallet_type: tempCurrency },
        });

        const allTxIds = tempAddressData.txId
          ? tempAddressData.txId + "," + transactionId
          : transactionId;

        await userTempAddressModel.update(
          {
            status: "successful",
            txId: allTxIds,
            adminTxId: adminTransferResult.transactionDetails?.txId,
            admin_status: "successful",
            blockchain_fee: adminTransferResult.blockchainFee,
            amount: 0,
          },
          {
            where: { temp_id: tempAddressData.temp_id },
          }
        );

        if (userAmountToSend > 0) {
          await userWalletModel.increment("amount", {
            by: Number(userAmountToSend),
            where: {
              wallet_id: walletData.dataValues.wallet_id,
            },
            transaction,
          });

          const userPayload = {
            wallet_id: walletData.dataValues.wallet_id,
            user_id: customerData.adm_id,
            payment_mode: tempData.mode,
            base_amount: Number(userAmountToSend).toFixed(8),
            base_currency: tempCurrency,
            transaction_reference: allTxIds,
            transaction_type: "CREDIT",
            status: "successful",
            customer_id: Number(customerData.customer_id),
          };

          if (tempData?.incomplete) {
            await userTransactionModel.create({
              ...userPayload,
              id: tempData.unique_tx_id,
            }, { transaction });
          } else {
            await userTransactionModel.update(
              { ...userPayload },
              { where: { id: tempData.unique_tx_id }, transaction }
            );
          }
        }

        let overPayment = false;
        let newAmount = [{ amount: 0 }];
        const tempAmount = Number(receivedAmount) - Number(tempData?.amount);
        if (tempAmount > 0) {
          newAmount = await currencyConvert({
            sourceCurrency: tempCurrency,
            currency: ["USD"],
            amount: tempAmount,
            fixedDecimal: true,
          });
          if (newAmount[0].amount > 5) {
            overPayment = true;
          }
        }

        if (customerData?.pathType.includes("addFund") || overPayment) {
          if (customerData?.pathType.includes("createPayment") && overPayment) {
            await tatumApi.deleteSubscription(tempAddressData.subscription_id);
            await transaction.commit();
            await deleteRedisItem("crypto-" + address);
            throw {
              status: 200,
              paymentStatus: "overpayment",
              amount: tempAmount,
              currency: tempCurrency,
              message: `Overpayment detected!`,
              commit: false,
            };
          } else if (customerData?.pathType.includes("cryptoPayment") && overPayment) {
            await customerWalletModel.increment("amount", {
              by: Number(newAmount[0].amount),
              where: { customer_id: Number(customerData.customer_id) },
              transaction,
            });
          } else {
            const finalAmount = await currencyConvert({
              sourceCurrency: tempCurrency,
              currency: [customerData?.base_currency],
              amount: totalAmountReceived,
              fixedDecimal: false,
            });
            await customerWalletModel.increment("amount", {
              by: Number(finalAmount[0].amount),
              where: { customer_id: Number(customerData.customer_id) },
              transaction,
            });
          }
        }

        await tatumApi.deleteSubscription(tempAddressData.subscription_id);
        await transaction.commit();
        await deleteRedisItem(tempData.ref);
        await deleteRedisItem("crypto-" + address);

        if (webhook) {
          const { company_id, customer_id, ...transferDetails } = customerPayload;
          let count = 0, success = false;
          while (count < 3 && !success) {
            count += 1;
            try {
              await callWebHook(customerData, transferDetails);
              await timer(2500);
              success = true;
            } catch (e) {
              const message = getErrorMessage(e);
              webhookLogs.error(message, { customerData, transferDetails }, new Error(e));
            }
          }
        } else {
          let resData;
          if (customerData?.redirect_uri) {
            resData = customerData.redirect_uri +
              `?transaction_id=${customerPayload.id}&status=${customerPayload.status}&meta_data=${customerData?.meta_data ?? null}&payment_type=CRYPTO`;
          } else {
            resData = {
              transaction_id: customerPayload.id,
              transaction_reference: transactionId,
              status: customerPayload.status,
            };
          }

          return {
            status: 200,
            message: `Transaction ${customerPayload?.status}!`,
            paymentStatus: "complete",
            resData,
          };
        }

        const mailMessage = `Your company ${company_data?.company_name ?? ""} has received ${userAmountToSend} ${tempCurrency} from your customer.\n Here is the blockchain transaction reference for that transaction: ${transactionId}`;
        const userData = await (
          await userModel.findOne({
            where: { user_id: customerData.adm_id },
          })
        ).dataValues;

        await sendEmail(
          userData?.email,
          userData?.name,
          "Transaction Received",
          mailMessage
        );
      }
    } else {
      let currency = tempCurrency;
      if (!currency) {
        const data = await userTempAddressModel.findOne({
          where: { wallet_address: address },
        });
        currency = data.dataValues.wallet_type;
      }
      const paymentStatus = await tatumApi.getCurrentPaymentStatus(address, currency);
      transaction.rollback();
      return paymentStatus;
    }
  } catch (e) {
    const { commit, ...restData } = e;
    const message = getErrorMessage(e);
    if (e?.commit) {
      transaction.commit();
    } else {
      transaction.rollback();
      console.log(e);
    }
    apiLogger.error(message, new Error(e));
    return { status: e?.status ?? 500, message, resData: restData };
  }
};

const timer = (ms) => new Promise((res) => setTimeout(res, ms));

const callWebHook = async (customerData, transferDetails) => {
  await axios.post(
    customerData?.redirect_uri,
    {
      ...transferDetails,
      meta_data: customerData?.meta_data
        ? JSON.parse(customerData?.meta_data)
        : null,
    },
    {
      timeout: 30000,
    }
  );
  webhookLogs.log("info", "webhook sent successfully!", {
    redirect_uri: customerData?.redirect_uri,
    ...transferDetails,
    meta_data: customerData?.meta_data
      ? JSON.parse(customerData?.meta_data)
      : null,
  });
};

const userWallet = async (data: IFundData, tokenData: IUserType) => {
  const id = tokenData.id;
  const customer_id = (await customerModel.findOne({ where: { id } }))
    .dataValues.customer_id;
  const walletData = (
    await customerWalletModel.findOne({
      where: { customer_id },
    })
  ).dataValues;

  if (walletData.amount < data.amount) {
    throw { message: "Insufficient Balance!" };
  } else {
    await customerWalletModel.update(
      {
        amount: Number(Number(walletData.amount) - Number(data.amount)).toFixed(
          2
        ),
      },
      {
        where: { customer_id },
      }
    );
    return true;
  }
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
    console.log(currencyRateList);

    successResponseHelper(res, 200, "", currencyRateList);
  } catch (e) {
    const message = getErrorMessage(e);
    errorResponseHelper(res, 500, message);
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
    apiLogger.error(
      errorMessage,
      { id: userData.id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, errorMessage);
  }
};

const createPaymentLink = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as any;
  const { email, base_currency, modes, amount } = req.body;
  try {
    const uniqueRef = crypto.randomBytes(24).toString("hex");
    console.log("userData============>", userData);
    const payload = {
      transaction_id: crypto.randomUUID(),
      email,
      allowedModes: modes.join(","),
      base_amount: amount,
      base_currency: base_currency,
      user_id: userData.user_id,
      payment_link: process.env.CHECKOUT_URL + "pay?d=" + uniqueRef,
    };

    const links = await paymentLinkModel.create(payload);
    const redisPayload = {
      ...payload,
      pathType: "createLink",
    };

    console.log(redisPayload);

    await setRedisItem("customer-" + uniqueRef, redisPayload);

    successResponseHelper(res, 200, "Link Created Successfully!", links);
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    apiLogger.error(
      errorMessage,
      { id: userData.id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, errorMessage);
  }
};

const getPaymentLinks = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as any;
  try {
    console.log("userData============>", userData);
    const links = await paymentLinkModel.findAll({
      where: {
        user_id: userData.user_id,
      },
    });

    successResponseHelper(res, 200, "Link Fetched Successfully!", links);
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    apiLogger.error(
      errorMessage,
      { id: userData.id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, errorMessage);
  }
};

const deletePaymentLink = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as any;
  const link_id = req.params.id;
  try {
    const links = await paymentLinkModel.destroy({
      where: {
        user_id: userData.user_id,
        link_id,
      },
    });

    if (links < 1) {
      errorResponseHelper(res, 500, "Link not found!");
    } else {
      successResponseHelper(res, 200, "Link Deleted Successfully!", links);
    }
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    apiLogger.error(
      errorMessage,
      { id: userData.id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, errorMessage);
  }
};

const checkingUSDT = async () => {
  const USDT: ITemporaryAddress[] = await sequelize.query(
    `select ut.*,at.amount_to_be_paid from tbl_user_temp_address ut join tbl_admin_fee_transaction at
    on ut.wallet_address=at.wallet_address
    where ut.wallet_type in ('USDT-ERC20','USDT-TRC20') and ut.status='successful'
    and ut.admin_status='pending'
    `,
    {
      type: QueryTypes.SELECT,
    }
  );

  for (let i = 0; i < USDT.length; i++) {
    try {
      const currentAddress = USDT[i];
      const addressBalance = await tatumApi.getAddressBalance(
        currentAddress?.wallet_address,
        currentAddress.wallet_type
      );
      const userWallet = await (
        await userWalletModel.findOne({
          where: {
            wallet_type: currentAddress.wallet_type,
            user_id: currentAddress.user_id,
          },
        })
      ).dataValues;
      if (addressBalance?.balance && Number(addressBalance?.balance) > 0) {
        let fees;
        if (currentAddress?.wallet_type === "USDT-ERC20") {
          const data = await getRedisItem(
            "crypto-" + currentAddress?.wallet_address + "-fees_paid"
          );
          if (Object.keys(data).length > 0 && data?.gasPrice) {
            fees = data;
            await deleteRedisItem(
              "crypto-" + currentAddress?.wallet_address + "-fees_paid"
            );
          } else {
            fees = await tatumApi.feeEstimation(
              currentAddress?.wallet_type,
              currentAddress?.wallet_address,
              userWallet?.wallet_address,
              currentAddress?.amount_to_be_paid,
              process.env.ETH_CONTRACT
            );
          }
        }

        const privateKey = await tatumApi.decryptSymmetric(
          currentAddress.privateKey,
          process.env.TEMP_KEY_ID
        );
        const transactionDetails = await tatumApi.assetToOtherAddress({
          amount: currentAddress?.amount_to_be_paid,
          currency: currentAddress?.wallet_type,
          fee: fees,
          fromAddress: currentAddress?.wallet_address,
          privateKey: privateKey,
          toAddress: userWallet?.wallet_address,
        });
        await userTempAddressModel.update(
          {
            adminTxId: transactionDetails?.txId,
            admin_status: "successful",
          },
          {
            where: {
              temp_id: currentAddress?.temp_id,
            },
          }
        );
      }
    } catch (e) {
      console.log(e);
      const message = getErrorMessage(e);
      cronLogger.error(message, new Error(e));
    }
  }
};

const sendingLeftover = async () => {
  const USDTAddressBalance: ITemporaryAddress[] = await sequelize.query(
    `select ut.* from tbl_user_temp_address ut join tbl_admin_fee_transaction at
    on ut.wallet_address=at.wallet_address
    where ut.wallet_type in ('USDT-ERC20','USDT-TRC20') and ut.status='successful'
    and ut.admin_status='successful' and ut."createdAt" >= NOW() - INTERVAL '2 days' 
    `,
    {
      type: QueryTypes.SELECT,
    }
  );
  for (let i = 0; i < USDTAddressBalance.length; i++) {
    try {
      const currentAddress = USDTAddressBalance[i];

      const wallet_type =
        currentAddress?.wallet_type === "USDT-TRC20" ? "TRX" : "ETH";
      const addressBalance = await tatumApi.getAddressBalance(
        currentAddress?.wallet_address,
        wallet_type
      );
      const adminFeeWallet = await (
        await adminFeeModel.findOne({
          where: { wallet_type },
        })
      ).dataValues;
      if (addressBalance?.balance && Number(addressBalance?.balance) > 0) {
        let fees, sendAmount;
        if (wallet_type === "ETH") {
          fees = await tatumApi.feeEstimation(
            wallet_type,
            currentAddress?.wallet_address,
            adminFeeWallet?.wallet_address,
            addressBalance?.balance,
            process.env.ETH_CONTRACT
          );
          sendAmount = (
            Number(addressBalance?.balance) - Number(fees?.slow)
          ).toFixed(5);
        } else {
          sendAmount = Math.floor(addressBalance?.balance / 1000000);
        }
        if (sendAmount && sendAmount > 0) {
          const privateKey = await tatumApi.decryptSymmetric(
            currentAddress.privateKey,
            process.env.TEMP_KEY_ID
          );
          const transactionDetails = await tatumApi.assetToOtherAddress({
            amount: sendAmount,
            currency: wallet_type,
            fee: fees,
            fromAddress: currentAddress?.wallet_address,
            privateKey: privateKey,
            toAddress: adminFeeWallet?.wallet_address,
          });
          const finalAmount = await currencyConvert({
            sourceCurrency: wallet_type,
            currency: ["USD"],
            amount: sendAmount,
            fixedDecimal: false,
          });
          const usd = Number(Number(finalAmount[0].amount).toFixed(2));

          await adminFeeTransactionModel.create({
            wallet_address: currentAddress?.wallet_address,
            amount: sendAmount,
            amount_in_usd: usd,
            wallet_type,
            transaction_id: transactionDetails?.txId,
            status: "successful",
            blockchain_fee: fees?.slow ?? 0,
            transaction_type: "CREDIT",
            amount_to_be_paid: 0,
          });
        }
      }
    } catch (e) {
      console.log(e);
      const message = getErrorMessage(e);
      cronLogger.error(message, new Error(e));
    }
  }
};

const checkFeeBalance = async () => {
  try {
    const adminFeesWallets = await await adminFeeModel.findAll({
      attributes: { exclude: ["privateKey", "mnemonic", "xpub"] },
    });

    let textData = "";

    for (let i = 0; i < adminFeesWallets.length; i++) {
      const { feeLimit, wallet_type } = adminFeesWallets[i].dataValues;
      const currentBalance = await tatumApi.getAddressBalance(
        adminFeesWallets[i]?.dataValues.wallet_address,
        adminFeesWallets[i]?.dataValues.wallet_type
      );
      let amount = adminFeesWallets[i]?.dataValues.amount;
      let newBalance =
        adminFeesWallets[i]?.dataValues.wallet_type === "TRX"
          ? currentBalance?.balance / 1000000
          : currentBalance?.balance;
      console.log("newBalance=========>", newBalance);
      if (newBalance != adminFeesWallets[i]?.dataValues.amount) {
        amount = newBalance;
        await adminFeeModel.update(
          { amount },
          {
            where: {
              fee_wallet_id: adminFeesWallets[i]?.dataValues.fee_wallet_id,
            },
          }
        );
      }

      const tempData = await currencyConvert({
        currency: ["USD"],
        sourceCurrency: wallet_type,
        amount,
        fixedDecimal: true,
      });
      const amount_in_usd = tempData[0].amount;
      if (amount_in_usd < feeLimit) {
        textData += `\n Your ${wallet_type} fee wallet has low fee amount ($${amount_in_usd}) then limit of ($${feeLimit}).`;
      }
    }

    if (textData.length > 0) {
      let flag = true;
      const sentData = await getRedisItem("admin_fee_alert");
      if (sentData) {
        const { expiresAt } = sentData;
        if (new Date().getTime() < Number(expiresAt)) {
          flag = false;
        }
      }
      if (flag) {
        const adminData: any[] = await sequelize.query(
          "select email from tbl_admin",
          {
            type: QueryTypes.SELECT,
          }
        );
        const { email } = adminData[0];
        textData += `\n\n Please recharge as soon as possible.`;
        await sendEmail(
          email,
          "DynoCash Admin",
          "Low amount in Fee wallet",
          textData
        );
        const { alert_duration } = adminFeesWallets[0].dataValues;
        await setRedisItem("admin_fee_alert", {
          status: "sent",
          expiresAt:
            new Date().getTime() + Number(alert_duration) * 60 * 60 * 1000,
        });
      }
    }
  } catch (e) {
    console.log(e);
    const message = getErrorMessage(e);
    cronLogger.error(message, new Error(e));
  }
};

const checkOnBlockchair = async () => {
  try {
    const tempData: any[] = await sequelize.query(
      `select * from tbl_user_temp_address 
      where "createdAt"::date = CURRENT_DATE - INTERVAL '1 day' 
      and "createdAt" <= NOW() - INTERVAL '15 minutes' 
      and status='pending' and check_count=0`,
      { type: QueryTypes.SELECT }
    );
    if (tempData.length > 0) {
      for (let i = 0; i < tempData.length; i++) {
        const addressDetails = await blockchairApi.getAddressStatus(
          tempData[i].wallet_address,
          tempData[i].wallet_type
        );

        const items = await getRedisItem(
          "crypto-" + tempData[i].wallet_address
        );

        await userTempAddressModel.update(
          {
            check_count: 1,
          },
          {
            where: {
              temp_id: tempData[i].temp_id,
            },
          }
        );
      }
    } else {
      console.log("No pending transactions!");
    }
  } catch (e) {
    console.log(e);
    const message = getErrorMessage(e);
    cronLogger.error(message, new Error(e));
  }
};

const removeUnwantedSubscriptions = async () => {
  try {
    const tempData: any[] = await sequelize.query(
      `select subscription_id,temp_id from tbl_user_temp_address where "txId" is null 
    and "updatedAt" < NOW() - INTERVAL '1 day' and subscription_id is not null`,
      { type: QueryTypes.SELECT }
    );

    for (let i = 0; i < tempData.length; i++) {
      try {
        await tatumApi.deleteSubscription(tempData[i]?.subscription_id);
      } catch (e) {
        console.log(e);
      }
      await userTempAddressModel.update(
        {
          subscription_id: null,
        },
        {
          where: {
            temp_id: tempData[i].temp_id,
          },
        }
      );
    }
  } catch (e) {
    console.log(e);
    const message = getErrorMessage(e);
    cronLogger.error(message, new Error(e));
  }
};

const processIncompletePayments = async () => {
  try {
    const pendingTransactions: any[] = await sequelize.query(
      `SELECT * FROM tbl_user_temp_address 
       WHERE status = 'partial' 
       AND "txId" IS NOT NULL
       AND COALESCE(partial_payment_timestamp, "updatedAt") < NOW() - INTERVAL '30 minutes'`,
      { type: QueryTypes.SELECT }
    );

    if (pendingTransactions.length > 0) {
      console.log(`Found ${pendingTransactions.length} incomplete payments to process after 30-minutes grace period.`);

      for (const tempTx of pendingTransactions) {
        try {
          const balanceData = await tatumApi.getAddressBalance(
            tempTx.wallet_address,
            tempTx.wallet_type
          );

          const actualBalance = Number(balanceData?.balance || 0);

          if (actualBalance > 0) {
            console.log(`Additional balance found: ${actualBalance} ${tempTx.wallet_type}. Processing final sweep...`);

            const merchantWallet = await userWalletModel.findOne({
              where: {
                user_id: tempTx.user_id,
                wallet_type: tempTx.wallet_type,
              },
            });

            if (!merchantWallet) {
              throw new Error(`Merchant wallet not found for user ${tempTx.user_id}`);
            }

            const totalReceived = Number(tempTx.amount) + Number(actualBalance);

            const { totalDeduction, minForwarding } = await calculateTransactionFees(
              tempTx.wallet_type,
              totalReceived
            );

            let adminAmountToSend, userAmountToSend;
            if (Number(totalReceived) < Number(minForwarding)) {
              adminAmountToSend = Number(totalReceived);
              userAmountToSend = 0;
              console.log(`Total amount ${totalReceived} below threshold ${minForwarding}. Sending all to admin.`);
            } else {
              adminAmountToSend = Number(totalDeduction);
              userAmountToSend = Number(totalReceived) - Number(totalDeduction);
              console.log(`Splitting final amount: Admin=${adminAmountToSend}, Merchant=${userAmountToSend}`);
            }

            const result = await settleCryptoTransaction({
              tempAddressData: tempTx,
              receivedAmount: Number(adminAmountToSend),
              currency: tempTx.wallet_type,
              transactionId: tempTx.txId,
              ...(userAmountToSend > 0 && {
                userAmount: Number(userAmountToSend),
                userAddress: merchantWallet.dataValues.wallet_address,
              }),
            });

            await adminWalletModel.increment("fee", {
              by: adminAmountToSend,
              where: { wallet_type: tempTx.wallet_type },
            });

            await userTempAddressModel.update(
              {
                status: "completed_partial",
                admin_status: "successful",
                amount: totalReceived,
                adminTxId: result.transactionDetails?.txId,
                blockchain_fee: result.blockchainFee,
              },
              {
                where: { temp_id: tempTx.temp_id },
              }
            );

            if (userAmountToSend > 0) {
              await userWalletModel.increment("amount", {
                by: Number(userAmountToSend),
                where: {
                  wallet_id: merchantWallet.dataValues.wallet_id,
                },
              });

              await userTransactionModel.create({
                wallet_id: merchantWallet.dataValues.wallet_id,
                user_id: tempTx.user_id,
                payment_mode: "CRYPTO",
                base_amount: Number(userAmountToSend).toFixed(8),
                base_currency: tempTx.wallet_type,
                transaction_reference: tempTx.txId,
                transaction_type: "CREDIT",
                status: "completed_partial",
              });
            }

            if (tempTx.subscription_id) {
              try {
                await tatumApi.deleteSubscription(tempTx.subscription_id);
              } catch (e) {
                console.log(`Failed to delete subscription ${tempTx.subscription_id}:`, e.message);
              }
            }

            console.log(`Incomplete payment processed successfully for ${tempTx.wallet_address}`);
          } else {
            console.log(`No additional payment for ${tempTx.wallet_address}. Processing with existing amount ${tempTx.amount}`);

            const merchantWallet = await userWalletModel.findOne({
              where: {
                user_id: tempTx.user_id,
                wallet_type: tempTx.wallet_type,
              },
            });

            if (!merchantWallet) {
              throw new Error(`Merchant wallet not found for user ${tempTx.user_id}`);
            }

            const { totalDeduction, minForwarding } = await calculateTransactionFees(
              tempTx.wallet_type,
              Number(tempTx.amount)
            );

            let adminAmountToSend, userAmountToSend;
            if (Number(tempTx.amount) < Number(minForwarding)) {
              adminAmountToSend = Number(tempTx.amount);
              userAmountToSend = 0;
              console.log(`Amount ${tempTx.amount} below threshold. Sending all to admin.`);
            } else {
              adminAmountToSend = Number(totalDeduction);
              userAmountToSend = Number(tempTx.amount) - Number(totalDeduction);
              console.log(`Splitting partial amount: Admin=${adminAmountToSend}, Merchant=${userAmountToSend}`);
            }

            const result = await settleCryptoTransaction({
              tempAddressData: tempTx,
              receivedAmount: Number(adminAmountToSend),
              currency: tempTx.wallet_type,
              transactionId: tempTx.txId,
              ...(userAmountToSend > 0 && {
                userAmount: Number(userAmountToSend),
                userAddress: merchantWallet.dataValues.wallet_address,
              }),
            });

            await adminWalletModel.increment("fee", {
              by: adminAmountToSend,
              where: { wallet_type: tempTx.wallet_type },
            });

            await userTempAddressModel.update(
              {
                status: "incomplete_expired",
                admin_status: "successful",
                adminTxId: result.transactionDetails?.txId,
                blockchain_fee: result.blockchainFee,
              },
              {
                where: { temp_id: tempTx.temp_id },
              }
            );

            if (userAmountToSend > 0) {
              await userWalletModel.increment("amount", {
                by: Number(userAmountToSend),
                where: {
                  wallet_id: merchantWallet.dataValues.wallet_id,
                },
              });

              await userTransactionModel.create({
                wallet_id: merchantWallet.dataValues.wallet_id,
                user_id: tempTx.user_id,
                payment_mode: "CRYPTO",
                base_amount: Number(userAmountToSend).toFixed(8),
                base_currency: tempTx.wallet_type,
                transaction_reference: tempTx.txId,
                transaction_type: "CREDIT",
                status: "incomplete_expired",
              });
            }

            if (tempTx.subscription_id) {
              try {
                await tatumApi.deleteSubscription(tempTx.subscription_id);
              } catch (e) {
                console.log(`Failed to delete subscription ${tempTx.subscription_id}:`, e.message);
              }
            }

            console.log(`Partial payment processed after timeout for ${tempTx.wallet_address}`);
          }
        } catch (innerError) {
          console.error(`Failed to process incomplete payment ${tempTx.wallet_address}:`, innerError.message);
          cronLogger.error(
            `Incomplete payment processing error for ${tempTx.wallet_address}`,
            new Error(innerError)
          );
        }
      }
    } else {
      console.log("No incomplete payments found that exceeded 1-hour grace period.");
    }
  } catch (e) {
    console.error("Error in processIncompletePayments:", e);
    const message = getErrorMessage(e);
    cronLogger.error(message, new Error(e));
  }
};


export default {
  getData,
  addPayment,
  verifyPayment,
  verifyCryptoPayment,
  createCryptoPayment,
  confirmPayment,
  getBalance,
  authStep,
  getCurrencyRates,
  getPaymentLinks,
  deletePaymentLink,
  createPaymentLink,
  cryptoVerification,
  checkingUSDT,
  sendingLeftover,
  checkFeeBalance,
  checkOnBlockchair,
  removeUnwantedSubscriptions,
  processIncompletePayments,
};

