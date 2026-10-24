import { createController } from "../../utils/controller.factory.js";
import { service } from "./interiorLeads.service.js";
export const controller = createController(service);