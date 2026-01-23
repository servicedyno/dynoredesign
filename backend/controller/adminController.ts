import express from "express";
import {
  currencyConvert,
  errorResponseHelper,
  getErrorMessage,
  sendEmail,
  successResponseHelper,
} from "../helper";
import { adminLogger } from "../utils/loggers";
import {
  deleteRedisItem,
  getRedisItem,
  setRedisItem,
} from "../utils/redisInstance";
import jwt from "jsonwebtoken";
import {
  adminFeeModel,
  adminFeeTransactionModel,
  adminTransferFeeModel,
  adminWalletModel,
  feesModel,
} from "../models";
import tatumApi from "../apis/tatumApi";
import { getAdminWalletAddress } from "../utils/adminUtils";
import sequelize from "../utils/dbInstance";
import { IAdminWallet } from "../utils/types";
import { QueryTypes } from "sequelize";
import sha256 from "crypto-js/sha256";
import {
  selfTransactionModel,
  userModel,
  userTransactionModel,
  userWalletModel,
} from "../models/userModels";

const getTransactionFee = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { fee } = await (
      await feesModel.findOne({
        where: {
          feeType: "TRANSACTION_FEE",
        },
      })
    ).dataValues;

    const blockchainData = await feesModel.findOne({
      where: {
        feeType: "BLOCKCHAIN_FEE",
      },
    });

    const transaction_fee = fee;
    await setRedisItem("admin_fee", { transaction_fee: transaction_fee });
    await setRedisItem("admin_fee", {
      blockchain_fee: blockchainData.dataValues.fee,
    });

    successResponseHelper(res, 200, "", {
      transaction_fee,
      blockchain_fee: blockchainData.dataValues.fee,
    });
  } catch (e) {
    const message = getErrorMessage(e);
    adminLogger.error(message, new Error(e));
    errorResponseHelper(res, 500, message);
  }
};

const newTransactionFee = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { fee, blockchainFeeInput } = req.body;
    await feesModel.update(
      {
        fee: fee ?? 0,
      },
      {
        where: {
          feeType: "TRANSACTION_FEE",
        },
      }
    );

    await feesModel.update(
      {
        fee: blockchainFeeInput ?? 0,
      },
      {
        where: {
          feeType: "BLOCKCHAIN_FEE",
        },
      }
    );
    const transaction_fee = fee;
    const blockchain_fee = blockchainFeeInput ?? 0;
    await setRedisItem("admin_fee", { transaction_fee });
    await setRedisItem("admin_fee", { blockchain_fee });
    successResponseHelper(res, 200, "", { transaction_fee, blockchain_fee });
  } catch (e) {
    const message = getErrorMessage(e);
    adminLogger.error(message, new Error(e));
    errorResponseHelper(res, 500, message);
  }
};

const getWallets = async (req: express.Request, res: express.Response) => {
  try {
    const walletData = await adminWalletModel.findAll({
      attributes: {
        exclude: ["privateKey", "mnemonic", "xpub", "wallet_account_id"],
      },
    });
    const currencyList = [];

    const allUserWalletData: any[] = await sequelize.query(
      "select sum(amount) as total_balance,wallet_type from tbl_user_wallet group by wallet_type",
      { type: QueryTypes.SELECT }
    );

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
      const userIndex = allUserWalletData.findIndex(
        (x) => x.wallet_type === currencyData[i].currency
      );
      console.log(currentIndex);
      const currentWallet = walletData[currentIndex].dataValues;
      const userWallet = allUserWalletData[userIndex];

      const finalAmount = Number(
        userWallet.total_balance / currencyData[i].transferRate
      );
      const feeAmount = Number(
        currentWallet.fee / currencyData[i].transferRate
      );
      const amount_in_usd = Number(finalAmount).toFixed(2);
      const fee_in_usd = Number(feeAmount).toFixed(2);
      returnData.push({
        ...currentWallet,
        amount: userWallet.total_balance,
        amount_in_usd,
        fee_in_usd,
        transfer_rate: currencyData[i].transferRate,
      });
    }
    const fiatWallets = returnData.filter((x) => x.currency_type === "FIAT");
    const cryptoWallets = returnData.filter(
      (x) => x.currency_type === "CRYPTO"
    );
    successResponseHelper(res, 200, "", { fiatWallets, cryptoWallets });
  } catch (e) {
    const message = getErrorMessage(e);
    adminLogger.error(message, new Error(e));
    errorResponseHelper(res, 500, message);
  }
};

