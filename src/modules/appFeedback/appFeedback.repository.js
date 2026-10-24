import { AppFeedback } from "./appFeedback.model.js";
import { createRepository } from "../../database/repository.factory.js";

export const repository = createRepository(AppFeedback);
