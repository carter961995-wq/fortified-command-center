import { loadDemoOverlaySync, saveDemoOverlaySync } from "./demo-persist";

type DemoRow = Record<string, any>;
type DemoTable = keyof typeof demoDb;
type Filter = { column: string; op: string; value: any };
type Sort = { column: string; ascending: boolean };

const now = "2026-05-19T00:00:00.000Z";

const ids = {
  user: "00000000-0000-4000-8000-000000000001",
  profile: "00000000-0000-4000-8000-000000000002",
  customerA: "11111111-1111-4111-8111-111111111111",
  customerB: "22222222-2222-4222-8222-222222222222",
  customerC: "33333333-3333-4333-8333-333333333333",
  locationA: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  locationB: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
  locationC: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
  locationD: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
  subA: "44444444-4444-4444-8444-444444444441",
  subB: "44444444-4444-4444-8444-444444444442",
  subC: "44444444-4444-4444-8444-444444444443",
  woA: "55555555-5555-4555-8555-555555555551",
  woB: "55555555-5555-4555-8555-555555555552",
  woC: "55555555-5555-4555-8555-555555555553",
  woD: "55555555-5555-4555-8555-555555555554",
  quoteA: "66666666-6666-4666-8666-666666666661",
  quoteB: "66666666-6666-4666-8666-666666666662",
  invoiceA: "77777777-7777-4777-8777-777777777771",
  invoiceB: "77777777-7777-4777-8777-777777777772",
  invoiceC: "77777777-7777-4777-8777-777777777773",
  contractA: "88888888-8888-4888-8888-888888888881",
};

