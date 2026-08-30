import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { COMPANY_OVERHEAD, PRICE_CATALOG, jobEstimate } from "@/lib/pricing/catalog";
import { formatCurrency } from "@/lib/format";

export const metadata = { title: "Pricing" };

const categories = ["material", "subcontractor", "equipment", "labor", "overhead"] as const;

export default function PricingPage() {
  const example = jobEstimate({ material: 640, subcontractor: 850, equipment: 285 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pricing book</h1>
        <p className="text-sm text-muted-foreground">
          Material, subcontractor, equipment, and overhead used to quote national-account fence and welding work.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Burden</CardDescription>
            <CardTitle>{COMPANY_OVERHEAD.burdenPercent}%</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Profit target</CardDescription>
            <CardTitle>{COMPANY_OVERHEAD.profitTargetPercent}%</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Default trip</CardDescription>
            <CardTitle>{formatCurrency(COMPANY_OVERHEAD.tripChargeDefault)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Example sell (mat+sub+eq)</CardDescription>
            <CardTitle>{formatCurrency(example.suggestedSell)}</CardTitle>
          </CardHeader>
        </Card>
      </div>
      {categories.map((category) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="capitalize">{category}</CardTitle>
            <CardDescription>Company cost book. Sell prices already include typical markup.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Item</th>
                    <th className="py-2 pr-4 font-medium">Unit</th>
                    <th className="py-2 pr-4 font-medium">Cost</th>
                    <th className="py-2 pr-4 font-medium">Sell</th>
                    <th className="py-2 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {PRICE_CATALOG.filter((item) => item.category === category).map((item) => (
                    <tr key={item.id} className="border-b border-border/70">
                      <td className="py-2 pr-4 font-medium">{item.name}</td>
                      <td className="py-2 pr-4">{item.unit}</td>
                      <td className="py-2 pr-4 tabular-nums">{formatCurrency(item.cost)}</td>
                      <td className="py-2 pr-4 tabular-nums">{item.sell != null ? formatCurrency(item.sell) : "—"}</td>
                      <td className="py-2 text-muted-foreground">{item.notes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
