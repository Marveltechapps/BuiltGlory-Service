import { jest } from "@jest/globals";
import { Property } from "../../modules/properties/properties.model.js";
import { errorHandler } from "../../modules/error/index.js";
import { AppError } from "../../modules/error/index.js";
import { createRepository } from "../../database/repository.factory.js";
import { seedProperty, setupIntegrationDb } from "../helpers/integrationHarness.js";

jest.setTimeout(60_000);
setupIntegrationDb();

const invokeErrorHandler = (err) => new Promise((resolve) => {
  const res = {
    locals: { requestId: "db-error-1" },
    statusCode: 0,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; resolve(this); }
  };
  errorHandler(err, {}, res, () => {});
});

describe("database", () => {
  test("repository hides soft-deleted properties", async () => {
    const visible = await seedProperty({ title: "Visible plot" });
    const removed = await seedProperty({ title: "Removed plot" });
    const repository = createRepository(Property);
    await repository.softDelete(removed._id, null);

    await expect(repository.findById(removed._id)).rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" });
    const listed = await repository.list({ limit: 50 });
    const titles = listed.data.map((row) => row.title);
    expect(titles).toContain("Visible plot");
    expect(titles).not.toContain("Removed plot");
    expect(String(visible._id)).not.toBe(String(removed._id));
  });

  test("duplicate reference ids are stored as Mongo duplicate-key errors", async () => {
    await Property.init();
    const payload = {
      referenceId: "PROP-AUTOMATION-DUP",
      title: "First",
      type: "plot",
      price: 1000,
      address: { city: "Bengaluru" }
    };
    await Property.create(payload);
    await expect(Property.create({ ...payload, title: "Second" })).rejects.toMatchObject({ code: 11000 });
  });
});

describe("error handling", () => {
  test("duplicate keys become a conflict envelope without a stack", async () => {
    const duplicate = Object.assign(new Error("E11000 duplicate key error index: email_1"), {
      code: 11000,
      keyPattern: { email: 1 },
      keyValue: { email: "owner@builtglory.test" }
    });
    const res = await invokeErrorHandler(duplicate);
    expect(res.statusCode).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
    expect(res.body.error.message).toMatch(/email/i);
    expect(res.body.error.details[0].field).toBe("email");
    expect(JSON.stringify(res.body)).not.toMatch(/at\s+\S+\s+\(/);
    expect(res.body.meta.requestId).toBe("db-error-1");
  });

  test("operational errors keep their status and unknown errors stay generic", async () => {
    const operational = await invokeErrorHandler(new AppError(422, "DOMAIN_RULE_VIOLATION", "Deal cannot close.", [{ field: "stage", message: "Token unpaid." }]));
    expect(operational.statusCode).toBe(422);
    expect(operational.body.error.message).toBe("Deal cannot close.");
    expect(operational.body.error.details[0].field).toBe("stage");

    const unexpected = await invokeErrorHandler(Object.assign(new Error("mongo credentials leaked in this message"), { stack: "Error: secret\n    at internal.js:1:1" }));
    expect(unexpected.statusCode).toBe(500);
    expect(unexpected.body.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(unexpected.body.error.message).toBe("Unexpected server error.");
    expect(JSON.stringify(unexpected.body)).not.toContain("mongo credentials");
    expect(JSON.stringify(unexpected.body)).not.toContain("internal.js");
  });

  test("parser client errors keep their HTTP status", async () => {
    const tooLarge = await invokeErrorHandler(Object.assign(new Error("request entity too large"), { status: 413, type: "entity.too.large" }));
    expect(tooLarge.statusCode).toBe(413);
    expect(tooLarge.body.error.code).toBe("PAYLOAD_TOO_LARGE");

    const badJson = await invokeErrorHandler(Object.assign(new SyntaxError("Unexpected token }"), { status: 400, type: "entity.parse.failed" }));
    expect(badJson.statusCode).toBe(400);
    expect(badJson.body.error.code).toBe("VALIDATION_ERROR");
  });
});
