import express, { RequestHandler } from "express";
import { companyController } from "../controller";
import { companyMiddleware, uploadImage, authMiddleware } from "../middleware";
import { companyOwnershipMiddleware } from "../middleware/authMiddleware";
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

// Webhook configuration endpoints
companyRouter.put("/webhook-settings/:id", authMiddleware, companyController.updateWebhookSettings);
companyRouter.get("/webhook-settings/:id", authMiddleware, companyController.getWebhookSettings);
companyRouter.post("/webhook-test/:id", authMiddleware, companyController.testWebhook);

// Webhook history and stats endpoints
companyRouter.get("/webhook-history/:id", authMiddleware, companyController.getWebhookHistory);
companyRouter.get("/webhook-history/:id/detail/:logId", authMiddleware, companyController.getWebhookDetail);
companyRouter.get("/webhook-stats/:id", authMiddleware, companyController.getWebhookStats);

export default companyRouter;
