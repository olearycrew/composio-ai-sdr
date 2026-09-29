import type { Tool } from "@composio/core"
import { provider, executeCall } from "./composio"
import { WALLET_TOOLS, type WalletSlug } from "./catalog"
import { STEPS } from "./sdr"
export function walletTool(id: string, slug: WalletSlug, raw: Tool) {
  const info = WALLET_TOOLS[slug]
  return provider.wrapTool(
    {
      ...raw,
      description: `${raw.description ?? info.action}. Wallet: paid from Composio credits. Publish a plan first. sdrCompanyId identifies a qualified company for people/verification.`,
      inputParameters: {
        ...raw.inputParameters,
        type: "object",
        properties: {
          ...raw.inputParameters?.properties,
          sdrCompanyId: {
            type: "string",
            description:
              "Qualified company ID, or empty for company discovery/research.",
          },
          sdrStep: {
            type: "string",
            enum:
              slug === "EXA_SEARCH"
                ? ["Find companies", "Research signals"]
                : [info.step],
          },
        },
        required: [
          ...(raw.inputParameters?.required ?? []),
          "sdrCompanyId",
          "sdrStep",
        ],
      },
    },
    async (_slug, input) => {
      const { sdrCompanyId, sdrStep, ...args } = input
      const step = STEPS.find((s) => s === sdrStep)
      if (
        !step ||
        (slug !== "EXA_SEARCH" && step !== info.step) ||
        (slug === "EXA_SEARCH" &&
          !["Find companies", "Research signals"].includes(step))
      )
        throw new Error("Invalid research step")
      const call = await executeCall(
        id,
        slug,
        args,
        step,
        typeof sdrCompanyId === "string" && sdrCompanyId
          ? sdrCompanyId
          : undefined
      )
      return {
        successful: call.status === "succeeded",
        data: { call },
        error: call.error ?? null,
      }
    }
  )
}
