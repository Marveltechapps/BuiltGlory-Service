import { ChatThread } from "./chatThreads.model.js";
import { createRepository } from "../../database/repository.factory.js";
export const repository = createRepository(ChatThread);