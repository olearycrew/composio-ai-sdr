"use client"
import * as React from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import {
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Loader2,
  Sparkles,
  Wallet,
} from "lucide-react"
import type { GatewayModel } from "@/lib/models"
import { LAUNCH_BRIEF, type Run } from "@/lib/sdr"
import type { ChatUIMessage } from "@/tools"
import { ChatMessage } from "./chat-message"
import { PromptForm } from "./prompt-form"
import { SpendPanel } from "./spend-panel"
import { ResultsTable } from "./results-table"
import { EmailReviews } from "./email-review"
import { ToolCard } from "./tool-card"
import { RunContext } from "./run-context"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "./ui/message-scroller"
export function Chat({ models }: { models: GatewayModel[] }) {
  const [run, setRun] = React.useState<Run | null>(null)
  const [model, setModel] = React.useState(models[0]?.id ?? "")
  const [tab, setTab] = React.useState("chat"),
    [notice, setNotice] = React.useState("")
  const [setup, setSetup] = React.useState({ composio: true, gateway: true })
  const [starting, setStarting] = React.useState(false)
  const hydrated = React.useRef(false)
  const transport = React.useMemo(
    () =>
      new DefaultChatTransport<ChatUIMessage>({
        prepareSendMessagesRequest: ({ messages, body }) => ({
          body: { ...body, messages: messages.slice(-1) },
        }),
      }),
    []
  )
  const { messages, setMessages, sendMessage, status, stop, error } =
    useChat<ChatUIMessage>({ transport })
  const busy = status === "streaming" || status === "submitted" || starting
  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch(
        hydrated.current ? "/api/run" : "/api/run?history=1",
        { cache: "no-store" }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setRun(data.run)
      setSetup(data.setup)
      if (!hydrated.current) {
        hydrated.current = true
        if (data.run?.messages?.length) setMessages(data.run.messages)
      }
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not load run")
    }
  }, [setMessages])
  React.useEffect(() => {
    const first = setTimeout(() => void refresh(), 0)
    const timer = setInterval(() => void refresh(), 2500)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [refresh])
  async function submit(text: string) {
    setNotice("")
    setStarting(true)
    try {
      let active = run
      if (!active) {
        const res = await fetch("/api/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brief: text }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        active = data.run as Run
        setRun(active)
      }
      setTab("chat")
      await sendMessage({ text }, { body: { runId: active.id, model } })
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not start research")
    } finally {
      setStarting(false)
      await refresh()
    }
  }
  async function connect(toolkit: string) {
    if (!run) return
    setNotice("")
    try {
      const res = await fetch("/api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: run.id, toolkit }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await refresh()
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Connection failed")
    }
  }
  const pending =
    run?.proposals.filter((p) => p.status === "pending").length ?? 0
  return (
    <RunContext.Provider value={{ run, refresh }}>
      <main className="sdr-shell">
        <div className="sdr-main">
          <div className="run-toolbar">
            <div>
              <div className="eyebrow">Your outbound workspace</div>
              <h1>From a brief to your next customer.</h1>
            </div>
            <span className={`run-status ${busy ? "working" : ""}`}>
              <i />
              {busy
                ? "Researching"
                : run?.status === "awaiting_review"
                  ? "Ready for review"
                  : run?.status === "complete"
                    ? "Run finished"
                    : run?.status === "blocked"
                      ? "Needs attention"
                      : "Ready when you are"}
            </span>
          </div>
          <nav className="run-tabs" aria-label="Workspace views">
            {[
              ["chat", "Conversation"],
              [
                "prospects",
                `Prospects ${run?.prospects.length ?? 0}/${run?.target ?? 20}`,
              ],
              ["review", `Review emails${pending ? ` (${pending})` : ""}`],
              ["activity", `Tool calls (${run?.calls.length ?? 0})`],
            ].map(([value, label]) => (
              <button
                key={value}
                aria-current={tab === value ? "page" : undefined}
                className={tab === value ? "active" : ""}
                onClick={() => setTab(value)}
              >
                {label}
              </button>
            ))}
          </nav>
          {(!setup.composio || !setup.gateway) && (
            <div className="setup-note">
              <KeyRound size={16} />
              <span>
                Live research needs{" "}
                {![setup.composio, setup.gateway].some(Boolean)
                  ? "Composio and AI Gateway credentials"
                  : !setup.composio
                    ? "a Composio credential"
                    : "an AI Gateway credential"}
                . Add them to the server environment to begin. No credits have
                been spent.
              </span>
            </div>
          )}
          {(notice || error) && (
            <div role="alert" className="error-note">
              {notice || error?.message}
            </div>
          )}
          {run?.note && (
            <div className="run-note">
              <CheckCircle2 size={16} />
              <span>{run.note}</span>
            </div>
          )}
          <div className="workspace-content">
            {tab === "chat" ? (
              <>
                {!messages.length ? (
                  <div className="intro-scroll">
                    <div className="brief-intro">
                      <span className="intro-icon">
                        <Sparkles size={25} />
                      </span>
                      <h2>
                        Your brief. Your apps.
                        <br />
                        <span>A little research money.</span>
                      </h2>
                      <p>
                        Find the right people, check the fit, and write the
                        first hello.
                        <br />
                        One conversation, with every call accounted for.
                      </p>
                      <button
                        className="launch-brief"
                        disabled={busy}
                        onClick={() => submit(LAUNCH_BRIEF)}
                      >
                        <span className="eyebrow">Try the launch brief</span>
                        <strong>
                          Bookkeeping for growing marketing agencies
                        </strong>
                        <span>
                          20 prospects · US agencies · 10–50 employees · $25
                          budget
                        </span>
                        <span className="launch-action">
                          Find my prospects <ArrowRight size={16} />
                        </span>
                      </button>
                      <div className="intro-promises">
                        <span>
                          <Wallet size={14} />
                          Pay per call
                        </span>
                        <span>
                          <KeyRound size={14} />
                          Your connected apps
                        </span>
                        <span>
                          <CheckCircle2 size={14} />
                          You approve every draft
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <MessageScrollerProvider>
                    <MessageScroller className="min-h-0 flex-1">
                      <MessageScrollerViewport>
                        <MessageScrollerContent className="chat-content">
                          {messages.map((message) => (
                            <MessageScrollerItem
                              key={message.id}
                              messageId={message.id}
                              scrollAnchor={message.role === "user"}
                            >
                              <ChatMessage
                                message={message}
                                isStreaming={
                                  busy && message.id === messages.at(-1)?.id
                                }
                              />
                            </MessageScrollerItem>
                          ))}
                          {busy && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="animate-spin" size={15} />
                              Checking the next step…
                            </div>
                          )}
                          {run && !busy && (
                            <div className="flex flex-wrap gap-2">
                              {["hubspot", "gmail"]
                                .filter((t) => !run.connections[t]?.connected)
                                .map((t) =>
                                  run.connections[t]?.url ? (
                                    <a
                                      key={t}
                                      className="secondary-button"
                                      href={run.connections[t].url}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      Connect {t} ↗
                                    </a>
                                  ) : (
                                    <button
                                      key={t}
                                      className="secondary-button"
                                      onClick={() => connect(t)}
                                    >
                                      Connect {t}
                                    </button>
                                  )
                                )}
                              {!run.connections.hubspot?.connected && (
                                <button
                                  className="secondary-button"
                                  onClick={() => connect("salesforce")}
                                >
                                  Use Salesforce
                                </button>
                              )}
                              {run.connections.salesforce?.url &&
                                !run.connections.salesforce.connected && (
                                  <a
                                    className="secondary-button"
                                    href={run.connections.salesforce.url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Connect Salesforce ↗
                                  </a>
                                )}
                              {!pending && run.status !== "complete" && (
                                <button
                                  className="primary-button"
                                  onClick={() =>
                                    submit(
                                      "Continue the run from the saved state. Refresh connections if needed."
                                    )
                                  }
                                >
                                  Continue <ArrowRight size={14} />
                                </button>
                              )}
                            </div>
                          )}
                        </MessageScrollerContent>
                      </MessageScrollerViewport>
                      <MessageScrollerButton />
                    </MessageScroller>
                  </MessageScrollerProvider>
                )}
                <div className="chat-composer">
                  <PromptForm
                    models={models}
                    model={model}
                    onModelChange={setModel}
                    isBusy={busy}
                    onSubmit={submit}
                    onStop={stop}
                  />
                </div>
              </>
            ) : tab === "prospects" ? (
              <div className="overflow-auto">
                {run ? (
                  <ResultsTable run={run} />
                ) : (
                  <div className="empty-panel">
                    <h2>Start with your sales brief</h2>
                    <p>
                      Qualified prospects will appear here as research
                      progresses.
                    </p>
                  </div>
                )}
              </div>
            ) : tab === "review" ? (
              <div className="overflow-auto">
                <EmailReviews />
              </div>
            ) : (
              <div className="activity-grid overflow-auto">
                {run?.calls.length ? (
                  run.calls.map((c) => <ToolCard key={c.id} call={c} />)
                ) : (
                  <div className="empty-panel">
                    <h2>Every call, accounted for</h2>
                    <p>
                      Research uses your wallet. CRM and Gmail use your keys.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <SpendPanel run={run} />
      </main>
    </RunContext.Provider>
  )
}
