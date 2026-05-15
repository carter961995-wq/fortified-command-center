import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { COMPANY } from "@/lib/constants";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="System configuration" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Company Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Company</span>
              <span className="font-medium">{COMPANY.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phone</span>
              <span className="font-medium">{COMPANY.phone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Default Payment Terms</span>
              <span className="font-medium">Net {COMPANY.defaultPaymentTermsDays}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Environment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Supabase URL</span>
              <span className="font-mono text-xs">
                {process.env.NEXT_PUBLIC_SUPABASE_URL ? "Configured" : "Not configured"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Anon Key</span>
              <span className="font-mono text-xs">
                {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "Configured" : "Not configured"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Future Integrations</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>Stripe (payment processing) — planned</p>
            <p>QuickBooks (accounting sync) — planned</p>
            <p>Supabase Storage (photos/documents) — planned</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
