import { ConversationMessage } from "./conversationMessages.model.js";

/**
 * Dual-write helper: insert a conversationMessages row while callers continue
 * to $push onto the parent embedded array during the migration window.
 */
export const appendConversationMessage = async ({
  conversationType,
  conversationId,
  senderType,
  senderId,
  senderName,
  type = "text",
  text,
  offer,
  attachments,
  clientMessageId
}) => {
  const latest = await ConversationMessage.findOne({ conversationType, conversationId })
    .sort({ seq: -1 })
    .select("seq")
    .lean();
  const seq = (latest?.seq || 0) + 1;
  try {
    return await ConversationMessage.create({
      conversationType,
      conversationId,
      seq,
      senderType,
      senderId,
      senderName,
      type,
      text,
      offer,
      attachments,
      clientMessageId
    });
  } catch (error) {
    if (error?.code === 11000 && clientMessageId) {
      return ConversationMessage.findOne({ conversationType, conversationId, clientMessageId });
    }
    throw error;
  }
};

export const listConversationMessages = async (conversationType, conversationId) =>
  ConversationMessage.find({ conversationType, conversationId }).sort({ seq: 1 }).lean();
