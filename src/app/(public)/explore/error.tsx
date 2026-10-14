"use client";

export default function ExploreError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-[560px] flex-col items-center gap-3 px-5 py-24 text-center">
      <div className="flex size-[72px] items-center justify-center rounded-full bg-[radial-gradient(circle,rgba(255,180,35,.3),transparent_70%)] text-[28px]">☔</div>
      <h1 className="font-display text-[26px]">Connection lost</h1>
      <p className="max-w-[360px] text-sm leading-normal text-ink-2">Couldn&apos;t load companions. Nothing changed on your account.</p>
      <button onClick={reset} className="bg-saanjh h-[42px] rounded-[14px] px-[18px] text-[13px] font-semibold text-white">
        Try again
      </button>
    </div>
  );
}
