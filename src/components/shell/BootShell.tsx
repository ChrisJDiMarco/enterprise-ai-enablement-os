export function BootShell() {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-950">
      <div className="flex min-h-screen">
        <aside className="fixed inset-y-0 left-0 w-[248px] border-r border-slate-200 bg-white">
          <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[#635bff] text-sm font-bold text-white">
              F
            </div>
            <div>
              <div className="text-sm font-semibold">Enterprise AI</div>
              <div className="text-xs text-slate-500">Enablement OS</div>
            </div>
          </div>
          <div className="space-y-2 px-4 py-5">
            {["Command Center", "Use Case Factory", "AI Harness", "Skills Library"].map((item) => (
              <div key={item} className="h-9 rounded-lg bg-slate-100" />
            ))}
          </div>
        </aside>
        <main className="ml-[248px] flex-1">
          <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-7">
            <div className="h-9 w-[420px] rounded-lg bg-slate-100" />
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-slate-100" />
              <div className="size-9 rounded-full bg-slate-100" />
            </div>
          </header>
          <div className="px-7 py-6">
            <div className="h-7 w-64 rounded-lg bg-slate-100" />
            <div className="mt-3 h-4 w-96 rounded bg-slate-100" />
            <div className="mt-6 grid gap-4 md:grid-cols-4">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="h-28 rounded-xl border border-slate-200 bg-white" />
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
