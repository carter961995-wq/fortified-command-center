import React from "react";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#1a1f2e",
    lineHeight: 1.35,
  },
  topBar: {
    backgroundColor: "#0f172a",
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 18,
  },
  brandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  brandName: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: 0.4,
  },
  brandSub: {
    color: "#cbd5f5",
    fontSize: 8,
    marginTop: 3,
    maxWidth: 280,
  },
  phone: {
    color: "#e2e8f0",
    fontSize: 9,
    fontWeight: 600,
  },
  invoiceLabel: {
    marginTop: 14,
    fontSize: 28,
    fontWeight: 700,
    color: "#0f172a",
    letterSpacing: 1.5,
  },
  row: {
    flexDirection: "row",
    marginTop: 14,
    gap: 16,
  },
  block: {
    flexGrow: 1,
    flexBasis: 0,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    padding: 10,
    minHeight: 88,
  },
  blockTitle: {
    fontSize: 8,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 6,
    letterSpacing: 0.8,
  },
  detailGrid: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  detailRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  detailCell: {
    flex: 1,
    padding: 8,
    fontSize: 8,
  },
  detailLabel: {
    fontWeight: 700,
    color: "#475569",
    width: 120,
    padding: 8,
    borderRightWidth: 1,
    borderRightColor: "#e2e8f0",
    fontSize: 8,
  },
  sectionTitle: {
    marginTop: 16,
    fontSize: 10,
    fontWeight: 700,
    color: "#0f172a",
    borderBottomWidth: 2,
    borderBottomColor: "#c7a43a",
    paddingBottom: 4,
  },
  bodyText: {
    marginTop: 6,
    fontSize: 9,
    color: "#334155",
  },
  table: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  th: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
  },
  thCell: {
    padding: 7,
    fontSize: 8,
    fontWeight: 700,
    color: "#475569",
    textTransform: "uppercase",
  },
  tr: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  td: {
    padding: 7,
    fontSize: 9,
    color: "#1e293b",
  },
  totals: {
    marginTop: 12,
    alignItems: "flex-end",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    width: 220,
    paddingVertical: 3,
  },
  totalLabel: {
    width: 90,
    textAlign: "right",
    fontSize: 9,
    color: "#64748b",
    paddingRight: 8,
  },
  totalValue: {
    width: 80,
    textAlign: "right",
    fontSize: 9,
    fontWeight: 700,
    color: "#0f172a",
  },
  footer: {
    marginTop: 22,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    fontSize: 8,
    color: "#64748b",
    textAlign: "center",
  },
});

type Customer = {
  company_name: string | null;
  billing_address: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
};

type Location = {
  location_name: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
};

type WorkOrder = {
  work_order_number: string | null;
  title: string | null;
  scope_summary: string | null;
  customer_work_order_number: string | null;
  purchase_order_number: string | null;
};

export type InvoicePdfRecord = {
  invoice_number: string;
  invoice_date: string | null;
  due_date: string | null;
  payment_terms: string | null;
  subtotal: number | null;
  tax_amount: number | null;
  total_amount: number | null;
  balance_due: number | null;
  notes: string | null;
  customers: Customer | Customer[] | null;
  locations: Location | Location[] | null;
  work_orders: WorkOrder | WorkOrder[] | null;
};

export type LinePdf = {
  description: string;
  quantity: number | null;
  unit_price: number | null;
  total: number | null;
};