const demoDb = {
  users_profile: [
    {
      id: ids.profile,
      auth_user_id: ids.user,
      full_name: "Demo Admin",
      email: "demo@fortified.local",
      phone: null,
      role: "owner",
    },
  ],
  customers: [
    {
      id: ids.customerA,
      company_name: "Bayou Retail Group",
      customer_type: "retail",
      status: "active",
      contact_name: "Nora Laurent",
      contact_email: "nora@bayou-retail.example",
      contact_phone: "504-555-0110",
      billing_email: "ap@bayou-retail.example",
      billing_address: "410 Canal St\nNew Orleans, LA 70130",
      payment_terms: "Net 30",
      notes: "High-volume retail maintenance account.",
      created_at: "2026-01-04T14:00:00.000Z",
      updated_at: now,
    },
    {
      id: ids.customerB,
      company_name: "Gulf Coast Warehousing",
      customer_type: "commercial",
      status: "active",
      contact_name: "Marcus Bell",
      contact_email: "mbell@gulf-warehouse.example",
      contact_phone: "225-555-0184",
      billing_email: "billing@gulf-warehouse.example",
      billing_address: "1880 River Rd\nBaton Rouge, LA 70802",
      payment_terms: "Net 15",
      notes: "Requires PO before invoicing.",
      created_at: "2026-02-12T15:30:00.000Z",
      updated_at: now,
    },
    {
      id: ids.customerC,
      company_name: "Delta Property Management",
      customer_type: "property_manager",
      status: "prospect",
      contact_name: "Avery Morgan",
      contact_email: "avery@delta-pm.example",
      contact_phone: "337-555-0142",
      billing_email: "ap@delta-pm.example",
      billing_address: "220 Center St\nLafayette, LA 70501",
      payment_terms: "Due on receipt",
      notes: "Quoted several bollard and gate repairs.",
      created_at: "2026-03-10T16:15:00.000Z",
      updated_at: now,
    },
  ],
  locations: [
    {
      id: ids.locationA,
      customer_id: ids.customerA,
      location_name: "Canal Street Store",
      name: "Canal Street Store",
      store_number: "104",
      address_line_1: "410 Canal St",
      address_line_2: null,
      city: "New Orleans",
      state: "LA",
      zip: "70130",
      gate_code: "1842",
      site_contact_name: "Tina Flores",
      site_contact_phone: "504-555-0138",
      site_contact_email: "canal-store@bayou-retail.example",
      access_instructions: "Use rear alley after 8 AM. Check in with store manager.",
      notes: "Busy pedestrian frontage.",
      created_at: "2026-01-05T12:00:00.000Z",
      updated_at: now,
    },
    {
      id: ids.locationB,
      customer_id: ids.customerA,
      location_name: "Kenner Shopping Center",
      name: "Kenner Shopping Center",
      store_number: "219",
      address_line_1: "2800 Veterans Blvd",
      address_line_2: null,
      city: "Kenner",
      state: "LA",
      zip: "70062",
      gate_code: null,
      site_contact_name: "Drew Patel",
      site_contact_phone: "504-555-0150",
      site_contact_email: "kenner@bayou-retail.example",
      access_instructions: "Coordinate lift access with property security.",
      notes: null,
      created_at: "2026-01-06T12:00:00.000Z",
      updated_at: now,
    },
    {
      id: ids.locationC,
      customer_id: ids.customerB,
      location_name: "Port Allen Yard",
      name: "Port Allen Yard",
      store_number: null,
      address_line_1: "910 Industrial Pkwy",
      address_line_2: null,
      city: "Port Allen",
      state: "LA",
      zip: "70767",
      gate_code: "7391",
      site_contact_name: "Joel Harris",
      site_contact_phone: "225-555-0199",
      site_contact_email: "yard@gulf-warehouse.example",
      access_instructions: "PPE required beyond guard shack.",
      notes: "Heavy truck traffic.",
      created_at: "2026-02-13T12:00:00.000Z",
      updated_at: now,
    },
    {
      id: ids.locationD,
      customer_id: ids.customerC,
      location_name: "Lafayette Office Park",
      name: "Lafayette Office Park",
      store_number: null,
      address_line_1: "220 Center St",
      address_line_2: "Suite 400",
      city: "Lafayette",
      state: "LA",
      zip: "70501",
      gate_code: null,
      site_contact_name: "Avery Morgan",
      site_contact_phone: "337-555-0142",
      site_contact_email: "avery@delta-pm.example",
      access_instructions: "Call on arrival.",
      notes: null,
      created_at: "2026-03-11T12:00:00.000Z",
      updated_at: now,
    },
  ],
  subcontractors: [
    {
      id: ids.subA,
      company_name: "Pelican Gate Services",
      owner_name: "Sam Guidry",
      phone: "504-555-0201",
      email: "dispatch@pelicangate.example",
      address: "31 Service Rd",
      city: "Metairie",
      state: "LA",
      zip: "70001",
      service_states: ["LA", "MS"],
      trades: ["gate", "access_control", "fence"],
      status: "active",
      preferred_vendor: true,
      w9_received: true,
      subcontractor_agreement_signed: true,
      coi_received: true,
      insurance_expiration: "2027-01-01",
      standard_labor_rate: 95,
      emergency_labor_rate: 145,
      trip_charge: 85,
      jobs_completed: 42,
      callback_count: 2,
      quality_score: 4.8,
      response_score: 4.6,
      notes: "Strong gate operator troubleshooting.",
      created_at: "2026-01-10T12:00:00.000Z",
      updated_at: now,
    },
    {
      id: ids.subB,
      company_name: "Iron Parish Welding",
      owner_name: "Luis Romero",
      phone: "225-555-0215",
      email: "luis@ironparish.example",
      address: "75 Fabrication Ln",
      city: "Baton Rouge",
      state: "LA",
      zip: "70805",
      service_states: ["LA"],
      trades: ["welding", "bollards", "steel"],
      status: "active",
      preferred_vendor: true,
      w9_received: true,
      subcontractor_agreement_signed: true,
      coi_received: true,
      insurance_expiration: "2026-11-15",
      standard_labor_rate: 110,
      emergency_labor_rate: 165,
      trip_charge: 100,
      jobs_completed: 28,
      callback_count: 1,
      quality_score: 4.9,
      response_score: 4.4,
      notes: "Good fit for bollards and welded repairs.",
      created_at: "2026-01-15T12:00:00.000Z",
      updated_at: now,
    },
    {
      id: ids.subC,
      company_name: "Acadiana Fence Crew",
      owner_name: "Maya Chen",
      phone: "337-555-0180",
      email: "maya@acadianafence.example",
      address: "18 Mill Rd",
      city: "Lafayette",
      state: "LA",
      zip: "70506",
      service_states: ["LA", "TX"],
      trades: ["fence", "chain_link", "security_grille"],
      status: "probation",
      preferred_vendor: false,
      w9_received: true,
      subcontractor_agreement_signed: false,
      coi_received: true,
      insurance_expiration: "2026-08-30",
      standard_labor_rate: 88,
      emergency_labor_rate: 130,
      trip_charge: 75,
      jobs_completed: 9,
      callback_count: 3,
      quality_score: 3.9,
      response_score: 4.1,
      notes: "Watch callback rate before increasing volume.",
      created_at: "2026-02-01T12:00:00.000Z",
      updated_at: now,
    },
  ],
  work_orders: [
    {
      id: ids.woA,
      work_order_number: "WO-2026-0001",
      customer_id: ids.customerA,
      location_id: ids.locationA,
      subcontractor_id: ids.subA,
      title: "Repair sliding gate operator",
      scope_summary: "Diagnose intermittent gate fault, replace safety edge, and test access keypad.",
      trade_type: "gate",
      priority: "Urgent",
      status: "In Progress",
      source: "Email",
      customer_work_order_number: "BRG-44102",
      customer_wo_number: "BRG-44102",
      purchase_order_number: "PO-10083",
      nte_amount: 3500,
      not_to_exceed_amount: 3500,
      requested_date: "2026-05-13",
      due_date: "2026-05-22",
      scheduled_date: "2026-05-20",
      completed_date: null,
      customer_notes: "Gate stuck open after evening deliveries.",
      internal_notes: "Check loop detector before ordering board.",
      invoice_sent_at: null,
      paid_at: null,
      created_at: "2026-05-13T14:00:00.000Z",
      updated_at: now,
    },
    {
      id: ids.woB,
      work_order_number: "WO-2026-0002",
      customer_id: ids.customerB,
      location_id: ids.locationC,
      subcontractor_id: ids.subB,
      title: "Install six warehouse bollards",
      scope_summary: "Core drill and set six 6-inch steel bollards at loading dock lanes.",
      trade_type: "bollards",
      priority: "Normal",
      status: "Ready to Invoice",
      source: "Phone",
      customer_work_order_number: "GCW-7781",
      customer_wo_number: "GCW-7781",
      purchase_order_number: "PO-55318",
      nte_amount: 7800,
      not_to_exceed_amount: 7800,
      requested_date: "2026-05-01",
      due_date: "2026-05-17",
      scheduled_date: "2026-05-15",
      completed_date: "2026-05-16",
      customer_notes: null,
      internal_notes: "Photos received from Luis.",
      invoice_sent_at: null,
      paid_at: null,
      created_at: "2026-05-01T11:00:00.000Z",
      updated_at: now,
    },
    {
      id: ids.woC,
      work_order_number: "WO-2026-0003",
      customer_id: ids.customerA,
      location_id: ids.locationB,
      subcontractor_id: null,
      title: "Quote damaged dumpster enclosure fence",
      scope_summary: "Measure damaged chain link enclosure and prepare repair quote.",
      trade_type: "fence",
      priority: "Normal",
      status: "Quote Needed",
      source: "Portal",
      customer_work_order_number: "BRG-44177",
      customer_wo_number: "BRG-44177",
      purchase_order_number: null,
      nte_amount: 0,
      not_to_exceed_amount: 0,
      requested_date: "2026-05-18",
      due_date: "2026-05-25",
      scheduled_date: null,
      completed_date: null,
      customer_notes: "Photos show truck impact on west panel.",
      internal_notes: "Needs site measurement.",
      invoice_sent_at: null,
      paid_at: null,
      created_at: "2026-05-18T09:00:00.000Z",
      updated_at: now,
    },
    {
      id: ids.woD,
      work_order_number: "WO-2026-0004",
      customer_id: ids.customerC,
      location_id: ids.locationD,
      subcontractor_id: ids.subC,
      title: "Security grille callback",
      scope_summary: "Return visit to adjust roll-up grille track alignment.",
      trade_type: "security_grille",
      priority: "Urgent",
      status: "Callback/Warranty",
      source: "Phone",
      customer_work_order_number: null,
      customer_wo_number: null,
      purchase_order_number: null,
      nte_amount: 1200,
      not_to_exceed_amount: 1200,
      requested_date: "2026-05-16",
      due_date: "2026-05-21",
      scheduled_date: "2026-05-21",
      completed_date: null,
      customer_notes: "Tenant cannot lock grille.",
      internal_notes: "Warranty review required.",
      invoice_sent_at: null,
      paid_at: null,
      created_at: "2026-05-16T10:30:00.000Z",
      updated_at: now,
    },
  ],
  job_costs: [
    {
      id: "99999999-9999-4999-8999-999999999991",
      work_order_id: ids.woA,
      subcontractor_id: ids.subA,
      cost_type: "subcontractor",
      description: "Gate troubleshooting and parts",
      amount: 740,
      paid: false,
      created_at: "2026-05-18T15:00:00.000Z",
    },
    {
      id: "99999999-9999-4999-8999-999999999992",
      work_order_id: ids.woB,
      subcontractor_id: ids.subB,
      cost_type: "subcontractor",
      description: "Bollard labor and equipment",
      amount: 3150,
      paid: true,
      created_at: "2026-05-16T15:00:00.000Z",
    },
    {
      id: "99999999-9999-4999-8999-999999999993",
      work_order_id: ids.woB,
      subcontractor_id: null,
      cost_type: "materials",
      description: "Steel bollards and concrete",
      amount: 1280,
      paid: true,
      created_at: "2026-05-15T15:00:00.000Z",
    },
  ],
  quotes: [
    {
      id: ids.quoteA,
      quote_number: "Q-2026-0001",
      work_order_id: ids.woC,
      customer_id: ids.customerA,
      location_id: ids.locationB,
      status: "draft",
      subtotal: 2450,
      tax_amount: 0,
      total_amount: 2450,
      internal_notes: "Draft repair quote for dumpster enclosure.",
      created_at: "2026-05-18T16:00:00.000Z",
      updated_at: now,
    },
    {
      id: ids.quoteB,
      quote_number: "Q-2026-0002",
      work_order_id: ids.woD,
      customer_id: ids.customerC,
      location_id: ids.locationD,
      status: "sent",
      subtotal: 980,
      tax_amount: 0,
      total_amount: 980,
      internal_notes: "Potential billable work pending warranty decision.",
      created_at: "2026-05-17T16:00:00.000Z",
      updated_at: now,
    },
  ],
  quote_line_items: [
    {
      id: "abababab-abab-4aba-8bab-ababababab01",
      quote_id: ids.quoteA,
      description: "Replace damaged chain link panels",
      quantity: 1,
      unit_price: 1850,
      total: 1850,
    },
    {
      id: "abababab-abab-4aba-8bab-ababababab02",
      quote_id: ids.quoteA,
      description: "Haul-off and site cleanup",
      quantity: 1,
      unit_price: 600,
      total: 600,
    },
    {
      id: "abababab-abab-4aba-8bab-ababababab03",
      quote_id: ids.quoteB,
      description: "Grille track repair allowance",
      quantity: 1,
      unit_price: 980,
      total: 980,
    },
  ],
  invoices: [
    {
      id: ids.invoiceA,
      invoice_number: "INV-2026-0001",
      work_order_id: ids.woB,
      customer_id: ids.customerB,
      location_id: ids.locationC,
      status: "sent",
      invoice_date: "2026-05-17",
      due_date: "2026-06-01",
      payment_terms: "Net 15",
      notes: "Bollard installation complete.",
      subtotal: 7200,
      tax_amount: 0,
      total_amount: 7200,
      amount_paid: 0,
      balance_due: 7200,
      pdf_url: null,
      created_at: "2026-05-17T18:00:00.000Z",
      updated_at: now,
    },
    {
      id: ids.invoiceB,
      invoice_number: "INV-2026-0002",
      work_order_id: ids.woA,
      customer_id: ids.customerA,
      location_id: ids.locationA,
      status: "partially_paid",
      invoice_date: "2026-05-10",
      due_date: "2026-05-25",
      payment_terms: "Net 15",
      notes: "Initial gate repair deposit.",
      subtotal: 1800,
      tax_amount: 0,
      total_amount: 1800,
      amount_paid: 900,
      balance_due: 900,
      pdf_url: null,
      created_at: "2026-05-10T18:00:00.000Z",
      updated_at: now,
    },
    {
      id: ids.invoiceC,
      invoice_number: "INV-2026-0003",
      work_order_id: null,
      customer_id: ids.customerA,
      location_id: ids.locationB,
      status: "paid",
      invoice_date: "2026-04-22",
      due_date: "2026-05-07",
      payment_terms: "Net 15",
      notes: "Monthly maintenance visit.",
      subtotal: 650,
      tax_amount: 0,
      total_amount: 650,
      amount_paid: 650,
      balance_due: 0,
      pdf_url: null,
      created_at: "2026-04-22T18:00:00.000Z",
      updated_at: now,
    },
  ],
  invoice_line_items: [
    {
      id: "cdcdcdcd-cdcd-4cdc-8dcd-cdcdcdcdcd01",
      invoice_id: ids.invoiceA,
      description: "Install six steel bollards",
      quantity: 6,
      unit_price: 1200,
      total: 7200,
    },
    {
      id: "cdcdcdcd-cdcd-4cdc-8dcd-cdcdcdcdcd02",
      invoice_id: ids.invoiceB,
      description: "Gate operator repair deposit",
      quantity: 1,
      unit_price: 1800,
      total: 1800,
    },
    {
      id: "cdcdcdcd-cdcd-4cdc-8dcd-cdcdcdcdcd03",
      invoice_id: ids.invoiceC,
      description: "Quarterly gate inspection",
      quantity: 1,
      unit_price: 650,
      total: 650,
    },
  ],
  payments: [
    {
      id: "dededede-dede-4ded-8ded-dedededed001",
      invoice_id: ids.invoiceB,
      customer_id: ids.customerA,
      amount: 900,
      payment_date: "2026-05-12",
      payment_method: "ach",
      reference_number: "ACH-4921",
      notes: null,
      created_at: "2026-05-12T18:00:00.000Z",
    },
    {
      id: "dededede-dede-4ded-8ded-dedededed002",
      invoice_id: ids.invoiceC,
      customer_id: ids.customerA,
      amount: 650,
      payment_date: "2026-05-02",
      payment_method: "check",
      reference_number: "10244",
      notes: null,
      created_at: "2026-05-02T18:00:00.000Z",
    },
  ],
  maintenance_contracts: [
    {
      id: ids.contractA,
      customer_id: ids.customerA,
      location_id: ids.locationB,
      contract_name: "Bayou Retail quarterly gate PM",
      title: "Bayou Retail quarterly gate PM",
      status: "active",
      plan_type: "quarterly",
      inspection_frequency: "quarterly",
      recurring_amount: 650,
      start_date: "2026-01-01",
      end_date: null,
      notes: "Inspect gates, hinges, latches, and access hardware.",
      created_at: "2026-01-01T12:00:00.000Z",
      updated_at: now,
    },
  ],
  maintenance_visits: [
    {
      id: "efefefef-efef-4efe-8fef-efefefefef01",
      maintenance_contract_id: ids.contractA,
      contract_id: ids.contractA,
      work_order_id: null,
      scheduled_date: "2026-07-01",
      visit_date: "2026-07-01",
      status: "scheduled",
      completed: false,
      notes: "Next quarterly inspection.",
      created_at: "2026-05-01T12:00:00.000Z",
    },
  ],
  work_order_photos: [],
  work_order_documents: [],
  work_order_financials: [],
};

