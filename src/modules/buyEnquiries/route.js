import { Router } from "express";
import { controller } from "./controller.js";
import { validate } from "../../middleware/validate.js";
import { authenticate, requirePermission } from "../../middleware/auth.js";
import { listValidator, createValidator, updateValidator } from "./validator.js";
const router = Router();
router.post("/buy-enquiries", authenticate("customer"), validate(createValidator), controller.create);
router.get("/me/buy-enquiries", authenticate("customer"), validate(listValidator), controller.mine);
router.get("/me/buy-enquiries/:enquiryId", authenticate("customer"), controller.get);
router.patch("/me/buy-enquiries/:enquiryId/cancel", authenticate("customer"), controller.action(async (req, res) => { const data = await import("./service.js").then((m) => m.service.cancel(req.params.enquiryId, req.actor, req, req.body || {})); res.json({ data, meta: { requestId: res.locals.requestId } }); }));
router.get("/admin/buy-enquiries", authenticate("admin"), requirePermission("enquiries.read"), validate(listValidator), controller.list);
router.get("/admin/buy-enquiries/:enquiryId", authenticate("admin"), requirePermission("enquiries.read"), controller.get);
router.patch("/admin/buy-enquiries/:enquiryId", authenticate("admin"), requirePermission("enquiries.write"), validate(updateValidator), controller.update);
router.post("/admin/buy-enquiries/:enquiryId/convert-to-deal", authenticate("admin"), requirePermission("sales.write"), controller.action(async (req, res) => {
  const result = await import("./service.js").then((m) => m.service.convertToDeal(req.params.enquiryId, req.body || {}, req.actor));
  res.status(result.created ? 201 : 200).json({ data: result.deal, meta: { requestId: res.locals.requestId } });
}));
export default router;