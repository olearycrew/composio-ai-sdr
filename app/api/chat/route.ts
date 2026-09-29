import { randomUUID } from "node:crypto"
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  hasToolCall,
  isStepCount,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai"
import { z } from "zod"
import { DEFAULT_MODEL, isModelAllowed } from "@/lib/models"
import { getTools } from "@/tools"
import { demoUser, jsonBody, sameOrigin, rateLimit } from "@/lib/http"
import { getRun, mutateRun } from "@/lib/ledger"
import { systemPrompt } from "@/lib/system-prompt"
export const maxDuration = 300
export const runtime = "nodejs"
export async function POST(req: Request) {
  let runId: string | undefined
  const requestId = randomUUID()
  const release = async () => {
    if (runId)
      await mutateRun(runId, (run) => {
        if (run.activeRequest?.id === requestId) delete run.activeRequest
      })
  }
  try {
    sameOrigin(req)
    const userId = await demoUser()
    if (!(await rateLimit(req, userId)))
      return Response.json(
        { error: "Too many requests. Wait a minute before continuing." },
        { status: 429, headers: { "Retry-After": "60" } }
      )
    const body = z
      .object({
        runId: z.uuid(),
        model: z.string().optional(),
        messages: z
          .array(
            z.object({
              id: z.string().max(100),
              role: z.string(),
              parts: z.array(z.unknown()),
            })
          )
          .max(500),
      })
      .parse(await jsonBody(req))
    const run = await getRun(body.runId)
    if (run.userId !== userId)
      return Response.json({ error: "Run not found" }, { status: 404 })
    if (
      !process.env.COMPOSIO_API_KEY ||
      (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL)
    )
      return Response.json(
        {
          error:
            "Configure COMPOSIO_API_KEY and AI_GATEWAY_API_KEY to start live research. No credits have been spent.",
        },
        { status: 503 }
      )
    const model = body.model ?? DEFAULT_MODEL
    if (!isModelAllowed(model))
      return Response.json({ error: "Model is not available" }, { status: 400 })
    const last = body.messages.at(-1)
    if (last?.role !== "user")
      throw new Error("Send a user message to continue")
    const parts = last.parts.map((p) =>
      z
        .object({ type: z.literal("text"), text: z.string().min(1).max(8000) })
        .parse(p)
    )
    if (!parts.length || parts.length > 5)
      throw new Error("Invalid user message")
    runId = run.id
    const messages = await mutateRun(run.id, (state) => {
      if (state.activeRequest && Date.now() - state.activeRequest.at < 360_000)
        throw new Error("This run is already working. Wait for it to finish.")
      state.activeRequest = { id: requestId, at: Date.now() }
      if (!state.messages.some((m) => m.id === last.id))
        state.messages.push({ id: last.id, role: "user", parts } as UIMessage)
      return state.messages
    })
    const tools = await getTools(run.id)
    const result = streamText({
      model,
      system: systemPrompt(await getRun(run.id)),
      messages: await convertToModelMessages(messages),
      tools,
      prepareStep: async () => ({
        tools: await getTools(run.id),
        system: systemPrompt(await getRun(run.id)),
      }),
      stopWhen: [
        isStepCount(35),
        hasToolCall("ask_user"),
        hasToolCall("connect_apps"),
        hasToolCall("finish_run"),
      ],
      maxOutputTokens: 8192,
      maxRetries: 0,
      abortSignal: req.signal,
      onError: async () => {
        await release()
      },
    })
    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        stream: result.stream,
        originalMessages: messages,
        sendSources: true,
        onError: () =>
          "The run stopped. Your ledger is saved; review its status before continuing.",
        onEnd: async ({ messages: saved }) => {
          await mutateRun(run.id, (state) => {
            state.messages = saved
          })
          await release()
        },
      }),
    })
  } catch (error) {
    await release()
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to continue the run",
      },
      { status: 400 }
    )
  }
}