const demoUser = {
  id: ids.user,
  email: "demo@fortified.local",
  app_metadata: {},
  user_metadata: { full_name: "Demo Admin" },
  aud: "authenticated",
  created_at: "2026-01-01T00:00:00.000Z",
};

export function createDemoClient() {
  applyDemoOverlay();
  return {
    auth: {
      async getUser() {
        return { data: { user: demoUser }, error: null };
      },
      async signInWithPassword() {
        return { data: { user: demoUser, session: null }, error: null };
      },
      async signOut() {
        return { error: null };
      },
    },
    from(table: string) {
      return new DemoQuery(normalizeTable(table));
    },
    storage: {
      from() {
        return {
          async upload() {
            return { data: null, error: null };
          },
          getPublicUrl(path: string) {
            return { data: { publicUrl: `/demo-files/${path}` } };
          },
        };
      },
    },
  };
}

class DemoQuery implements PromiseLike<any> {
  private action: "select" | "insert" | "update" | "delete" = "select";
  private filters: Filter[] = [];
  private sorts: Sort[] = [];
  private rowLimit: number | null = null;
  private resultMode: "many" | "single" | "maybeSingle" = "many";
  private selectOptions: { count?: "exact"; head?: boolean } = {};
  private mutationValue: any;
  private orExpression: string | null = null;

