/**
 * Legal & trust page registry. Every page is a DRAFT pending Indian counsel
 * review. Company facts are TODO placeholders and the launch gate
 * (docs/COMPLIANCE_REGISTER.md) must fail while any remain.
 * Do NOT write invented legal text here — outline only.
 */

export type LegalStatus = "draft" | "in_review" | "approved";

export type LegalPage = {
  slug: string;
  title: string;
  group: "Trust" | "Legal";
  summary: string;
  sections: string[];
  status: LegalStatus;
  version: string;
  lastReviewed: string | null;
};

const draft = { status: "draft" as const, version: "0.1-draft", lastReviewed: null };

export const companyFacts = {
  legalEntity: "TODO: registered legal entity name",
  registeredOffice: "TODO: registered office address",
  grievanceOfficer: "TODO: grievance officer name & designation",
  grievanceEmail: "TODO: grievance contact email",
  effectiveDate: "TODO: effective date",
};

export const legalPages: LegalPage[] = [
  { slug: "terms", title: "Terms of Use", group: "Legal", summary: "The rules for using the service, who can use it, and what happens if those rules are broken.", sections: ["Service scope", "AI disclosure", "Eligibility (18+)", "Acceptable use", "Account suspension", "Intellectual property", "Limitations", "Governing law"], ...draft },
  { slug: "privacy", title: "Privacy Policy", group: "Legal", summary: "What data we collect, why, who processes it, how long we keep it and how to exercise your rights.", sections: ["Data categories", "Purposes and legal basis", "Processors and transfers", "Retention", "Your rights", "Security", "Grievance contact", "How to make a request"], ...draft },
  { slug: "cookies", title: "Cookies & Tracking", group: "Legal", summary: "Essential vs optional technologies and how to change your choice.", sections: ["Essential technologies", "Optional analytics", "Your preferences", "Withdrawing consent"], ...draft },
  { slug: "ai-disclosure", title: "AI Companion Disclosure", group: "Trust", summary: "Every companion is an AI-generated fictional character. Not a human, therapist, doctor or emergency service.", sections: ["Characters are AI and fictional", "Limitations", "No human presence", "Not therapy, medical or emergency support"], ...draft },
  { slug: "community-guidelines", title: "Community Guidelines", group: "Trust", summary: "What is and isn't allowed, and how we enforce it.", sections: ["Acceptable use", "Prohibited behaviour", "Reporting", "Enforcement and appeals"], ...draft },
  { slug: "content-safety", title: "Content Safety", group: "Trust", summary: "Prohibited content and how reporting, blocking, takedown and appeals work.", sections: ["Prohibited content", "Reporting and blocking", "Takedown", "Appeals"], ...draft },
  { slug: "generation-policy", title: "Image, Video & Voice Generation Policy", group: "Trust", summary: "Restrictions on generated media, real-person consent, impersonation, labels and deletion.", sections: ["Restrictions", "Real-person consent and impersonation", "Child safety", "Labels", "Deletion"], ...draft },
  { slug: "copyright-and-takedown", title: "Copyright, Impersonation & Takedown", group: "Legal", summary: "How to report infringing or impersonating content.", sections: ["What to report", "How to file a notice", "Counter-notice", "Repeat infringers"], ...draft },
  { slug: "grievance-redressal", title: "Grievance Redressal", group: "Legal", summary: "How to raise a complaint, acknowledgement and resolution timelines.", sections: ["Designated contact", "Complaint channels", "Acknowledgement", "Handling process"], ...draft },
  { slug: "refunds-and-cancellation", title: "Refunds & Cancellation", group: "Legal", summary: "Eligibility, processing, subscription cancellation and failed generations or payments.", sections: ["Eligibility", "Processing", "Subscription cancellation", "Failed generation or payment", "Statutory rights"], ...draft },
  { slug: "credits", title: "Sparks & Credits", group: "Legal", summary: "How Sparks are granted, used, refunded and when they expire.", sections: ["What Sparks are", "Validity and expiry", "Usage", "Grants and promos", "Refunds", "Errors and disputes"], ...draft },
  { slug: "data-retention-and-deletion", title: "Data Retention & Deletion", group: "Legal", summary: "Retention schedule, export, account deletion and lawful retention exceptions.", sections: ["Retention schedule", "Export", "Account deletion", "Backups", "Retention exceptions"], ...draft },
  { slug: "security", title: "Security & Vulnerability Reporting", group: "Trust", summary: "How to report a security issue to us.", sections: ["Reporting route", "Scope", "Safe harbour", "Contact"], ...draft },
  { slug: "accessibility", title: "Accessibility Statement", group: "Trust", summary: "Our accessibility commitment, known limitations and how to contact us.", sections: ["Commitment", "Known limitations", "Contact"], ...draft },
  { slug: "child-safety", title: "Child Safety", group: "Trust", summary: "Strict prohibition on sexual content involving minors or minor-coded characters.", sections: ["Zero tolerance", "Age requirements", "Detection and reporting", "Cooperation with authorities"], ...draft },
  { slug: "ai-media-labelling", title: "AI Media Labelling", group: "Trust", summary: "How AI-generated outputs are labelled and why labels must not be removed.", sections: ["When labels apply", "Labels and metadata", "Provenance", "Restrictions on removal"], ...draft },
];

export function getLegalPage(slug: string) {
  return legalPages.find((p) => p.slug === slug) ?? null;
}
