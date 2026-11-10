"use client";

import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { money, scenarioNames } from "../lib/demo";
import { labReport, labScenarios } from "../lib/traffic-lab";
import { pickupWindow } from "../lib/pickup-time";
import { ErrorMessage } from "./shared";

type LabScenario = typeof labScenarios[number];
type LabReport = ReturnType<typeof labReport.parse>;

export function TrafficLab({ stalls }: { stalls: { id: string; name: string }[] }) {
  const [scenario, setScenario] = useState<LabScenario>("heavy");
  const [report, setReport] = useState<LabReport>();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    setRunning(true);
    setReport(undefined);
    setError("");
    try {
      const response = await fetch("/api/demo/traffic?scenario=" + scenario, {
        method: "POST", headers: { "X-AP-Food-Traffic-Lab": "1" },
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(typeof payload?.message === "string" ? payload.message : "The scenario could not finish.");
      setReport(labReport.parse(payload));
    } catch (problem) {
      setError(problem instanceof Error && problem.name === "Error" ? problem.message : "Could not read the scenario results. Try again.");
    } finally {
      setRunning(false);
    }
  }

  return <section className="panel stack" aria-labelledby="traffic-lab-title">
    <div className="line spread wrap">
      <div><span className="section-label">FIF · Traffic Lab</span><h2 id="traffic-lab-title">Rehearse a pickup rush</h2></div>
      <span className="badge neutral">Isolated local simulation</span>
    </div>
    <p className="muted">Run fictional orders through the checkout and pickup rules in a fresh local database. Results appear here separately from the browser demo.</p>
    <form className="line wrap" onSubmit={event => { event.preventDefault(); if (!running) void run(); }}>
      <label className="field compact">Lab scenario<select value={scenario} disabled={running} onChange={event => {
        const selected = labScenarios.find(value => value === event.target.value);
        if (selected) setScenario(selected);
      }}>{labScenarios.map(value => <option key={value} value={value}>{scenarioNames[value]}</option>)}</select></label>
      <button className="button primary" disabled={running}><FlaskConical size={16} aria-hidden /> {running ? "Running scenario…" : "Run scenario"}</button>
    </form>
    <div role="status" className="small muted">{running ? "Creating the local database and placing demo orders." : report ? scenarioNames[report.scenario] + " run complete." : ""}</div>
    <ErrorMessage message={error} />
    {report && <>
      <div className="metrics">{[
        ["First-window attempts", report.initialAttempts], ["Accepted at target", report.acceptedAtTarget],
        ["Slot conflicts", report.slotConflicts], ["Rerouted", report.reroutedOrders],
      ].map(([label, count]) => <div className="metric" key={label}><div><span>{label}</span><strong>{count}</strong></div></div>)}</div>
      <div className="small"><p>Target window · {pickupWindow(report.pickupWindow)}</p><p>Next quoted noodle pickup after the initial demand · {pickupWindow(report.nextNoodlePickupAfterInitialDemand)}</p></div>
      <div className="table-wrap"><table><caption>Target-window load before collection</caption><thead><tr><th>Stall</th><th>Pickups</th><th>Work units booked</th></tr></thead><tbody>
        {report.targetBucketsBeforeCollection.map(bucket => <tr key={bucket.vendor_id}><th scope="row">{stalls.find(stall => stall.id === bucket.vendor_id)?.name ?? bucket.vendor_id}</th><td>{bucket.pickup_count}</td><td>{bucket.reserved_units} / {bucket.total_units}</td></tr>)}
      </tbody></table></div>
      <p className="small muted">{report.unresolvedConflicts} first-window requests remained unplaced · {money(report.demoReceipts.reduce((sum, receipt) => sum + receipt.amount_sen, 0))} in demo receipts</p>
    </>}
  </section>;
}
