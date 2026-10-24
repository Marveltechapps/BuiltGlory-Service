import { Admin } from "./admins.model.js";
import { createRepository } from "../../database/repository.factory.js";
export const repository = createRepository(Admin);