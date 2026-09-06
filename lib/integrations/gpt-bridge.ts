import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateMilesBetween, resolveCoordinates } from "../../src/lib/subcontractors/geo";
import { nextWorkOrderNumber } from "../../src/lib/document-numbers";
import type { PlainRow } from "../business";
import {
  asDate,
  asMoney,
  cleanList,
  cleanText,
  matchKey,
  namesMatch,
  normalizeCustomerStatus,
  normalizeCustomerType,
  normalizePriority,
  normalizeSource,
  normalizeState,
  normalizeSubStatus,
  normalizeWorkOrderStatus,
} from "./gpt-normalize";

export type KnowledgeEntry = {
  id: string;
  title: string;
  category: string;
  content: string;
  updatedAt: string;
};

export type BusinessProfile = {
  companyName?: string;
  phone?: string;
  email?: string;
  website?: string;
  operatingStates?: string[];
  notes?: string;
  pricingRules?: string;
  dispatchRules?: string;
};

export type GptLinkMap = {
  customers: Record<string, string>;
  locations: Record<string, string>;
  subcontractors: Record<string, string>;
  workOrders: Record<string, string>;
};

export type GptStore = {
  apiKey: string;
  createdAt: string;
  updatedAt: string;
  business: BusinessProfile;
  knowledge: KnowledgeEntry[];
  links: GptLinkMap;
  importLog: Array<{ at: string; summary: string; counts: Record<string, number> }>;
};

function integrationDir() {
  return (
    process.env.FORTIFIED_USER_DATA_DIR ||
    process.env.FORTIFIED_INTEGRATION_DIR ||
    path.join(process.cwd(), ".fortified-data")
  );
}

function storePath() {
  return path.join(integrationDir(), "gpt-bridge.json");
}

function emptyStore(): GptStore {
  const now = new Date().toISOString();
  return {
    apiKey: "",
    createdAt: now,
    updatedAt: now,
    business: {},
    knowledge: [],
    links: { customers: {}, locations: {}, subcontractors: {}, workOrders: {} },
    importLog: [],
  };
}

