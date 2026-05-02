import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storesRouter from "./stores";
import chemicalsRouter from "./chemicals";
import inventoryRouter from "./inventory";
import scanRouter from "./scan";
import alertsRouter from "./alerts";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storesRouter);
router.use(chemicalsRouter);
router.use(scanRouter);
router.use(inventoryRouter);
router.use(alertsRouter);

export default router;