const createWallets = async (req: express.Request, res: express.Response) => {
  const transaction = await sequelize.transaction();
  try {
    const count = (await adminWalletModel.findAndCountAll()).count;
    if (count === 0) {
      const fiatData = ["EUR", "GBP", "NGN", "KES", "UGX", "GHS", "RWF", "USD"];
      const cryptoData = ["BTC", "ETH", "TRX", "BSC", "LTC", "DOGE", "BCH"];

      for (let i = 0; i < fiatData.length; i++) {
        await adminWalletModel.create(
          {
            wallet_type: fiatData[i],
            currency_type: "FIAT",
          },
          { transaction }
        );
      }

      for (let i = 0; i < cryptoData.length; i++) {
        const wallet = await tatumApi.generateWallet(cryptoData[i]);

        await adminWalletModel.create(
          {
            wallet_type: cryptoData[i],
            wallet_address: wallet.address,
            wallet_account_id: null,
            currency_type: "CRYPTO",
            xpub: wallet.xpub,
            mnemonic: wallet.mnemonic,
            privateKey: wallet.privateKey,
            customer_id: null,
          },
          { transaction }
        );
        if (cryptoData[i] === "ETH") {
          await adminWalletModel.create(
            {
              wallet_type: "USDT-ERC20",
              wallet_address: wallet.address,
              wallet_account_id: null,
              currency_type: "CRYPTO",
              xpub: wallet.xpub,
              mnemonic: wallet.mnemonic,
              privateKey: wallet.privateKey,
              customer_id: null,
            },
            { transaction }
          );
        }
        if (cryptoData[i] === "TRX") {
          await adminWalletModel.create(
            {
              wallet_type: "USDT-TRC20",
              wallet_address: wallet.address,
              wallet_account_id: null,
              currency_type: "CRYPTO",
              xpub: wallet.xpub,
              mnemonic: wallet.mnemonic,
              privateKey: wallet.privateKey,
              customer_id: null,
            },
            { transaction }
          );
        }
      }
      transaction.commit();
    } else {
      transaction.rollback();
      throw { message: "Wallets already exists" };
    }
    successResponseHelper(res, 200, "Wallets generated!");
  } catch (e) {
    transaction.rollback();
    const message = getErrorMessage(e);
    adminLogger.error(message, new Error(e));
    errorResponseHelper(res, 500, message);
  }
};

const login = async (req: express.Request, res: express.Response) => {
  try {
    const { email, password } = req.body;
    const newPassword = sha256(password).toString();
    const data = await sequelize.query(
      `select * from tbl_admin where email='${email}' 
      and password='${newPassword}'`,
      { type: QueryTypes.SELECT }
    );

    if (data.length > 0) {
      const tokenSecret = process.env.ACCESS_TOKEN_SECRET;
      const userData = {
        email,
        role: "ADMIN",
      };

      if (tokenSecret) {
        const accessToken = jwt.sign(userData, tokenSecret, {
          expiresIn: "30d",
        });
        successResponseHelper(res, 200, "Login Success!", { accessToken });
      }
    } else {
      throw { message: "Invalid username or password!" };
    }
  } catch (e) {
    const message = getErrorMessage(e);
    adminLogger.error(message, new Error(e));
    errorResponseHelper(res, 500, message);
  }
};

const withdrawAssets = async (req: express.Request, res: express.Response) => {
  try {
    const { currency, amount, address } = req.body;

    const adminWallet: IAdminWallet = (
      await adminWalletModel.findOne({
        where: {
          wallet_type: currency,
        },
      })
    ).dataValues;

    const envAddress = getAdminWalletAddress(currency);
    if (envAddress) {
      adminWallet.wallet_address = envAddress;
    }

    let fees,
      sendAmount: any = amount;
    if (["BTC", "LTC", "DOGE"].indexOf(adminWallet.wallet_type) !== -1) {
      fees = (
        await tatumApi.feeEstimation(
          adminWallet.wallet_type,
          adminWallet.wallet_address,
          address,
          Number(amount)
        )
      )?.fast;

      sendAmount = Number(Number(Number(amount) - Number(fees)).toFixed(8));
    }

    if (["ETH", "BSC", "USDT-ERC20"].indexOf(adminWallet.wallet_type) !== -1) {
      fees = await tatumApi.feeEstimation(
        adminWallet.wallet_type,
        adminWallet.wallet_address,
        address,
        Number(amount)
      );

      sendAmount = Number(
        Number(amount) -
        Number(((fees?.gasPrice + 1) * fees?.gasLimit) / 1000000000)
      ).toFixed(8);
    }

    console.log(fees);

    const transactionDetails = await tatumApi.assetToOtherAddress({
      currency: currency,
      fromAddress: adminWallet.wallet_address,
      toAddress: address,
      privateKey: adminWallet.privateKey,
      amount: sendAmount,
      fee: fees,
    });

    // if (transactionDetails) {
    //   await adminWalletModel.decrement("fee", {
    //     by: amount,
    //     where: {
    //       wallet_id: adminWallet.wallet_id,
    //     },
    //   });
    // }

    successResponseHelper(res, 200, "Amount withdrawed!", transactionDetails);
  } catch (e) {
    const message = getErrorMessage(e);
    adminLogger.error(message, new Error(e));
    errorResponseHelper(res, 500, message);
  }
};

