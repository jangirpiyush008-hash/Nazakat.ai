import type { Metadata } from "next";
import Link from "next/link";
import { companyFacts } from "@/lib/legal";
import { SimplePage } from "@/components/simple-page";

export const metadata: Metadata = { title: "Contact", alternates: { canonical: "/contact" } };

export default function ContactPage() {
  return (
    <SimplePage
      title="Contact"
      intro="The support form and ticket tracking open with accounts (Milestone 4). Until then, grievance and reporting contacts are listed below once the company appoints them."
    >
      <div className="rounded-[20px] bg-surface p-5 font-mono text-xs leading-loose text-marigold">
        {companyFacts.grievanceOfficer}
        <br />
        {companyFacts.grievanceEmail}
      </div>
      <p className="text-sm text-ink-2">
        Read the <Link href="/legal/grievance-redressal" className="text-rani">grievance redressal</Link> and{" "}
        <Link href="/legal/content-safety" className="text-rani">content safety</Link> policies.
      </p>
    </SimplePage>
  );
}
