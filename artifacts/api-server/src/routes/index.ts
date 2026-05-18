import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storesRouter from "./stores";
import chemicalsRouter from "./chemicals";
import inventoryRouter from "./inventory";
import scanRouter from "./scan";
import alertsRouter from "./alerts";
import adminRouter from "./admin";
import ordersRouter from "./orders";
import receivedRouter from "./received";
import onhandRouter from "./onhand";
import reportsRouter from "./reports";
import notificationsRouter from "./notifications";
import pushRouter from "./push";
import exportRouter from "./export";
import pullsRouter from "./pulls";

const router: IRouter = Router();

router.use(healthRouter);
router.use(adminRouter);
router.use(storesRouter);
router.use(chemicalsRouter);
router.use(scanRouter);
router.use(inventoryRouter);
router.use(alertsRouter);
router.use(ordersRouter);
router.use(receivedRouter);
router.use(onhandRouter);
router.use(reportsRouter);
router.use(notificationsRouter);
router.use(pushRouter);
router.use(exportRouter);
router.use(pullsRouter);

export default router;
