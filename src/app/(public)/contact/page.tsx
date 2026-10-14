import type { Metadata } from "next";
import Link from "next/link";
import { LegalText } from "@/components/legal-text";
import { SimplePage } from "@/components/simple-page";

export const metadata: Metadata = { title: "Contact", alternates: { canonical: "/contact" } };

export default function ContactPage() {
  return (
    <SimplePage
      title="Contact"
      intro="Signed-in users can report any message or companion from inside the app. For everything else, write to us."
    >
      <div className="flex flex-col gap-2 rounded-[20px] bg-surface p-5 text-sm leading-relaxed text-ink-2">
        <p><b className="text-ink">Support</b> · <LegalText text="{{supportEmail}}" /></p>
        <p><b className="text-ink">Privacy</b> · <LegalText text="{{privacyEmail}}" /></p>
        <p><b className="text-ink">Grievance Officer</b> · <LegalText text="{{grievanceOfficerName}}, {{grievanceEmail}}, {{grievancePhone}}" /></p>
        <p><b className="text-ink">Registered office</b> · <LegalText text="{{legalName}}, {{registeredAddress}}" /></p>
      </div>
      <p className="text-sm text-ink-2">
        Read the <Link href="/legal/grievance-redressal" className="text-rani">grievance redressal</Link> and{" "}
        <Link href="/legal/content-safety" className="text-rani">content safety</Link> policies.
      </p>
    </SimplePage>
  );
}
