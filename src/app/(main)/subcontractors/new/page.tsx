import { createSubcontractor } from "@/actions/subcontractors";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/link-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "New subcontractor" };

export default function NewSubcontractorPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New subcontractor</h1>
          <p className="text-sm text-muted-foreground">Partner record with trades and compliance flags.</p>
        </div>
        <LinkButton href="/subcontractors" variant="outline">
          Back
        </LinkButton>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Company</CardTitle>
          <CardDescription>Contact, coverage, and commercial terms.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createSubcontractor} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="company_name">Company name *</Label>
              <Input id="company_name" name="company_name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner_name">Owner name</Label>
              <Input id="owner_name" name="owner_name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" name="address" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input id="state" name="state" maxLength={2} className="uppercase" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zip">ZIP</Label>
              <Input id="zip" name="zip" />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="service_states">Service states (comma separated)</Label>
              <Input id="service_states" name="service_states" placeholder="LA, AR, TX" />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="trades">Trades (comma separated)</Label>
              <Input id="trades" name="trades" placeholder="fence, gate, welding" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service_radius_miles">Service radius (mi)</Label>
              <Input id="service_radius_miles" name="service_radius_miles" type="number" step="1" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="insurance_expiration">Insurance expiration</Label>
              <Input id="insurance_expiration" name="insurance_expiration" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="standard_labor_rate">Standard labor rate</Label>
              <Input id="standard_labor_rate" name="standard_labor_rate" type="number" step="0.01" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emergency_labor_rate">Emergency labor rate</Label>
              <Input id="emergency_labor_rate" name="emergency_labor_rate" type="number" step="0.01" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trip_charge">Trip charge</Label>
              <Input id="trip_charge" name="trip_charge" type="number" step="0.01" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dedicated_region">Dedicated region</Label>
              <Input id="dedicated_region" name="dedicated_region" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quality_score">Quality score</Label>
              <Input id="quality_score" name="quality_score" type="number" step="0.1" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="response_score">Response score</Label>
              <Input id="response_score" name="response_score" type="number" step="0.1" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="callback_count">Callback count</Label>
              <Input id="callback_count" name="callback_count" type="number" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobs_completed">Jobs completed</Label>
              <Input id="jobs_completed" name="jobs_completed" type="number" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <select id="status" name="status" required className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm" defaultValue="active">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="probation">Probation</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
            <div className="sm:col-span-2 flex flex-wrap gap-6 pt-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="w9_received" className="size-4 rounded border" />
                W-9 received
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="subcontractor_agreement_signed" className="size-4 rounded border" />
                Agreement signed
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="coi_received" className="size-4 rounded border" />
                COI received
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="preferred_vendor" className="size-4 rounded border" />
                Preferred vendor
              </label>
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={3} />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit">Save</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
