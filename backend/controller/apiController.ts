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
import { userWalletAddressModel } from "../models/userModels";
import { apiLogger } from "../utils/loggers";
import crypto from "crypto";
import sequelize from "../utils/dbInstance";
import { Op, QueryTypes } from "sequelize";
import flw from "../apis/flutterwaveApi";

const addApi = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { company_id, base_currency, withdrawal_whitelist, api_name, permissions } = req.body;

    const keyData = {
      base_currency,
      company_id,
      adm_id: userData.user_id,
    };

    // Default permissions if not provided
    const defaultPermissions = ["payments", "transactions", "webhooks", "wallets"];
    const apiPermissions = permissions || defaultPermissions;

    // Check for at least 1 wallet address for this company
    const walletAddresses = await userWalletAddressModel.findOne({
      where: {
        user_id: userData.user_id,
        ...(company_id && { company_id }),
      },
    });


    if(!walletAddresses){
      return errorResponseHelper(
        res,
        500,
        "User does not have any wallet address configured for this company!"
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
        "API for this company and currency already exists!"
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
        errorResponseHelper(res, 500, "Company does not exist!");
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
          withdrawal_whitelist: withdrawal_whitelist,
          api_name: api_name || `${company_data.dataValues.company_name} API`,
          permissions: JSON.stringify(apiPermissions),  // Store permissions as JSON
        });

        successResponseHelper(res, 200, "API generated successfully!", {
          ...resData.dataValues,
          ...company_data.dataValues,
          permissions: apiPermissions,  // Return parsed permissions
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
        order by a."createdAt" DESC
        `,
      { type: QueryTypes.SELECT }
    );
    
    // Parse permissions JSON for each API
    const formattedData = resData.map((api: any) => ({
      ...api,
      permissions: api.permissions ? JSON.parse(api.permissions) : ["payments", "transactions", "webhooks", "wallets"],
    }));
    
    successResponseHelper(res, 200, "", formattedData);
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

/**
 * Get API by ID
 * GET /api/userApi/getApi/:id
 */
const getApiById = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const api_id = req.params.id;
    
    const resData = await sequelize.query(
      `SELECT a.*, c.company_id, c.company_name FROM tbl_api a
       JOIN tbl_company c ON a.company_id = c.company_id
       WHERE a.user_id = :user_id AND a.api_id = :api_id`,
      { 
        replacements: { user_id: userData.user_id, api_id },
        type: QueryTypes.SELECT 
      }
    );

    if (!resData || resData.length === 0) {
      return errorResponseHelper(res, 404, "API key not found");
    }

    const api: any = resData[0];
    const formattedData = {
      ...api,
      permissions: api.permissions ? JSON.parse(api.permissions) : ["payments", "transactions", "webhooks", "wallets"],
    };

    successResponseHelper(res, 200, "API retrieved successfully", formattedData);
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

/**
 * Update API
 * PUT /api/userApi/updateApi/:id
 * Updatable fields: api_name, permissions, withdrawal_whitelist
 */
const updateApi = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const api_id = req.params.id;
    const { api_name, permissions, withdrawal_whitelist } = req.body;

    // Check if API exists and belongs to user
    const existingApi = await apiModel.findOne({
      where: {
        api_id,
        user_id: userData.user_id,
      },
    });

    if (!existingApi) {
      return errorResponseHelper(res, 404, "API key not found");
    }

    // Build update data
    const updateData: any = {};
    
    if (api_name !== undefined) {
      updateData.api_name = api_name;
    }
    
    if (permissions !== undefined) {
      // Validate permissions array
      const validPermissions = ["payments", "transactions", "webhooks", "wallets", "invoices", "customers"];
      const invalidPerms = permissions.filter((p: string) => !validPermissions.includes(p));
      if (invalidPerms.length > 0) {
        return errorResponseHelper(res, 400, `Invalid permissions: ${invalidPerms.join(", ")}`);
      }
      updateData.permissions = JSON.stringify(permissions);
    }
    
    if (withdrawal_whitelist !== undefined) {
      updateData.withdrawal_whitelist = withdrawal_whitelist;
    }

    if (Object.keys(updateData).length === 0) {
      return errorResponseHelper(res, 400, "No valid fields to update");
    }

    await apiModel.update(updateData, {
      where: {
        api_id,
        user_id: userData.user_id,
      },
    });

    // Fetch updated record
    const updatedApi = await apiModel.findOne({
      where: { api_id },
    });

    const responseData = {
      ...updatedApi?.dataValues,
      permissions: updatedApi?.dataValues.permissions 
        ? JSON.parse(updatedApi.dataValues.permissions) 
        : ["payments", "transactions", "webhooks", "wallets"],
    };

    apiLogger.info(`API ${api_id} updated by user ${userData.user_id}`);
    successResponseHelper(res, 200, "API updated successfully", responseData);
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

/**
 * Regenerate API Key
 * POST /api/userApi/regenerateKey/:id
 */
const regenerateApiKey = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const api_id = req.params.id;

    // Check if API exists and belongs to user
    const existingApi = await apiModel.findOne({
      where: {
        api_id,
        user_id: userData.user_id,
      },
    });

    if (!existingApi) {
      return errorResponseHelper(res, 404, "API key not found");
    }

    // Generate new API key
    const keyData = {
      base_currency: existingApi.dataValues.base_currency,
      company_id: existingApi.dataValues.company_id,
      adm_id: userData.user_id,
      regenerated_at: new Date().toISOString(),
    };

    const keyString = "DYNOPAY_USER_API-" + JSON.stringify(keyData);
    const newApiKey = encrypt(keyString, process.env.API_SECRET);

    await apiModel.update(
      { apiKey: newApiKey },
      { where: { api_id, user_id: userData.user_id } }
    );

    // Fetch updated record
    const updatedApi = await apiModel.findOne({
      where: { api_id },
    });

    apiLogger.info(`API key ${api_id} regenerated by user ${userData.user_id}`);
    successResponseHelper(res, 200, "API key regenerated successfully", {
      api_id,
      apiKey: newApiKey,
      message: "Please update your integrations with the new API key"
    });
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

/**
 * Update Plan
 * PUT /api/userApi/updatePlan/:id
 */
const updatePlan = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const plan_id = req.params.id;
    const { plan_name, amount, interval } = req.body;

    // Check if plan exists and belongs to user
    const existingPlan = await planModel.findOne({
      where: {
        plan_id,
        user_id: userData.user_id,
      },
    });

    if (!existingPlan) {
      return errorResponseHelper(res, 404, "Plan not found");
    }

    // Build update data
    const updateData: any = {};
    if (plan_name !== undefined) updateData.plan_name = plan_name;
    if (amount !== undefined) updateData.amount = amount;
    if (interval !== undefined) updateData.interval = interval;

    if (Object.keys(updateData).length === 0) {
      return errorResponseHelper(res, 400, "No valid fields to update");
    }

    // Update in Flutterwave if amount or interval changed
    if (amount !== undefined || interval !== undefined) {
      try {
        await flw.PaymentPlan.update(existingPlan.dataValues.flw_plan_id, {
          name: plan_name || existingPlan.dataValues.plan_name,
          amount: amount || existingPlan.dataValues.amount,
        });
      } catch (flwError) {
        apiLogger.warn(`Failed to update plan in Flutterwave: ${getErrorMessage(flwError)}`);
        // Continue with local update even if Flutterwave fails
      }
    }

    await planModel.update(updateData, {
      where: { plan_id, user_id: userData.user_id },
    });

    const updatedPlan = await planModel.findOne({ where: { plan_id } });

    apiLogger.info(`Plan ${plan_id} updated by user ${userData.user_id}`);
    successResponseHelper(res, 200, "Plan updated successfully", updatedPlan);
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

/**
 * Delete Plan
 * DELETE /api/userApi/deletePlan/:id
 */
const deletePlan = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const plan_id = req.params.id;

    // Check if plan exists and belongs to user
    const existingPlan = await planModel.findOne({
      where: {
        plan_id,
        user_id: userData.user_id,
      },
    });

    if (!existingPlan) {
      return errorResponseHelper(res, 404, "Plan not found");
    }

    // Try to cancel in Flutterwave
    try {
      await flw.PaymentPlan.cancel(existingPlan.dataValues.flw_plan_id);
    } catch (flwError) {
      apiLogger.warn(`Failed to cancel plan in Flutterwave: ${getErrorMessage(flwError)}`);
      // Continue with local delete even if Flutterwave fails
    }

    await planModel.destroy({
      where: { plan_id, user_id: userData.user_id },
    });

    apiLogger.info(`Plan ${plan_id} deleted by user ${userData.user_id}`);
    successResponseHelper(res, 200, "Plan deleted successfully", { plan_id });
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

/**
 * Update Customer
 * PUT /api/userApi/updateCustomer/:id
 */
const updateCustomer = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const customer_id = req.params.id;
    const { customer_name, email, mobile } = req.body;

    // Get user's companies
    const userCompanies = await companyModel.findAll({
      attributes: ["company_id"],
      where: { user_id: userData.user_id },
    });
    const companyIds = userCompanies.map((c) => c.dataValues.company_id);

    // Check if customer belongs to user's company
    const existingCustomer = await customerModel.findOne({
      where: {
        customer_id,
        company_id: { [Op.in]: companyIds },
      },
    });

    if (!existingCustomer) {
      return errorResponseHelper(res, 404, "Customer not found");
    }

    // Build update data
    const updateData: any = {};
    if (customer_name !== undefined) updateData.customer_name = customer_name;
    if (email !== undefined) updateData.email = email;
    if (mobile !== undefined) updateData.mobile = mobile;

    if (Object.keys(updateData).length === 0) {
      return errorResponseHelper(res, 400, "No valid fields to update");
    }

    await customerModel.update(updateData, {
      where: { customer_id },
    });

    const updatedCustomer = await customerModel.findOne({ where: { customer_id } });

    apiLogger.info(`Customer ${customer_id} updated by user ${userData.user_id}`);
    successResponseHelper(res, 200, "Customer updated successfully", updatedCustomer);
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

/**
 * Delete Customer
 * DELETE /api/userApi/deleteCustomer/:id
 */
const deleteCustomer = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const customer_id = req.params.id;

    // Get user's companies
    const userCompanies = await companyModel.findAll({
      attributes: ["company_id"],
      where: { user_id: userData.user_id },
    });
    const companyIds = userCompanies.map((c) => c.dataValues.company_id);

    // Check if customer belongs to user's company
    const existingCustomer = await customerModel.findOne({
      where: {
        customer_id,
        company_id: { [Op.in]: companyIds },
      },
    });

    if (!existingCustomer) {
      return errorResponseHelper(res, 404, "Customer not found");
    }

    // Delete customer wallets first
    await customerWalletModel.destroy({
      where: { customer_id },
    });

    // Delete customer
    await customerModel.destroy({
      where: { customer_id },
    });

    apiLogger.info(`Customer ${customer_id} deleted by user ${userData.user_id}`);
    successResponseHelper(res, 200, "Customer deleted successfully", { customer_id });
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
  getApiById,
  updateApi,
  regenerateApiKey,
  deleteApi,
  getApiCustomers,
  updateCustomer,
  deleteCustomer,
  createPlan,
  getPlans,
  updatePlan,
  deletePlan,
};