const getFeeWalletBalance = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const adminFeesWallets = await adminFeeModel.findAll({
      attributes: { exclude: ["privateKey", "mnemonic", "xpub"] },
    });
    const transactions = await adminFeeTransactionModel.findAll({
      attributes: { exclude: ["amount_to_be_paid"] },
      order: [["createdAt", "desc"]],
    });
    const cryptoWallets = [];
    for (let i = 0; i < adminFeesWallets.length; i++) {
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
        sourceCurrency: adminFeesWallets[i]?.dataValues.wallet_type,
        amount,
        fixedDecimal: true,
      });
      cryptoWallets.push({
        ...adminFeesWallets[i].dataValues,
        amount,
        amount_in_usd: tempData[0]?.amount,
      });
    }
    successResponseHelper(res, 200, "", {
      cryptoWallets,
      transactions,
    });
  } catch (e) {
    const message = getErrorMessage(e);
    adminLogger.error(message, new Error(e));
    errorResponseHelper(res, 500, message);
  }
};

const changePassword = async (req: express.Request, res: express.Response) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const adminData: any = jwt.decode(res.locals.token);
    const password = oldPassword ? sha256(oldPassword).toString() : null;

    const data = await sequelize.query(
      `select * from tbl_admin where email='${adminData?.email}' 
      and password='${password}'`,
      { type: QueryTypes.SELECT }
    );
    if (data.length > 0) {
      const newPass = sha256(newPassword).toString();
      await sequelize.query(
        `update tbl_admin set password='${newPass}' where email='${adminData?.email}'`,
        {
          type: QueryTypes.UPDATE,
        }
      );
      successResponseHelper(res, 200, "Password updated successfully!", null);
    } else {
      errorResponseHelper(res, 500, "Old password not recognized!");
    }
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    adminLogger.error(errorMessage, new Error(e));
    errorResponseHelper(res, 500, errorMessage);
  }
};

const updateEmail = async (req: express.Request, res: express.Response) => {
  try {
    const { email, otp } = req.body;
    const adminData: any = jwt.decode(res.locals.token);
    if (!otp) {
      const data = await sequelize.query(
        `select * from tbl_admin where email='${adminData?.email}'`,
        { type: QueryTypes.SELECT }
      );
      if (data.length > 0) {
        const randomNumberOTP = Math.floor(100000 + Math.random() * 900000);
        await sendEmail(
          email,
          "Admin",
          "OTP for Email change",
          "Here is OTP for updating the email: " + randomNumberOTP
        );
        await setRedisItem(email + "-update-otp", {
          otp: randomNumberOTP.toString(),
          expiresAt: new Date().getTime() + 5 * 60 * 1000,
        });
        successResponseHelper(res, 200, "OTP sent for confirmation!");
      }
    } else {
      const storedOtp = await getRedisItem(email + "-update-otp");
      console.log(storedOtp);
      if (storedOtp.otp != otp) {
        errorResponseHelper(res, 500, "OTP did not match!");
      } else {
        if (new Date().getTime() > Number(storedOtp?.expiresAt)) {
          throw { message: "OTP expired!" };
        }

        await sequelize.query(
          `update tbl_admin set email='${email}' where email='${adminData?.email}'`,
          {
            type: QueryTypes.UPDATE,
          }
        );
        const tokenSecret = process.env.ACCESS_TOKEN_SECRET;
        const userData = {
          email,
          role: "ADMIN",
        };

        if (tokenSecret) {
          const accessToken = jwt.sign(userData, tokenSecret, {
            expiresIn: "30d",
          });
          await deleteRedisItem(email + "-update-otp");
          successResponseHelper(res, 200, "Email updated successfully!", {
            accessToken,
          });
        }
      }
    }
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    adminLogger.error(errorMessage, new Error(e));
    errorResponseHelper(res, 500, errorMessage);
  }
};

const updateFeeLimits = async (req: express.Request, res: express.Response) => {
  try {
    const { feeLimit, alert_duration } = req.body;
    await adminFeeModel.update(
      {
        feeLimit,
        alert_duration,
      },
      {
        where: {
          wallet_type: ["ETH", "TRX"],
        },
      }
    );
    successResponseHelper(res, 200, "Limits updated successfully!");
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    adminLogger.error(errorMessage, new Error(e));
    errorResponseHelper(res, 500, errorMessage);
  }
};

