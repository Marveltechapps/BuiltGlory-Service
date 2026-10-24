import { createController } from "../../utils/controller.factory.js";
import { service } from "./appFeedback.service.js";

export const controller = createController(service);