  constructor(private table: DemoTable) {}

  select(_columns = "*", options: { count?: "exact"; head?: boolean } = {}) {
    this.selectOptions = options;
    return this;
  }

  insert(value: any) {
    this.action = "insert";
    this.mutationValue = value;
    return this;
  }

  update(value: any) {
    this.action = "update";
    this.mutationValue = value;
    return this;
  }

  delete() {
    this.action = "delete";
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ column, op: "eq", value });
    return this;
  }

  gt(column: string, value: any) {
    this.filters.push({ column, op: "gt", value });
    return this;
  }

  gte(column: string, value: any) {
    this.filters.push({ column, op: "gte", value });
    return this;
  }

  lt(column: string, value: any) {
    this.filters.push({ column, op: "lt", value });
    return this;
  }

  lte(column: string, value: any) {
    this.filters.push({ column, op: "lte", value });
    return this;
  }

  in(column: string, value: any[]) {
    this.filters.push({ column, op: "in", value });
    return this;
  }

  not(column: string, operator: string, value: any) {
    this.filters.push({ column, op: `not.${operator}`, value });
    return this;
  }

  ilike(column: string, value: string) {
    this.filters.push({ column, op: "ilike", value });
    return this;
  }

  contains(column: string, value: any[]) {
    this.filters.push({ column, op: "contains", value });
    return this;
  }

  or(expression: string) {
    this.orExpression = expression;
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.sorts.push({ column, ascending: options.ascending ?? true });
    return this;
  }

  limit(value: number) {
    this.rowLimit = value;
    return this;
  }

  single() {
    this.resultMode = "single";
    return this;
  }

  maybeSingle() {
    this.resultMode = "maybeSingle";
    return this;
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute() {
    applyDemoOverlay();
    if (this.action === "insert") return this.executeInsert();
    if (this.action === "update") return this.executeUpdate();
    if (this.action === "delete") return this.executeDelete();
    return this.executeSelect();
  }

  private executeSelect() {
    let rows = this.filteredRows();
    const count = rows.length;

    for (const sort of [...this.sorts].reverse()) {
      rows = rows.sort((a, b) => compareValues(a[sort.column], b[sort.column], sort.ascending));
    }

    if (this.rowLimit !== null) rows = rows.slice(0, this.rowLimit);
    rows = rows.map((row) => attachRelations(this.table, row));

    if (this.selectOptions.head) {
      return { data: null, error: null, count };
    }

    if (this.resultMode === "single") {
      return { data: rows[0] ?? null, error: rows[0] ? null : { message: "No rows returned" }, count };
    }

    if (this.resultMode === "maybeSingle") {
      return { data: rows[0] ?? null, error: null, count };
    }

    return { data: rows, error: null, count: this.selectOptions.count ? count : null };
  }

  private executeInsert() {
    const input = Array.isArray(this.mutationValue) ? this.mutationValue : [this.mutationValue];
    const rows = input.map((value) => normalizeInsertedRow(this.table, value));
    const tableRows = physicalRows(this.table);
    tableRows.push(...rows);
    persistDemoTables();
    const data = rows.map((row) => attachRelations(this.table, row));
    if (this.resultMode === "single") return { data: data[0] ?? null, error: null, count: data.length };
    return { data, error: null, count: data.length };
  }

  private executeUpdate() {
    const rows = physicalRows(this.table);
    const matches = new Set(this.filteredRows().map((row) => row.id));
    for (const row of rows) {
      if (matches.has(row.id)) Object.assign(row, this.mutationValue, { updated_at: now });
    }
    persistDemoTables();
    return { data: null, error: null, count: matches.size };
  }

  private executeDelete() {
    const rows = physicalRows(this.table);
    const matches = new Set(this.filteredRows().map((row) => row.id));
    const keep = rows.filter((row) => !matches.has(row.id));
    rows.splice(0, rows.length, ...keep);
    persistDemoTables();
    return { data: null, error: null, count: matches.size };
  }

  private filteredRows() {
    return readRows(this.table).filter((row) => {
      return this.filters.every((filter) => matchesFilter(row, filter)) && matchesOr(row, this.orExpression);
    });
  }
}

