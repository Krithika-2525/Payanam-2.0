import { useState } from "react";
import { Wallet, Check, Plus, Trash2 } from "lucide-react";
import type { Draft } from "./drafts";
import type { Planning } from "./planner";
export default function TripTools({
  draft,
  onChange,
}: {
  draft: Draft;
  onChange: (d: Draft) => void;
}) {
  const p = draft.metadata.planning!;
  const [label, setLabel] = useState(""),
    [amount, setAmount] = useState(""),
    [category, setCategory] = useState<
      "transport" | "stay" | "food" | "activities" | "other"
    >("transport"),
    [packing, setPacking] = useState(""),
    [error, setError] = useState("");
  const update = (value: Partial<Planning>) =>
    onChange({
      ...draft,
      metadata: { ...draft.metadata, planning: { ...p, ...value } },
    });
  const expenses = p.expenses || [],
    checklist = p.checklist || [],
    total = expenses.reduce((s, e) => s + e.amount, 0);
  const money = (v: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: draft.metadata.currency,
      maximumFractionDigits: 0,
    }).format(v);
  return (
    <div className="trip-tools">
      <section className="planner-tool-card">
        <span className="travel-eyebrow">
          <Wallet size={15} /> YOUR MONEY, YOUR PLAN
        </span>
        <h2>Keep an eye on the little things.</h2>
        <p>
          Track costs you enter. These are personal expenses, not estimated
          ticket prices.
        </p>
        <label>
          Trip budget
          <input
            aria-label="Trip budget"
            type="number"
            min="0"
            max="10000000"
            value={p.budget || ""}
            onChange={(e) =>
              update({
                budget: Math.min(
                  10000000,
                  Math.max(0, Number(e.target.value) || 0),
                ),
              })
            }
          />
        </label>
        <div className="budget-summary">
          <div>
            <small>RECORDED</small>
            <strong>{money(total)}</strong>
          </div>
          <div>
            <small>{total > p.budget ? "OVER BUDGET" : "LEFT TO PLAN"}</small>
            <strong>
              {p.budget ? money(Math.abs(p.budget - total)) : "Set a budget"}
            </strong>
          </div>
        </div>
        {p.budget > 0 && (
          <progress
            aria-label="Budget used"
            value={Math.min(total, p.budget)}
            max={p.budget}
          />
        )}
        <form
          className="expense-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (
              !label.trim() ||
              !Number.isFinite(Number(amount)) ||
              Number(amount) < 0 ||
              Number(amount) > 10000000 ||
              expenses.length >= 50
            ) {
              setError(
                "Enter a description and valid amount; up to 50 expenses.",
              );
              return;
            }
            update({
              expenses: [
                ...expenses,
                {
                  id: crypto.randomUUID(),
                  label: label.trim(),
                  amount: Number(amount),
                  category,
                },
              ],
            });
            setLabel("");
            setAmount("");
            setError("");
          }}
        >
          <input
            aria-label="Expense description"
            placeholder="Train ticket, lunch, a place to stay…"
            maxLength={120}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            required
          />
          <input
            aria-label="Expense amount"
            placeholder="Amount"
            type="number"
            min="0"
            max="10000000"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <select
            aria-label="Expense category"
            value={category}
            onChange={(e) => setCategory(e.target.value as typeof category)}
          >
            {["transport", "stay", "food", "activities", "other"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button className="travel-button primary">
            <Plus size={14} /> Add expense
          </button>
        </form>
        {error && <p role="alert">{error}</p>}
        <div className="expense-list">
          {expenses.map((e) => (
            <div key={e.id}>
              <span>
                <strong>{e.label}</strong>
                <small>{e.category}</small>
              </span>
              <b>{money(e.amount)}</b>
              <button
                className="travel-icon-button"
                aria-label={"Remove expense " + e.label}
                onClick={() =>
                  update({ expenses: expenses.filter((x) => x.id !== e.id) })
                }
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          {!expenses.length && (
            <p>No expenses recorded yet. Start with something you know.</p>
          )}
        </div>
      </section>
      <section className="planner-tool-card">
        <span className="travel-eyebrow">
          <Check size={15} /> BEFORE YOU STEP OUT
        </span>
        <h2>A little preparation, a better journey.</h2>
        <p>
          {checklist.filter((c) => c.done).length} of {checklist.length} ready.
          Adapt this list to your trip.
        </p>
        <div className="packing-list">
          {checklist.map((c) => (
            <div key={c.id}>
              <label>
                <input
                  type="checkbox"
                  checked={c.done}
                  onChange={(e) =>
                    update({
                      checklist: checklist.map((x) =>
                        x.id === c.id ? { ...x, done: e.target.checked } : x,
                      ),
                    })
                  }
                />
                <span>{c.label}</span>
              </label>
              <button
                className="travel-icon-button"
                aria-label={"Remove packing item " + c.label}
                onClick={() =>
                  update({ checklist: checklist.filter((x) => x.id !== c.id) })
                }
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!packing.trim() || checklist.length >= 50) return;
            update({
              checklist: [
                ...checklist,
                { id: crypto.randomUUID(), label: packing.trim(), done: false },
              ],
            });
            setPacking("");
          }}
        >
          <input
            aria-label="New packing item"
            maxLength={120}
            placeholder="Something else to remember…"
            value={packing}
            onChange={(e) => setPacking(e.target.value)}
            required
          />
          <button className="travel-button secondary">
            <Plus size={14} /> Add to list
          </button>
        </form>
        <small>
          Your costs and checklist are saved with this trip when you choose
          Save.
        </small>
      </section>
    </div>
  );
}
