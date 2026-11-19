/**
 * Backfill isOpen / slotActive / reservesProperty / payment direction for partial unique indexes.
 */
export const up = async () => {
  const mongoose = (await import("mongoose")).default;
  const db = mongoose.connection.db;
  const summary = {};

  if (await db.listCollections({ name: "buyEnquiries" }).hasNext()) {
    const closed = await db.collection("buyEnquiries").updateMany(
      { status: "closed" },
      { $set: { isOpen: false } }
    );
    const open = await db.collection("buyEnquiries").updateMany(
      { status: { $ne: "closed" }, $or: [{ isOpen: { $exists: false } }, { isOpen: null }] },
      { $set: { isOpen: true } }
    );
    summary.buyEnquiries = { closed: closed.modifiedCount, open: open.modifiedCount };
  }

  if (await db.listCollections({ name: "salesDeals" }).hasNext()) {
    const lost = await db.collection("salesDeals").updateMany(
      { stage: "lost" },
      { $set: { isOpen: false, reservesProperty: false } }
    );
    const open = await db.collection("salesDeals").updateMany(
      { stage: { $ne: "lost" }, $or: [{ isOpen: { $exists: false } }, { isOpen: null }] },
      { $set: { isOpen: true } }
    );
    const reserveStages = ["token_payment", "full_payment", "stage_payment", "interior_design", "documentation", "closed"];
    const reserved = await db.collection("salesDeals").updateMany(
      { stage: { $in: reserveStages } },
      { $set: { reservesProperty: true } }
    );
    const unreserved = await db.collection("salesDeals").updateMany(
      { stage: { $nin: reserveStages } },
      { $set: { reservesProperty: false } }
    );
    summary.salesDeals = {
      lost: lost.modifiedCount,
      open: open.modifiedCount,
      reserved: reserved.modifiedCount,
      unreserved: unreserved.modifiedCount
    };
  }

  if (await db.listCollections({ name: "payments" }).hasNext()) {
    const open = await db.collection("payments").updateMany(
      { status: { $in: ["created", "pending"] } },
      { $set: { isOpen: true } }
    );
    const closed = await db.collection("payments").updateMany(
      { status: { $nin: ["created", "pending"] } },
      { $set: { isOpen: false } }
    );
    const inbound = await db.collection("payments").updateMany(
      { type: { $in: ["token", "full", "stage"] }, direction: { $exists: false } },
      { $set: { direction: "inbound" } }
    );
    const outbound = await db.collection("payments").updateMany(
      { type: { $in: ["seller_payout", "refund"] }, direction: { $exists: false } },
      { $set: { direction: "outbound" } }
    );
    summary.payments = {
      open: open.modifiedCount,
      closed: closed.modifiedCount,
      inbound: inbound.modifiedCount,
      outbound: outbound.modifiedCount
    };
  }

  if (await db.listCollections({ name: "visits" }).hasNext()) {
    const active = await db.collection("visits").updateMany(
      { status: { $in: ["scheduled", "confirmed", "rescheduled"] } },
      { $set: { slotActive: true } }
    );
    const inactive = await db.collection("visits").updateMany(
      { status: { $in: ["completed", "cancelled", "missed"] } },
      { $set: { slotActive: false } }
    );
    summary.visits = { active: active.modifiedCount, inactive: inactive.modifiedCount };
  }

  if (await db.listCollections({ name: "supportTickets" }).hasNext()) {
    const open = await db.collection("supportTickets").updateMany(
      { status: { $in: ["open", "in_progress"] } },
      { $set: { isOpen: true } }
    );
    const closed = await db.collection("supportTickets").updateMany(
      { status: { $in: ["resolved", "closed"] } },
      { $set: { isOpen: false } }
    );
    summary.supportTickets = { open: open.modifiedCount, closed: closed.modifiedCount };
  }

  return summary;
};
