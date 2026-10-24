import { Router } from "express";
import { controller } from "./appConfig.controller.js";

const router = Router();

router.get("/app/config", controller.getPublicConfig);

export default router;
