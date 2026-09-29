import { tool } from "ai"
import { companySchema, qualifyCompany } from "@/lib/prospects"
export const qualifyCompanyTool = (id: string) =>
  tool({
    description:
      "Record company qualification from quoted tool evidence BEFORE enriching people. Read team/about and careers pages. Record pages checked, finance findings, hiring/funding dates, headcount and country. Missing information is not proof of absence. Reject companies that do not fit the brief.",
    inputSchema: companySchema,
    execute: (input) => qualifyCompany(id, input),
  })
