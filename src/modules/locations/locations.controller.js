import { createController } from "../../utils/controller.factory.js";
import { service } from "./locations.service.js";

export const controller = createController(service, { idParam: "locationId" });
