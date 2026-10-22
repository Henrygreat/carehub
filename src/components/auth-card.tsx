import { brand } from "@/lib/brand";

export function AuthCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#FAF8F3] px-4 py-10">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex items-center justify-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-[#237E78] font-bold text-white shadow-sm">
            E
          </span>
          <span className="text-lg font-semibold tracking-tight text-[#182F42]">
            {brand.name}
          </span>
        </div>

        {/* Card */}
        <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
          <p className="text-sm font-semibold text-[#237E78]">{eyebrow}</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#182F42]">
            {title}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
          <div className="mt-7">{children}</div>
        </section>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-slate-400">
          {brand.tagline}
        </p>
      </div>
    </main>
  );
}
