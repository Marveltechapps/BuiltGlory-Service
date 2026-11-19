import { createService } from "../../services/service.factory.js";
import { repository } from "./locations.repository.js";
import { badRequest, conflict } from "./locations.error.js";

const baseService = createService({ collection: "locations", repository });

const normalizeKey = (value) => String(value || "").trim().toLowerCase();

export const service = {
  ...baseService,
  async create(data, actor) {
    const payload = {
      ...data,
      key: normalizeKey(data.key),
      cityKey: normalizeKey(data.cityKey)
    };
    if (payload.kind === "city" && !payload.state) throw badRequest("state is required for city.");
    if ((payload.kind === "locality" || payload.kind === "zone") && !payload.parentId) {
      throw badRequest("parentId is required for locality/zone.");
    }
    if (payload.kind === "zone" && !payload.boundary) throw badRequest("boundary is required for zone.");
    try {
      return await baseService.create(payload, actor);
    } catch (error) {
      if (error?.code === 11000) throw conflict("Location with this kind, cityKey and key already exists.");
      throw error;
    }
  },
  async update(id, data, actor, req) {
    const patch = { ...data };
    if (patch.key) patch.key = normalizeKey(patch.key);
    if (patch.cityKey) patch.cityKey = normalizeKey(patch.cityKey);
    try {
      return await baseService.update(id, patch, actor, req);
    } catch (error) {
      if (error?.code === 11000) throw conflict("Location with this kind, cityKey and key already exists.");
      throw error;
    }
  }
};
