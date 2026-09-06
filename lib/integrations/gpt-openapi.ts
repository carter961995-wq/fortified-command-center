export function gptOpenApiSpec(serverUrl: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "Fortified Command Center GPT Bridge",
      version: "1.0.0",
      description:
        "Use these actions to move Fortified Fence & Weld customers, job sites, subcontractors, work orders, and business knowledge into the Command Center. Prefer /import for a bulk transfer, then /dispatch to assign crews. Always match existing records by company name, store number, or work order number before creating duplicates.",
    },
    servers: [{ url: serverUrl.replace(/\/$/, "") }],
    paths: {
      "/api/gpt/v1/health": {
        get: {
          operationId: "healthCheck",
          summary: "Confirm the Fortified GPT bridge is online",
          responses: { "200": { description: "Bridge is reachable" } },
        },
      },
      "/api/gpt/v1/snapshot": {
        get: {
          operationId: "getSnapshot",
          summary: "Read current customers, locations, subcontractors, work orders, and knowledge",
          description: "Call this before importing so you can link existing records instead of duplicating them.",
          responses: { "200": { description: "Current Command Center snapshot" } },
        },
      },
      "/api/gpt/v1/import": {
        post: {
          operationId: "importFortifiedData",
          summary: "Bulk upsert business, customer, location, subcontractor, project, and knowledge records",
          description:
            "Send everything the Fortified GPT already knows. Records are matched by externalId when provided, otherwise by company name, store number, or work order number. Nested customer/location names on jobs are resolved automatically if those records are included in the same payload or already exist.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ImportPayload" },
              },
            },
          },
          responses: { "200": { description: "Import counts" } },
        },
      },
      "/api/gpt/v1/dispatch": {
        post: {
          operationId: "dispatchWorkOrder",
          summary: "Assign a subcontractor to a work order and mark it scheduled",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DispatchPayload" },
              },
            },
          },
          responses: { "200": { description: "Assigned crew and work order" } },
        },
      },
      "/api/gpt/v1/knowledge": {
        get: {
          operationId: "listKnowledge",
          summary: "List saved business knowledge, pricing rules, and SOPs",
          responses: { "200": { description: "Knowledge entries" } },
        },
        post: {
          operationId: "saveKnowledge",
          summary: "Save business facts, pricing rules, scripts, or SOPs",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/KnowledgePayload" },
              },
            },
          },
          responses: { "200": { description: "Saved knowledge" } },
        },
      },
    },
    components: {
      securitySchemes: {
        apiKey: {
          type: "apiKey",
          in: "header",
          name: "Authorization",
          description: "Use `Bearer YOUR_FORTIFIED_GPT_KEY`.",
        },
      },
      schemas: {
        ImportPayload: {
          type: "object",
          additionalProperties: false,
          properties: {
            business: {
              type: "object",
              properties: {
                companyName: { type: "string" },
                phone: { type: "string" },
                email: { type: "string" },
                website: { type: "string" },
                operatingStates: { type: "array", items: { type: "string" } },
                notes: { type: "string" },
                pricingRules: { type: "string" },
                dispatchRules: { type: "string" },
              },
            },
            customers: { type: "array", items: { $ref: "#/components/schemas/CustomerInput" } },
            locations: { type: "array", items: { $ref: "#/components/schemas/LocationInput" } },
            subcontractors: { type: "array", items: { $ref: "#/components/schemas/SubcontractorInput" } },
            workOrders: { type: "array", items: { $ref: "#/components/schemas/WorkOrderInput" } },
            projects: { type: "array", items: { $ref: "#/components/schemas/WorkOrderInput" } },
            knowledge: { type: "array", items: { $ref: "#/components/schemas/KnowledgeEntry" } },
          },
        },
        CustomerInput: {
          type: "object",
          required: ["companyName"],
          properties: {
            externalId: { type: "string", description: "Stable id from the GPT so later updates attach to the same record." },
            companyName: { type: "string" },
            contactName: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
            billingAddress: { type: "string" },
            paymentTerms: { type: "string" },
            customerType: { type: "string" },
            status: { type: "string" },
            notes: { type: "string" },
          },
        },
        LocationInput: {
          type: "object",
          properties: {
            externalId: { type: "string" },
            customerName: { type: "string" },
            customerExternalId: { type: "string" },
            locationName: { type: "string" },
            storeNumber: { type: "string" },
            address: { type: "string" },
            city: { type: "string" },
            state: { type: "string" },
            zip: { type: "string" },
            gateCode: { type: "string" },
            accessInstructions: { type: "string" },
            notes: { type: "string" },
          },
        },
        SubcontractorInput: {
          type: "object",
          required: ["companyName"],
          properties: {
            externalId: { type: "string" },
            companyName: { type: "string" },
            contactName: { type: "string" },
            phone: { type: "string" },
            email: { type: "string" },
            city: { type: "string" },
            state: { type: "string" },
            trades: { type: "array", items: { type: "string" } },
            serviceStates: { type: "array", items: { type: "string" } },
            serviceRadiusMiles: { type: "number" },
            preferred: { type: "boolean" },
            status: { type: "string" },
            notes: { type: "string" },
          },
        },
        WorkOrderInput: {
          type: "object",
          required: ["title"],
          properties: {
            externalId: { type: "string" },
            title: { type: "string" },
            customerName: { type: "string" },
            customerExternalId: { type: "string" },
            locationName: { type: "string" },
            city: { type: "string" },
            state: { type: "string" },
            storeNumber: { type: "string" },
            scope: { type: "string" },
            tradeType: { type: "string" },
            priority: { type: "string" },
            status: { type: "string" },
            workOrderNumber: { type: "string" },
            customerWorkOrderNumber: { type: "string" },
            subcontractorName: { type: "string" },
            scheduledDate: { type: "string" },
            dueDate: { type: "string" },
            nte: { type: "number" },
            notes: { type: "string" },
          },
        },
        DispatchPayload: {
          type: "object",
          properties: {
            workOrderId: { type: "string" },
            workOrderNumber: { type: "string" },
            customerWorkOrderNumber: { type: "string" },
            title: { type: "string" },
            subcontractorId: { type: "string" },
            subcontractorName: { type: "string" },
            city: { type: "string" },
            state: { type: "string" },
            trade: { type: "string" },
            scheduledDate: { type: "string" },
            notes: { type: "string" },
          },
        },
        KnowledgeEntry: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            category: { type: "string" },
            content: { type: "string" },
          },
        },
        KnowledgePayload: {
          type: "object",
          properties: {
            entries: { type: "array", items: { $ref: "#/components/schemas/KnowledgeEntry" } },
            title: { type: "string" },
            category: { type: "string" },
            content: { type: "string" },
          },
        },
      },
    },
    security: [{ apiKey: [] }],
  };
}

export function gptCustomInstructions() {
  return `You are the Fortified Fence & Weld operations assistant connected to the Fortified Command Center.

When the user wants their existing customers, job sites, subcontractors, projects, pricing rules, or business knowledge moved into the app:
1. Call getSnapshot first so you can reuse existing record ids/names.
2. Call importFortifiedData with everything you already know. Use stable externalId values you control.
3. Put customers, locations, subcontractors, and workOrders/projects in one import when possible.
4. After import, confirm counts and summarize what now lives in the Command Center.

When the user asks to send a crew:
- Call dispatchWorkOrder with the work order number or customer WO number and the subcontractor name if known.
- If no crew is named, still dispatch and let the API pick coverage by city/state/trade.

Keep the Command Center as the source of truth after the first successful transfer. Do not keep a second copy of jobs only in chat.`;
}
