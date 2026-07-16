/** Placeholder page body used until each page is built in its phase. */

export default function PageStub({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="p-4 md:p-6">
      <h1 className="mb-4 text-lg font-semibold">{title}</h1>
      <div className="flex min-h-48 items-center justify-center rounded-xl border border-border bg-surface">
        <p className="px-6 text-center text-sm text-text-dim">
          {title} is built in {phase}.
        </p>
      </div>
    </div>
  );
}
