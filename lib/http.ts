import { randomUUID } from "node:crypto"
import { cookies, headers } from "next/headers"
import { update } from "./store"

export async function demoUser() {
  const jar = await cookies()
  const requestHeaders = await headers()
  let id = jar.get("sdr-user")?.value
  if (!id || !/^[a-f0-9-]{36}$/.test(id)) {
    id = randomUUID()
    jar.set("sdr-user", id, {
      httpOnly: true,
      secure:
        !!process.env.VERCEL ||
        requestHeaders.get("x-forwarded-proto") === "https",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    })
  }
  return id
}
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin")
  const url = new URL(req.url)
  const host =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host
  const protocol =
    req.headers.get("x-forwarded-proto") ?? url.protocol.slice(0, -1)
  if (origin && origin !== `${protocol}://${host}`)
    throw new Error("Cross-origin requests are not allowed")
}
export async function rateLimit(req: Request, userId: string) {
  // Vercel owns this header. Locally a global bucket cannot be bypassed by spoofing headers.
  const ip = process.env.VERCEL
    ? (req.headers.get("x-vercel-forwarded-for") ?? "unknown")
    : "local"
  for (const key of [`ip:${ip}`, `user:${userId}`, "global"]) {
    const allowed = await update<{ start: number; count: number }, boolean>(
      `limit:${key}`,
      (old) => {
        const state =
          !old || Date.now() - old.start > 60_000
            ? { start: Date.now(), count: 0 }
            : old
        state.count++
        return { state, result: state.count <= (key === "global" ? 60 : 15) }
      }
    )
    if (!allowed) return false
  }
  return true
}
export async function jsonBody(req: Request) {
  if (Number(req.headers.get("content-length")) > 200_000)
    throw new Error("Request too large")
  const text = await req.text()
  if (text.length > 200_000) throw new Error("Request too large")
  return JSON.parse(text) as unknown
}
