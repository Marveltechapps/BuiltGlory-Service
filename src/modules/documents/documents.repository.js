import { Document } from "./documents.model.js";
import { createRepository } from "../../database/repository.factory.js";
export const repository = createRepository(Document);