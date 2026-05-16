import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 40,
    color: "#1a1a1a",
  },
  headerBar: {
    backgroundColor: "#111827",
    padding: 20,
    marginHorizontal: -40,
    marginTop: -40,
    marginBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  companyName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 20,
    color: "#ffffff",
    letterSpacing: 1,
  },
  companyTagline: {
    fontSize: 8,
    color: "#d1d5db",
    marginTop: 2,
  },
  companyPhone: {
    fontSize: 10,
    color: "#ffffff",
    textAlign: "right" as const,
  },
  invoiceLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 28,
    color: "#111827",
    textAlign: "right" as const,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  infoBlock: {
    width: "48%",
  },
  infoBlockLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: "#6b7280",
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 10,
    marginBottom: 2,
    lineHeight: 1.4,
  },
  infoBold: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    marginBottom: 2,
  },
  detailsGrid: {
    flexDirection: "row",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 4,
  },
  detailCell: {
    flex: 1,
    padding: 8,
    borderRightWidth: 1,
    borderRightColor: "#e5e7eb",
  },
  detailCellLast: {
    flex: 1,
    padding: 8,
  },
  detailLabel: {
    fontSize: 7,
    color: "#6b7280",
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
  },
  scopeSection: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: "#f9fafb",
    borderRadius: 4,
  },
  scopeLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: "#6b7280",
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  scopeText: {
    fontSize: 10,
    lineHeight: 1.4,
  },
  table: {
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#111827",
    padding: 8,
    borderRadius: 2,
  },
  tableHeaderText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: "#ffffff",
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: "row",
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  tableRowAlt: {
    flexDirection: "row",
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    backgroundColor: "#f9fafb",
  },
  colDescription: { flex: 4 },
  colQty: { flex: 1, textAlign: "center" as const },
  colUnitPrice: { flex: 2, textAlign: "right" as const },
  colAmount: { flex: 2, textAlign: "right" as const },
  totalsSection: {
    alignItems: "flex-end",
    marginBottom: 20,
  },
  totalsRow: {
    flexDirection: "row",
    width: 220,
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  totalsBorder: {
    flexDirection: "row",
    width: 220,
    justifyContent: "space-between",
    paddingVertical: 6,
    borderTopWidth: 2,
    borderTopColor: "#111827",
    marginTop: 4,
  },
  totalsLabel: {
    fontSize: 10,
    color: "#374151",
  },
  totalsValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },
  totalDueLabel: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },
  totalDueValue: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },
  notesSection: {
    marginBottom: 20,
    padding: 12,
    backgroundColor: "#f9fafb",
    borderRadius: 4,
  },
  notesLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: "#6b7280",
    textTransform: "uppercase" as const,
    marginBottom: 4,
  },
  notesText: {
    fontSize: 9,
    lineHeight: 1.4,
    color: "#374151",
  },
  termsSection: {
    marginBottom: 20,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 4,
  },
  termsText: {
    fontSize: 8,
    color: "#6b7280",
    lineHeight: 1.4,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 8,
    color: "#9ca3af",
  },
  footerBold: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: "#6b7280",
  },
});