function one<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function money(n: number | null | undefined) {
  const v = Number(n ?? 0);
  return v.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function FortifiedInvoiceDocument({
  invoice,
  lineItems,
}: {
  invoice: InvoicePdfRecord;
  lineItems: LinePdf[];
}) {
  const customer = one(invoice.customers);
  const location = one(invoice.locations);
  const wo = one(invoice.work_orders);

  const addr = [
    location?.location_name,
    location?.address_line_1,
    location?.address_line_2,
    [location?.city, location?.state, location?.zip].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <View>
              <Text style={styles.brandName}>Fortified Fence & Weld</Text>
              <Text style={styles.brandSub}>
                Commercial fence, gate, welding, and perimeter security for multi-site retail, industrial, and
                facilities programs.
              </Text>
            </View>
            <Text style={styles.phone}>(318) 446-2134</Text>
          </View>
        </View>

        <Text style={styles.invoiceLabel}>INVOICE</Text>

        <View style={styles.row}>
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Bill To</Text>
            <Text style={{ fontSize: 10, fontWeight: 700 }}>{customer?.company_name ?? "Customer"}</Text>
            {customer?.contact_name ? (
              <Text style={{ marginTop: 4 }}>{customer.contact_name}</Text>
            ) : null}
            {customer?.billing_address ? (
              <Text style={{ marginTop: 4, color: "#475569" }}>{customer.billing_address}</Text>
            ) : null}
            {customer?.contact_email ? (
              <Text style={{ marginTop: 4, fontSize: 8 }}>{customer.contact_email}</Text>
            ) : null}
            {customer?.contact_phone ? (
              <Text style={{ marginTop: 2, fontSize: 8 }}>{customer.contact_phone}</Text>
            ) : null}
          </View>
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Invoice Details</Text>
            <Text>
              <Text style={{ fontWeight: 700 }}>Invoice #: </Text>
              {invoice.invoice_number}
            </Text>
            <Text style={{ marginTop: 4 }}>
              <Text style={{ fontWeight: 700 }}>Invoice date: </Text>
              {invoice.invoice_date ?? "—"}
            </Text>
            <Text style={{ marginTop: 2 }}>
              <Text style={{ fontWeight: 700 }}>Due date: </Text>
              {invoice.due_date ?? "—"}
            </Text>
            <Text style={{ marginTop: 2 }}>
              <Text style={{ fontWeight: 700 }}>Terms: </Text>
              {invoice.payment_terms ?? "Net 30"}
            </Text>
            {wo?.work_order_number ? (
              <Text style={{ marginTop: 4 }}>
                <Text style={{ fontWeight: 700 }}>Work order: </Text>
                {wo.work_order_number}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.detailGrid}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Customer WO #</Text>
            <Text style={styles.detailCell}>{wo?.customer_work_order_number ?? "—"}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Purchase order</Text>
            <Text style={styles.detailCell}>{wo?.purchase_order_number ?? "—"}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Job location</Text>
        <Text style={styles.bodyText}>{addr || "—"}</Text>

        <Text style={styles.sectionTitle}>Service summary</Text>
        <Text style={styles.bodyText}>{wo?.title ?? "Field services"}</Text>

        <Text style={styles.sectionTitle}>Detailed work scope</Text>
        <Text style={styles.bodyText}>{wo?.scope_summary ?? invoice.notes ?? "See attached completion photos and site notes."}</Text>

        <Text style={styles.sectionTitle}>Charges</Text>
        <View style={styles.table}>
          <View style={styles.th}>
            <Text style={[styles.thCell, { flex: 3 }]}>Description</Text>
            <Text style={[styles.thCell, { flex: 0.8, textAlign: "right" }]}>Qty</Text>
            <Text style={[styles.thCell, { flex: 1, textAlign: "right" }]}>Unit</Text>
            <Text style={[styles.thCell, { flex: 1, textAlign: "right" }]}>Amount</Text>
          </View>
          {lineItems.map((li, idx) => (
            <View key={idx} style={styles.tr} wrap={false}>
              <Text style={[styles.td, { flex: 3 }]}>{li.description}</Text>
              <Text style={[styles.td, { flex: 0.8, textAlign: "right" }]}>{String(li.quantity ?? 0)}</Text>
              <Text style={[styles.td, { flex: 1, textAlign: "right" }]}>{money(li.unit_price)}</Text>
              <Text style={[styles.td, { flex: 1, textAlign: "right", fontWeight: 700 }]}>{money(li.total)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{money(invoice.subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tax</Text>
            <Text style={styles.totalValue}>{money(invoice.tax_amount)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total due</Text>
            <Text style={[styles.totalValue, { fontSize: 11 }]}>{money(invoice.total_amount)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Balance</Text>
            <Text style={styles.totalValue}>{money(invoice.balance_due)}</Text>
          </View>
        </View>

        <Text style={styles.footer}>
          Thank you for partnering with Fortified Fence & Weld. Remit payment per the terms above. Questions on this
          invoice may be directed to our billing desk at (318) 446-2134.
        </Text>
      </Page>
    </Document>
  );
}
