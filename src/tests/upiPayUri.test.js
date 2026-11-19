import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { buildUpiPayUri, isValidUpiId } = require("../../../BG-Customer App/src/lib/upiPay.js");

describe("UPI payment URI", () => {
  test("encodes the escrow id, amount, and INR currency", () => {
    const uri = buildUpiPayUri({
      upiId: "builtglory@okhdfcbank",
      payee: "Builtglory Escrow",
      amount: 250000,
      note: "Token BG-1",
      transactionRef: "token-1"
    });
    const params = new URLSearchParams(uri.slice("upi://pay?".length));
    expect(params.get("pa")).toBe("builtglory@okhdfcbank");
    expect(params.get("am")).toBe("250000.00");
    expect(params.get("cu")).toBe("INR");
    expect(params.get("pn")).toBe("Builtglory Escrow");
    expect(params.get("tn")).toBe("Token BG-1");
    expect(isValidUpiId("builtglory@okhdfcbank")).toBe(true);
    expect(isValidUpiId("not-a-upi")).toBe(false);
    expect(() => buildUpiPayUri({ upiId: "bad", amount: 1 })).toThrow(/valid UPI/);
  });
});
