import { BoostOrder } from "./boostOrders.model.js";
import { createRepository } from "../../database/repository.factory.js";

export const repository = createRepository(BoostOrder);
