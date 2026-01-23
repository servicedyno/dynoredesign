import express from "express";
import {
  errorResponseHelper,
  getErrorMessage,
  successResponseHelper,
} from "../helper";
import jwt from "jsonwebtoken";
import { IUserType } from "../utils/types";
import { companyModel } from "../models";
import { companyLogger } from "../utils/loggers";
import sequelize from "../utils/dbInstance";
import { QueryTypes } from "sequelize";

const addCompany = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const file = req.file as Express.Multer.File;
    const data = JSON.parse(req.body.data);
    let photo;
    if (file) {
      photo = process.env.SERVER_URL + "images/" + file.filename;
    }
    const resData = await companyModel.create({
      ...data,
      user_id: userData.user_id,
      photo,
    });

    successResponseHelper(res, 200, "Company added successfully!", resData);
  } catch (e) {
    const message = getErrorMessage(e);
    companyLogger.error(
      message,
      { user_id: userData.user_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

const updateCompany = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const file = req.file as Express.Multer.File;
    const data = JSON.parse(req.body.data);
    const company_id = req.params.id;
    let photo;
    if (file) {
      photo = process.env.SERVER_URL + "images/" + file.filename;
    }
    const resData = await companyModel.update(
      {
        ...data,
        user_id: userData.user_id,
        ...(photo && { photo }),
      },
      {
        where: {
          user_id: userData.user_id,
          company_id,
        },
        returning: true,
      }
    );

    const finalArray = resData[1][0].dataValues;
    successResponseHelper(
      res,
      200,
      "Company updated successfully!",
      finalArray
    );
  } catch (e) {
    const message = getErrorMessage(e);
    companyLogger.error(
      message,
      { user_id: userData.user_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

const getCompany = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const resData = await companyModel.findAll({
      where: {
        user_id: userData.user_id,
      },
    });
    successResponseHelper(res, 200, "", resData);
  } catch (e) {
    const message = getErrorMessage(e);
    companyLogger.error(
      message,
      { user_id: userData.user_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

const deleteCompany = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const company_id = req.params.id;
    const resData = await companyModel.destroy({
      where: {
        user_id: userData.user_id,
        company_id,
      },
    });
    successResponseHelper(res, 200, "Company deleted successfully!", resData);
  } catch (e) {
    const message = getErrorMessage(e);
    companyLogger.error(
      message,
      { user_id: userData.user_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

const getTransactions = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const id = req.params.id;

    const resData = await sequelize.query(
      `
      select ut.*,c.customer_name,c.email,cm.company_name,cm.company_id from tbl_user_transaction ut 
      join tbl_customer c on c.customer_id=ut.customer_id
      join tbl_company cm on cm.company_id=c.company_id where c.company_id=${id}`,
      { type: QueryTypes.SELECT }
    );

    const finalRes = resData.map((x) => {
      const { wallet_id, ...rest }: any = x;
      return rest;
    });

    successResponseHelper(res, 200, "", finalRes);
  } catch (e) {
    const message = getErrorMessage(e);
    companyLogger.error(
      message,
      { user_id: userData.user_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

export default {
  addCompany,
  getCompany,
  deleteCompany,
  updateCompany,
  getTransactions,
};
