import Link from "next/link"
import { ArrowUpRight, KeyRound, Wallet } from "lucide-react"
export function SiteHeader() {
  return (
    <header className="sdr-header">
      <Link href="/" className="brand">
        <span className="brand-mark">c</span>
        <span>
          Composio <strong>AI SDR</strong>
        </span>
        <span className="demo-tag">DEMO</span>
      </Link>
      <div className="header-legend">
        <span>
          <KeyRound size={13} /> Your keys
        </span>
        <span>+</span>
        <span>
          <Wallet size={13} /> Your wallet
        </span>
      </div>
      <div className="flex items-center gap-5">
        <span className="signup-counter">
          Accounts signed up for: <strong>0</strong>
        </span>
        <a
          href="https://github.com/olearycrew/composio-ai-sdr"
          target="_blank"
          rel="noreferrer"
          className="github-link"
        >
          Open source <ArrowUpRight size={14} />
        </a>
      </div>
    </header>
  )
}
