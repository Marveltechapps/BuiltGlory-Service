/**
 * M-01: Unset plaintext otp / otpExpiry from users (G-01).
 * Idempotent. Safe to re-run.
 */
export const up = async () => {
  const { User } = await import("../../src/modules/users/users.model.js");
  const result = await User.collection.updateMany(
    { $or: [{ otp: { $exists: true } }, { otpExpiry: { $exists: true } }] },
    { $unset: { otp: 1, otpExpiry: 1 } }
  );
  return { matched: result.matchedCount, modified: result.modifiedCount };
};
