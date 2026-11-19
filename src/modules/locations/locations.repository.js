import { Location } from "./locations.model.js";
import { createRepository } from "../../database/repository.factory.js";

export const repository = createRepository(Location);
