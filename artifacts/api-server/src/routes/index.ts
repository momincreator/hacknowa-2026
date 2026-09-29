import { Router, type IRouter } from "express";
import healthRouter from "./health";
import analyzeUrlRouter from "./analyze-url";

const router: IRouter = Router();

router.use(healthRouter);
router.use(analyzeUrlRouter);

export default router;
