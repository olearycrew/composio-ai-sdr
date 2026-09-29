import { createHash, randomUUID } from "node:crypto"
import { read, update } from "./store"
import { reserved, spent, type Run, type Call, type Step } from "./sdr"

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`
  return JSON.stringify(value)
}
export const callKey = (slug: string, input: unknown) =>
  createHash("sha256")
    .update(`${slug}:${canonical(input)}`)
    .digest("hex")
export async function getRun(id: string) {
  const run = await read<Run>(`run:${id}`)
  if (!run) throw new Error("Run not found")
  return run
}
export const mutateRun = <T>(id: string, f: (run: Run) => T) =>
  update<Run, T>(`run:${id}`, (run) => {
    if (!run) throw new Error("Run not found")
    return { state: run, result: f(run) }
  })
export async function reserveCall(
  id: string,
  input: {
    slug: string
    args: Record<string, unknown>
    provider: string
    action: string
    source: Call["source"]
    step: Step
    maxCharge: number
    companyId?: string
  }
) {
  const key = callKey(input.slug, input.args)
  return mutateRun(id, (run) => {
    const prior = run.calls.find((c) => c.key === key)
    if (prior) return { call: prior, cached: true }
    if (input.source === "Wallet") {
      if (
        run.status === "complete" ||
        run.status === "blocked" ||
        run.prospects.length >= run.target
      )
        throw new Error(
          "Research has stopped. Summarize the results already available."
        )
      if (run.calls.some((c) => c.status === "uncertain"))
        throw new Error(
          "A previous charge is unresolved. Research is paused to protect the budget."
        )
      const planned = run.plans
        .flatMap((p) => p.lines)
        .filter((l) => l.slug === input.slug && l.step === input.step)
        .reduce((n, l) => n + l.calls, 0)
      if (
        run.calls.filter((c) => c.slug === input.slug && c.step === input.step)
          .length >= planned
      )
        throw new Error(
          "Publish a plan with this tool and call count before spending."
        )
      if (!Number.isSafeInteger(input.maxCharge) || input.maxCharge < 0)
        throw new Error("Verified maximum charge required.")
      if (
        spent(run) >= run.budget ||
        spent(run) + reserved(run) + input.maxCharge > run.budget
      )
        throw new Error(
          "Budget limit reached. Wrap up with the prospects already found."
        )
    }
    const call: Call = {
      id: randomUUID(),
      key,
      slug: input.slug,
      args: input.args,
      provider: input.provider,
      action: input.action,
      source: input.source,
      step: input.step,
      companyId: input.companyId,
      status: "pending",
      reserved: input.maxCharge,
      charge: null,
      at: new Date().toISOString(),
    }
    run.calls.push(call)
    return { call, cached: false }
  })
}
export async function settleCall(
  id: string,
  callId: string,
  result: {
    status: Call["status"]
    charge: number | null
    result?: Record<string, unknown>
    error?: string
    logId?: string
  }
) {
  return mutateRun(id, (run) => {
    const call = run.calls.find((c) => c.id === callId)
    if (!call || call.status !== "pending")
      throw new Error("Call is already settled or missing")
    Object.assign(call, result)
    if (
      result.status === "uncertain" ||
      (result.charge !== null &&
        result.charge > call.reserved &&
        call.source === "Wallet")
    ) {
      run.status = "blocked"
      run.note =
        "A provider charge needs reconciliation. Further research is paused."
    }
    return call
  })
}
