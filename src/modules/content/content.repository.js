import { ContentItem } from "./content.model.js";
import { createRepository } from "../../database/repository.factory.js";

export const repository = createRepository(ContentItem);
