"use client";

import { useState } from "react";

export function RelationPicker({
  name,
  label,
  table,
  labelKey,
  required,
  defaultValue,
  initialOptions,
}: {
  name: string;
  label: string;
  table: string;
  labelKey: string;
  required?: boolean;
  defaultValue?: string;
  initialOptions: { value: string; label: string }[];
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState(initialOptions);
  const [value, setValue] = useState(defaultValue ?? "");

  async function search(next: string) {
    setQuery(next);
    const params = new URLSearchParams({ table, label: labelKey, q: next });
    if (value) params.set("selected", value);
    const response = await fetch(`/api/relations?${params.toString()}`);
    if (!response.ok) return;
    const body = (await response.json()) as { options?: { value: string; label: string }[] };
    if (body.options) setOptions(body.options);
  }

  return (
    <label>
      {label}
      <input aria-label={`Search ${label}`} placeholder={`Search ${label.toLowerCase()}...`} value={query} onChange={(event) => void search(event.target.value)} />
      <select name={name} required={required} value={value} onChange={(event) => setValue(event.target.value)}>
        <option value="">{required ? "Select..." : "None"}</option>
        {options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}
