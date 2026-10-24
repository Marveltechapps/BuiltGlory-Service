import { Notification } from "./notifications.model.js";
import { createRepository } from "../../database/repository.factory.js";
export const repository = createRepository(Notification);