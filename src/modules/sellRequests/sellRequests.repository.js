import { SellRequest } from "./sellRequests.model.js";
import { createRepository } from "../../database/repository.factory.js";
export const repository = createRepository(SellRequest);