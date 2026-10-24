import { createController } from "../../utils/controller.factory.js";
import { service } from "./buyEnquiries.service.js";
export const controller = createController(service);