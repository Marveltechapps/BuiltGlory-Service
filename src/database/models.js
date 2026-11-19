/**
 * Barrel that imports (and therefore registers) every Mongoose model.
 * Used by scripts/migrate.js to run `syncIndexes()` on all collections.
 */
import { User } from "../modules/users/users.model.js";
import { Device } from "../modules/users/users.device.model.js";
import { Admin } from "../modules/admins/admins.model.js";
import { BulkMessage } from "../modules/admins/admins.bulkMessage.model.js";
import { MessageTemplate } from "../modules/admins/admins.messageTemplate.model.js";
import { EmailOtp } from "../modules/auth/auth.otp.model.js";
import { Property } from "../modules/properties/properties.model.js";
import { Favorite } from "../modules/properties/properties.favorite.model.js";
import { PropertyDailyStat } from "../modules/properties/properties.dailyStat.model.js";
import { PropertyImportJob } from "../modules/properties/properties.importJob.model.js";
import { SearchHistory } from "../modules/search/search.searchHistory.model.js";
import { Location } from "../modules/locations/locations.model.js";
import { BuyEnquiry } from "../modules/buyEnquiries/buyEnquiries.model.js";
import { Visit } from "../modules/visits/visits.model.js";
import { ChatThread } from "../modules/chatThreads/chatThreads.model.js";
import { SellRequest } from "../modules/sellRequests/sellRequests.model.js";
import { Acquisition } from "../modules/acquisitions/acquisitions.model.js";
import { SalesDeal } from "../modules/salesDeals/salesDeals.model.js";
import { Payment } from "../modules/payments/payments.model.js";
import { Document } from "../modules/documents/documents.model.js";
import { InteriorLead } from "../modules/interiorLeads/interiorLeads.model.js";
import { SupportTicket } from "../modules/supportTickets/supportTickets.model.js";
import { ConversationMessage } from "../modules/conversationMessages/conversationMessages.model.js";
import { Callback } from "../modules/callbacks/callbacks.model.js";
import { AppFeedback } from "../modules/appFeedback/appFeedback.model.js";
import { Notification } from "../modules/notifications/notifications.model.js";
import { CommunicationLog } from "../modules/communicationLogs/communicationLogs.model.js";
import { AdminSetting } from "../modules/adminSettings/adminSettings.model.js";
import { ContentItem } from "../modules/content/content.model.js";
import { EditLock } from "../modules/editLocks/editLocks.model.js";
import { AuditLog } from "../modules/auditLogs/auditLogs.model.js";
import { ReportExport } from "../modules/reports/reports.export.model.js";
import { ReportSchedule } from "../modules/reports/reports.schedule.model.js";
import { BoostOrder } from "../modules/boostOrders/boostOrders.model.js";
import { Migration } from "./migration.model.js";

export const models = {
  User,
  Device,
  Admin,
  BulkMessage,
  MessageTemplate,
  EmailOtp,
  Property,
  Favorite,
  PropertyDailyStat,
  PropertyImportJob,
  SearchHistory,
  Location,
  BuyEnquiry,
  Visit,
  ChatThread,
  SellRequest,
  Acquisition,
  SalesDeal,
  Payment,
  Document,
  InteriorLead,
  SupportTicket,
  ConversationMessage,
  Callback,
  AppFeedback,
  Notification,
  CommunicationLog,
  AdminSetting,
  ContentItem,
  EditLock,
  AuditLog,
  ReportExport,
  ReportSchedule,
  BoostOrder,
  Migration
};

export const allModels = Object.values(models);

/** Synchronise indexes for every registered model. Run as the final migration step. */
export const syncAllIndexes = async () => {
  const results = [];
  for (const model of allModels) {
    try {
      await model.syncIndexes();
      results.push({ model: model.modelName, status: "ok" });
    } catch (error) {
      results.push({ model: model.modelName, status: "error", error: error.message });
    }
  }
  return results;
};

export {
  User, Device, Admin, BulkMessage, MessageTemplate, EmailOtp, Property, Favorite, PropertyDailyStat,
  PropertyImportJob, SearchHistory, Location, BuyEnquiry, Visit, ChatThread, SellRequest, Acquisition,
  SalesDeal, Payment, Document, InteriorLead, SupportTicket, ConversationMessage, Callback, AppFeedback,
  Notification, CommunicationLog, AdminSetting, ContentItem, EditLock, AuditLog, ReportExport,
  ReportSchedule, BoostOrder, Migration
};
