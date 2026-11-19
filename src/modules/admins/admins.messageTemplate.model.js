import mongoose from "mongoose";
import { applySchemaDefaults } from "../../database/schemaCommon.js";

/** Same token syntax as admins.helpers.templateVariables: {name}, {{name}}, {a.b}. */
const TOKEN_PATTERN = /\{\{?([\w.]+)\}?\}/g;
const tokensIn = (body = "") => new Set(Array.from(String(body).matchAll(TOKEN_PATTERN), (match) => match[1]));

const schema = new mongoose.Schema(
  {
    referenceId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    channel: { type: String, enum: ["whatsapp", "email", "sms", "push", "in_app"], required: true, index: true },
    category: { type: String, default: "General", trim: true },
    subject: { type: String, trim: true },
    body: { type: String, required: true },
    variables: [{ type: String }],
    /** WhatsApp Business requires pre-approved template ids. */
    whatsappTemplateName: { type: String, trim: true },
    whatsappLanguage: { type: String, trim: true },
    /** Links the template to a notificationCatalog event for automatic sends. */
    event: { type: String, trim: true },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" }
  },
  {
    timestamps: true,
    collection: "messageTemplates",
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

schema.index({ channel: 1, category: 1, isActive: 1 });
// [N] Template names are unique per channel.
schema.index({ channel: 1, name: 1 }, { unique: true });

// `variables` must correspond to tokens present in `body`. When the body changes and variables were not set
// explicitly, they are re-derived; explicitly supplied variables that do not appear in the body are rejected.
schema.pre("validate", function validateTemplateVariables() {
  const tokens = tokensIn(this.body);
  if (this.isModified("body") && !this.isModified("variables")) {
    this.variables = Array.from(tokens);
    return;
  }
  if (this.isModified("variables")) {
    const unknown = (this.variables || []).filter((name) => !tokens.has(name));
    if (unknown.length) this.invalidate("variables", `Variables not found in body: ${unknown.join(", ")}`, unknown);
  }
});

applySchemaDefaults(schema);

export const MessageTemplate = mongoose.models.MessageTemplate || mongoose.model("MessageTemplate", schema);
