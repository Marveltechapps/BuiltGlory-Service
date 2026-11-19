import { createController } from "../../utils/controller.factory.js";
import { service } from "./boostOrders.service.js";

export const controller = createController(service, { idParam: "boostOrderId" });
