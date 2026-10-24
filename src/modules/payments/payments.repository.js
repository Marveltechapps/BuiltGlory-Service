import { Payment } from "./payments.model.js";
import { createRepository } from "../../database/repository.factory.js";
export const repository = createRepository(Payment);