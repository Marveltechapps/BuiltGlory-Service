import { visitDateTime } from "../shared/visitTime.js";
import { buyerProgressPercent, buyerStepIndex, sellerProgressPercent, sellerStepIndex } from "../shared/customerProgress.js";

describe("visit slot timezone", () => {
  it("treats 11:00 AM as 11:00 in Asia/Kolkata", () => {
    expect(visitDateTime({ visitDate: "2026-10-21", visitTime: "11:00 AM" }).toISOString()).toBe("2026-10-21T05:30:00.000Z");
  });

  it("treats 2:00 PM as 14:00 in Asia/Kolkata", () => {
    expect(visitDateTime({ visitDate: "2026-10-21", visitTime: "2:00 PM" }).toISOString()).toBe("2026-10-21T08:30:00.000Z");
  });
});

describe("customer deal progress", () => {
  it("starts a new buyer enquiry on the verification step", () => {
    expect(buyerStepIndex({ enquiry: { status: "new" } })).toBe(1);
    expect(buyerProgressPercent({ enquiry: { status: "new" } })).toBe(10);
  });

  it("marks a closed buyer deal as complete", () => {
    expect(buyerProgressPercent({ enquiry: { status: "negotiating" }, deal: { stage: "closed" } })).toBe(100);
  });

  it("holds token payment on KYC until the buyer is verified", () => {
    const deal = { stage: "token_payment" };
    expect(buyerStepIndex({ enquiry: { status: "negotiating" }, deal, kycStatus: "pending" })).toBe(5);
    expect(buyerStepIndex({ enquiry: { status: "negotiating" }, deal, kycStatus: "verified" })).toBe(6);
  });

  it("moves an accepted seller offer to deal confirmation", () => {
    const acquisition = { stage: "negotiation", negotiation: { status: "seller_accepted", sellerDecision: { decision: "accepted" } } };
    expect(sellerStepIndex({ sellRequest: { status: "negotiating" }, acquisition, offer: { amount: 1 } })).toBe(8);
    expect(sellerProgressPercent({ sellRequest: { status: "sold" }, acquisition })).toBe(100);
  });
});
