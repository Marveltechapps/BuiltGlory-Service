import { Visit } from "./visits.model.js";
import { createRepository } from "../../database/repository.factory.js";
export const repository = createRepository(Visit);