export async function loadGptStore(): Promise<GptStore> {
  try {
    const raw = await readFile(storePath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<GptStore>;
    const base = emptyStore();
    return {
      ...base,
      ...parsed,
      business: { ...base.business, ...(parsed.business ?? {}) },
      knowledge: Array.isArray(parsed.knowledge) ? parsed.knowledge : [],
      links: {
        customers: parsed.links?.customers ?? {},
        locations: parsed.links?.locations ?? {},
        subcontractors: parsed.links?.subcontractors ?? {},
        workOrders: parsed.links?.workOrders ?? {},
      },
      importLog: Array.isArray(parsed.importLog) ? parsed.importLog.slice(0, 40) : [],
      apiKey: parsed.apiKey ?? "",
    };
  } catch {
    return emptyStore();
  }
}

export async function saveGptStore(store: GptStore) {
  await mkdir(integrationDir(), { recursive: true });
  const next = { ...store, updatedAt: new Date().toISOString() };
  await writeFile(storePath(), JSON.stringify(next, null, 2), { mode: 0o600 });
  return next;
}

export function configuredGptApiKey(store: GptStore) {
  return cleanText(process.env.FORTIFIED_GPT_API_KEY) || store.apiKey;
}

export async function ensureGptApiKey() {
  const store = await loadGptStore();
  const envKey = cleanText(process.env.FORTIFIED_GPT_API_KEY);
  if (envKey) return { store, apiKey: envKey, source: "env" as const, created: false };
  if (store.apiKey) return { store, apiKey: store.apiKey, source: "file" as const, created: false };
  const apiKey = `fft_${randomBytes(24).toString("hex")}`;
  const next = await saveGptStore({ ...store, apiKey });
  return { store: next, apiKey, source: "file" as const, created: true };
}

export async function rotateGptApiKey() {
  const store = await loadGptStore();
  const apiKey = `fft_${randomBytes(24).toString("hex")}`;
  const next = await saveGptStore({ ...store, apiKey });
  return { store: next, apiKey, envOverrides: Boolean(cleanText(process.env.FORTIFIED_GPT_API_KEY)) };
}

export function gptKeyMatches(request: Request, store: GptStore) {
  const expected = configuredGptApiKey(store);
  if (!expected) return false;
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const headerKey =
    request.headers.get("x-fortified-key") ??
    request.headers.get("x-api-key") ??
    bearer;
  return Boolean(headerKey) && headerKey === expected;
}

function rememberLink(store: GptStore, kind: keyof GptLinkMap, externalId: string | undefined, id: string) {
  if (!externalId) return;
  store.links[kind][externalId] = id;
}

function linkedId(store: GptStore, kind: keyof GptLinkMap, externalId?: string) {
  if (!externalId) return null;
  return store.links[kind][externalId] ?? null;
}

async function allRows(supabase: SupabaseClient, table: string) {
  const { data, error } = await supabase.from(table).select("*").limit(1000);
  if (error) throw new Error(error.message);
  return (data ?? []) as PlainRow[];
}

function findByName(rows: PlainRow[], field: string, name: string) {
  return rows.find((row) => namesMatch(row[field], name)) ?? null;
}

export async function importGptPayload(supabase: SupabaseClient, payload: Record<string, unknown>) {
  const store = await loadGptStore();
  const counts = {
    customers: 0,
    locations: 0,
    subcontractors: 0,
    workOrders: 0,
    knowledge: 0,
  };

  if (payload.business && typeof payload.business === "object") {
    const business = payload.business as Record<string, unknown>;
    store.business = {
      ...store.business,
      companyName: cleanText(business.companyName ?? business.name, store.business.companyName ?? ""),
      phone: cleanText(business.phone, store.business.phone ?? ""),
      email: cleanText(business.email, store.business.email ?? ""),
      website: cleanText(business.website, store.business.website ?? ""),
      operatingStates: cleanList(business.operatingStates ?? business.states).length
        ? cleanList(business.operatingStates ?? business.states).map(normalizeState)
        : store.business.operatingStates,
      notes: cleanText(business.notes ?? business.about, store.business.notes ?? ""),
      pricingRules: cleanText(business.pricingRules ?? business.pricing, store.business.pricingRules ?? ""),
      dispatchRules: cleanText(business.dispatchRules ?? business.dispatch, store.business.dispatchRules ?? ""),
    };
  }

  const knowledgeItems = [
    ...((payload.knowledge as unknown[]) ?? []),
    ...((payload.playbooks as unknown[]) ?? []),
    ...((payload.facts as unknown[]) ?? []),
  ];
  for (const item of knowledgeItems) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const title = cleanText(entry.title ?? entry.name);
    const content = cleanText(entry.content ?? entry.body ?? entry.text);
    if (!title && !content) continue;
    const existing = store.knowledge.find((row) => namesMatch(row.title, title));
    if (existing) {
      existing.content = content || existing.content;
      existing.category = cleanText(entry.category ?? entry.type, existing.category);
      existing.updatedAt = new Date().toISOString();
    } else {
      store.knowledge.unshift({
        id: cleanText(entry.id) || randomUUID(),
        title: title || "Untitled note",
        category: cleanText(entry.category ?? entry.type, "general"),
        content,
        updatedAt: new Date().toISOString(),
      });
    }
    counts.knowledge += 1;
  }

  const customers = await allRows(supabase, "customers");
  const customerItems = asObjectList(payload.customers);
  for (const entry of customerItems) {
    const companyName = cleanText(entry.companyName ?? entry.name ?? entry.company_name);
    if (!companyName) continue;
    const externalId = cleanText(entry.externalId ?? entry.id);
    const existingId = linkedId(store, "customers", externalId) ?? findByName(customers, "company_name", companyName)?.id;
    const row = {
      company_name: companyName,
      contact_name: cleanText(entry.contactName ?? entry.contact_name) || null,
      contact_email: cleanText(entry.email ?? entry.contact_email) || null,
      contact_phone: cleanText(entry.phone ?? entry.contact_phone) || null,
      billing_email: cleanText(entry.billingEmail ?? entry.billing_email) || null,
      billing_address: cleanText(entry.billingAddress ?? entry.billing_address) || null,
      payment_terms: cleanText(entry.paymentTerms ?? entry.payment_terms, "Net 30"),
      notes: appendImportNote(cleanText(entry.notes), externalId),
      customer_type: normalizeCustomerType(entry.customerType ?? entry.type ?? entry.customer_type),
      status: normalizeCustomerStatus(entry.status),
    };
    if (existingId) {
      const { error } = await supabase.from("customers").update(row).eq("id", String(existingId));
      if (error) throw new Error(error.message);
      rememberLink(store, "customers", externalId, String(existingId));
    } else {
      const { data, error } = await supabase.from("customers").insert(row).select("id, company_name").single();
      if (error) throw new Error(error.message);
      customers.push(data as PlainRow);
      rememberLink(store, "customers", externalId, String((data as PlainRow).id));
    }
    counts.customers += 1;
  }

  const subcontractors = await allRows(supabase, "subcontractors");
  const subItems = asObjectList(payload.subcontractors, payload.subs);
  for (const item of subItems) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const companyName = cleanText(entry.companyName ?? entry.name ?? entry.company_name);
    if (!companyName) continue;
    const externalId = cleanText(entry.externalId ?? entry.id);
    const coords = resolveCoordinates({
      city: cleanText(entry.city),
      state: normalizeState(entry.state),
      lat: entry.lat as number | undefined,
      lng: entry.lng as number | undefined,
    });
    const existingId =
      linkedId(store, "subcontractors", externalId) ?? findByName(subcontractors, "company_name", companyName)?.id;
    const row = {
      company_name: companyName,
      owner_name: cleanText(entry.contactName ?? entry.owner_name ?? entry.contact) || null,
      phone: cleanText(entry.phone) || null,
      email: cleanText(entry.email) || null,
      address: cleanText(entry.address) || null,
      city: coords?.city || cleanText(entry.city) || null,
      state: coords?.state || normalizeState(entry.state) || null,
      zip: cleanText(entry.zip) || null,
      service_states: cleanList(entry.serviceStates ?? entry.service_states ?? entry.states).map(normalizeState),
      trades: cleanList(entry.trades ?? entry.skills),
      service_radius_miles: asMoney(entry.serviceRadiusMiles ?? entry.service_radius_miles ?? entry.radius) ?? 75,
      preferred_vendor: Boolean(entry.preferred ?? entry.preferred_vendor),
      notes: appendImportNote(cleanText(entry.notes), externalId),
      status: normalizeSubStatus(entry.status),
    };
    if (existingId) {
      const { error } = await supabase.from("subcontractors").update(row).eq("id", String(existingId));
      if (error) throw new Error(error.message);
      rememberLink(store, "subcontractors", externalId, String(existingId));
    } else {
      const { data, error } = await supabase.from("subcontractors").insert(row).select("id, company_name").single();
      if (error) throw new Error(error.message);
      subcontractors.push(data as PlainRow);
      rememberLink(store, "subcontractors", externalId, String((data as PlainRow).id));
    }
    counts.subcontractors += 1;
  }

  const locations = await allRows(supabase, "locations");
  const refreshedCustomers = await allRows(supabase, "customers");
  const locationItems = asObjectList(payload.locations, payload.sites);
  for (const item of locationItems) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const customerName = cleanText(entry.customerName ?? entry.customer_name ?? entry.account);
    const customerId =
      linkedId(store, "customers", cleanText(entry.customerExternalId ?? entry.customerId)) ??
      findByName(refreshedCustomers, "company_name", customerName)?.id;
    if (!customerId) continue;
    const locationName = cleanText(
      entry.locationName ?? entry.name ?? entry.storeNumber ?? entry.store_number,
      cleanText(entry.city, "Job site")
    );
    const externalId = cleanText(entry.externalId ?? entry.id);
    const existing =
      (externalId && linkedId(store, "locations", externalId)
        ? locations.find((row) => String(row.id) === linkedId(store, "locations", externalId))
        : null) ??
      locations.find(
        (row) =>
          String(row.customer_id) === String(customerId) &&
          (namesMatch(row.location_name, locationName) ||
            namesMatch(row.store_number, entry.storeNumber ?? entry.store_number))
      );
    const row = {
      customer_id: String(customerId),
      location_name: locationName,
      store_number: cleanText(entry.storeNumber ?? entry.store_number) || null,
      address_line_1: cleanText(entry.address ?? entry.address_line_1, locationName),
      address_line_2: cleanText(entry.addressLine2 ?? entry.address_line_2) || null,
      city: cleanText(entry.city, "Unknown"),
      state: normalizeState(entry.state) || "LA",
      zip: cleanText(entry.zip) || null,
      gate_code: cleanText(entry.gateCode ?? entry.gate_code) || null,
      access_instructions: cleanText(entry.accessInstructions ?? entry.access) || null,
      site_contact_name: cleanText(entry.siteContactName ?? entry.contactName) || null,
      site_contact_phone: cleanText(entry.siteContactPhone ?? entry.phone) || null,
      site_contact_email: cleanText(entry.siteContactEmail ?? entry.email) || null,
      notes: appendImportNote(cleanText(entry.notes), externalId),
    };
    if (existing) {
      const { error } = await supabase.from("locations").update(row).eq("id", String(existing.id));
      if (error) throw new Error(error.message);
      rememberLink(store, "locations", externalId, String(existing.id));
    } else {
      const { data, error } = await supabase.from("locations").insert(row).select("*").single();
      if (error) throw new Error(error.message);
      locations.push(data as PlainRow);
      rememberLink(store, "locations", externalId, String((data as PlainRow).id));
    }
    counts.locations += 1;
  }

  const workOrders = await allRows(supabase, "work_orders");
  const jobs = asObjectList(payload.workOrders, payload.projects, payload.jobs);
  for (const item of jobs) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const title = cleanText(entry.title ?? entry.name ?? entry.scope, "Imported job");
    const customerName = cleanText(entry.customerName ?? entry.customer_name ?? entry.account);
    const customerId =
      linkedId(store, "customers", cleanText(entry.customerExternalId ?? entry.customerId)) ??
      findByName(refreshedCustomers, "company_name", customerName)?.id;
    if (!customerId) continue;

    const customerLocations = locations.filter((row) => String(row.customer_id) === String(customerId));
    const locationId =
      linkedId(store, "locations", cleanText(entry.locationExternalId ?? entry.locationId)) ??
      customerLocations.find((row) =>
        namesMatch(row.location_name, entry.locationName ?? entry.location) ||
        namesMatch(row.store_number, entry.storeNumber ?? entry.store_number) ||
        namesMatch(row.city, entry.city)
      )?.id ??
      customerLocations[0]?.id;
    if (!locationId) continue;

    const subName = cleanText(entry.subcontractorName ?? entry.subcontractor ?? entry.assignedSub);
    const subcontractorId =
      linkedId(store, "subcontractors", cleanText(entry.subcontractorExternalId ?? entry.subcontractorId)) ??
      (subName ? findByName(subcontractors, "company_name", subName)?.id : null) ??
      null;

    const externalId = cleanText(entry.externalId ?? entry.id);
    const number = cleanText(entry.workOrderNumber ?? entry.work_order_number);
    const customerNumber = cleanText(entry.customerWorkOrderNumber ?? entry.customer_wo_number ?? entry.woNumber);
    const existing =
      (externalId && linkedId(store, "workOrders", externalId)
        ? workOrders.find((row) => String(row.id) === linkedId(store, "workOrders", externalId))
        : null) ??
      workOrders.find(
        (row) =>
          (number && namesMatch(row.work_order_number, number)) ||
          (customerNumber && namesMatch(row.customer_work_order_number, customerNumber))
      );

    const row = {
      customer_id: String(customerId),
      location_id: String(locationId),
      subcontractor_id: subcontractorId ? String(subcontractorId) : null,
      title,
      scope_summary: cleanText(entry.scope ?? entry.scope_summary ?? entry.description) || null,
      trade_type: cleanText(entry.tradeType ?? entry.trade_type ?? entry.trade, "fence"),
      priority: normalizePriority(entry.priority),
      status: normalizeWorkOrderStatus(entry.status),
      source: normalizeSource(entry.source ?? "other"),
      customer_work_order_number: customerNumber || null,
      purchase_order_number: cleanText(entry.purchaseOrderNumber ?? entry.poNumber) || null,
      not_to_exceed_amount: asMoney(entry.nte ?? entry.dne ?? entry.notToExceed),
      requested_date: asDate(entry.requestedDate ?? entry.requested_date),
      due_date: asDate(entry.dueDate ?? entry.due_date),
      scheduled_date: asDate(entry.scheduledDate ?? entry.scheduled_date),
      internal_notes: appendImportNote(cleanText(entry.internalNotes ?? entry.notes), externalId),
      customer_notes: cleanText(entry.customerNotes) || null,
    };

    if (existing) {
      const { error } = await supabase.from("work_orders").update(row).eq("id", String(existing.id));
      if (error) throw new Error(error.message);
      rememberLink(store, "workOrders", externalId, String(existing.id));
    } else {
      const work_order_number = number || (await nextWorkOrderNumber(supabase));
      const { data, error } = await supabase
        .from("work_orders")
        .insert({ ...row, work_order_number })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      workOrders.push({ ...(data as PlainRow), ...row, work_order_number });
      rememberLink(store, "workOrders", externalId, String((data as PlainRow).id));
    }
    counts.workOrders += 1;
  }

  store.importLog.unshift({
    at: new Date().toISOString(),
    summary: "GPT import applied to Command Center records.",
    counts,
  });
  store.importLog = store.importLog.slice(0, 25);
  await saveGptStore(store);
  return { counts, business: store.business, knowledgeCount: store.knowledge.length };
}

