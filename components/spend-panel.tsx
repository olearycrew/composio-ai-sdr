"use client"
import { KeyRound, ShieldCheck, Wallet } from "lucide-react"
import { BILLING_URL, STEPS, money, reserved, spent, type Run } from "@/lib/sdr"
export function SpendPanel({ run }: { run: Run | null }) {
  const total = run ? spent(run) : 0,
    budget = run?.budget ?? 25_000_000,
    held = run ? reserved(run) : 0
  const providers = [
    ...new Set(
      run?.calls.filter((c) => c.source === "Wallet").map((c) => c.provider)
    ),
  ]
  return (
    <aside className="spend-panel">
      <div className="eyebrow">
        <Wallet size={14} /> Research wallet
      </div>
      <div className="mt-5 flex items-baseline gap-2">
        <span className="spend-number">{money(total)}</span>
        <span className="text-sm text-muted-foreground">/ {money(budget)}</span>
      </div>
      <div
        role="progressbar"
        aria-label="Research budget spent"
        aria-valuenow={total}
        aria-valuemax={budget}
        className="budget-track"
      >
        <div
          style={{
            width: `${budget ? Math.min(100, (total / budget) * 100) : 0}%`,
          }}
        />
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Available for research</span>
        <strong>{money(Math.max(0, budget - total - held))}</strong>
      </div>
      {held > 0 && (
        <p className="mt-2 text-xs text-amber-800">
          {money(held)} reserved for pending charges
        </p>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        Composio balance:{" "}
        {run?.walletBalance != null
          ? money(run.walletBalance)
          : "not exposed by this API"}
      </p>
      <a
        href={BILLING_URL}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-block text-xs font-medium text-teal-800 underline underline-offset-4"
      >
        Top up Composio credits ↗
      </a>
      <div className="panel-divider" />
      <h3 className="eyebrow">By provider</h3>
      {providers.length ? (
        providers.map((p) => (
          <div className="mt-3 flex justify-between text-sm" key={p}>
            <span className="capitalize">{p}</span>
            <span className="font-mono">
              {money(
                run!.calls
                  .filter((c) => c.provider === p)
                  .reduce((n, c) => n + (c.charge ?? 0), 0)
              )}
            </span>
          </div>
        ))
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No paid calls yet.</p>
      )}
      <h3 className="eyebrow mt-7">By step</h3>
      {STEPS.slice(0, 4).map((step, i) => (
        <div key={step} className="mt-3 flex items-center gap-2 text-xs">
          <span className="step-number">{i + 1}</span>
          <span>{step}</span>
          <span className="ml-auto font-mono">
            {money(
              run?.calls
                .filter((c) => c.step === step)
                .reduce((n, c) => n + (c.charge ?? 0), 0) ?? 0
            )}
          </span>
        </div>
      ))}
      <div className="panel-divider" />
      <div className="flex gap-2 text-xs leading-relaxed">
        <ShieldCheck className="shrink-0 text-teal-700" size={17} />
        <p>
          Budget enforced before every call. <strong>Nothing sends.</strong> You
          approve each Gmail draft.
        </p>
      </div>
      <p className="mt-4 flex items-center gap-1 text-xs text-muted-foreground">
        <KeyRound size={12} /> Your Gmail and CRM use your connections.
      </p>
      <p className="mt-3 text-[11px] text-muted-foreground">
        AI Gateway model usage is billed separately.
      </p>
    </aside>
  )
}
