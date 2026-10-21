import { SalesDeal } from "./model.js";
import { BuyEnquiry } from "../buyEnquiries/model.js";
import { Visit } from "../visits/model.js";
import { SellRequest } from "../sellRequests/model.js";
import { Acquisition } from "../acquisitions/model.js";
import { User } from "../users/model.js";
import { getPagination, paginationMeta } from "../../shared/pagination.js";
import { buyerProgressPercent, sellerDealLabel, sellerHasDeal, sellerProgressPercent } from "../../shared/customerProgress.js";

const clean = { isDeleted: { $ne: true } };
const dealStageLabels = {
  active_leads: "Active Lead",
  site_visits: "Site Visits",
  negotiation: "Negotiating",
  re_engagement: "Re-engagement",
  token_payment: "Token Payment",
  full_payment: "Full Payment",
  stage_payment: "Stage Payment",
  interior_design: "Interior Design",
  documentation: "Documentation",
  closed: "Closed",
  lost: "Lost"
};

const offerAmount = (sellRequest, acquisition) => acquisition?.agreedPrice
  || acquisition?.negotiation?.agreedPrice
  || acquisition?.negotiation?.builtgloryOffer
  || acquisition?.builtgloryOffer
  || acquisition?.valuation?.amount
  || sellRequest?.sale?.salePrice
  || null;

export const listCustomerDeals = async (actor, query = {}) => {
  const user = await User.findById(actor.id).select("kycStatus").lean();
  const deals = await SalesDeal.find({ buyerId: actor.id, stage: { $ne: "lost" }, ...clean }).lean();
  const enquiryIds = deals.map((deal) => deal.sourceEnquiryId).filter(Boolean);
  const [enquiries, visits] = await Promise.all([
    enquiryIds.length ? BuyEnquiry.find({ _id: { $in: enquiryIds }, ...clean }).lean() : [],
    enquiryIds.length ? Visit.find({ enquiryId: { $in: enquiryIds }, ...clean }).lean() : []
  ]);
  const enquiryById = new Map(enquiries.map((enquiry) => [String(enquiry._id), enquiry]));
  const visitsByEnquiry = visits.reduce((map, visit) => {
    const key = String(visit.enquiryId);
    map.set(key, [...(map.get(key) || []), visit]);
    return map;
  }, new Map());

  const buyerRows = deals.map((deal) => {
    const enquiry = enquiryById.get(String(deal.sourceEnquiryId)) || null;
    const linkedVisits = visitsByEnquiry.get(String(deal.sourceEnquiryId)) || [];
    return {
      side: "buyer",
      id: String(deal._id),
      title: deal.propertySnapshot?.title || enquiry?.propertySnapshot?.title || "Property",
      price: deal.financials?.agreedPrice || deal.financials?.offeredPrice || enquiry?.propertySnapshot?.price || null,
      stage: deal.stage,
      stageLabel: dealStageLabels[deal.stage] || deal.stage,
      progressPercent: buyerProgressPercent({ enquiry, visits: linkedVisits, deal, kycStatus: user?.kycStatus }),
      enquiryId: deal.sourceEnquiryId ? String(deal.sourceEnquiryId) : null,
      sellRequestId: null,
      updatedAt: deal.lastActivityAt || deal.updatedAt || deal.createdAt || null
    };
  });

  const sellRequests = await SellRequest.find({ sellerId: actor.id, status: { $nin: ["draft", "rejected"] }, ...clean }).lean();
  const acquisitions = sellRequests.length
    ? await Acquisition.find({ sellRequestId: { $in: sellRequests.map((item) => item._id) }, sellerId: actor.id, ...clean }).sort({ createdAt: -1 }).lean()
    : [];
  const acquisitionBySell = new Map();
  for (const acquisition of acquisitions) {
    const key = String(acquisition.sellRequestId);
    if (!acquisitionBySell.has(key)) acquisitionBySell.set(key, acquisition);
  }

  const sellerRows = sellRequests.flatMap((sellRequest) => {
    const acquisition = acquisitionBySell.get(String(sellRequest._id)) || null;
    if (!sellerHasDeal(sellRequest, acquisition)) return [];
    const amount = offerAmount(sellRequest, acquisition);
    return [{
      side: "seller",
      id: String(sellRequest._id),
      title: sellRequest.propertyTitle || "Listing",
      price: amount || sellRequest.askingPrice || null,
      stage: acquisition?.stage || sellRequest.status,
      stageLabel: sellerDealLabel(sellRequest, acquisition),
      progressPercent: sellerProgressPercent({ sellRequest, acquisition, offer: amount ? { amount } : null }),
      enquiryId: null,
      sellRequestId: String(sellRequest._id),
      updatedAt: acquisition?.updatedAt || sellRequest.updatedAt || sellRequest.submittedAt || null
    }];
  });

  const rows = [...buyerRows, ...sellerRows].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  const { page, limit, skip } = getPagination(query);
  return { data: rows.slice(skip, skip + limit), meta: paginationMeta(page, limit, rows.length) };
};
