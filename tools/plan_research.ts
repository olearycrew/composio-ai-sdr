import { tool } from "ai"
import { z } from "zod"
import { mutateRun } from "@/lib/ledger"
import { STEPS, spent, reserved } from "@/lib/sdr"
import { maxCharge } from "@/lib/catalog"
export const planResearch = (id: string) =>
  tool({
    description:
      "Publish a research plan BEFORE any wallet call. Choose the cheapest adequate verified tool. Give slugs, step and call counts; the server computes maximum cost. Additional plans add calls: plan only the next small batch.",
    inputSchema: z.object({
      summary: z.string().min(10).max(1000),
      lines: z
        .array(
          z.object({
            slug: z.string(),
            step: z.enum(STEPS),
            calls: z.number().int().min(1).max(100),
          })
        )
        .min(1)
        .max(10),
    }),
    execute: (input) =>
      mutateRun(id, (run) => {
        if (
          run.status === "blocked" ||
          run.status === "complete" ||
          run.prospects.length >= run.target
        )
          throw new Error("Research has stopped. Summarize the saved results.")
        const lines = input.lines.map((line) => {
          const entry = run.catalog.find((c) => c.slug === line.slug)
          const rate = maxCharge(line.slug)
          if (!entry?.instant || rate === null)
            throw new Error(
              "Plan only tools with verified Instant coverage and prices"
            )
          return { ...line, estimate: rate * line.calls }
        })
        if (
          lines.reduce((n, l) => n + l.estimate, 0) >
          run.budget - spent(run) - reserved(run)
        )
          throw new Error(
            "This plan exceeds the remaining budget. Reduce the batch."
          )
        const plan = { summary: input.summary, lines }
        run.plans.push(plan)
        run.status = "researching"
        return plan
      }),
  })
