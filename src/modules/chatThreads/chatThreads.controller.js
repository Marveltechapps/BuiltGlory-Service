import { createController } from "../../utils/controller.factory.js";
import { service } from "./chatThreads.service.js";
export const controller = createController(service);