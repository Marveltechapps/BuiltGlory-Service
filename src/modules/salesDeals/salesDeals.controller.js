import { createController } from "../../utils/controller.factory.js";
import { service } from "./salesDeals.service.js";
export const controller = createController(service);