function asObjectList(...groups: unknown[]) {
  return groups.flatMap((group) => (Array.isArray(group) ? group : [])).filter((item) => item && typeof item === "object") as Record<string, unknown>[];
}

function appendImportNote(notes: string, externalId?: string) {
  const tag = externalId ? `Imported via Fortified GPT (${externalId}).` : "Imported via Fortified GPT.";
  if (!notes) return tag;
  if (notes.includes("Imported via Fortified GPT")) return notes;
  return `${notes}\n${tag}`;
}

export async function snapshotGpt(supabase: SupabaseClient) {
  const store = await loadGptStore();
  const [customers, locations, subcontractors, workOrders] = await Promise.all([
    allRows(supabase, "customers"),
    allRows(supabase, "locations"),
    allRows(supabase, "subcontractors"),
    allRows(supabase, "work_orders"),
  ]);
  return {
    business: store.business,
    knowledge: store.knowledge,
    customers: customers.map(publicCustomer),
    locations: locations.map(publicLocation),
    subcontractors: subcontractors.map(publicSub),
    workOrders: workOrders.map(publicWorkOrder),
    counts: {
      customers: customers.length,
      locations: locations.length,
      subcontractors: subcontractors.length,
      workOrders: workOrders.length,
      knowledge: store.knowledge.length,
    },
  };
}

