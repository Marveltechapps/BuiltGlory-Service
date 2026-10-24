import { SalesDeal } from "./salesDeals.model.js";
import { createRepository } from "../../database/repository.factory.js";
const baseRepository = createRepository(SalesDeal);
const populateAssigned = async (doc) => {
  if (!doc) return doc;
  await SalesDeal.populate(doc, { path: "assignedTo", select: "name email" });
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
      await SalesDeal.populate(result.data, { path: "assignedTo", select: "name email" });
    }
    return result;
  }
};
