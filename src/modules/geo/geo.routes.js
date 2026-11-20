import { Router } from "express";
import { controller } from "./geo.controller.js";
const router = Router();
router.get("/geo/reverse", controller.getGeoReverse);
router.get("/geo/forward", controller.getGeoForward);
export default router;
