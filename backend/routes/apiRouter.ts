import express from "express";
import { apiController } from "../controller";
import { apiMiddleware } from "../middleware";

const apiRouter = express.Router();

apiRouter.post("/addApi", apiMiddleware, apiController.addApi);
apiRouter.post("/createPlan", apiMiddleware, apiController.createPlan);
apiRouter.post("/getApiCustomers", apiController.getApiCustomers);
apiRouter.get("/getApi", apiController.getApi);
apiRouter.get("/getPlans/:id", apiController.getPlans);
apiRouter.delete("/deleteApi/:id", apiController.deleteApi);

export default apiRouter;
