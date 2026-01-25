import express, { RequestHandler } from "express";
import { companyController } from "../controller";
import { companyMiddleware, uploadImage, authMiddleware } from "../middleware";
const companyRouter = express.Router();

companyRouter.post(
  "/addCompany",
  authMiddleware,
  uploadImage.single("image") as unknown as RequestHandler,
  companyMiddleware,
  companyController.addCompany
);

companyRouter.put(
  "/updateCompany/:id",
  authMiddleware,
  uploadImage.single("image") as unknown as RequestHandler,
  companyMiddleware,
  companyController.updateCompany
);

companyRouter.get("/getCompany", authMiddleware, companyController.getCompany);
companyRouter.get("/getCompany/:id", authMiddleware, companyController.getCompanyById);
companyRouter.get("/getTransactions/:id", authMiddleware, companyController.getTransactions);
companyRouter.delete("/deleteCompany/:id", authMiddleware, companyController.deleteCompany);

// TAX ID Validation endpoint
companyRouter.post("/validateTaxId", authMiddleware, companyController.validateTaxId);

export default companyRouter;