function publicCustomer(row: PlainRow) {
  return {
    id: row.id,
    companyName: row.company_name,
    contactName: row.contact_name,
    email: row.contact_email ?? row.billing_email,
    phone: row.contact_phone,
    type: row.customer_type,
    status: row.status,
    notes: row.notes,
  };
}

function publicLocation(row: PlainRow) {
  return {
    id: row.id,
    customerId: row.customer_id,
    locationName: row.location_name,
    storeNumber: row.store_number,
    address: row.address_line_1,
    city: row.city,
    state: row.state,
    zip: row.zip,
  };
}

function publicSub(row: PlainRow) {
  return {
    id: row.id,
    companyName: row.company_name,
    contactName: row.owner_name,
    phone: row.phone,
    email: row.email,
    city: row.city,
    state: row.state,
    trades: row.trades,
    serviceStates: row.service_states,
    serviceRadiusMiles: row.service_radius_miles,
    status: row.status,
    preferred: row.preferred_vendor,
    notes: row.notes,
  };
}

function publicWorkOrder(row: PlainRow) {
  return {
    id: row.id,
    workOrderNumber: row.work_order_number,
    customerWorkOrderNumber: row.customer_work_order_number,
    title: row.title,
    status: row.status,
    priority: row.priority,
    tradeType: row.trade_type,
    customerId: row.customer_id,
    locationId: row.location_id,
    subcontractorId: row.subcontractor_id,
    scheduledDate: row.scheduled_date,
    dueDate: row.due_date,
    nte: row.not_to_exceed_amount ?? row.nte_amount,
    notes: row.internal_notes,
  };
}

