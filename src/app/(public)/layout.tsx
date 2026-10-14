import { Suspense } from "react";
import { getCapabilities } from "@/config/features";
import { AgeGate } from "@/components/age-gate";
import { AuthModal } from "@/components/auth-modal";
import { BottomTabs } from "@/components/shell/bottom-tabs";
import { Sidebar } from "@/components/shell/sidebar";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

/** App-style shell: header + sidebar (desktop) / bottom tabs (mobile). */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const { authMethods } = getCapabilities();
  return (
    <>
      <SiteHeader />
      <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
        <Sidebar />
        <div className="min-w-0">
          {children}
          <SiteFooter />
        </div>
      </div>
      <BottomTabs />
      <AgeGate />
      <Suspense>
        <AuthModal methods={authMethods} />
      </Suspense>
    </>
  );
}
