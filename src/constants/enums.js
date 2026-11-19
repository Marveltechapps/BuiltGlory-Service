export const USER_TYPES = ["resident", "nri", "pio"];
export const CUSTOMER_ROLES = ["buyer", "seller", "both"];
export const KYC_STATUSES = ["not_submitted", "pending", "verified", "rejected"];
export const FEMA_STATUSES = ["not_checked", "compliant", "non_compliant", "under_review"];
export const ADMIN_ROLES = ["super_admin", "admin", "operations", "support", "sales_manager", "sales_executive", "relationship_manager", "designer"];
export const ADMIN_STATUSES = ["invited", "active", "suspended"];
export const PROPERTY_TYPES = ["plot", "apartment", "residential", "commercial", "organic_home", "3d_printing", "fractional", "ceo_mansion", "holiday_home", "land", "farmhouse", "nri", "interior", "villa"];
export const PROPERTY_STATUSES = ["draft", "available", "reserved", "under_construction", "sold"];
export const PROPERTY_SOURCES = ["acquired", "manual", "bulk_upload"];
export const FACING = ["north", "south", "east", "west", "north_east", "north_west", "south_east", "south_west"];
export const FURNISHING = ["unfurnished", "semi_furnished", "fully_furnished"];
export const POSSESSION_STATUSES = ["ready", "under_construction", "new_launch"];
export const AGE_BUCKETS = ["new", "1_5", "5_10", "10_plus"];
export const OWNERSHIP_TYPES = ["freehold", "leasehold", "cooperative", "power_of_attorney"];
export const NEARBY_PLACE_TYPES = ["school", "hospital", "metro", "bus", "airport", "mall", "office", "park", "temple", "other"];
export const BUY_ENQUIRY_STATUSES = ["new", "responded", "visit_scheduled", "negotiating", "closed"];
export const ENQUIRY_CLOSED_REASONS = ["deal_won", "deal_lost", "cancelled_by_buyer", "duplicate", "property_unavailable", "no_response"];
export const ENQUIRY_TYPES = ["visit", "price", "documents", "loan", "nri_assistance", "other"];
export const INTEREST_TYPES = ["schedule_visit", "price_negotiation", "more_details"];
export const PREFERRED_CONTACT = ["phone", "whatsapp", "email"];
export const PREFERRED_VISIT_TIME = ["tomorrow_morning", "tomorrow_afternoon", "this_weekend_morning", "this_weekend_afternoon", "custom"];
export const ENQUIRY_SOURCES = ["app", "web", "dashboard", "callback", "import"];
export const SELL_REQUEST_STATUSES = ["draft", "new", "under_review", "accepted", "approved", "active", "negotiating", "paused", "sold", "rejected", "changes_requested"];
export const ACQUISITION_STAGES = ["pending_review", "site_inspection", "valuation", "negotiation", "token_to_seller", "documentation", "seller_payout", "acquired", "rejected", "on_hold"];
export const ACQ_NEGOTIATION_STATUSES = ["open", "awaiting_seller", "seller_accepted", "seller_countered", "agreed", "expired", "withdrawn"];
export const SALES_DEAL_STAGES = ["active_leads", "site_visits", "negotiation", "token_payment", "full_payment", "stage_payment", "interior_design", "documentation", "closed", "lost", "re_engagement"];
export const PRIORITIES = ["normal", "high", "urgent"];
export const SUPPORT_PRIORITIES = ["low", "medium", "high", "urgent"];
export const VISIT_STATUSES = ["scheduled", "confirmed", "completed", "cancelled", "missed", "rescheduled"];
export const VISIT_TYPES = ["physical", "virtual"];
export const VIRTUAL_PLATFORMS = ["zoom", "google_meet", "teams", "whatsapp_video"];
export const VISIT_LANGUAGES = ["English", "Tamil", "Hindi", "Kannada"];
export const CALLBACK_STATUSES = ["pending", "called", "resolved", "missed", "rescheduled", "overdue"];
export const CALLBACK_SOURCES = ["help_support", "profile_support", "property_detail", "payment", "interior"];
export const CALLBACK_CATEGORIES = ["property_inquiry", "pricing", "technical_issue", "complaint", "general", "stage_payment", "interior"];
export const CALL_OUTCOMES = ["answered", "no_answer", "busy", "wrong_number", "callback_later"];
export const CHAT_STATUSES = ["active", "deal_agreed", "lost", "inactive"];
export const MESSAGE_TYPES = ["text", "offer", "counter_offer", "deal_agreed", "attachment", "system_event"];
export const INTERIOR_LEAD_STATUSES = ["new", "contacted", "quote_sent", "accepted", "negotiating", "declined", "completed"];
export const DESIGN_STYLES = ["modern", "classic", "contemporary", "minimalist"];
export const BUDGET_RANGES = ["budget", "standard", "premium", "luxury"];
export const INTERIOR_ROOMS = ["living", "dining", "kitchen", "master_bedroom", "bedroom", "kids_room", "bathroom", "pooja", "study", "balcony", "full_home"];
export const SUPPORT_TICKET_STATUSES = ["open", "in_progress", "resolved", "closed"];
export const SUPPORT_CATEGORIES = ["property_inquiry", "payment", "technical", "kyc", "general", "complaint"];
export const SUPPORT_CHANNELS = ["ticket", "live_chat"];
export const PAYMENT_STATUSES = ["created", "pending", "paid", "failed", "refunded", "cancelled", "rejected"];
export const PAYMENT_TYPES = ["token", "full", "stage", "seller_payout", "refund"];
export const PAYMENT_METHODS = ["bank", "upi", "cheque", "cash", "razorpay"];
export const PAYMENT_DIRECTIONS = ["inbound", "outbound"];
export const PAYMENT_GATEWAYS = ["escrow", "razorpay", "manual"];
export const MILESTONE_STATUSES = ["pending", "proof_pending", "paid", "overdue"];
export const DOCUMENT_STATUSES = ["missing", "uploaded", "verified", "rejected", "expired", "scan_pending", "scan_failed"];
export const DOC_WORKFLOW_STATUSES = ["missing", "requested", "pending", "uploaded", "verified", "rejected", "sent"];
export const SCAN_STATUSES = ["pending", "clean", "infected", "failed"];
export const KYC_DOCUMENT_TYPES = ["pan", "aadhaar", "passport", "oci_card", "visa", "address_proof", "other"];
export const NOTIFICATION_CHANNELS = ["push", "sms", "whatsapp", "email", "in_app"];
export const NOTIFICATION_STATUSES = ["queued", "processing", "sent", "delivered", "failed", "cancelled", "dead_letter"];
export const NOTIFICATION_AUDIENCES = ["buyer", "seller", "admin", "all"];
export const COMM_LOG_CHANNELS = ["call", "note", "message", "push", "email", "whatsapp", "proof_upload"];
export const CONTENT_SECTIONS = ["home", "onboarding", "faq", "legal", "about", "news", "general", "banner"];
export const CONTENT_STATUSES = ["draft", "published", "archived"];
export const CONTENT_KINDS = ["article", "config"];
export const REPORT_EXPORT_STATUSES = ["queued", "processing", "completed", "ready", "failed", "expired"];
export const ACTOR_TYPES = ["admin", "customer", "system"];
export const APP_LANGUAGES = ["en", "ta", "hi", "kn"];
export const DEVICE_PLATFORMS = ["android", "ios", "web"];
export const LOCATION_KINDS = ["city", "locality", "zone"];
export const CONVERSATION_TYPES = ["support_ticket", "chat_thread", "sell_request"];
export const BOOST_ORDER_STATUSES = ["scheduled", "active", "expired", "cancelled"];
export const ENTITY_TYPES = [
  "user", "admin", "property", "buy_enquiry", "visit", "chat_thread", "sales_deal",
  "payment", "interior_lead", "sell_request", "acquisition", "support_ticket",
  "callback", "document", "content", "settings"
];
export const DOCUMENT_OWNER_TYPES = [
  "user", "property", "sell_request", "acquisition", "sales_deal",
  "support_ticket", "payment", "interior_lead", "visit", "conversation"
];
export const DOCUMENT_PURPOSES = [
  "kyc", "legal", "property_media", "profile_photo", "payment_proof",
  "support_attachment", "inspection", "deal_document", "report"
];
export const EMAIL_OTP_PURPOSES = ["email_verification", "login", "password_reset"];
export const SEARCH_HISTORY_SOURCES = ["customer_app", "web"];
export const FEEDBACK_SOURCES = ["customer_app", "web", "help_feedback"];
export const VERIFICATION_CHECK_STATUSES = ["pending", "passed", "failed"];
export const INSPECTION_CONDITIONS = ["excellent", "good", "fair", "poor"];
export const INSPECTION_RECOMMENDATIONS = ["proceed", "proceed_with_caution", "reject"];
export const QUOTE_STATUSES = ["pending", "sent", "accepted", "negotiating", "declined"];
export const OFFER_ACTIONS = ["offered", "countered", "accepted", "declined", "expired"];
export const SELLER_VISIT_ACTIONS = ["confirm", "decline", "reschedule"];
export const BUYER_INTEREST = ["very_interested", "interested", "not_interested", "needs_time"];
export const VISIT_NEXT_ACTIONS = ["move_to_negotiation", "schedule_another_visit", "mark_lost", "follow_up"];