export async function dispatchWorkOrder(supabase: SupabaseClient, input: Record<string, unknown>) {
  const store = await loadGptStore();
  const workOrders = await allRows(supabase, "work_orders");
  const subcontractors = await allRows(supabase, "subcontractors");
  const locations = await allRows(supabase, "locations");

  const requestedId = cleanText(input.workOrderId ?? input.id);
  const workOrder =
    workOrders.find((row) => String(row.id) === requestedId) ??
    workOrders.find((row) => namesMatch(row.work_order_number, input.workOrderNumber)) ??
    workOrders.find((row) => namesMatch(row.customer_work_order_number, input.customerWorkOrderNumber ?? input.woNumber)) ??
    workOrders.find((row) => namesMatch(row.title, input.title ?? input.name));
  if (!workOrder) throw new Error("Work order not found. Import it first or pass workOrderNumber.");

  let subcontractor =
    subcontractors.find((row) => String(row.id) === cleanText(input.subcontractorId)) ??
    subcontractors.find((row) => namesMatch(row.company_name, input.subcontractorName ?? input.subcontractor));

  if (!subcontractor) {
    const location = locations.find((row) => String(row.id) === String(workOrder.location_id));
    const city = cleanText(input.city, cleanText(location?.city));
    const state = normalizeState(input.state ?? location?.state);
    const trade = matchKey(input.trade ?? workOrder.trade_type);
    const target = resolveCoordinates({ city, state });
    const ranked = subcontractors
      .filter((row) => String(row.status ?? "active").toLowerCase() === "active")
      .map((row) => {
        const coords = resolveCoordinates({
          city: cleanText(row.city),
          state: cleanText(row.state),
        });
        const trades = cleanList(row.trades).map(matchKey);
        const miles = target && coords ? calculateMilesBetween(target, coords) : 9999;
        const radius = Number(row.service_radius_miles ?? 150);
        const tradeFit = !trade || trades.some((item) => item.includes(trade) || trade.includes(item));
        return { row, miles, radius, tradeFit };
      })
      .filter((item) => item.miles <= item.radius + 25)
      .sort((a, b) => Number(b.tradeFit) - Number(a.tradeFit) || a.miles - b.miles);
    subcontractor = ranked[0]?.row;
  }

  if (!subcontractor) throw new Error("No matching subcontractor found for this job.");

  const scheduledDate = asDate(input.scheduledDate) || asDate(workOrder.scheduled_date);
  const status = normalizeWorkOrderStatus(input.status ?? "Scheduled");
  const { error } = await supabase
    .from("work_orders")
    .update({
      subcontractor_id: String(subcontractor.id),
      status,
      scheduled_date: scheduledDate,
      internal_notes: [cleanText(workOrder.internal_notes), cleanText(input.notes), `Dispatched to ${subcontractor.company_name} via Fortified GPT.`]
        .filter(Boolean)
        .join("\n"),
    })
    .eq("id", String(workOrder.id));
  if (error) throw new Error(error.message);

  rememberLink(store, "workOrders", cleanText(input.externalId), String(workOrder.id));
  await saveGptStore(store);

  return {
    workOrder: {
      id: workOrder.id,
      title: workOrder.title,
      status,
      scheduledDate,
    },
    subcontractor: publicSub(subcontractor),
  };
}

export async function upsertKnowledge(entries: unknown[]) {
  const store = await loadGptStore();
  let saved = 0;
  for (const item of entries) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const title = cleanText(entry.title ?? entry.name);
    const content = cleanText(entry.content ?? entry.body ?? entry.text);
    if (!title && !content) continue;
    const existing = store.knowledge.find((row) => namesMatch(row.title, title) || row.id === cleanText(entry.id));
    if (existing) {
      existing.title = title || existing.title;
      existing.content = content || existing.content;
      existing.category = cleanText(entry.category, existing.category);
      existing.updatedAt = new Date().toISOString();
    } else {
      store.knowledge.unshift({
        id: cleanText(entry.id) || randomUUID(),
        title: title || "Untitled note",
        category: cleanText(entry.category, "general"),
        content,
        updatedAt: new Date().toISOString(),
      });
    }
    saved += 1;
  }
  await saveGptStore(store);
  return { saved, knowledge: store.knowledge };
}
