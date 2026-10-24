import { Callback } from "./callbacks.model.js";
import { createRepository } from "../../database/repository.factory.js";
export const repository = createRepository(Callback);