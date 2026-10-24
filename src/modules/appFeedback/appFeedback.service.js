import { createService } from "../../services/service.factory.js";
import { repository } from "./appFeedback.repository.js";

const baseService = createService({
  collection: "appFeedback",
  repository,
  ownerField: "userId",
});

export const service = {
  ...baseService,
  async create(data, actor) {
    return baseService.create(
      {
        ...data,
        userId: actor?.id,
        status: "new",
      },
      actor,
    );
  },
};
