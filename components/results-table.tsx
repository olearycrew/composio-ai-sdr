import { CheckCircle2 } from "lucide-react"
import { money, type Run } from "@/lib/sdr"
export function ResultsTable({ run }: { run: Run }) {
  if (!run.prospects.length)
    return (
      <div className="empty-panel">
        <CheckCircle2 size={28} />
        <h2>No screened prospects yet</h2>
        <p>
          Only verified emails that pass both CRM and sent-mail checks appear
          here.
        </p>
      </div>
    )
  return (
    <div className="overflow-x-auto">
      <table className="results-table">
        <caption className="sr-only">Qualified and screened prospects</caption>
        <thead>
          <tr>
            {[
              "Company",
              "Person / title",
              "Growth signal",
              "Verified email",
              "Sources",
              "Research cost",
            ].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {run.prospects.map((p) => {
            const c = run.companies.find((c) => c.id === p.companyId)!
            const count = run.prospects.filter(
              (v) => v.companyId === c.id
            ).length
            const cost =
              run.calls
                .filter((call) => call.companyId === c.id)
                .reduce((n, call) => n + (call.charge ?? 0), 0) / count
            return (
              <tr key={p.id}>
                <td>
                  <strong>{c.name}</strong>
                  <small>
                    {c.domain} · {c.employees} people
                  </small>
                </td>
                <td>
                  <strong>{p.person}</strong>
                  <small>{p.title}</small>
                </td>
                <td className="max-w-60">{c.signal}</td>
                <td>
                  <span className="email-verified">
                    <CheckCircle2 size={13} />
                    {p.email}
                  </span>
                  <small>CRM + sent mail clear</small>
                </td>
                <td>
                  {[
                    ...new Set(
                      [...c.evidence, ...p.evidence].map((e) => e.url)
                    ),
                  ].map((url, i) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="mr-2 text-teal-800 underline"
                    >
                      {i + 1} ↗
                    </a>
                  ))}
                </td>
                <td className="font-mono">{money(cost)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="px-5 py-4 text-xs text-muted-foreground">
        Company research is split across its prospects. Shared discovery and
        research for excluded companies remain in the wallet total.
      </p>
    </div>
  )
}
