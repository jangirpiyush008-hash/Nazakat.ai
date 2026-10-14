export default function Loading() {
  return (
    <div className="mx-auto grid max-w-[1440px] grid-cols-2 gap-3 px-5 pt-[120px] md:grid-cols-3 md:gap-4 md:px-16 xl:grid-cols-5" aria-busy>
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} className="animate-pulse-soft aspect-[3/4] rounded-[20px] bg-surface" style={{ animationDelay: `${(i % 3) * 0.3}s` }} />
      ))}
    </div>
  );
}