function normalizeTable(table: string): DemoTable {
  if (table === "quote_items") return "quote_line_items";
  if (table === "invoice_items") return "invoice_line_items";
  return table as DemoTable;
}

function readRows(table: DemoTable): DemoRow[] {
  if (table === "work_order_financials") return workOrderFinancials();
  return physicalRows(table).map((row) => ({ ...row }));
}

function physicalRows(table: DemoTable): DemoRow[] {
  return (demoDb[table] ?? []) as DemoRow[];
}

function applyDemoOverlay() {
  const overlay = loadDemoOverlaySync();
  if (!overlay) return;
  for (const table of ["customers", "locations", "subcontractors", "work_orders"] as const) {
    const incoming = overlay[table];
    if (!Array.isArray(incoming)) continue;
    const current = physicalRows(table);
    for (const row of incoming) {
      if (!row || typeof row !== "object" || !row.id) continue;
      const index = current.findIndex((item) => item.id === row.id);
      if (index >= 0) current[index] = { ...current[index], ...row };
      else current.push({ ...row });
    }
  }
}

function persistDemoTables() {
  saveDemoOverlaySync({
    customers: physicalRows("customers").map((row) => ({ ...row })),
    locations: physicalRows("locations").map((row) => ({ ...row })),
    subcontractors: physicalRows("subcontractors").map((row) => ({ ...row })),
    work_orders: physicalRows("work_orders").map((row) => ({ ...row })),
  });
}