const updateTransferFees = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { feesData } = req.body;

    for (let i = 0; i < feesData.length; i++) {
      const { wallet_type, speed, transfer_speed_id } = feesData[i];

      await adminTransferFeeModel.update(
        {
          wallet_type,
          speed,
        },
        {
          where: {
            transfer_speed_id,
          },
        }
      );
    }
    successResponseHelper(res, 200, "Transfer fees updated successfully!");
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    adminLogger.error(errorMessage, new Error(e));
    errorResponseHelper(res, 500, errorMessage);
  }
};

const getTransferFees = async (req: express.Request, res: express.Response) => {
  try {
    const resData = await adminTransferFeeModel.findAll();
    successResponseHelper(res, 200, "", resData);
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    adminLogger.error(errorMessage, new Error(e));
    errorResponseHelper(res, 500, errorMessage);
  }
};

const getAllTransactions = async (
  req: express.Request,
  res: express.Response
) => {
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
      ...(column && sortType && { order: [[column, sortType]] }),
      ...(offset !== -1 && limit && { offset, limit }),
    });

    const tempData = await sequelize.query(
      `
      select ut.*,c.customer_name,c.email,cm.company_name,cm.company_id from tbl_user_transaction ut 
      join tbl_customer c on c.customer_id=ut.customer_id
      join tbl_company cm on cm.company_id=c.company_id
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
      users_transactions: selfData,
    });
  } catch (e) {
    const message = getErrorMessage(e);
    adminLogger.error(message, new Error(e));
    errorResponseHelper(res, 500, message);
  }
};

const getAdminAnalytics = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const {
      periodType,
      year = new Date().getFullYear(),
      month = new Date().getMonth() + 1,
    } = req.body;
    const activeUsers = (
      await userModel.findAndCountAll({
        where: {
          status: "active",
        },
      })
    ).count;

    const totalTransactionsIncoming = (
      await userTransactionModel.findAndCountAll()
    ).count;

    const totalTransactionOutgoing = (
      await selfTransactionModel.findAndCountAll({
        where: {
          transaction_type: "DEBIT",
        },
      })
    ).count;

    let where = "";
    if (periodType === "YEAR") {
      where = `where extract(year from ut."createdAt")=${year}`;
    } else if (periodType === "MONTH") {
      where = `where extract(year from ut."createdAt")=${year} and extract(month from ut."createdAt")=${month}`;
    } else {
      where = "";
    }

    const popularCurrency = await sequelize.query(
      `select aw.wallet_type,count(ut.base_currency) as transaction_count,aw.currency_type from tbl_admin_wallet aw 
      left join tbl_user_transaction ut on  aw.wallet_type=ut.base_currency
      ${where} group by ut.base_currency,aw.wallet_type,aw.currency_type order by transaction_count desc`,
      { type: QueryTypes.SELECT }
    );

    const invoicesCreatedIn30Days = await sequelize.query(
      `select date_trunc('day', "createdAt") as date_temp, count(*) as invoices_created
    from tbl_user_transaction group by date_temp order by date_temp desc limit 30`,
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

    const growthTrends = await sequelize.query(
      `with users_per_month as (
      select
        date_trunc('month', "createdAt") as month,
        count(*) as new_users
      from tbl_user
      group by month
    ),
    transactions_per_month as (
      select
        date_trunc('month', "createdAt") as month,
        count(*) as new_transactions
      from tbl_user_transaction
      group by month
    )
    select
      extract(month from t.month) as t_month,
	  extract (month from u.month) as u_month,
      COALESCE(u.new_users, 0) as new_users,
      COALESCE(t.new_transactions, 0) as new_transactions
    from users_per_month u
    full outer join transactions_per_month t on u.month = t.month
    order by u.month desc`,
      {
        type: QueryTypes.SELECT,
      }
    );

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
      activeUsers,
      totalTransactionsIncoming,
      totalTransactionOutgoing,
      popularCurrency,
      invoicesCreatedIn30Days,
      paymentSuccessRates,
      growthTrends,
      revenue_performance,
    };

    successResponseHelper(res, 200, "", returnData);
  } catch (e) {
    const message = getErrorMessage(e);
    adminLogger.error(message, new Error(e));
    errorResponseHelper(res, 500, message);
  }
};

const getAllUsers = async (req: express.Request, res: express.Response) => {
  try {
    const userData = await userModel.findAll({
      attributes: { exclude: ["password"] },
    });
    successResponseHelper(res, 200, "", userData);
  } catch (e) {
    const message = getErrorMessage(e);
    adminLogger.error(message, new Error(e));
    errorResponseHelper(res, 500, message);
  }
};

export default {
  createWallets,
  login,
  getWallets,
  getAdminAnalytics,
  getAllTransactions,
  getAllUsers,
  withdrawAssets,
  getTransactionFee,
  newTransactionFee,
  getFeeWalletBalance,
  changePassword,
  updateEmail,
  updateFeeLimits,
  updateTransferFees,
  getTransferFees,
};
