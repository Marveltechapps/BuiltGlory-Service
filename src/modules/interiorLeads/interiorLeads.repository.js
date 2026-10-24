import { InteriorLead } from "./interiorLeads.model.js";
import { createRepository } from "../../database/repository.factory.js";
export const repository = createRepository(InteriorLead);