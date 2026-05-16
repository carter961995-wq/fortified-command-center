"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createSubcontractor, updateSubcontractor } from "@/app/(dashboard)/subcontractors/actions";
import type { Subcontractor, TradeType } from "@/lib/types/database";
import { TRADE_TYPES, US_STATES, SUBCONTRACTOR_STATUSES } from "@/lib/constants";
import { toast } from "sonner";

interface SubcontractorFormProps {
  subcontractor?: Subcontractor;
}

export function SubcontractorForm({ subcontractor }: SubcontractorFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>(subcontractor?.status ?? "Pending");
  const [selectedTrades, setSelectedTrades] = useState<TradeType[]>(
    (subcontractor?.trades as TradeType[]) ?? []
  );
  const [selectedStates, setSelectedStates] = useState<string[]>(
    subcontractor?.service_states ?? []
  );
  const isEdit = !!subcontractor;

  function toggleTrade(trade: TradeType) {
    setSelectedTrades((prev) =>
      prev.includes(trade) ? prev.filter((t) => t !== trade) : [...prev, trade]
    );
  }

  function toggleState(state: string) {
    setSelectedStates((prev) =>
      prev.includes(state) ? prev.filter((s) => s !== state) : [...prev, state]
    );
  }

  async function handleSubmit(formData: FormData) {
    formData.set("trades", JSON.stringify(selectedTrades));
    formData.set("service_states", JSON.stringify(selectedStates));
    formData.set("status", status);
    setLoading(true);
    try {
      if (isEdit) {
        await updateSubcontractor(subcontractor.id, formData);
        toast.success("Subcontractor updated");
      } else {
        await createSubcontractor(formData);
        toast.success("Subcontractor created");
      }
      router.push("/subcontractors");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit}>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Company Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name *</Label>
              <Input id="company_name" name="company_name" defaultValue={subcontractor?.company_name} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner_name">Owner Name *</Label>
              <Input id="owner_name" name="owner_name" defaultValue={subcontractor?.owner_name} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone *</Label>
                <Input id="phone" name="phone" defaultValue={subcontractor?.phone} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" defaultValue={subcontractor?.email ?? ""} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUBCONTRACTOR_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Compliance & Rates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="insurance_expiration">Insurance Expiration</Label>
              <Input id="insurance_expiration" name="insurance_expiration" type="date" defaultValue={subcontractor?.insurance_expiration ?? ""} />
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Switch id="w9_received" name="w9_received" value="true" defaultChecked={subcontractor?.w9_received} />
                <Label htmlFor="w9_received">W-9</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="coi_received" name="coi_received" value="true" defaultChecked={subcontractor?.coi_received} />
                <Label htmlFor="coi_received">COI</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="agreement_signed" name="agreement_signed" value="true" defaultChecked={subcontractor?.agreement_signed} />
                <Label htmlFor="agreement_signed">Agreement</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="is_preferred" name="is_preferred" value="true" defaultChecked={subcontractor?.is_preferred} />
                <Label htmlFor="is_preferred">Preferred</Label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="labor_rate_per_hour">Labor Rate ($/hr)</Label>
                <Input id="labor_rate_per_hour" name="labor_rate_per_hour" type="number" step="0.01" defaultValue={subcontractor?.labor_rate_per_hour ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trip_charge">Trip Charge ($)</Label>
                <Input id="trip_charge" name="trip_charge" type="number" step="0.01" defaultValue={subcontractor?.trip_charge ?? ""} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="service_radius_miles">Service Radius (mi)</Label>
                <Input id="service_radius_miles" name="service_radius_miles" type="number" defaultValue={subcontractor?.service_radius_miles ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dedicated_region">Dedicated Region</Label>
                <Input id="dedicated_region" name="dedicated_region" defaultValue={subcontractor?.dedicated_region ?? ""} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trades</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {TRADE_TYPES.map((trade) => (
                <div key={trade} className="flex items-center gap-2">
                  <Checkbox
                    id={`trade-${trade}`}
                    checked={selectedTrades.includes(trade)}
                    onCheckedChange={() => toggleTrade(trade)}
                  />
                  <Label htmlFor={`trade-${trade}`} className="text-sm">{trade}</Label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Service States</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-1">
              {US_STATES.map((st) => (
                <div key={st} className="flex items-center gap-1">
                  <Checkbox
                    id={`state-${st}`}
                    checked={selectedStates.includes(st)}
                    onCheckedChange={() => toggleState(st)}
                  />
                  <Label htmlFor={`state-${st}`} className="text-xs">{st}</Label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea name="notes" rows={4} defaultValue={subcontractor?.notes ?? ""} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving…" : isEdit ? "Update Subcontractor" : "Create Subcontractor"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
