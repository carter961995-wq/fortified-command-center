import { PageHeader } from "@/components/page-header";
import { CustomerForm } from "@/components/customers/customer-form";

export default function NewCustomerPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="New Customer" description="Add a new commercial customer" />
      <CustomerForm />
    </div>
  );
}
