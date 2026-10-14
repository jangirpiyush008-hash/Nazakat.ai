import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { companyFacts, getLegalPage, legalPages } from "@/lib/legal";
import { Logo } from "@/components/site-chrome";

type Params = Promise<{ slug: string }>;

export function generateStaticParams() {
  return legalPages.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const page = getLegalPage((await params).slug);
  if (!page) return {};
  return { title: page.title, description: page.summary, alternates: { canonical: `/legal/${page.slug}` } };
}

/** Light theme per design/README.md §06. */
export default async function LegalPageView({ params }: { params: Params }) {
  const { slug } = await params;
  const page = getLegalPage(slug);
  if (!page) notFound();

  return (
    <div className="bg-l-bg text-l-text [color-scheme:light]">
      <header className="border-b border-l-divider bg-white">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-4 md:px-16">
          <Logo className="!text-l-text" />
          <Link href="/help" className="text-sm text-l-text-2 hover:text-l-primary">Help centre</Link>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1200px] gap-10 px-5 py-10 md:grid-cols-[240px_1fr] md:px-16 md:py-16">
        <nav aria-label="Legal and trust pages" className="flex gap-1 overflow-x-auto text-sm md:flex-col md:overflow-visible">
          {legalPages.map((p) => (
            <Link
              key={p.slug}
              href={`/legal/${p.slug}`}
              aria-current={p.slug === slug ? "page" : undefined}
              className={clsx(
                "flex-none rounded-lg px-3 py-2",
                p.slug === slug ? "bg-l-chip font-semibold text-l-primary" : "text-l-text-2 hover:text-l-text",
              )}
            >
              {p.title}
            </Link>
          ))}
        </nav>

        <article className="flex max-w-[720px] flex-col gap-6">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {page.status !== "approved" && (
              <span className="rounded-full bg-l-draft-bg px-2.5 py-1 font-semibold text-l-draft-text">Draft · pending counsel review</span>
            )}
            <span className="text-l-muted">
              Version {page.version} · Last reviewed {page.lastReviewed ?? "—"} · English
            </span>
          </div>
          <h1 className="font-display text-[40px] font-light leading-[1.05] md:text-5xl">{page.title}</h1>
          <code className="font-mono text-xs text-l-draft-text">
            {companyFacts.legalEntity} · {companyFacts.effectiveDate}
          </code>
          <div className="rounded-2xl bg-white p-5 shadow-[0_1px_0_#F3E3EA]">
            <div className="label-caps mb-2 text-[11px] text-l-muted">In short</div>
            <p className="text-[15px] leading-relaxed text-l-text-2">{page.summary}</p>
          </div>
          <ol className="flex flex-col gap-5">
            {page.sections.map((s, i) => (
              <li key={s} className="flex flex-col gap-1.5">
                <h2 className="text-lg font-semibold">
                  {i + 1}. {s}
                </h2>
                <p className="font-mono text-xs text-l-muted">TODO: wording to be supplied by Indian counsel.</p>
              </li>
            ))}
          </ol>
          {page.slug === "grievance-redressal" && (
            <div className="rounded-2xl border border-l-divider bg-white p-5 font-mono text-xs leading-loose text-l-draft-text">
              {companyFacts.grievanceOfficer}
              <br />
              {companyFacts.grievanceEmail}
              <br />
              {companyFacts.registeredOffice}
            </div>
          )}
        </article>
      </div>
    </div>
  );
}
