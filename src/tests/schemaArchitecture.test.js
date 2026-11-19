import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { models, syncAllIndexes } from "../database/models.js";
import { buildAuditDiff, AUDIT_REDACT_PATHS } from "../services/audit.service.js";
import { CURRENT_SCHEMA_VERSION } from "../database/schemaCommon.js";
import { makeReferenceId, REFERENCE_ID_PREFIXES } from "../utils/id.js";
import { ADMIN_STATUSES, MESSAGE_TYPES, PAYMENT_DIRECTIONS, REPORT_EXPORT_STATUSES } from "../constants/enums.js";

describe("schema architecture — new collections", () => {
  let mongo;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri(), { autoIndex: true });
    await syncAllIndexes();
  }, 120_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  beforeEach(async () => {
    await models.Favorite.deleteMany({});
    await models.Device.deleteMany({});
  });

  test("registers the six approved new collections plus migrations", () => {
    expect(models.Device.collection.collectionName).toBe("devices");
    expect(models.Favorite.collection.collectionName).toBe("favorites");
    expect(models.PropertyDailyStat.collection.collectionName).toBe("propertyDailyStats");
    expect(models.Location.collection.collectionName).toBe("locations");
    expect(models.ConversationMessage.collection.collectionName).toBe("conversationMessages");
    expect(models.BoostOrder.collection.collectionName).toBe("boostOrders");
    expect(models.Migration.collection.collectionName).toBe("migrations");
  });

  test("does not recreate a reports document collection", () => {
    expect(mongoose.models.Report).toBeUndefined();
  });

  test("reference id prefixes cover new named collections", () => {
    expect(REFERENCE_ID_PREFIXES.locations).toBe("BG-LOC");
    expect(REFERENCE_ID_PREFIXES.boostOrders).toBe("BG-BST");
    expect(REFERENCE_ID_PREFIXES.contentItems).toBe("BG-CNT");
    expect(makeReferenceId("boostOrders")).toMatch(/^BG-BST-\d{4}-[A-Z0-9]{6}$/);
  });

  test("new enums required by the architecture are present", () => {
    expect(ADMIN_STATUSES).toEqual(expect.arrayContaining(["invited", "active", "suspended"]));
    expect(MESSAGE_TYPES).toContain("counter_offer");
    expect(PAYMENT_DIRECTIONS).toEqual(["inbound", "outbound"]);
    expect(REPORT_EXPORT_STATUSES).toEqual(expect.arrayContaining(["completed", "ready"]));
  });

  test("P1 missing fields exist on critical schemas", () => {
    expect(models.SalesDeal.schema.path("notes")).toBeTruthy();
    expect(models.SalesDeal.schema.path("lostAtStage")).toBeTruthy();
    expect(models.SalesDeal.schema.path("stageEnteredAt")).toBeTruthy();
    expect(models.BuyEnquiry.schema.path("notes")).toBeTruthy();
    expect(models.BuyEnquiry.schema.path("isOpen")).toBeTruthy();
    expect(models.Visit.schema.path("visitAt")).toBeTruthy();
    expect(models.Visit.schema.path("buyerSnapshot.name")).toBeTruthy();
    expect(models.Visit.schema.path("propertySnapshot.title")).toBeTruthy();
    expect(models.Visit.schema.path("slotActive")).toBeTruthy();
    expect(models.SellRequest.schema.path("duplicateOf")).toBeTruthy();
    expect(models.Acquisition.schema.path("notes")).toBeTruthy();
    expect(models.Admin.schema.path("referenceId")).toBeTruthy();
    expect(models.Admin.schema.path("status")).toBeTruthy();
    expect(models.AuditLog.schema.path("description")).toBeTruthy();
    expect(models.AuditLog.schema.path("actorName")).toBeTruthy();
    expect(models.Notification.schema.path("dedupeKey")).toBeTruthy();
    expect(models.Payment.schema.path("direction")).toBeTruthy();
    expect(models.Payment.schema.path("isOpen")).toBeTruthy();
    expect(models.Property.schema.path("media.droneVideoUrl")).toBeTruthy();
  });

  test("deprecated compatibility fields remain readable", () => {
    expect(models.User.schema.path("otp")).toBeTruthy();
    expect(models.User.schema.path("pushDevices")).toBeTruthy();
    expect(models.Property.schema.path("savedByUsers")).toBeTruthy();
    expect(models.ChatThread.schema.path("messages")).toBeTruthy();
    expect(models.SupportTicket.schema.path("responses")).toBeTruthy();
  });

  test("schemaVersion defaults to current", () => {
    const userPath = models.User.schema.path("schemaVersion");
    expect(userPath).toBeTruthy();
    expect(userPath.defaultValue).toBe(CURRENT_SCHEMA_VERSION);
  });

  test("favorites enforce unique user+property", async () => {
    const userId = new mongoose.Types.ObjectId();
    const propertyId = new mongoose.Types.ObjectId();
    await models.Favorite.create({ userId, propertyId, priceAtSave: 100 });
    await expect(models.Favorite.create({ userId, propertyId, priceAtSave: 100 }))
      .rejects.toThrow(/E11000|duplicate/i);
  });

  test("devices upsert by tokenHash uniqueness", async () => {
    const userId = new mongoose.Types.ObjectId();
    await models.Device.create({
      token: "a".repeat(40),
      tokenHash: "hash-1",
      userId,
      platform: "android",
      lastSeenAt: new Date()
    });
    await expect(models.Device.create({
      token: "b".repeat(40),
      tokenHash: "hash-1",
      userId,
      platform: "ios",
      lastSeenAt: new Date()
    })).rejects.toThrow(/E11000|duplicate/i);
  });

  test("audit redaction strips sensitive paths and builds a diff", () => {
    expect(AUDIT_REDACT_PATHS).toEqual(expect.arrayContaining(["bankDetails", "otp", "passwordHash", "pushDevices"]));
    const { before, after, changedFields } = buildAuditDiff(
      { name: "A", bankDetails: { ifsc: "HDFC0001234" }, city: "Chennai" },
      { name: "B", bankDetails: { ifsc: "HDFC0001234" }, city: "Chennai" }
    );
    expect(changedFields).toContain("name");
    expect(changedFields).not.toContain("city");
    expect(before.bankDetails).toBeUndefined();
    expect(after.name).toBe("B");

    const sensitive = buildAuditDiff(
      { otp: "123456", passwordHash: "x" },
      { otp: null, passwordHash: "y" }
    );
    expect(sensitive.before.otp).toBe("[redacted]");
    expect(sensitive.after.passwordHash).toBe("[redacted]");
  });

  describe("safe hardening", () => {
    const sameKeys = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const findIndex = (model, keys) => model.schema.indexes().find(([fields]) => sameKeys(fields, keys));
    const expiringIndexes = (model) => model.schema.indexes().filter(([, options]) => options?.expireAfterSeconds !== undefined);

    test("notifications, searchHistory and reportExports declare NO TTL indexes", () => {
      expect(expiringIndexes(models.Notification)).toEqual([]);
      expect(expiringIndexes(models.SearchHistory)).toEqual([]);
      expect(expiringIndexes(models.ReportExport)).toEqual([]);
    });

    test("[D] indexes are retained until post-deploy monitoring ends", () => {
      expect(findIndex(models.Notification, { isRead: 1 })).toBeTruthy();
      expect(findIndex(models.Notification, { userId: 1, channel: 1, isRead: 1 })).toBeTruthy(); // partial unread index
      expect(findIndex(models.CommunicationLog, { entityType: 1 })).toBeTruthy();
      expect(findIndex(models.CommunicationLog, { entityId: 1 })).toBeTruthy();
      expect(findIndex(models.AppFeedback, { status: 1 })).toBeTruthy();
      expect(findIndex(models.AppFeedback, { status: 1, createdAt: -1 })).toBeTruthy();
      expect(findIndex(models.AdminSetting, { updatedAt: -1 })).toBeTruthy();

      const globalIdempotency = findIndex(models.Payment, { idempotencyKey: 1 });
      expect(globalIdempotency?.[1]).toMatchObject({ unique: true, sparse: true });
      const perUserIdempotency = findIndex(models.Payment, { userId: 1, idempotencyKey: 1 });
      expect(perUserIdempotency?.[1]).toMatchObject({ unique: true });
      expect(perUserIdempotency?.[1].partialFilterExpression).toBeTruthy();
    });

    test("Device derives tokenHash (sha256 hex) on validate when only token is provided", async () => {
      const token = "t".repeat(40);
      const device = new models.Device({ token, userId: new mongoose.Types.ObjectId(), platform: "android" });
      await device.validate();
      expect(device.tokenHash).toBe(createHash("sha256").update(token).digest("hex"));

      const explicit = new models.Device({ token, tokenHash: "custom", userId: new mongoose.Types.ObjectId(), platform: "ios" });
      await explicit.validate();
      expect(explicit.tokenHash).toBe("custom");
    });

    test("stageEnteredAt has no schema default (legacy docs are not hydrated with 'now')", () => {
      expect(models.SalesDeal.schema.path("stageEnteredAt").defaultValue).toBeUndefined();
      expect(models.Acquisition.schema.path("stageEnteredAt").defaultValue).toBeUndefined();
      const legacy = models.SalesDeal.hydrate({ _id: new mongoose.Types.ObjectId(), stage: "new_enquiry" });
      expect(legacy.stageEnteredAt).toBeUndefined();
    });

    test("stageEnteredAt is stamped on first save of a new deal / acquisition", async () => {
      const deal = new models.SalesDeal({ referenceId: "BG-DEAL-T-1", buyerId: new mongoose.Types.ObjectId(), propertyId: new mongoose.Types.ObjectId() });
      expect(deal.stageEnteredAt).toBeUndefined();
      await deal.save();
      expect(deal.stageEnteredAt).toBeInstanceOf(Date);

      const acquisition = new models.Acquisition({ referenceId: "BG-ACQ-T-1" });
      expect(acquisition.stageEnteredAt).toBeUndefined();
      await acquisition.save();
      expect(acquisition.stageEnteredAt).toBeInstanceOf(Date);

      await models.SalesDeal.deleteMany({ referenceId: "BG-DEAL-T-1" });
      await models.Acquisition.deleteMany({ referenceId: "BG-ACQ-T-1" });
    });

    test("payments auto-fill paidAt and direction without rejecting", async () => {
      const payment = new models.Payment({
        referenceId: "BG-PAY-T-1",
        userId: new mongoose.Types.ObjectId(),
        type: "refund",
        amount: 1000,
        status: "paid"
      });
      await payment.validate();
      expect(payment.direction).toBe("outbound");
      expect(payment.paidAt).toBeInstanceOf(Date);
    });

    test("properties auto-fill soldAt when sold", async () => {
      const property = new models.Property({ status: "sold" });
      await property.validate().catch(() => {}); // other required fields may be missing; the hook still runs first
      expect(property.soldAt).toBeInstanceOf(Date);
    });

    test("sell requests derive photosCount / documentsCount but never completenessPercent", async () => {
      const doc = new models.SellRequest({ photos: ["a", "b"], completenessPercent: 40 });
      await doc.validate().catch(() => {});
      expect(doc.photosCount).toBe(2);
      expect(doc.documentsCount).toBe(0);
      expect(doc.completenessPercent).toBe(40);
    });

    test("reportExports keep fileContent / downloadTokenHash out of default selects, keep downloadToken", () => {
      const schema = models.ReportExport.schema;
      expect(schema.path("fileContent").options.select).toBe(false);
      expect(schema.path("downloadTokenHash").options.select).toBe(false);
      expect(schema.path("downloadToken")).toBeTruthy();
    });

    test("audit redaction hides sensitive leaf keys at any depth", () => {
      const { after } = buildAuditDiff(
        { meta: { x: 1 } },
        {
          meta: { x: 2 },
          payload: { user: { passwordHash: "h", nested: [{ otpHash: "o", salt: "s", keep: "ok" }] } },
          export: { fileContent: "bytes", downloadTokenHash: "t" },
          gateway: { providerResponse: { raw: 1 }, gatewaySignature: "sig" }
        }
      );
      expect(after.payload.user.passwordHash).toBe("[redacted]");
      expect(after.payload.user.nested[0].otpHash).toBe("[redacted]");
      expect(after.payload.user.nested[0].salt).toBe("[redacted]");
      expect(after.payload.user.nested[0].keep).toBe("ok");
      expect(after.export.fileContent).toBe("[redacted]");
      expect(after.export.downloadTokenHash).toBe("[redacted]");
      expect(after.gateway.providerResponse).toBe("[redacted]");
      expect(after.gateway.gatewaySignature).toBe("[redacted]");
    });

    test("migration documents accept a result summary", async () => {
      const id = "test-migration-result";
      await models.Migration.create({ _id: id, status: "applied", result: { migrated: 3 } });
      const found = await models.Migration.findById(id).lean();
      expect(found.result).toEqual({ migrated: 3 });
      await models.Migration.deleteOne({ _id: id });
    });
  });

  test("syncAllIndexes reports every registered model", async () => {
    const results = await syncAllIndexes();
    const failed = results.filter((row) => row.status === "error");
    expect(failed).toEqual([]);
    expect(results.length).toBe(Object.keys(models).length);
  }, 120_000);
});
