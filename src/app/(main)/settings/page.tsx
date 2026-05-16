import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Integrations and company defaults (MVP placeholders).</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payments</CardTitle>
          <CardDescription>Stripe card and ACH capture will connect here.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Reserved for Stripe Checkout / Customer Portal integration.</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Accounting</CardTitle>
          <CardDescription>QuickBooks Online export and sync.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Reserved for invoice / payment export and chart-of-accounts mapping.</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Email and SMS dispatch rules.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Reserved for transactional email (quotes, invoices) and SMS alerts.</CardContent>
      </Card>

      <Separator />
      <p className="text-xs text-muted-foreground">
        Fortified Work Order Command Center — internal use only. Role expansion (dispatcher, subcontractor portal,
        customer portal) is supported at the database level via{" "}
        <code className="rounded bg-muted px-1">users_profile.role</code>.
      </p>
    </div>
  );
}