function formatCurrencyPDF(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatDatePDF(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

interface InvoicePDFData {
  invoiceNumber: string;
  customerWoNumber: string | null;
  purchaseOrderNumber: string | null;
  invoiceDate: string;
  dueDate: string;
  paymentTermsDays: number;
  description: string | null;
  billTo: {
    companyName: string;
    contactName: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    zip: string;
  };
  jobLocation: {
    name: string;
    addressLine1: string;
    city: string;
    state: string;
    zip: string;
  };
  workScope: string;
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes: string | null;
}

export function InvoicePDF({ data }: { data: InvoicePDFData }) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header Bar */}
        <View style={styles.headerBar}>
          <View>
            <Text style={styles.companyName}>FORTIFIED FENCE & WELD</Text>
            <Text style={styles.companyTagline}>
              Commercial Fence, Gate, Welding & Security Solutions
            </Text>
          </View>
          <Text style={styles.companyPhone}>(318) 446-2134</Text>
        </View>

        {/* INVOICE Title */}
        <Text style={styles.invoiceLabel}>INVOICE</Text>

        {/* Bill To and Invoice Details */}
        <View style={styles.infoRow}>
          <View style={styles.infoBlock}>
            <Text style={styles.infoBlockLabel}>Bill To</Text>
            <Text style={styles.infoBold}>{data.billTo.companyName}</Text>
            <Text style={styles.infoText}>{data.billTo.contactName}</Text>
            <Text style={styles.infoText}>{data.billTo.addressLine1}</Text>
            {data.billTo.addressLine2 && (
              <Text style={styles.infoText}>{data.billTo.addressLine2}</Text>
            )}
            <Text style={styles.infoText}>
              {data.billTo.city}, {data.billTo.state} {data.billTo.zip}
            </Text>
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoBlockLabel}>Job Location</Text>
            <Text style={styles.infoBold}>{data.jobLocation.name}</Text>
            <Text style={styles.infoText}>{data.jobLocation.addressLine1}</Text>
            <Text style={styles.infoText}>
              {data.jobLocation.city}, {data.jobLocation.state} {data.jobLocation.zip}
            </Text>
          </View>
        </View>

        {/* Invoice Details Grid */}
        <View style={styles.detailsGrid}>
          <View style={styles.detailCell}>
            <Text style={styles.detailLabel}>Invoice Number</Text>
            <Text style={styles.detailValue}>{data.invoiceNumber}</Text>
          </View>
          <View style={styles.detailCell}>
            <Text style={styles.detailLabel}>Invoice Date</Text>
            <Text style={styles.detailValue}>{formatDatePDF(data.invoiceDate)}</Text>
          </View>
          <View style={styles.detailCell}>
            <Text style={styles.detailLabel}>Due Date</Text>
            <Text style={styles.detailValue}>{formatDatePDF(data.dueDate)}</Text>
          </View>
          <View style={styles.detailCellLast}>
            <Text style={styles.detailLabel}>Terms</Text>
            <Text style={styles.detailValue}>Net {data.paymentTermsDays}</Text>
          </View>
        </View>

        {data.customerWoNumber || data.purchaseOrderNumber ? (
          <View style={styles.detailsGrid}>
            {data.customerWoNumber && (
              <View style={styles.detailCell}>
                <Text style={styles.detailLabel}>Customer WO #</Text>
                <Text style={styles.detailValue}>{data.customerWoNumber}</Text>
              </View>
            )}
            {data.purchaseOrderNumber && (
              <View style={data.customerWoNumber ? styles.detailCellLast : styles.detailCell}>
                <Text style={styles.detailLabel}>Purchase Order #</Text>
                <Text style={styles.detailValue}>{data.purchaseOrderNumber}</Text>
              </View>
            )}
          </View>
        ) : null}

        {/* Work Scope */}
        {(data.description || data.workScope) && (
          <View style={styles.scopeSection}>
            <Text style={styles.scopeLabel}>Service Summary / Work Scope</Text>
            <Text style={styles.scopeText}>{data.description || data.workScope}</Text>
          </View>
        )}

        {/* Line Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.colDescription]}>Description</Text>
            <Text style={[styles.tableHeaderText, styles.colQty]}>Qty</Text>
            <Text style={[styles.tableHeaderText, styles.colUnitPrice]}>Unit Price</Text>
            <Text style={[styles.tableHeaderText, styles.colAmount]}>Amount</Text>
          </View>
          {data.items.map((item, index) => (
            <View key={index} style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
              <Text style={styles.colDescription}>{item.description}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colUnitPrice}>{formatCurrencyPDF(item.unitPrice)}</Text>
              <Text style={styles.colAmount}>{formatCurrencyPDF(item.amount)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text style={styles.totalsValue}>{formatCurrencyPDF(data.subtotal)}</Text>
          </View>
          {data.taxAmount > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>
                Tax ({(data.taxRate * 100).toFixed(2)}%)
              </Text>
              <Text style={styles.totalsValue}>{formatCurrencyPDF(data.taxAmount)}</Text>
            </View>
          )}
          <View style={styles.totalsBorder}>
            <Text style={styles.totalDueLabel}>TOTAL DUE</Text>
            <Text style={styles.totalDueValue}>{formatCurrencyPDF(data.total)}</Text>
          </View>
        </View>

        {/* Notes */}
        {data.notes && (
          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>{data.notes}</Text>
          </View>
        )}

        {/* Payment Terms */}
        <View style={styles.termsSection}>
          <Text style={styles.termsText}>
            Payment is due within {data.paymentTermsDays} days of the invoice date.
            Please remit payment to Fortified Fence & Weld.
            For questions regarding this invoice, contact us at (318) 446-2134.
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerBold}>Fortified Fence & Weld</Text>
          <Text style={styles.footerText}>Thank you for your business.</Text>
          <Text style={styles.footerText}>Page 1</Text>
        </View>
      </Page>
    </Document>
  );
}
