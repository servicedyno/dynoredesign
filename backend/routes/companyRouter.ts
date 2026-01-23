import express from "express";
import { companyController } from "../controller";
import { companyMiddleware, uploadImage } from "../middleware";
const companyRouter = express.Router();

companyRouter.post(
  "/addCompany",
  uploadImage.single("image"),
  companyMiddleware,
  companyController.addCompany
);

companyRouter.put(
  "/updateCompany/:id",
  uploadImage.single("image"),
  companyMiddleware,
  companyController.updateCompany
);

companyRouter.get("/getCompany", companyController.getCompany);
companyRouter.get("/getTransactions/:id", companyController.getTransactions);
companyRouter.delete("/deleteCompany/:id", companyController.deleteCompany);

export default companyRouter;
