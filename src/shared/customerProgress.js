const BUYER_STEPS = 10;
const SELLER_STEPS = 12;

const offerAccepted = (acquisition) => acquisition?.negotiation?.sellerDecision?.decision === "accepted"
  || acquisition?.negotiation?.status === "seller_accepted"
  || ["token_to_seller", "documentation", "seller_payout", "acquired"].includes(acquisition?.stage);

export const isSellerSold = (sellRequest, acquisition) => sellRequest?.status === "sold" || acquisition?.stage === "acquired";

/** 0-based step that is currently in progress for a buyer enquiry. */
export const buyerStepIndex = ({ enquiry, visits = [], deal, kycStatus } = {}) => {
  const status = enquiry?.status;
  const stage = deal?.stage;
  if (stage === "closed" || (status === "closed" && deal)) return BUYER_STEPS - 1;
  if (stage === "documentation") return 8;
  if (["full_payment", "stage_payment", "interior_design"].includes(stage)) return 7;
  if (stage === "token_payment") return kycStatus === "verified" ? 6 : 5;
  if (["negotiation", "re_engagement"].includes(stage) || status === "negotiating") return 3;
  const activeVisit = visits.some((visit) => !["cancelled", "missed"].includes(visit.status));
  if (activeVisit || ["visit_scheduled", "responded"].includes(status) || ["active_leads", "site_visits"].includes(stage)) return 2;
  return 1;
};

export const buyerProgressPercent = (input = {}) => {
  const status = input.enquiry?.status;
  const stage = input.deal?.stage;
  if (stage === "closed" || (status === "closed" && input.deal)) return 100;
  return Math.round((buyerStepIndex(input) / BUYER_STEPS) * 100);
};

/** 0-based step that is currently in progress for a seller listing. */
export const sellerStepIndex = ({ sellRequest, acquisition, offer } = {}) => {
  if (isSellerSold(sellRequest, acquisition)) return SELLER_STEPS - 1;
  const status = sellRequest?.status;
  const stage = acquisition?.stage;
  const countered = acquisition?.negotiation?.sellerDecision?.decision === "countered"
    || acquisition?.negotiation?.status === "seller_countered";
  if (status === "draft") return 0;
  if (stage === "seller_payout") return 10;
  if (stage === "documentation") return 9;
  if (stage === "token_to_seller" || offerAccepted(acquisition)) return 8;
  if (stage === "negotiation") {
    if (countered) return 7;
    if (offer) return 6;
    return 5;
  }
  if (stage === "valuation") return offer ? 6 : 5;
  if (stage === "site_inspection") return 3;
  if (status === "under_review" || stage === "pending_review") return 2;
  if (["accepted", "approved", "active", "negotiating"].includes(status)) return 4;
  return 1;
};

export const sellerProgressPercent = (input = {}) => {
  if (isSellerSold(input.sellRequest, input.acquisition)) return 100;
  return Math.round((sellerStepIndex(input) / SELLER_STEPS) * 100);
};

export const sellerDealLabel = (sellRequest, acquisition) => {
  if (isSellerSold(sellRequest, acquisition)) return "Completed";
  if (acquisition?.stage === "seller_payout") return "Registration";
  if (acquisition?.stage === "documentation") return "Payment Schedule";
  return "Deal Confirmed";
};

export const sellerHasDeal = (sellRequest, acquisition) => isSellerSold(sellRequest, acquisition) || offerAccepted(acquisition);
