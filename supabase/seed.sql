-- Optional demo seed. Run after creating an auth user and users_profile row for your owner/admin.
insert into public.customers (company_name, contact_name, contact_email, billing_email, billing_address, customer_type, status)
values ('Bayou Retail Group', 'Dana Manager', 'dana@example.com', 'ap@example.com', '100 Commerce Way, Alexandria, LA 71301', 'retail', 'active')
on conflict do nothing;

insert into public.subcontractors (company_name, owner_name, phone, email, service_states, trades, preferred_vendor, standard_labor_rate, emergency_labor_rate, trip_charge, quality_score, response_score, status)
values ('Delta Gate & Fence', 'Sam Welder', '(318) 555-0101', 'sam@example.com', array['LA','TX','MS'], array['fence','gate','welding','bollards'], true, 85, 125, 75, 4.7, 4.5, 'active')
on conflict do nothing;

with c as (select id from public.customers where company_name = 'Bayou Retail Group' limit 1)
insert into public.locations (customer_id, location_name, store_number, address_line_1, city, state, zip, site_contact_name, site_contact_phone)
select id, 'Bayou Retail - Alexandria', 'LA-014', '100 Commerce Way', 'Alexandria', 'LA', '71301', 'Dana Manager', '(318) 555-0102' from c
on conflict do nothing;
