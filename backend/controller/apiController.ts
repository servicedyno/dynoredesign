import express from "express";
import {
  encrypt,
  errorResponseHelper,
  getErrorMessage,
  successResponseHelper,
} from "../helper";
import jwt from "jsonwebtoken";
import { IUserType } from "../utils/types";
import {
  apiModel,
  companyModel,
  customerModel,
  customerWalletModel,
  planModel,
  userWalletModel,
} from "../models";
import { apiLogger } from "../utils/loggers";
import crypto from "crypto";
import sequelize from "../utils/dbInstance";
import { Op, QueryTypes } from "sequelize";
import flw from "../apis/flutterwaveApi";

const addApi = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { company_id, base_currency, withdrawal_whitelist } = req.body;

    const keyData = {
      base_currency,
      company_id,
      adm_id: userData.user_id,
    };

    const wallets = await userWalletModel.findOne({
      where: {
        user_id: userData.user_id,
        wallet_address: { [Op.not]: null },
      },
    });


    if(!wallets){
      return errorResponseHelper(
        res,
        500,
        "User do not have any wallet address!"
      );
    }

    const keyString = "DYNOPAY_USER_API-" + JSON.stringify(keyData);

    const apiKey = encrypt(keyString, process.env.API_SECRET);

    const isExists = await apiModel
      .findOne({
        where: {
          company_id,
          base_currency,
        },
      })
      .then((token) => token !== null)
      .then((isExists) => isExists);

    if (isExists) {
      errorResponseHelper(
        res,
        400,
        "API for this company and currency is already exists!"
      );
    } else {
      const isExists = await companyModel
        .findOne({
          where: {
            company_id,
          },
        })
        .then((token) => token !== null)
        .then((isExists) => isExists);

      if (!isExists) {
        errorResponseHelper(res, 500, "Company does not exists!");
      } else {
        const company_data = await companyModel.findOne({
          where: {
            company_id,
          },
        });
        const createdUser = await customerModel.create({
          id: crypto.randomUUID(),
          customer_name: company_data.dataValues.company_name + " admin",
          email: company_data.dataValues.email,
          mobile: company_data.dataValues.email,
          company_id: company_id,
        });

        await customerWalletModel.create({
          id: crypto.randomUUID(),
          customer_id: createdUser.dataValues.customer_id,
          wallet_type: base_currency,
        });

        const token = await getAccessToken(createdUser.dataValues.customer_id);
        const resData = await apiModel.create({
          company_id,
          base_currency: base_currency,
          apiKey,
          user_id: userData.user_id,
          adminToken: token.token,
          withdrawal_whitelist: withdrawal_whitelist
        });

        successResponseHelper(res, 200, "Api generated successfully!", {
          ...resData.dataValues,
          ...company_data.dataValues,
        });
      }
    }
  } catch (e) {
    const message = getErrorMessage(e);
    apiLogger.error(
      message,
      { user_id: userData.user_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
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

const getApi = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const resData = await sequelize.query(
      `select a.*,c.company_id,c.company_name from tbl_api a
        join tbl_company c on a.company_id=c.company_id
        where a.user_id=${userData.user_id}
        `,
      { type: QueryTypes.SELECT }
    );
    successResponseHelper(res, 200, "", resData);
  } catch (e) {
    const message = getErrorMessage(e);
    apiLogger.error(
      message,
      { user_id: userData.user_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

const deleteApi = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const api_id = req.params.id;
    const resData = await apiModel.destroy({
      where: {
        user_id: userData.user_id,
        api_id,
      },
    });
    successResponseHelper(res, 200, "Api deleted successfully!", resData);
  } catch (e) {
    const message = getErrorMessage(e);
    apiLogger.error(
      message,
      { user_id: userData.user_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

const getApiCustomers = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { rowsPerPage, page } = req.body;
    let column, sortType, offset, limit;

    if (rowsPerPage && page) {
      offset = (page - 1) * rowsPerPage;
      limit = rowsPerPage;
    }
    const company_data = await (
      await companyModel.findAll({
        attributes: ["company_id"],
        where: {
          user_id: userData.user_id,
        },
      })
    ).map((x) => x.dataValues.company_id);

    const customer_data = await customerModel.findAll({
      where: {
        company_id: {
          [Op.in]: company_data,
        },
      },
    });

    successResponseHelper(res, 200, "", customer_data);
  } catch (e) {
    const message = getErrorMessage(e);
    apiLogger.error(
      message,
      { user_id: userData.user_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

const createPlan = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { plan_name, amount, interval, company_id } = req.body;

    const apiData = await apiModel.findOne({ where: { company_id } });

    const { data } = await flw.PaymentPlan.create({
      name: plan_name,
      amount,
      interval,
      currency: apiData.dataValues?.base_currency ?? "USD",
    });

    const payload = {
      id: crypto.randomUUID(),
      user_id: userData.user_id,
      flw_plan_id: data.id,
      company_id,
      plan_name,
      amount,
      interval,
      currency: data.currency,
    };

    const planData = await planModel.create({ ...payload });

    successResponseHelper(res, 200, "Plan generated successfully!", planData);
  } catch (e) {
    const message = getErrorMessage(e);
    apiLogger.error(
      message,
      { user_id: userData.user_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

const getPlans = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  const company_id = req.params.id;
  try {
    const planData = await planModel.findAll({
      where: {
        company_id,
        user_id: userData.user_id,
      },
    });

    successResponseHelper(res, 200, "", planData);
  } catch (e) {
    const message = getErrorMessage(e);
    apiLogger.error(
      message,
      { user_id: userData.user_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

export default {
  addApi,
  getApi,
  deleteApi,
  getApiCustomers,
  createPlan,
  getPlans,
};
