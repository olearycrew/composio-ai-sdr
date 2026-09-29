import type { Metadata } from "next"

import { MODELS } from "@/lib/models"
import { Chat } from "@/components/chat"

export const metadata: Metadata = {
  title: "Composio AI SDR — Your keys. Your wallet.",
  description:
    "Find verified prospects, track every research charge, and approve outreach drafts with your connected apps.",
}

export default function Page() {
  return <Chat models={MODELS} />
}
