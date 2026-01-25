import express from "express";
import {
  currencyConvert,
  decrypt,
  encrypt,
  errorResponseHelper,
  getErrorMessage,
  sendEmail,
  sendPaymentReceivedEmail,
  successResponseHelper,
} from "../helper";
import { apiLogger, cronLogger, webhookLogs } from "../utils/loggers";
import {
  deleteRedisItem,
  getRedisItem,
  setRedisItem,
} from "../utils/redisInstance";
import sequelize from "../utils/dbInstance";
import { Op, QueryTypes } from "sequelize";
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
import { createNotification, NOTIFICATION_TYPES } from "./notificationController";
import {
  sendPartialPaymentNotification,
  sendPartialPaymentExpiredNotification,
} from "../services/pendingPaymentService";
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
import { autoGenerateInvoice } from "./invoiceController";

import {
  userTempAddressModel,
  userTransactionModel,
  paymentLinkModel,
  userWalletAddressModel,
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
import { 
  getBlockchainNetworkFee, 
  getAllBlockchainFees, 
  calculateCustomerPaymentAmount 
} from "../services/blockchainFeeService";

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
        fee_payer: item.fee_payer || 'company',  // Include fee_payer for checkout
      };
    } else {
      payload = {
        amount: item.amount,
        base_currency: item.base_currency,
        token: await getAccessToken(item.customer_id, data),
        payment_mode: item.pathType,
        fee_payer: item.fee_payer || 'company',
      };
    }

    console.log(payload);
    successResponseHelper(res, 200, "Payment link details retrieved successfully", payload);
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
        successResponseHelper(res, 200, "Payment created successfully", finalRes);
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
  console.log('[DEBUG] Step 1: JWT decoded successfully');
  
  try {
    const data: IFundData = req.body;
    console.log('[DEBUG] Step 2: Request body parsed:', { uniqueRef: data?.uniqueRef, currency: data?.currency });
    
    if (data) {
      let finalRes;
      console.log('[DEBUG] Step 3: About to call getRedisItem with key:', "customer-" + data.uniqueRef);
      
      const items = await getRedisItem("customer-" + data.uniqueRef);
      
      console.log('[DEBUG] Step 4: Redis item retrieved successfully:', { adm_id: items?.adm_id, company_id: items?.company_id });

      // Phase 10 Task 10.3: Validate currency is configured using userWalletModel
      const requestedCurrency = data.currency;
      console.log(`[Phase 10 Validation] Checking wallet for currency: ${requestedCurrency}, user_id: ${items.adm_id}, company_id: ${items.company_id}`);
      
      // Parse user_id safely
      const userId = parseInt(items.adm_id);
      if (isNaN(userId)) {
        return errorResponseHelper(res, 400, "Invalid user ID");
      }
      
      const whereClause: any = {
        user_id: userId,
        wallet_type: requestedCurrency,
        wallet_address: { [Op.not]: null },
      };
      
      // Handle company_id: if provided and valid, add to query; otherwise check for NULL
      if (items.company_id && items.company_id !== '' && items.company_id !== 'undefined' && items.company_id !== 'null') {
        const companyId = parseInt(items.company_id);
        if (!isNaN(companyId)) {
          whereClause.company_id = companyId;
        }
      } else {
        // If company_id not provided, check for NULL company_id wallets
        whereClause.company_id = null;
      }
      
      console.log('[Phase 10 Validation] Where clause:', JSON.stringify(whereClause));
      
      const hasWallet = await userWalletModel.findOne({
        where: whereClause,
      });
      
      console.log('[Phase 10 Validation] Wallet found:', hasWallet ? 'YES' : 'NO');

      if (!hasWallet) {
        return errorResponseHelper(
          res,
          400,
          `No wallet address configured for ${requestedCurrency}. Please add a ${requestedCurrency} wallet first.`
        );
      }

      const tokenData: any = {
        ref: data.uniqueRef,
        adm_id: items.adm_id,
        customer_id: items.customer_id,
        company_id: items.company_id,  // Include company_id from Redis
      };
      const { paymentRes, uniqueRef } = await Crypto(data, tokenData, true);
      finalRes = { hash: uniqueRef, ...paymentRes };
      
      // Determine fee_payer mode
      const fee_payer = items.fee_payer || 'company';
      
      // Calculate merchant's expected amount (base amount in crypto)
      let merchant_amount_crypto = data.amount;
      let total_fees_crypto = 0;
      
      if (fee_payer === 'customer') {
        // Customer paid total including fees, calculate what merchant should receive
        const baseAmountUSD = items.base_amount || items.amount || 0;  // Handle both createLink and createPayment
        const chain = requestedCurrency.replace('-', '_').toUpperCase();
        
        try {
          // Get the base amount in crypto (what merchant should receive)
          const baseRates = await currencyConvert({
            sourceCurrency: items.base_currency || 'USD',
            currency: [requestedCurrency],
            amount: baseAmountUSD,
            fixedDecimal: false,
          });
          merchant_amount_crypto = parseFloat(baseRates[0]?.amount?.toString() || data.amount.toString());
          total_fees_crypto = data.amount - merchant_amount_crypto;
          
          console.log(`[createCryptoPayment] Customer pays fees mode:
            - Total paid by customer: ${data.amount} ${requestedCurrency}
            - Merchant receives: ${merchant_amount_crypto} ${requestedCurrency}
            - Fees collected: ${total_fees_crypto} ${requestedCurrency}`);
        } catch (calcError) {
          console.error('[createCryptoPayment] Fee calc error:', calcError);
          // Fallback to standard calculation
          merchant_amount_crypto = data.amount;
        }
      }

      console.log("paymentRes=============>", paymentRes, uniqueRef, {
        mode: paymentTypes.CRYPTO,
        amount: data.amount,
        status: "pending",
        ref: uniqueRef,
        currency: data.currency,
        walletType: "customer",
        fee_payer,
      });

      await setRedisItem("crypto-" + paymentRes.address, {
        mode: paymentTypes.CRYPTO,
        amount: data.amount,                    // Total amount customer is paying
        merchant_amount: merchant_amount_crypto, // Amount merchant should receive
        total_fees: total_fees_crypto,          // Total fees (if customer pays)
        fee_payer: fee_payer,                   // Who pays fees
        base_amount_usd: items.base_amount || items.amount,     // Original USD amount
        status: "pending",
        ref: uniqueRef,
        currency: data.currency,
        unique_tx_id: paymentRes.transaction_id,
        walletType: "customer",
        temp_id: paymentRes.temp_id,
      });

      // Also update the temp address record in database for partial payment handling
      await userTempAddressModel.update(
        {
          fee_payer: fee_payer,
          merchant_amount: merchant_amount_crypto,
          base_amount_usd: items.base_amount || items.amount || 0,
        },
        { where: { temp_id: paymentRes.temp_id } }
      );

      successResponseHelper(res, 200, "Payment created successfully", finalRes);
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

      successResponseHelper(res, 200, "Payment authenticated successfully", finalRes);
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
      successResponseHelper(res, 200, "Payment verified successfully", finalRes);
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

        // Increment times_used counter
        await paymentLinkModel.increment('times_used', {
          by: 1,
          where: {
            transaction_id: tempData?.transaction_id,
          },
        });

        transaction.commit();
        
        // Use stored redirect_url or callback_url if available
        const returnData = {
          transaction_reference: data.flw_ref,
          status: data.status,
          redirect: false,
          ...(linkData.redirect_url && { redirect_url: linkData.redirect_url }),
          ...(linkData.callback_url && { callback_url: linkData.callback_url }),
        };
        
        // Call webhook if webhook_url is configured
        if (linkData.webhook_url) {
          try {
            await axios.post(linkData.webhook_url, returnData, { timeout: 30000 });
            webhookLogs.log("info", "Payment link webhook sent successfully!", {
              webhook_url: linkData.webhook_url,
              ...returnData,
            });
          } catch (webhookError) {
            webhookLogs.error("Payment link webhook failed", { 
              webhook_url: linkData.webhook_url,
              error: webhookError.message 
            });
          }
        }
        
        await deleteRedisItem(uniqueRef);
        successResponseHelper(res, 200, "Payment confirmed successfully", returnData);
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
            company_id: tempData.company_id || null,  // Include company_id from Redis
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

          // Auto-generate invoice for completed transaction
          if (tempData.company_id && userPayload.id) {
            autoGenerateInvoice(
              userPayload.id as any,
              Number(tempData.company_id)
            ).catch(err => {
              console.error("Failed to generate invoice:", err);
            });
          }

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
    // Fix: Handle null/undefined/NaN last_index values
    const currentIndex = walletDetails.last_index;
    const latestIndex = (currentIndex === null || currentIndex === undefined || isNaN(Number(currentIndex))) 
      ? 1 
      : Number(currentIndex) + 1;

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

    // Try to create subscription, but don't fail if Tatum API has issues
    let id = null;
    try {
      const subscription = await tatumApi.createSubscription(
        address,
        walletDetails.wallet_type,
        onlyCrypto
      );
      id = subscription.id;
      console.log("Tatum subscription created:", id);
    } catch (subscriptionError) {
      console.log("⚠️ Tatum subscription failed (using local monitoring):", subscriptionError.message);
      id = `local-${Date.now()}`; // Use local subscription ID as fallback
    }

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
      customer_id: tokenData.customer_id ? Number(tokenData.customer_id) : null,
      company_id: tokenData.company_id ? Number(tokenData.company_id) : null,
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
        const expectedAmount = Number(tempData?.amount) + (tempData?.previousAmount ? Number(tempData.previousAmount) : 0);

        await userTempAddressModel.update(
          {
            txId: tempAddressData.txId ? tempAddressData.txId + "," + transactionId : transactionId,
            status: "partial",
            amount: receivedAmount,
            partial_payment_timestamp: tempAddressData.partial_payment_timestamp ?? new Date(),
          },
          { where: { temp_id: tempAddressData.temp_id } }
        );

        // Send partial payment notification
        await sendPartialPaymentNotification(
          address,
          transactionId,
          Number(receivedAmount),
          expectedAmount,
          tempCurrency,
          customerData,
          30 // 30 minutes grace period
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

        // Check fee_payer mode
        const fee_payer = tempData?.fee_payer || 'company';
        const merchant_amount = tempData?.merchant_amount;
        
        let adminAmountToSend, userAmountToSend;
        
        if (fee_payer === 'customer' && merchant_amount) {
          // CUSTOMER PAYS FEES MODE
          // Customer already paid extra to cover fees
          // Merchant receives the original base amount (merchant_amount)
          // DynoPay keeps everything else (the fees)
          
          console.log(`[cryptoVerification] Customer pays fees mode:
            - Total received: ${totalAmountReceived} ${tempCurrency}
            - Merchant should receive: ${merchant_amount} ${tempCurrency}
            - Fees for DynoPay: ${Number(totalAmountReceived) - Number(merchant_amount)} ${tempCurrency}`);
          
          userAmountToSend = Number(merchant_amount);
          adminAmountToSend = Number(totalAmountReceived) - Number(merchant_amount);
          
          // Ensure we don't send negative or more than received
          if (adminAmountToSend < 0) {
            adminAmountToSend = 0;
            userAmountToSend = Number(totalAmountReceived);
          }
          if (userAmountToSend > Number(totalAmountReceived)) {
            userAmountToSend = Number(totalAmountReceived);
            adminAmountToSend = 0;
          }
        } else {
          // COMPANY PAYS FEES MODE (default)
          // Standard fee deduction from received amount
          const { totalDeduction, minForwarding } = await calculateTransactionFees(
            tempCurrency,
            Number(totalAmountReceived)
          );

          if (Number(totalAmountReceived) < Number(minForwarding)) {
            adminAmountToSend = Number(totalAmountReceived);
            userAmountToSend = 0;
          } else {
            adminAmountToSend = Number(totalDeduction);
            userAmountToSend = Number(totalAmountReceived) - Number(totalDeduction);
          }
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
          // Convert overpayment to API key's base currency (not hardcoded USD)
          newAmount = await currencyConvert({
            sourceCurrency: tempCurrency,
            currency: [customerData?.base_currency || "USD"],  // Use API key base currency
            amount: tempAmount,
            fixedDecimal: true,
          });
          // Flag overpayment if > 5 in base currency (USD/EUR/GBP/etc.)
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
              overpayment: {
                amount_crypto: tempAmount,
                currency_crypto: tempCurrency,
                amount_base: newAmount[0].amount,
                currency_base: customerData?.base_currency || "USD",
              },
              message: `Overpayment detected! ${tempAmount} ${tempCurrency} (${newAmount[0].amount} ${customerData?.base_currency || "USD"})`,
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
            ...(tempAmount > 0 && {
              overpayment: {
                detected: true,
                amount_crypto: tempAmount,
                currency_crypto: tempCurrency,
                amount_base: newAmount[0].amount,
                currency_base: customerData?.base_currency || "USD",
              }
            })
          };
        }

        // Get user data for notifications
        const userData = (
          await userModel.findOne({
            where: { user_id: customerData.adm_id },
          })
        )?.dataValues;

        // Always send email notification for payment received
        const companyName = company_data?.company_name ?? "";
        await sendPaymentReceivedEmail(
          userData?.email,
          userData?.name,
          companyName,
          userAmountToSend,
          tempCurrency,
          transactionId
        );

        // Create in-app notification for payment received
        await createNotification(
          customerData.adm_id,
          NOTIFICATION_TYPES.PAYMENT_RECEIVED,
          "Payment Received",
          `Your company ${companyName} received ${userAmountToSend} ${tempCurrency}`,
          {
            amount: userAmountToSend,
            currency: tempCurrency,
            transaction_id: transactionId,
            company_name: companyName,
            company_id: company_data?.company_id,
          },
          company_data?.company_id
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
    const { source, amount, currencyList, fixedDecimal = true, fee_payer = 'company' } = req.body;

    const currencyRateList = await currencyConvert({
      sourceCurrency: source,
      currency: currencyList,
      amount,
      fixedDecimal,
    });
    
    // If customer pays fees, calculate total amounts including all fees
    if (fee_payer === 'customer') {
      const enhancedRates = await Promise.all(
        currencyRateList.map(async (rate: any) => {
          try {
            const chain = rate.currency.replace('-', '_').toUpperCase();
            const cryptoPrice = parseFloat(rate.amount) > 0 ? amount / parseFloat(rate.amount) : 0;
            
            // Get fee breakdown
            const networkFee = await getBlockchainNetworkFee(chain);
            const { fixedFee, transactionFee, blockchainBuffer } = await calculateTransactionFees(
              chain,
              amount
            );
            
            // Calculate totals
            const totalFeesUSD = fixedFee + transactionFee + blockchainBuffer + networkFee.feeInUSD;
            const totalAmountUSD = amount + totalFeesUSD;
            const totalAmountCrypto = cryptoPrice > 0 ? totalAmountUSD / cryptoPrice : 0;
            
            return {
              ...rate,
              fee_payer: 'customer',
              base_amount: parseFloat(rate.amount),
              base_amount_usd: amount,
              fees: {
                transaction_fee: transactionFee,
                fixed_fee: fixedFee,
                blockchain_buffer: blockchainBuffer,
                network_fee: networkFee.feeInUSD,
                total_fees_usd: totalFeesUSD,
              },
              total_amount: fixedDecimal ? totalAmountCrypto.toFixed(8) : totalAmountCrypto,
              total_amount_usd: totalAmountUSD,
              amount: fixedDecimal ? totalAmountCrypto.toFixed(8) : totalAmountCrypto, // Override amount with total
            };
          } catch (feeError) {
            console.error(`[getCurrencyRates] Fee calc error for ${rate.currency}:`, feeError.message);
            return {
              ...rate,
              fee_payer: 'customer',
              fee_error: 'Could not calculate fees',
            };
          }
        })
      );
      
      return successResponseHelper(res, 200, "Exchange rates retrieved successfully", enhancedRates);
    }

    // Default: company pays fees (original behavior)
    successResponseHelper(res, 200, "Exchange rates retrieved successfully", currencyRateList);
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

    successResponseHelper(res, 200, "Balance retrieved successfully", {
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
  
  // Extract both old and new field names for backward compatibility
  // IMPORTANT: Client should send EITHER new format OR legacy format, not both
  // If both provided, new format (base_*) takes priority
  const { 
    email, 
    base_currency,    // NEW format (recommended)
    currency,         // LEGACY format (backward compatibility)
    modes, 
    amount,           // LEGACY format (backward compatibility)
    base_amount,      // NEW format (recommended)
    description,
    expire,
    callback_url,
    redirect_url,
    webhook_url,
    fee_payer,        // Who pays blockchain fees: 'customer' or 'company'
    company_id        // Phase 10 Fix: Accept company_id for multi-tenant isolation
  } = req.body;
  
  // Normalize field names - use new format first, fall back to legacy, then default
  // Priority: base_currency > currency > 'USD'
  const normalizedCurrency = base_currency || currency || 'USD';
  // Priority: base_amount > amount
  const normalizedAmount = base_amount || amount;
  
  try {
    // Validate required fields with clear error messages
    if (!normalizedAmount) {
      return errorResponseHelper(
        res, 
        400, 
        "Amount is required. Please provide either 'amount' or 'base_amount' field."
      );
    }
    
    if (!normalizedCurrency) {
      return errorResponseHelper(
        res, 
        400, 
        "Currency is required. Please provide either 'currency' or 'base_currency' field."
      );
    }
    
    // Validate amount is positive
    if (normalizedAmount <= 0) {
      return errorResponseHelper(
        res,
        400,
        "Amount must be greater than zero."
      );
    }
    
    // Validate email format if provided
    if (email && !email.includes('@')) {
      return errorResponseHelper(
        res,
        400,
        "Invalid email format. Please provide a valid email address."
      );
    }
    
    // Validate modes if provided
    if (modes) {
      const validModes = ['CRYPTO', 'CARD', 'BANK_TRANSFER', 'GOOGLE_PAY', 'APPLE_PAY', 'USSD', 'MOBILE_MONEY', 'QR_CODE'];
      const invalidModes = modes.filter((mode: string) => !validModes.includes(mode.toUpperCase()));
      
      if (invalidModes.length > 0) {
        return errorResponseHelper(
          res,
          400,
          `Invalid payment modes: ${invalidModes.join(', ')}. Valid modes are: ${validModes.join(', ')}`
        );
      }
      
      // Convert to uppercase if lowercase provided
      const normalizedModes = modes.map((mode: string) => mode.toUpperCase());
      req.body.modes = normalizedModes;
    }
    
    // Validate expire format if provided
    if (expire && expire !== 'No' && !['24h', '7d', '30d'].includes(expire)) {
      return errorResponseHelper(
        res,
        400,
        "Invalid expire value. Valid options are: '24h', '7d', '30d', or 'No'."
      );
    }
    
    // Phase 10 Fix: Validate company_id if provided
    if (company_id) {
      const companyExists = await companyModel.findOne({
        where: {
          company_id,
          user_id: userData.user_id,
        },
      });
      
      if (!companyExists) {
        return errorResponseHelper(
          res,
          400,
          "Invalid company_id or company does not belong to this user"
        );
      }
    }
    
    const uniqueRef = crypto.randomBytes(24).toString("hex");
    console.log("userData============>", userData);
    
    // Calculate expires_at based on expire option
    let expires_at = null;
    if (expire && expire !== "No") {
      const now = new Date();
      if (expire === "24h") {
        expires_at = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      } else if (expire === "7d") {
        expires_at = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      } else if (expire === "30d") {
        expires_at = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      }
    }
    
    // Default modes if not provided
    const allowedModes = modes ? modes.join(",") : "crypto,card";
    
    const payload = {
      transaction_id: crypto.randomUUID(),
      email: email || null,
      allowedModes: allowedModes,
      base_amount: normalizedAmount,
      base_currency: normalizedCurrency,
      user_id: userData.user_id,
      adm_id: userData.user_id,  // Add adm_id for crypto payment compatibility
      company_id: company_id || null,  // Phase 10 Fix: Include company_id
      payment_link: process.env.CHECKOUT_URL + "/pay?d=" + uniqueRef,
      description: description || null,
      expires_at: expires_at,
      callback_url: callback_url || null,
      redirect_url: redirect_url || null,
      webhook_url: webhook_url || null,
      fee_payer: fee_payer || 'company',  // Default: company pays fees (existing behavior)
    };

    const links = await paymentLinkModel.create(payload);
    const redisPayload = {
      ...payload,
      pathType: "createLink",
      link_id: links.dataValues.link_id,
    };

    console.log(redisPayload);

    await setRedisItem("customer-" + uniqueRef, redisPayload);

    successResponseHelper(res, 200, "Payment link created successfully", links);
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
    const { company_id, page, limit, paginated } = req.query;  // Added pagination params
    
    console.log("userData============>", userData);
    
    // Build where clause with optional company_id filter
    const whereClause: any = {
      user_id: userData.user_id,
    };
    
    if (company_id) {
      whereClause.company_id = parseInt(company_id as string);
    }
    
    // Check if pagination is requested (backward compatibility)
    const usePagination = paginated === 'true' || page !== undefined || limit !== undefined;
    
    // Get total count for pagination
    const totalCount = await paymentLinkModel.count({ where: whereClause });
    
    // Calculate pagination
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 10;
    const offset = (pageNum - 1) * limitNum;
    
    const links = await paymentLinkModel.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      ...(usePagination && { limit: limitNum, offset: offset }),
    });

    // Format for UI with computed status
    const formattedLinks = links.map((link: any) => {
      const linkData = link.dataValues;
      const now = new Date();
      
      // Calculate status
      let status = "Active";
      if (linkData.expires_at && new Date(linkData.expires_at) <= now) {
        status = "Expired";
      }
      if (linkData.status === "completed") {
        status = "Completed";
      }

      // Format dates
      const formatDate = (date) => {
        if (!date) return "Never";
        const d = new Date(date);
        return d.toLocaleString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).replace(',', '');
      };

      return {
        link_id: linkData.link_id,
        transaction_id: linkData.transaction_id,
        description: linkData.description || "No description",
        usd_value: `$${linkData.base_amount}`,
        base_amount: linkData.base_amount,
        base_currency: linkData.base_currency,
        created: formatDate(linkData.createdAt),
        expires: formatDate(linkData.expires_at),
        status: status,
        times_used: linkData.times_used || 0,
        payment_link: linkData.payment_link,
        email: linkData.email,
        allowedModes: linkData.allowedModes,
        callback_url: linkData.callback_url,
        redirect_url: linkData.redirect_url,
        webhook_url: linkData.webhook_url,
        fee_payer: linkData.fee_payer || 'company',  // Who pays blockchain fees
        company_id: linkData.company_id,  // Phase 10 Fix: Include company_id in response
      };
    });

    // Return with pagination info only if pagination was requested
    // Otherwise return array directly for backward compatibility
    if (usePagination) {
      successResponseHelper(res, 200, "Payment links retrieved successfully", {
        links: formattedLinks,
        pagination: {
          total: totalCount,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(totalCount / limitNum),
        }
      });
    } else {
      // Backward compatible: return array directly
      successResponseHelper(res, 200, "Links Fetched Successfully!", formattedLinks);
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

/**
 * Get single payment link by ID
 * GET /api/pay/links/:id
 */
const getPaymentLinkById = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as any;
  const link_id = req.params.id;
  
  try {
    const link = await paymentLinkModel.findOne({
      where: {
        user_id: userData.user_id,
        link_id,
      },
    });

    if (!link) {
      return errorResponseHelper(res, 404, "Payment link not found!");
    }

    const linkData = link.dataValues;
    const now = new Date();
    
    // Calculate status
    let status = "Active";
    if (linkData.expires_at && new Date(linkData.expires_at) <= now) {
      status = "Expired";
    }
    if (linkData.status === "completed") {
      status = "Completed";
    }

    // Format dates
    const formatDate = (date) => {
      if (!date) return null;
      const d = new Date(date);
      return d.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).replace(',', '');
    };

    const response = {
      link_id: linkData.link_id,
      transaction_id: linkData.transaction_id,
      description: linkData.description,
      base_amount: linkData.base_amount,
      base_currency: linkData.base_currency,
      paid_amount: linkData.paid_amount,
      paid_currency: linkData.paid_currency,
      created: formatDate(linkData.createdAt),
      updated: formatDate(linkData.updatedAt),
      expires_at: linkData.expires_at,
      expires: formatDate(linkData.expires_at) || "Never",
      status: status,
      times_used: linkData.times_used || 0,
      payment_link: linkData.payment_link,
      email: linkData.email,
      allowedModes: linkData.allowedModes,
      payment_mode: linkData.payment_mode,
      transaction_reference: linkData.transaction_reference,
      callback_url: linkData.callback_url,
      redirect_url: linkData.redirect_url,
      webhook_url: linkData.webhook_url,
      company_id: linkData.company_id,  // Phase 10 Fix: Include company_id in response
    };

    successResponseHelper(res, 200, "Payment link retrieved successfully", response);
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

/**
 * Update payment link
 * PUT /api/pay/links/:id
 */
const updatePaymentLink = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as any;
  const link_id = req.params.id;
  const { 
    description, 
    expire,
    callback_url, 
    redirect_url, 
    webhook_url 
  } = req.body;
  
  try {
    // First check if link exists and belongs to user
    const existingLink = await paymentLinkModel.findOne({
      where: {
        user_id: userData.user_id,
        link_id,
      },
    });

    if (!existingLink) {
      return errorResponseHelper(res, 404, "Payment link not found!");
    }

    // Prepare update object
    const updateData: any = {};
    
    if (description !== undefined) {
      updateData.description = description;
    }
    
    if (expire !== undefined) {
      // Calculate new expires_at
      if (expire === "No" || !expire) {
        updateData.expires_at = null;
      } else {
        const now = new Date();
        if (expire === "24h") {
          updateData.expires_at = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        } else if (expire === "7d") {
          updateData.expires_at = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        } else if (expire === "30d") {
          updateData.expires_at = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        }
      }
    }
    
    if (callback_url !== undefined) {
      updateData.callback_url = callback_url;
    }
    
    if (redirect_url !== undefined) {
      updateData.redirect_url = redirect_url;
    }
    
    if (webhook_url !== undefined) {
      updateData.webhook_url = webhook_url;
    }

    // Update the link
    await paymentLinkModel.update(updateData, {
      where: {
        user_id: userData.user_id,
        link_id,
      },
    });

    // Fetch updated link
    const updatedLink = await paymentLinkModel.findOne({
      where: {
        user_id: userData.user_id,
        link_id,
      },
    });

    successResponseHelper(res, 200, "Payment link updated successfully", updatedLink);
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
      successResponseHelper(res, 200, "Payment link deleted successfully", links);
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
        // Try to get admin email from database or environment variable
        let adminEmail = process.env.ADMIN_EMAIL || "moxxcompany@gmail.com"; // Default fallback
        
        try {
          const adminData: any[] = await sequelize.query(
            "select email from tbl_admin limit 1",
            {
              type: QueryTypes.SELECT,
            }
          );
          if (adminData && adminData.length > 0 && adminData[0].email) {
            adminEmail = adminData[0].email;
          }
        } catch (dbError) {
          console.log("Could not fetch admin from database, using fallback email:", adminEmail);
        }
        
        textData += `\n\n Please recharge as soon as possible.`;
        
        console.log(`Sending low fee balance alert to: ${adminEmail}`);
        
        await sendEmail(
          adminEmail,
          "DynoPay Admin",
          "Low amount in Fee wallet",
          textData
        );
        
        const alert_duration = adminFeesWallets[0]?.dataValues?.alert_duration || 24; // Default 24 hours
        await setRedisItem("admin_fee_alert", {
          status: "sent",
          expiresAt:
            new Date().getTime() + Number(alert_duration) * 60 * 60 * 1000,
        });
        
        console.log(`Fee balance alert sent successfully to ${adminEmail}`);
      } else {
        console.log("Fee balance alert already sent recently, skipping");
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

            // Check fee_payer mode from temp address record
            const fee_payer = tempTx.fee_payer || 'company';
            const merchant_amount = tempTx.merchant_amount;

            let adminAmountToSend, userAmountToSend;

            if (fee_payer === 'customer' && merchant_amount > 0) {
              // CUSTOMER PAYS FEES MODE
              userAmountToSend = Number(merchant_amount);
              adminAmountToSend = Number(totalReceived) - Number(merchant_amount);
              
              if (adminAmountToSend < 0) {
                adminAmountToSend = 0;
                userAmountToSend = Number(totalReceived);
              }
              console.log(`[processIncompletePayments] Customer pays fees: Admin=${adminAmountToSend}, Merchant=${userAmountToSend}`);
            } else {
              // COMPANY PAYS FEES MODE (default)
              const { totalDeduction, minForwarding } = await calculateTransactionFees(
                tempTx.wallet_type,
                totalReceived
              );

              if (Number(totalReceived) < Number(minForwarding)) {
                adminAmountToSend = Number(totalReceived);
                userAmountToSend = 0;
                console.log(`Total amount ${totalReceived} below threshold ${minForwarding}. Sending all to admin.`);
              } else {
                adminAmountToSend = Number(totalDeduction);
                userAmountToSend = Number(totalReceived) - Number(totalDeduction);
                console.log(`Splitting final amount: Admin=${adminAmountToSend}, Merchant=${userAmountToSend}`);
              }
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

            // Send partial payment completed notification
            await sendPartialPaymentExpiredNotification(
              tempTx.wallet_address,
              tempTx.txId,
              totalReceived,
              Number(tempTx.expected_amount || tempTx.amount),
              tempTx.wallet_type,
              tempTx.user_id,
              tempTx.company_id,
              "completed_partial"
            );

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

            // Check fee_payer mode from temp address record
            const fee_payer = tempTx.fee_payer || 'company';
            const merchant_amount = tempTx.merchant_amount;

            let adminAmountToSend, userAmountToSend;

            if (fee_payer === 'customer' && merchant_amount > 0) {
              // CUSTOMER PAYS FEES MODE - but partial payment, so prorate
              // Customer only paid partial, so merchant gets proportional amount
              const expectedTotal = Number(tempTx.amount) + (Number(tempTx.amount) - Number(merchant_amount));
              const paidRatio = Number(tempTx.amount) / expectedTotal;
              userAmountToSend = Number(merchant_amount) * paidRatio;
              adminAmountToSend = Number(tempTx.amount) - userAmountToSend;
              
              if (adminAmountToSend < 0) {
                adminAmountToSend = 0;
                userAmountToSend = Number(tempTx.amount);
              }
              console.log(`[processIncompletePayments] Customer pays fees (incomplete): Admin=${adminAmountToSend}, Merchant=${userAmountToSend}`);
            } else {
              // COMPANY PAYS FEES MODE (default)
              const { totalDeduction, minForwarding } = await calculateTransactionFees(
                tempTx.wallet_type,
                Number(tempTx.amount)
              );

              if (Number(tempTx.amount) < Number(minForwarding)) {
                adminAmountToSend = Number(tempTx.amount);
                userAmountToSend = 0;
                console.log(`Amount ${tempTx.amount} below threshold. Sending all to admin.`);
              } else {
                adminAmountToSend = Number(totalDeduction);
                userAmountToSend = Number(tempTx.amount) - Number(totalDeduction);
                console.log(`Splitting partial amount: Admin=${adminAmountToSend}, Merchant=${userAmountToSend}`);
              }
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

            // Send partial payment expired notification
            await sendPartialPaymentExpiredNotification(
              tempTx.wallet_address,
              tempTx.txId,
              Number(tempTx.amount),
              Number(tempTx.expected_amount || tempTx.amount * 2), // Use expected if available
              tempTx.wallet_type,
              tempTx.user_id,
              tempTx.company_id,
              "incomplete_expired"
            );

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


/**
 * GET /api/payment/network-fees
 * Public endpoint - Get real-time blockchain network fees
 */
const getNetworkFees = async (req: express.Request, res: express.Response) => {
  try {
    const { chain } = req.query;

    if (chain) {
      const fee = await getBlockchainNetworkFee(chain as string);
      successResponseHelper(res, 200, "Network fee retrieved", fee);
    } else {
      const fees = await getAllBlockchainFees();
      successResponseHelper(res, 200, "Network fees retrieved", fees);
    }
  } catch (e) {
    const message = getErrorMessage(e);
    console.error("[getNetworkFees] Error:", message);
    errorResponseHelper(res, 500, message);
  }
};

/**
 * POST /api/payment/calculate-payment
 * Public endpoint - Calculate total payment amount with blockchain fees
 */
const calculatePaymentAmount = async (req: express.Request, res: express.Response) => {
  try {
    const { amount_usd, chain, fee_payer = 'customer' } = req.body;

    if (!amount_usd || !chain) {
      return errorResponseHelper(res, 400, "amount_usd and chain are required");
    }

    // Get current crypto price
    const cryptoPrice = await getCryptoPriceForPayment(chain);
    
    if (fee_payer === 'customer') {
      const calculation = await calculateCustomerPaymentAmount(
        parseFloat(amount_usd),
        chain,
        cryptoPrice
      );

      successResponseHelper(res, 200, "Payment amount calculated", {
        fee_payer: 'customer',
        base_amount_usd: parseFloat(amount_usd),
        base_amount_crypto: calculation.baseAmountCrypto,
        blockchain_fee_native: calculation.blockchainFeeNative,
        blockchain_fee_usd: calculation.blockchainFeeUSD,
        total_amount_crypto: calculation.totalAmountCrypto,
        total_amount_usd: calculation.totalAmountUSD,
        crypto_currency: chain,
        crypto_price_usd: cryptoPrice,
      });
    } else {
      const baseAmountCrypto = parseFloat(amount_usd) / cryptoPrice;
      const networkFee = await getBlockchainNetworkFee(chain);

      successResponseHelper(res, 200, "Payment amount calculated", {
        fee_payer: 'company',
        base_amount_usd: parseFloat(amount_usd),
        base_amount_crypto: baseAmountCrypto,
        blockchain_fee_native: networkFee.feeInNative,
        blockchain_fee_usd: networkFee.feeInUSD,
        total_amount_crypto: baseAmountCrypto,
        total_amount_usd: parseFloat(amount_usd),
        crypto_currency: chain,
        crypto_price_usd: cryptoPrice,
        note: "Blockchain fee will be deducted from merchant settlement"
      });
    }
  } catch (e) {
    const message = getErrorMessage(e);
    console.error("[calculatePaymentAmount] Error:", message);
    errorResponseHelper(res, 500, message);
  }
};

/**
 * Helper: Get crypto price in USD for payment calculations
 */
const getCryptoPriceForPayment = async (symbol: string): Promise<number> => {
  try {
    const idMap: Record<string, string> = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'LTC': 'litecoin',
      'DOGE': 'dogecoin',
      'TRX': 'tron',
      'USDT': 'tether',
      'USDT_ERC20': 'tether',
      'USDT_TRC20': 'tether',
      'BCH': 'bitcoin-cash',
    };

    const coinId = idMap[symbol.toUpperCase()] || symbol.toLowerCase();
    const response = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`
    );
    
    return response.data[coinId]?.usd || 0;
  } catch (error) {
    const fallbackPrices: Record<string, number> = {
      'BTC': 95000,
      'ETH': 3300,
      'LTC': 100,
      'DOGE': 0.35,
      'TRX': 0.25,
      'USDT': 1,
      'USDT_ERC20': 1,
      'USDT_TRC20': 1,
      'BCH': 450,
    };
    return fallbackPrices[symbol.toUpperCase()] || 0;
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
  getPaymentLinkById,
  updatePaymentLink,
  deletePaymentLink,
  createPaymentLink,
  cryptoVerification,
  checkingUSDT,
  sendingLeftover,
  checkFeeBalance,
  checkOnBlockchair,
  removeUnwantedSubscriptions,
  processIncompletePayments,
  getNetworkFees,
  calculatePaymentAmount,
};

