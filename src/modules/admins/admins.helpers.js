import crypto from "node:crypto";
import { User } from "../users/users.model.js";
import { MessageTemplate } from "./admins.messageTemplate.model.js";
import { makeReferenceId } from "../../utils/id.js";

const sanitizeAdmin = (admin) => {
  const obj = admin.toObject ? admin.toObject() : admin;
  delete obj.passwordHash;
  return obj;
};
const compact = (obj) => Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined));
const SALES_ROLES = ["sales_manager", "sales_executive", "relationship_manager"];
const issueTemporaryPassword = () => crypto.randomBytes(18).toString("base64url");
const ensureSalesRole = (role = "sales_executive") => SALES_ROLES.includes(role) ? role : "sales_executive";
const DEFAULT_MESSAGE_TEMPLATES = [
  { name: "Visit Confirmation", channel: "whatsapp", category: "Visit", body: "Hi {buyerName}, your visit for {propertyTitle} is confirmed for {date} at {time}." },
  { name: "Token Payment Request", channel: "whatsapp", category: "Payment", body: "Hi {buyerName}, please pay token amount of Rs {amount} for {propertyTitle}. Reference: {referenceId}" },
  { name: "KYC Reminder", channel: "sms", category: "KYC", body: "Hi {buyerName}, please complete your KYC verification on the Builtglory app." },
  { name: "Welcome Email", channel: "email", category: "General", subject: "Welcome to Builtglory!", body: "Dear {buyerName}, welcome to Builtglory." }
];
const templateVariables = (body = "") => Array.from(new Set(String(body).match(/\{\{?([\w.]+)\}?\}/g)?.map((part) => part.replace(/[{}]/g, "")) || []));
const ensureDefaultTemplates = async (actorId) => {
  if (await MessageTemplate.estimatedDocumentCount()) return;
  await MessageTemplate.insertMany(DEFAULT_MESSAGE_TEMPLATES.map((item) => ({ ...item, referenceId: makeReferenceId("messageTemplates"), variables: templateVariables(item.body), createdBy: actorId, updatedBy: actorId })));
};
const isObjectIdLike = (value) => /^[a-f\d]{24}$/i.test(String(value || ""));
const cleanRecipient = (value) => String(value || "").trim();
const contactForChannel = (user, channel) => channel === "email" ? user.email : (user.phone || user.mobileNumber || user.phoneNormalized || user.email);
const recipientsForAudience = async ({ audience = "all", channel = "whatsapp", recipients = [] }) => {
  const explicit = recipients.map(cleanRecipient).filter(Boolean);
  if (explicit.length) return explicit;
  const filter = { isDeleted: { $ne: true }, isActive: { $ne: false } };
  if (audience === "buyers") filter.role = { $in: ["buyer", "both"] };
  if (audience === "sellers") filter.role = { $in: ["seller", "both"] };
  if (audience === "nri") filter.userType = "nri";
  if (audience === "kyc") filter.kycStatus = "verified";
  const users = await User.find(filter).limit(5000);
  const primaryChannel = channel === "all" ? "whatsapp" : channel;
  return users.map((user) => cleanRecipient(contactForChannel(user, primaryChannel))).filter(Boolean);
};

export {
  sanitizeAdmin,
  compact,
  SALES_ROLES,
  issueTemporaryPassword,
  ensureSalesRole,
  DEFAULT_MESSAGE_TEMPLATES,
  templateVariables,
  ensureDefaultTemplates,
  isObjectIdLike,
  cleanRecipient,
  contactForChannel,
  recipientsForAudience
};