function normalizeInsertedRow(table: DemoTable, value: DemoRow) {
  const row: DemoRow = {
    id: value.id ?? crypto.randomUUID(),
    created_at: value.created_at ?? new Date().toISOString(),
    updated_at: value.updated_at ?? new Date().toISOString(),
    ...value,
  };

  if ((table === "invoice_line_items" || table === "quote_line_items") && row.total === undefined) {
    row.total = Number(row.quantity ?? 0) * Number(row.unit_price ?? 0);
  }

  if (table === "invoices") {
    row.amount_paid = row.amount_paid ?? 0;
    row.balance_due = row.balance_due ?? row.total_amount ?? 0;
  }

  return row;
}

function matchesFilter(row: DemoRow, filter: Filter) {
  if (filter.column.includes(".")) return true;

  const value = row[filter.column];
  switch (filter.op) {
    case "eq":
      return value === filter.value;
    case "gt":
      return value > filter.value;
    case "gte":
      return value >= filter.value;
    case "lt":
      return value < filter.value;
    case "lte":
      return value <= filter.value;
    case "in":
      return filter.value.includes(value);
    case "ilike":
      return includesLike(value, filter.value);
    case "contains":
      return Array.isArray(value) && filter.value.every((item: any) => value.includes(item));
    case "not.eq":
      return value !== filter.value;
    case "not.in":
      return !parseInList(filter.value).includes(value);
    case "not.is":
      return filter.value === null ? value !== null && value !== undefined : value !== filter.value;
    default:
      return true;
  }
}

