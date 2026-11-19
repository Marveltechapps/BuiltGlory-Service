import { isSesIdentityError, isTransientEmailError, withEmailRetry } from "../modules/auth/auth.email.service.js";

describe("email retry helpers", () => {
  test("classifies transient SES/network errors", () => {
    expect(isTransientEmailError({ name: "Throttling", message: "Rate exceeded" })).toBe(true);
    expect(isTransientEmailError({ code: "ETIMEDOUT", message: "timeout" })).toBe(true);
    expect(isTransientEmailError({ name: "MessageRejected", message: "Email address is not verified" })).toBe(false);
  });

  test("classifies SES identity errors", () => {
    expect(isSesIdentityError({ name: "MessageRejected", message: "Email address is not verified." })).toBe(true);
    expect(isSesIdentityError({ code: "MailFromDomainNotVerified", message: "domain" })).toBe(true);
    expect(isSesIdentityError({ code: "ETIMEDOUT", message: "timeout" })).toBe(false);
  });

  test("withEmailRetry retries transient failures then succeeds", async () => {
    let calls = 0;
    const result = await withEmailRetry(async () => {
      calls += 1;
      if (calls < 3) {
        const err = new Error("timeout");
        err.code = "ETIMEDOUT";
        throw err;
      }
      return "ok";
    }, { attempts: 3, label: "test" });
    expect(result).toBe("ok");
    expect(calls).toBe(3);
  });

  test("withEmailRetry does not retry identity failures", async () => {
    let calls = 0;
    await expect(withEmailRetry(async () => {
      calls += 1;
      const err = new Error("Email address is not verified.");
      err.name = "MessageRejected";
      throw err;
    }, { attempts: 3, label: "test" })).rejects.toMatchObject({ name: "MessageRejected" });
    expect(calls).toBe(1);
  });
});
