import Link from "next/link";
import { notFound } from "next/navigation";
import { addInvoiceLineItemAction, addJobCostAction, addMaintenanceVisitAction, addPaymentAction, addQuoteLineItemAction, advanceWorkOrderStatusAction, createRecordAction, createWorkOrderFromVisitAction, updateRecordAction } from "../lib/actions";
import { displayValue, formatDate, money, nextWorkOrderStatus, percent, type PlainRow } from "../lib/business";
import { fetchInvoiceRelated, fetchMaintenanceVisits, fetchModuleRecord, fetchModuleRows, fetchRelationOptions, fetchWorkOrderRelated, getSessionContext, moduleForSlug } from "../lib/data";
import type { ModuleDefinition, ModuleField } from "../lib/schema";
import { workOrderLifecycle } from "../lib/schema";
import { DataTable } from "./data-table";
import { Badge, ButtonLink, Card, EmptyState, ErrorNotice, KeyValue, PageHeader, SecondaryButton, SubmitButton } from "./ui";
import { WorkOrderFiles } from "./work-order-files";

function fieldValue(record: PlainRow | null | undefined, field: ModuleField) {
  const value = record?.[field.name];
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value;
  return value === null || value === undefined ? "" : String(value);
}

function FormField({ field, value, options }: { field: ModuleField; value?: unknown; options?: { value: string; label: string }[] }) {
  const inputName = field.name;
  const defaultValue = value === true || value === false ? undefined : String(value ?? "");
  if (field.type === "textarea" || field.type === "array") {
    return (
      <label className="md:col-span-2">
        {field.label}
        <textarea name={inputName} defaultValue={defaultValue} placeholder={field.placeholder} required={field.required} />
        {field.help ? <span className="text-xs font-medium text-stone-500">{field.help}</span> : null}
      </label>
    );
  }
  if (field.type === "select") {
    return (
      <label>
        {field.label}
        <select name={inputName} defaultValue={defaultValue || String(field.options?.[0] ?? "")} required={field.required}>
          {field.options?.map((option) => <option value={option} key={option}>{option}</option>)}
        </select>
      </label>
    );
  }
  if (field.type === "relation") {
    return (
      <label>
        {field.label}
        <select name={inputName} defaultValue={defaultValue} required={field.required}>
          <option value="">{field.required ? "Select..." : "None"}</option>
          {(options ?? []).map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
        </select>
      </label>
    );
  }
  if (field.type === "checkbox") {
    return (
      <label className="flex min-h-12 flex-row items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2">
        <input className="h-4 w-4" name={inputName} type="checkbox" defaultChecked={Boolean(value)} />
        <span>{field.label}</span>
      </label>
    );
  }
  const type = field.type === "money" || field.type === "number" ? "number" : field.type;
  return (
    <label>
      {field.label}
      <input name={inputName} type={type} step={field.type === "money" || field.type === "number" ? "0.01" : undefined} defaultValue={defaultValue} placeholder={field.placeholder} required={field.required} />
    </label>
  );
}

async function RecordForm({ def, record, id }: { def: ModuleDefinition; record?: PlainRow | null; id?: string }) {
  const relationOptions = await fetchRelationOptions(def.fields);
  const action = id ? updateRecordAction.bind(null, def.slug, id) : createRecordAction.bind(null, def.slug);
  return (
    <Card>
      <form action={action} className="grid gap-4 md:grid-cols-2">
        {def.fields.map((field) => <FormField field={field} key={field.name} value={fieldValue(record, field)} options={relationOptions[field.name]} />)}
        <div className="flex gap-3 md:col-span-2">
          <SubmitButton>{id ? `Save ${def.singular}` : `Create ${def.singular}`}</SubmitButton>
          <Link className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-black" href={`/${def.slug}`}>Cancel</Link>
        </div>
      </form>
    </Card>
  );
}

export async function ModuleListPage({ slug }: { slug: string }) {
  const def = moduleForSlug(slug);
  if (!def) notFound();
  const { data, error } = await fetchModuleRows(def);
  return (
    <div className="grid gap-6">
      <PageHeader title={def.label} description={def.description} action={<ButtonLink href={`/${def.slug}/new`}>New {def.singular}</ButtonLink>} />
      <ErrorNotice message={error} />
      {data.length ? <DataTable rows={data} columns={def.listColumns} basePath={`/${def.slug}`} primaryKey={def.primaryField} /> : <EmptyState title={`No ${def.label.toLowerCase()} yet`} description={`Create the first ${def.singular.toLowerCase()} to start tracking this part of the business.`} action={<ButtonLink href={`/${def.slug}/new`}>New {def.singular}</ButtonLink>} />}
    </div>
  );
}

export async function ModuleNewPage({ slug }: { slug: string }) {
  const def = moduleForSlug(slug);
  if (!def) notFound();
  return (
    <div className="grid gap-6">
      <PageHeader title={`New ${def.singular}`} description={def.description} />
      <RecordForm def={def} />
    </div>
  );
}

function DetailGrid({ def, record }: { def: ModuleDefinition; record: PlainRow }) {
  return (
    <Card>
      <h2 className="mb-4 text-lg font-black">Record details</h2>
      <dl className="grid gap-3 md:grid-cols-3">
        {def.fields.map((field) => {
          const value = field.type === "money" ? money(record[field.name]) : field.type === "date" ? formatDate(record[field.name]) : field.type === "checkbox" ? (record[field.name] ? "Yes" : "No") : displayValue(record, field.name);
          return <KeyValue key={field.name} label={field.label} value={value} />;
        })}
      </dl>
    </Card>
  );
}

function WorkOrderPipeline({ record }: { record: PlainRow }) {
  const next = nextWorkOrderStatus(record.status);
  const action = next ? advanceWorkOrderStatusAction.bind(null, String(record.id), next) : null;
  return (
    <Card>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-black">Status pipeline</h2>
          <p className="mt-1 text-sm text-stone-600">Required lifecycle timestamps are set automatically when statuses advance.</p>
        </div>
        {action ? <form action={action}><SecondaryButton>Advance to {next}</SecondaryButton></form> : null}
      </div>
      <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
        {workOrderLifecycle.map((status) => {
          const active = status === record.status;
          return <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-black ${active ? "border-amber-700 bg-amber-700 text-white" : "border-stone-200 bg-stone-50 text-stone-500"}`} key={status}>{status}</span>;
        })}
      </div>
    </Card>
  );
}

function MiniTable({ title, rows, columns }: { title: string; rows: PlainRow[]; columns: { key: string; label: string; type?: "money" | "date" | "status" }[] }) {
  return (
    <Card>
      <h2 className="mb-4 text-lg font-black">{title}</h2>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-stone-500"><tr>{columns.map((col) => <th className="border-b border-stone-200 px-3 py-2" key={col.key}>{col.label}</th>)}</tr></thead>
            <tbody>
              {rows.map((row) => <tr key={String(row.id)}>{columns.map((col) => <td className="border-b border-stone-100 px-3 py-2" key={col.key}>{col.type === "money" ? money(row[col.key]) : col.type === "date" ? formatDate(row[col.key]) : col.type === "status" ? <Badge>{displayValue(row, col.key)}</Badge> : displayValue(row, col.key)}</td>)}</tr>)}
            </tbody>
          </table>
        </div>
      ) : <p className="text-sm text-stone-500">No records yet.</p>}
    </Card>
  );
}

async function WorkOrderRelated({ record }: { record: PlainRow }) {
  const related = await fetchWorkOrderRelated(String(record.id));
  const subOptions = await fetchRelationOptions([{ name: "subcontractor_id", label: "Subcontractor", type: "relation", relation: { table: "subcontractors", value: "id", label: "company_name" } }]);
  return (
    <div className="grid gap-6">
      <Card>
        <h2 className="text-lg font-black">Profit snapshot</h2>
        <dl className="mt-4 grid gap-3 md:grid-cols-4">
          <KeyValue label="Invoice revenue" value={money(related.profit.revenue)} />
          <KeyValue label="Job costs" value={money(related.profit.totalCosts)} />
          <KeyValue label="Gross profit" value={money(related.profit.grossProfit)} />
          <KeyValue label="Gross margin" value={percent(related.profit.grossMargin)} />
        </dl>
      </Card>
      <div className="grid gap-6 xl:grid-cols-2">
        <MiniTable title="Quotes" rows={related.quotes} columns={[{ key: "quote_number", label: "Quote #" }, { key: "status", label: "Status", type: "status" }, { key: "total_amount", label: "Total", type: "money" }]} />
        <MiniTable title="Invoices" rows={related.invoices} columns={[{ key: "invoice_number", label: "Invoice #" }, { key: "status", label: "Status", type: "status" }, { key: "balance_due", label: "Balance", type: "money" }]} />
      </div>
      <Card>
        <h2 className="mb-4 text-lg font-black">Add job cost</h2>
        <form action={addJobCostAction.bind(null, String(record.id))} className="grid gap-3 md:grid-cols-4">
          <select name="cost_type"><option>subcontractor</option><option>materials</option><option>equipment</option><option>travel</option><option>permit</option><option>other</option></select>
          <select name="subcontractor_id"><option value="">No subcontractor</option>{(subOptions.subcontractor_id ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
          <input name="description" placeholder="Description" required />
          <input name="amount" placeholder="Amount" step="0.01" type="number" required />
          <input name="receipt_url" placeholder="Receipt URL" />
          <label className="flex flex-row items-center gap-2"><input className="h-4 w-4" name="paid" type="checkbox" /> Paid</label>
          <input name="paid_at" type="date" />
          <SubmitButton>Add cost</SubmitButton>
        </form>
      </Card>
      <MiniTable title="Job costs" rows={related.jobCosts} columns={[{ key: "cost_type", label: "Type" }, { key: "description", label: "Description" }, { key: "amount", label: "Amount", type: "money" }]} />
      <WorkOrderFiles workOrderId={String(record.id)} photos={related.photos} documents={related.documents} />
    </div>
  );
}

async function InvoiceRelated({ record }: { record: PlainRow }) {
  const related = await fetchInvoiceRelated(String(record.id));
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black">Invoice PDF</h2>
          <Link className="font-black text-amber-700" href={`/api/invoices/${String(record.id)}/pdf`} target="_blank">Open PDF</Link>
        </div>
        <p className="mt-2 text-sm text-stone-600">Server-generated branded PDF with Fortified header, invoice details, job location, line items, terms, and footer.</p>
      </Card>
      <Card>
        <h2 className="mb-4 text-lg font-black">Add invoice line item</h2>
        <form action={addInvoiceLineItemAction.bind(null, String(record.id))} className="grid gap-3">
          <input name="description" placeholder="Description" required />
          <div className="grid gap-3 md:grid-cols-3"><input name="quantity" placeholder="Qty" type="number" step="0.01" defaultValue="1" /><input name="unit_price" placeholder="Unit price" type="number" step="0.01" /><SubmitButton>Add item</SubmitButton></div>
        </form>
      </Card>
      <MiniTable title="Line items" rows={related.lineItems} columns={[{ key: "description", label: "Description" }, { key: "quantity", label: "Qty" }, { key: "unit_price", label: "Unit", type: "money" }, { key: "total", label: "Total", type: "money" }]} />
      <Card>
        <h2 className="mb-4 text-lg font-black">Record payment</h2>
        <form action={addPaymentAction.bind(null, String(record.id), String(record.customer_id))} className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-2"><input name="amount" placeholder="Amount" step="0.01" type="number" required /><input name="payment_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></div>
          <div className="grid gap-3 md:grid-cols-2"><select name="payment_method"><option>cash</option><option>check</option><option>ach</option><option>card</option><option>wire</option><option>other</option></select><input name="reference_number" placeholder="Reference #" /></div>
          <textarea name="notes" placeholder="Payment notes" />
          <SubmitButton>Record payment</SubmitButton>
        </form>
      </Card>
      <MiniTable title="Payments" rows={related.payments} columns={[{ key: "payment_date", label: "Date", type: "date" }, { key: "payment_method", label: "Method" }, { key: "amount", label: "Amount", type: "money" }, { key: "reference_number", label: "Reference" }]} />
    </div>
  );
}

async function QuoteRelated({ record }: { record: PlainRow }) {
  const { supabase } = await getSessionContext();
  const { data } = supabase ? await supabase.from("quote_line_items").select("*").eq("quote_id", String(record.id)).order("created_at", { ascending: true }) : { data: [] };
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <h2 className="mb-4 text-lg font-black">Add quote line item</h2>
        <form action={addQuoteLineItemAction.bind(null, String(record.id))} className="grid gap-3">
          <input name="description" placeholder="Description" required />
          <div className="grid gap-3 md:grid-cols-3"><input name="quantity" placeholder="Qty" type="number" step="0.01" defaultValue="1" /><input name="unit_price" placeholder="Unit price" type="number" step="0.01" /><SubmitButton>Add item</SubmitButton></div>
        </form>
      </Card>
      <MiniTable title="Quote line items" rows={(data ?? []) as PlainRow[]} columns={[{ key: "description", label: "Description" }, { key: "quantity", label: "Qty" }, { key: "unit_price", label: "Unit", type: "money" }, { key: "total", label: "Total", type: "money" }]} />
    </div>
  );
}

async function MaintenanceRelated({ record }: { record: PlainRow }) {
  const visits = await fetchMaintenanceVisits(String(record.id));
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <h2 className="mb-4 text-lg font-black">Schedule maintenance visit</h2>
        <form action={addMaintenanceVisitAction.bind(null, String(record.id))} className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-2"><input name="scheduled_date" type="date" required /><select name="status"><option>scheduled</option><option>completed</option><option>missed</option><option>cancelled</option></select></div>
          <input name="completed_date" type="date" />
          <textarea name="notes" placeholder="Visit notes" />
          <SubmitButton>Add visit</SubmitButton>
        </form>
      </Card>
      <Card>
        <h2 className="mb-4 text-lg font-black">Maintenance visits</h2>
        {visits.length ? <div className="grid gap-3">{visits.map((visit) => <div className="rounded-xl border border-stone-200 p-3" key={String(visit.id)}><div className="flex items-center justify-between gap-3"><Badge>{displayValue(visit, "status")}</Badge><span className="text-sm font-bold">{formatDate(visit.scheduled_date)}</span></div><p className="mt-2 text-sm text-stone-600">{displayValue(visit, "notes")}</p>{!visit.work_order_id ? <form action={createWorkOrderFromVisitAction.bind(null, String(visit.id), String(record.id))} className="mt-3"><SecondaryButton>Create linked work order</SecondaryButton></form> : <Link className="mt-3 inline-block text-sm font-black text-amber-700" href={`/work-orders/${String(visit.work_order_id)}`}>Open linked work order</Link>}</div>)}</div> : <p className="text-sm text-stone-500">No visits scheduled.</p>}
      </Card>
    </div>
  );
}

export async function ModuleDetailPage({ slug, id }: { slug: string; id: string }) {
  const def = moduleForSlug(slug);
  if (!def) notFound();
  const { data: record, error } = await fetchModuleRecord(def, id);
  if (!record && !error) notFound();
  return (
    <div className="grid gap-6">
      <PageHeader title={record ? displayValue(record, def.primaryField) : def.singular} description={def.description} action={<ButtonLink href={`/${def.slug}/new`}>New {def.singular}</ButtonLink>} />
      <ErrorNotice message={error} />
      {record ? (
        <>
          {def.slug === "work-orders" ? <WorkOrderPipeline record={record} /> : null}
          <DetailGrid def={def} record={record} />
          <div>
            <h2 className="mb-4 text-xl font-black">Edit {def.singular}</h2>
            <RecordForm def={def} record={record} id={id} />
          </div>
          {def.slug === "work-orders" ? <WorkOrderRelated record={record} /> : null}
          {def.slug === "invoices" ? <InvoiceRelated record={record} /> : null}
          {def.slug === "quotes" ? <QuoteRelated record={record} /> : null}
          {def.slug === "maintenance-contracts" ? <MaintenanceRelated record={record} /> : null}
        </>
      ) : null}
    </div>
  );
}
