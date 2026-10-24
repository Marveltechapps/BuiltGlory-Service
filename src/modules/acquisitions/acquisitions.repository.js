import { Acquisition } from "./acquisitions.model.js";
import { createRepository } from "../../database/repository.factory.js";
const baseRepository = createRepository(Acquisition);
const populateAssigned = async (doc) => {
  if (!doc) return doc;
  await Acquisition.populate(doc, { path: "assignedTo", select: "name email" });
  return doc;
};
export const repository = {
  ...baseRepository,
  async findById(id, projection, options = {}) {
    return populateAssigned(await baseRepository.findById(id, projection, options));
  },
  async update(id, patch, options = {}) {
    return populateAssigned(await baseRepository.update(id, patch, options));
  },
  async list(query = {}, forcedFilter = {}) {
    const result = await baseRepository.list(query, forcedFilter);
    if (result.data.length) {
      await Acquisition.populate(result.data, { path: "assignedTo", select: "name email" });
    }
    return result;
  }
};