import express from "express";
import { apiController } from "../controller";
import { apiMiddleware, authMiddleware } from "../middleware";

const apiRouter = express.Router();

// API Key Management
apiRouter.post("/addApi", authMiddleware, apiMiddleware, apiController.addApi);
apiRouter.get("/getApi", authMiddleware, apiController.getApi);
apiRouter.get("/getApi/:id", authMiddleware, apiController.getApiById);
apiRouter.put("/updateApi/:id", authMiddleware, apiController.updateApi);
apiRouter.post("/regenerateKey/:id", authMiddleware, apiController.regenerateApiKey);
apiRouter.put("/toggleStatus/:id", authMiddleware, apiController.toggleApiStatus);
apiRouter.post("/revoke/:id", authMiddleware, apiController.revokeApi);
apiRouter.delete("/deleteApi/:id", authMiddleware, apiController.deleteApi);

// Plan Management
apiRouter.post("/createPlan", authMiddleware, apiMiddleware, apiController.createPlan);
apiRouter.get("/getPlans/:id", authMiddleware, apiController.getPlans);
apiRouter.put("/updatePlan/:id", authMiddleware, apiController.updatePlan);
apiRouter.delete("/deletePlan/:id", authMiddleware, apiController.deletePlan);

// Customer Management
apiRouter.post("/getApiCustomers", authMiddleware, apiController.getApiCustomers);
apiRouter.put("/updateCustomer/:id", authMiddleware, apiController.updateCustomer);
apiRouter.delete("/deleteCustomer/:id", authMiddleware, apiController.deleteCustomer);

export default apiRouter;
