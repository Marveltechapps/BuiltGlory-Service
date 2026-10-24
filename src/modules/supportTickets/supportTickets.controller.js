import { createController } from "../../utils/controller.factory.js";
import { service } from "./supportTickets.service.js";
export const controller = createController(service);