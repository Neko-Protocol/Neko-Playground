"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { ALLOWED_COUNTRIES } from "@/lib/constants";

function MockKycForm() {
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get("sessionId") ?? "";
  const reference = params.get("reference") ?? "";
  const redirectTo = params.get("redirectTo") ?? "/issuer/list";

  const [country, setCountry] = useState("US");
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");

  const submit = async (approve: boolean) => {
    setStatus("submitting");
    await fetch("/api/kyc/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        status: approve ? "approved" : "declined",
        vendor_data: reference,
        country,
      }),
    });
    setStatus("done");
    setTimeout(() => router.push(redirectTo), 600);
  };

  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <Card className="p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Mock KYC</h1>
          <p className="text-sm text-muted-foreground">
            DIDIT stand-in for local development. Approve or decline to move on.
          </p>
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <p>
            <span className="font-medium">Session:</span> {sessionId}
          </p>
          <p>
            <span className="font-medium">Reference:</span> {reference}
          </p>
        </div>

        <Select
          label="Country of residence"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
        >
          {ALLOWED_COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </Select>

        <div className="flex gap-3">
          <Button
            onClick={() => submit(true)}
            disabled={status !== "idle"}
            className="flex-1"
          >
            {status === "submitting" ? "Submitting…" : "Approve"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => submit(false)}
            disabled={status !== "idle"}
            className="flex-1"
          >
            Decline
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default function MockKycPage() {
  return (
    <Suspense>
      <MockKycForm />
    </Suspense>
  );
}
