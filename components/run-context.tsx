"use client"
import { createContext, useContext } from "react"
import type { Run } from "@/lib/sdr"
export const RunContext = createContext<{
  run: Run | null
  refresh: () => Promise<void>
}>({ run: null, refresh: async () => {} })
export const useRun = () => useContext(RunContext)
