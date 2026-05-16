import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { InvoicePDF } from "@/components/invoices/invoice-pdf";
import React from "react";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select(`
      *,
      invoice_items:invoice_items(*),
      work_order:work_orders(*,
        customer:customers(*),
        location:locations(*)
      )
    `)
    .eq("id", id)
    .single();

  if (error || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const wo = invoice.work_order as {
    title: string;
    scope_summary: string;
    customer: {
      company_name: string;
      contact_name: string;
      billing_address_line1: string;
      billing_address_line2: string;
      billing_city: string;
      billing_state: string;
      billing_zip: string;
    };
    location: {
      name: string;
      address_line1: string;
      city: string;
      state: string;
      zip: string;
    };
  };

  const items = (invoice.invoice_items as {
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
  }[]) ?? [];

  const pdfData = {
    invoiceNumber: invoice.invoice_number,
    customerWoNumber: invoice.customer_wo_number,
    purchaseOrderNumber: invoice.purchase_order_number,
    invoiceDate: invoice.invoice_date,
    dueDate: invoice.due_date,
    paymentTermsDays: invoice.payment_terms_days,
    description: invoice.description,
    billTo: {
      companyName: wo.customer.company_name,
      contactName: wo.customer.contact_name,
      addressLine1: wo.customer.billing_address_line1,
      addressLine2: wo.customer.billing_address_line2,
      city: wo.customer.billing_city,
      state: wo.customer.billing_state,
      zip: wo.customer.billing_zip,
    },
    jobLocation: {
      name: wo.location.name,
      addressLine1: wo.location.address_line1,
      city: wo.location.city,
      state: wo.location.state,
      zip: wo.location.zip,
    },
    workScope: wo.scope_summary || wo.title,
    items: items.map((item) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unit_price),
      amount: Number(item.amount),
    })),
    subtotal: Number(invoice.subtotal),
    taxRate: Number(invoice.tax_rate),
    taxAmount: Number(invoice.tax_amount),
    total: Number(invoice.total),
    notes: invoice.notes,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(
    React.createElement(InvoicePDF, { data: pdfData }) as any
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.invoice_number}.pdf"`,
    },
  });
}
