import { User } from "./users.model.js";
import { createRepository } from "../../database/repository.factory.js";
export const repository = createRepository(User);