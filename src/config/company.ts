/**
 * Company facts used across every legal page. Fill these in ONCE before
 * launch; any empty value shows as an amber [placeholder] on the site and is
 * listed by `missingCompanyFacts()` so the launch gate can block on it.
 * Never invent these — they must match your incorporation documents.
 */
export const company = {
  legalName: "", // e.g. "Nazakat Technologies Private Limited"
  cin: "", // Corporate Identification Number (MCA)
  gstin: "",
  registeredAddress: "",
  jurisdictionCity: "", // courts with jurisdiction, e.g. "Mumbai"
  supportEmail: "",
  privacyEmail: "",
  securityEmail: "",
  grievanceOfficerName: "",
  grievanceOfficerDesignation: "Grievance Officer",
  grievanceEmail: "",
  grievancePhone: "",
  effectiveDate: "", // e.g. "1 December 2026"
};

export type CompanyKey = keyof typeof company;

export const companyLabels: Record<CompanyKey, string> = {
  legalName: "Company legal name",
  cin: "CIN",
  gstin: "GSTIN",
  registeredAddress: "Registered office address",
  jurisdictionCity: "Jurisdiction city",
  supportEmail: "Support email",
  privacyEmail: "Privacy email",
  securityEmail: "Security email",
  grievanceOfficerName: "Grievance Officer name",
  grievanceOfficerDesignation: "Grievance Officer designation",
  grievanceEmail: "Grievance email",
  grievancePhone: "Grievance phone",
  effectiveDate: "Effective date",
};

export function missingCompanyFacts() {
  return (Object.keys(company) as CompanyKey[]).filter((k) => !company[k]);
}
