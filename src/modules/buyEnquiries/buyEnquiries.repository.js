import { BuyEnquiry } from "./buyEnquiries.model.js";
import { createRepository } from "../../database/repository.factory.js";
export const repository = createRepository(BuyEnquiry);