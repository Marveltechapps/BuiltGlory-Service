import {
  COMPANY_SUPPORT_EMAIL,
  COMPANY_SUPPORT_PHONE_DISPLAY,
  COMPANY_SUPPORT_WHATSAPP_MESSAGE,
  COMPANY_WHATSAPP_DIGITS
} from "../../constants/companyContact.js";

export const DEFAULT_CONTENT_ITEMS = [
  {
    slug: "faq-listings-verified",
    section: "faq",
    title: "How are listings verified?",
    body: "Our team conducts legal verification, title checks and a site visit before publishing any listing on Builtglory.",
    category: "buying",
    order: 10,
    metadata: { icon: "home", topicLabel: "Buying" }
  },
  {
    slug: "faq-payment-options",
    section: "faq",
    title: "What payment options are available?",
    body: "We support UPI, NEFT/RTGS, bank transfer and home loans from partner banks.",
    category: "payment",
    order: 20,
    metadata: { icon: "wallet", topicLabel: "Payment" }
  },
  {
    slug: "faq-schedule-visit",
    section: "faq",
    title: "Can I schedule a visit to the property?",
    body: "Yes, pick a preferred date and time from the visit flow. Our agent will confirm availability and next steps.",
    category: "buying",
    order: 30,
    metadata: { icon: "home", topicLabel: "Buying" }
  },
  {
    slug: "faq-brokerage",
    section: "faq",
    title: "Do you charge brokerage?",
    body: "No middlemen, no commissions. The price you see is the price you pay.",
    category: "selling",
    order: 40,
    metadata: { icon: "tag", topicLabel: "Selling" }
  },
  {
    slug: "faq-data-secured",
    section: "faq",
    title: "How is my data secured?",
    body: "Personal data and property documents are protected with access controls and shared only for verified transaction workflows.",
    category: "account",
    order: 50,
    metadata: { icon: "user", topicLabel: "Account" }
  },
  {
    slug: "terms-of-service",
    section: "legal",
    title: "Builtglory Marketplace Agreement",
    excerpt: "Terms of Service",
    body: "By using Builtglory you agree to be bound by these terms. We connect buyers, sellers and renters of real estate across India and verify each listing before it appears.\n\nWe collect personal data such as your name, phone, email and location to operate the service. Property documents you upload are stored securely and shared only with parties required for transaction fulfilment.\n\nNo commission is charged to buyers or sellers.",
    category: "terms",
    order: 10,
    metadata: { lastUpdatedLabel: "1 Jan 2026" }
  },
  {
    slug: "privacy-policy",
    section: "legal",
    title: "Privacy Policy",
    excerpt: "How we use and protect your data",
    body: "Builtglory collects profile, contact, property preference, transaction, support, and verification information to operate the marketplace.\n\nWe do not sell your data to third parties. Documents are used only for verification and transaction support.\n\nFor privacy questions, contact privacy@builtglory.com.",
    category: "privacy",
    order: 20,
    metadata: { lastUpdatedLabel: "1 Jan 2026" }
  },
  {
    slug: "about-builtglory",
    section: "about",
    title: "About Builtglory",
    excerpt: "India's verified real estate marketplace",
    body: "Builtglory is India's verified real estate marketplace dedicated to simplifying property transactions for buyers, sellers, and investors. We combine AI-driven valuations, rigorous legal verification, and transparent transaction support to build trust in real estate.",
    order: 10,
    metadata: {
      version: "1.0.0",
      copyright: "2026 Builtglory",
      supportEmail: COMPANY_SUPPORT_EMAIL,
      supportPhone: COMPANY_SUPPORT_PHONE_DISPLAY,
      supportWhatsApp: COMPANY_WHATSAPP_DIGITS,
      supportWhatsAppMessage: COMPANY_SUPPORT_WHATSAPP_MESSAGE,
      address: "123 Tech Park, OMR, Adyar, Chennai 600020, India",
      tagline: "Simplifying real estate, one transaction at a time",
      steps: [
        { title: "Seller Lists", desc: "Property owners submit listings with verified documents and photos." },
        { title: "Valuation & Buyer Match", desc: "AI evaluates properties and connects verified buyers through our platform." },
        { title: "Safe Transaction", desc: "Escrow payments, legal verification, and registration assistance support a smooth sale." }
      ]
    }
  },
  {
    slug: "news-chennai-omr-q1-2026",
    section: "news",
    title: "Chennai OMR: 15% appreciation in Q1 2026",
    excerpt: "Market update",
    body: "Demand across the OMR corridor continues to grow as verified inventory and improved connectivity bring new buyers into the market.",
    category: "Market Update",
    order: 10,
    metadata: { readTime: "4 min", publishedLabel: "2 days ago" }
  },
  {
    slug: "news-adyar-residential-zone",
    section: "news",
    title: "Why Adyar remains the top residential zone",
    excerpt: "Investment",
    body: "Established social infrastructure, limited supply, and strong rental demand continue to make Adyar attractive for end-users and investors.",
    category: "Investment",
    order: 20,
    metadata: { readTime: "6 min", publishedLabel: "1 week ago" }
  },
  {
    slug: "news-rera-amendments-2026",
    section: "news",
    title: "New RERA amendments for 2026",
    excerpt: "Policy",
    body: "Upcoming regulatory changes reinforce project transparency and strengthen buyer protection across verified property transactions.",
    category: "Policy",
    order: 30,
    metadata: { readTime: "5 min", publishedLabel: "2 weeks ago" }
  },
  {
    slug: "offer-home-loan",
    section: "general",
    title: "Home Loan at preferential rates",
    excerpt: "Partner banks · Limited time",
    body: "Eligible Builtglory buyers can apply for partner-bank home loans. Rates and tenure depend on the active bank offer.",
    category: "offers",
    order: 10,
    metadata: { icon: "percent", tag: "Finance", color: "#1A6FFF" }
  },
  {
    slug: "offer-free-legal",
    section: "general",
    title: "Free Legal Verification",
    excerpt: "For premium listings",
    body: "Legal title checks are included for eligible premium listings closed through Builtglory.",
    category: "offers",
    order: 20,
    metadata: { icon: "shield", tag: "New", color: "#10B981" }
  },
  {
    slug: "offer-interior-consult",
    section: "general",
    title: "Free Interior Consult",
    excerpt: "For buyers who close this month",
    body: "Book a complimentary interior consultation after your token payment is confirmed.",
    category: "offers",
    order: 30,
    metadata: { icon: "truck", tag: "Limited", color: "#F59E0B" }
  },
  {
    slug: "offer-priority-boost",
    section: "general",
    title: "Priority Listing Boost",
    excerpt: "Sell faster with featured placement",
    body: "Sellers can request a priority boost for verified listings to improve discovery.",
    category: "offers",
    order: 40,
    metadata: { icon: "star", tag: "Seller", color: "#8B5CF6" }
  }
];
