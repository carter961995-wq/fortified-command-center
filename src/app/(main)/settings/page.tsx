import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NationalAccountCards } from "@/components/integrations/national-account-panels";

export const metadata = { title: "Settings" };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          National-account intake, Gemini assistant, and company defaults for Fortified Fence &amp; Weld.
        </p>
      </div>

      {sp.google ? (
        <p className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm">{sp.google}</p>
      ) : null}

      <NationalAccountCards />

      <Card>
        <CardHeader>
          <CardTitle>Invoice template</CardTitle>
          <CardDescription>Fortified commercial invoice PDF is built in. Generate it from any invoice record.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          The PDF includes company letterhead, customer WO #, PO #, site address, scope, line items, and terms. Open an
          invoice and choose Generate PDF.
        </CardContent>
      </Card>
    </div>
  );
}
