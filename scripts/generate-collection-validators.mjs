/**
 * DBA helper — prints $jsonSchema validators for money/identity collections (§13.3).
 * Does NOT apply collMod. A DBA (bg_migrator) must review and run against Atlas with
 * validationLevel: "moderate" after a verified backup.
 *
 * Usage: node scripts/generate-collection-validators.mjs
 */
import {
  PAYMENT_STATUSES,
  PAYMENT_TYPES,
  PAYMENT_METHODS,
  CUSTOMER_ROLES,
  USER_TYPES,
  KYC_STATUSES
} from "../src/constants/enums.js";

const moderate = { validationLevel: "moderate", validationAction: "error" };

const validators = {
  payments: {
    ...moderate,
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["referenceId", "userId", "type", "amount", "currency", "status", "method"],
        properties: {
          referenceId: { bsonType: "string" },
          userId: { bsonType: "objectId" },
          type: { enum: [...PAYMENT_TYPES] },
          amount: { bsonType: ["int", "long", "double"], minimum: 1 },
          currency: { enum: ["INR"] },
          status: { enum: [...PAYMENT_STATUSES] },
          method: { enum: [...PAYMENT_METHODS] },
          paidAt: { bsonType: ["date", "null"] }
        }
      }
    }
  },
  users: {
    ...moderate,
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["referenceId", "role", "userType", "kycStatus"],
        properties: {
          referenceId: { bsonType: "string" },
          role: { enum: [...CUSTOMER_ROLES] },
          userType: { enum: [...USER_TYPES] },
          kycStatus: { enum: [...KYC_STATUSES] },
          phoneNormalized: { bsonType: ["string", "null"] }
        }
      }
    }
  },
  auditLogs: {
    ...moderate,
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["actorType", "action", "resourceType"],
        properties: {
          actorType: { enum: ["admin", "customer", "system"] },
          action: { bsonType: "string" },
          resourceType: { bsonType: "string" }
        }
      }
    }
  }
};

for (const [collection, spec] of Object.entries(validators)) {
  console.log(`\n// --- ${collection} ---`);
  console.log(JSON.stringify({ collMod: collection, ...spec }, null, 2));
}

console.log(`
// Apply only via bg_migrator after backup, e.g.:
// db.runCommand({ collMod: "payments", validator: {...}, validationLevel: "moderate", validationAction: "error" })
`);