function matchesOr(row: DemoRow, expression: string | null) {
  if (!expression) return true;
  return expression.split(",").some((part) => {
    const [column, op, ...rest] = part.split(".");
    if (op !== "ilike") return false;
    return includesLike(row[column], rest.join("."));
  });
}

function includesLike(value: any, pattern: string) {
  const needle = String(pattern).replaceAll("%", "").toLowerCase();
  return String(value ?? "").toLowerCase().includes(needle);
}

function parseInList(value: any) {
  if (Array.isArray(value)) return value;
  return String(value)
    .replace(/[()"]/g, "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function compareValues(a: any, b: any, ascending: boolean) {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  return (a > b ? 1 : -1) * (ascending ? 1 : -1);
}

function findById(table: DemoTable, id: string | null | undefined) {
  if (!id) return null;
  return (demoDb[table] as DemoRow[]).find((row) => row.id === id) ?? null;
}

function attachRelations(table: DemoTable, row: DemoRow) {
  const copy = { ...row };

  if (table === "work_orders") {
    const customer = findById("customers", row.customer_id);
    const location = findById("locations", row.location_id);
    const subcontractor = findById("subcontractors", row.subcontractor_id);
    copy.customers = customer;
    copy.customer = customer;
    copy.locations = location;
    copy.location = location;
    copy.subcontractors = subcontractor;
    copy.subcontractor = subcontractor;
    copy.job_costs = demoDb.job_costs.filter((cost) => cost.work_order_id === row.id);
    copy.quotes = demoDb.quotes.filter((quote) => quote.work_order_id === row.id);
    copy.invoices = demoDb.invoices.filter((invoice) => invoice.work_order_id === row.id);
  }

  if (table === "locations") {
    const customer = findById("customers", row.customer_id);
    copy.customers = customer;
    copy.customer = customer;
  }

  if (table === "job_costs") {
    copy.subcontractors = findById("subcontractors", row.subcontractor_id);
  }

  if (table === "quotes") {
    copy.customers = findById("customers", row.customer_id);
    copy.work_orders = findById("work_orders", row.work_order_id);
    copy.quote_line_items = demoDb.quote_line_items.filter((line) => line.quote_id === row.id);
    copy.quote_items = copy.quote_line_items;
  }

  if (table === "invoices") {
    copy.customers = findById("customers", row.customer_id);
    copy.locations = findById("locations", row.location_id);
    copy.work_orders = findById("work_orders", row.work_order_id);
    copy.invoice_line_items = demoDb.invoice_line_items.filter((line) => line.invoice_id === row.id);
    copy.invoice_items = copy.invoice_line_items;
    copy.payments = demoDb.payments.filter((payment) => payment.invoice_id === row.id);
  }

  if (table === "payments") {
    copy.invoices = findById("invoices", row.invoice_id);
  }

  if (table === "maintenance_contracts") {
    copy.customers = findById("customers", row.customer_id);
    copy.locations = findById("locations", row.location_id);
  }

  if (table === "maintenance_visits") {
    const contract = findById("maintenance_contracts", row.maintenance_contract_id ?? row.contract_id);
    copy.maintenance_contracts = contract;
    copy.contract = contract ? attachRelations("maintenance_contracts", contract) : null;
    copy.work_orders = findById("work_orders", row.work_order_id);
  }

  return copy;
}

function workOrderFinancials() {
  return demoDb.work_orders.map((wo) => {
    const invoiceTotal = demoDb.invoices
      .filter((invoice) => invoice.work_order_id === wo.id && invoice.status !== "void")
      .reduce((sum, invoice) => sum + Number(invoice.total_amount ?? 0), 0);
    const totalJobCosts = demoDb.job_costs
      .filter((cost) => cost.work_order_id === wo.id)
      .reduce((sum, cost) => sum + Number(cost.amount ?? 0), 0);
    const grossProfit = invoiceTotal - totalJobCosts;
    return {
      work_order_id: wo.id,
      invoice_total: invoiceTotal,
      total_job_costs: totalJobCosts,
      gross_profit: grossProfit,
      gross_margin_pct: invoiceTotal > 0 ? Math.round((grossProfit / invoiceTotal) * 10000) / 100 : 0,
    };
  });
}
