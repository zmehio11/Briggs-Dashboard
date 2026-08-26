import { outreachAdapter } from "@/lib/adapters/outreach";
import { OutreachType } from "@/lib/types";
import { addContact } from "./actions";
import { StatusSelect } from "./StatusSelect";
import { DeleteButton } from "./DeleteButton";

const TYPES: OutreachType[] = ["Partnership", "Sponsorship", "Influencer", "Local Press", "Community Event", "Other"];

const inputClass = "rounded-lg border border-hairline bg-plane px-3 py-2 text-sm outline-none focus:border-series-1";

export default async function CommunityOutreachPage() {
  const contacts = await outreachAdapter.list();

  return (
    <div>
      <h1 className="text-2xl font-semibold">Community Outreach Tracker</h1>
      <p className="mt-1 text-sm text-ink-secondary">Local partnerships, sponsorships, press, and influencer contacts — who to reach, and where things stand.</p>

      <form action={addContact} className="mt-6 grid grid-cols-1 gap-3 rounded-xl border border-hairline bg-surface p-5 sm:grid-cols-2">
        <input name="name" placeholder="Name" required className={inputClass} />
        <input name="organization" placeholder="Organization" className={inputClass} />
        <select name="type" defaultValue="Partnership" className={inputClass}>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input name="contactInfo" placeholder="Email / phone / handle" className={inputClass} />
        <div className="sm:col-span-2">
          <label className="text-xs font-medium uppercase tracking-wide text-ink-muted">Next action date</label>
          <input name="nextActionDate" type="date" className={`mt-1 w-full ${inputClass}`} />
        </div>
        <textarea name="notes" placeholder="Notes" rows={2} className={`sm:col-span-2 ${inputClass}`} />
        <button type="submit" className="rounded-lg bg-series-1 px-4 py-2 text-sm font-medium text-white sm:col-span-2 sm:w-fit">
          Add contact
        </button>
      </form>

      <div className="mt-6 overflow-x-auto rounded-xl border border-hairline bg-surface">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-hairline text-xs uppercase tracking-wide text-ink-muted">
              <th className="p-3 font-medium">Name</th>
              <th className="p-3 font-medium">Type</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Next action</th>
              <th className="p-3 font-medium">Contact</th>
              <th className="p-3 font-medium">Notes</th>
              <th className="p-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <tr key={c.id} className="border-b border-hairline last:border-0">
                <td className="p-3">
                  <div className="font-medium">{c.name}</div>
                  {c.organization && <div className="text-xs text-ink-muted">{c.organization}</div>}
                </td>
                <td className="p-3 text-ink-secondary">{c.type}</td>
                <td className="p-3">
                  <StatusSelect id={c.id} status={c.status} />
                </td>
                <td className="p-3 text-ink-secondary tabular">{c.nextActionDate ?? "—"}</td>
                <td className="p-3 text-ink-secondary">{c.contactInfo ?? "—"}</td>
                <td className="max-w-xs truncate p-3 text-ink-secondary">{c.notes ?? "—"}</td>
                <td className="p-3">
                  <DeleteButton id={c.id} />
                </td>
              </tr>
            ))}
            {contacts.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-sm text-ink-muted">
                  No contacts yet — add one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
