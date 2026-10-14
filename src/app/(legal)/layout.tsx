import { SiteFooter } from "@/components/site-chrome";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <SiteFooter />
    </>
  );
}
