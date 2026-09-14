"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Mail, RadioTower, Workflow } from "lucide-react";
import { GoogleIntegrationPanel } from "./google-integration-panel";
import { SourceConnectionForm } from "./source-connection-form";

const sources = [
  {
    id: "mhelpdesk" as const,
    name: "mHelpDesk",
    blurb: "Log in. Current facility work orders are pulled and organized here.",
    icon: Workflow,
  },
  {
    id: "truesource" as const,
    name: "TrueSource",
    blurb: "Log in to Affiliate Connect. Current tickets land on the board.",
    icon: RadioTower,
  },
  {
    id: "gmail" as const,
    name: "Gmail",
    blurb: "Sign in with Google. Bids, quotes, and work orders sort themselves.",
    icon: Mail,
  },
];

export function JobSourcesSetup({ googleMessage }: { googleMessage?: string }) {
  const [selected, setSelected] = useState<(typeof sources)[number]["id"]>("mhelpdesk");

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 md:grid-cols-3">
        {sources.map((source) => {
          const Icon = source.icon;
          const active = selected === source.id;
          return (
            <button
              key={source.id}
              type="button"
              onClick={() => setSelected(source.id)}
              className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${
                active
                  ? "border-orange-400 bg-orange-500/15 ring-2 ring-orange-400/40"
                  : "border-slate-600 bg-slate-900/80 hover:border-orange-300/60 hover:bg-slate-800"
              }`}
            >
              <span className="flex size-11 items-center justify-center rounded-lg bg-slate-950 text-orange-300">
                <Icon className="size-5" />
              </span>
              <span>
                <span className="flex items-center gap-2 text-base font-bold text-white">
                  {source.name}
                  {active ? <Check className="size-4 text-orange-300" /> : null}
                </span>
                <span className="mt-1 block text-sm leading-5 text-slate-200">{source.blurb}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-slate-600 bg-slate-900 p-5">
        {selected === "mhelpdesk" ? (
          <SourceConnectionForm
            provider="mhelpdesk"
            title="Set up mHelpDesk"
            description="Log in with the same email you use on mHelpDesk. The Command Center pulls current work orders and files them here."
            defaultUrl="https://app.mhelpdesk.com"
            apiPath="/api/integrations/mhelpdesk"
          />
        ) : null}
        {selected === "truesource" ? (
          <SourceConnectionForm
            provider="truesource"
            title="Set up TrueSource / Affiliate Connect"
            description="Log in to Affiliate Connect. After that, current national-account jobs are pulled, searched, and grouped in Job Intake."
            defaultUrl="https://truesource.com"
            apiPath="/api/integrations/truesource"
          />
        ) : null}
        {selected === "gmail" ? (
          <div className="grid gap-4">
            <div>
              <h3 className="text-lg font-bold text-white">Sign in with Gmail</h3>
              <p className="mt-1 text-sm leading-6 text-slate-200">
                One Google login is enough. The Command Center reads the mailbox, files invitation to bid / quoted /
                approved quotes, and pulls mHelpDesk and Affiliate Connect assignment emails automatically.
              </p>
            </div>
            <GoogleIntegrationPanel message={googleMessage} />
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/job-intake" className="app-btn app-btn-primary">
          Open Job Intake
        </Link>
        <Link href="/email-inbox" className="app-btn app-btn-secondary">
          Open Email Inbox
        </Link>
      </div>
    </div>
  );
}
