export function gptOpenApiSpec(serverUrl: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "Fortified Command Center GPT Bridge",
      version: "1.0.0",
      description:
        "Sync Fortified Fence & Weld customers, jobs, SOP, guidelines, pricing, and other company knowledge into the Command Center. Prefer /import for a bulk transfer, /knowledge or /business for later updates, then /dispatch to assign crews. Match existing records by externalId, company name, store number, or work order number before creating duplicates.",
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
            "Send everything the Fortified GPT already knows, including customers and company SOP/guidelines/pricing. Records are matched by externalId when provided, otherwise by company name, store number, title, or work order number. Later calls with the same externalId or title update the live Command Center / Fence Bible records.",
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
      "/api/gpt/v1/update": {
        post: {
          operationId: "updateFortifiedRecord",
          summary: "Create or update one customer, job, subcontractor, SOP, guideline, pricing, or business record",
          description:
            "Use this for live edits after the first sync. Send type=customer|workOrder|subcontractor|location|sop|guideline|pricing|business plus the fields to change. Same name/externalId updates the existing Command Center row.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UpdatePayload" },
              },
            },
          },
          responses: { "200": { description: "Updated record counts" } },
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
          summary: "List saved SOP, guidelines, pricing, and other Fence Bible knowledge",
          responses: { "200": { description: "Knowledge entries" } },
        },
        post: {
          operationId: "saveKnowledge",
          summary: "Create or update SOP, guidelines, pricing data, scripts, or other company knowledge",
          description:
            "Use category sop, guideline, pricing, script, vendor, or general. Matching title or id updates the existing Fence Bible entry instead of duplicating it. You can also send sops, guidelines, and pricing arrays, or a business object to update company-level pricingRules/dispatchRules.",
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
      "/api/gpt/v1/business": {
        get: {
          operationId: "getBusinessProfile",
          summary: "Read company profile, pricing rules, and dispatch rules",
          responses: { "200": { description: "Business profile" } },
        },
        post: {
          operationId: "updateBusinessProfile",
          summary: "Update company profile, SOP notes, pricing rules, or dispatch rules",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/BusinessProfile" },
              },
            },
          },
          responses: { "200": { description: "Updated business profile" } },
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
            business: { $ref: "#/components/schemas/BusinessProfile" },
            customers: { type: "array", items: { $ref: "#/components/schemas/CustomerInput" } },
            locations: { type: "array", items: { $ref: "#/components/schemas/LocationInput" } },
            subcontractors: { type: "array", items: { $ref: "#/components/schemas/SubcontractorInput" } },
            workOrders: { type: "array", items: { $ref: "#/components/schemas/WorkOrderInput" } },
            projects: { type: "array", items: { $ref: "#/components/schemas/WorkOrderInput" } },
            knowledge: { type: "array", items: { $ref: "#/components/schemas/KnowledgeEntry" } },
            sops: { type: "array", items: { $ref: "#/components/schemas/KnowledgeEntry" } },
            guidelines: { type: "array", items: { $ref: "#/components/schemas/KnowledgeEntry" } },
            pricing: { type: "array", items: { $ref: "#/components/schemas/KnowledgeEntry" } },
            scripts: { type: "array", items: { $ref: "#/components/schemas/KnowledgeEntry" } },
          },
        },
        BusinessProfile: {
          type: "object",
          properties: {
            companyName: { type: "string" },
            phone: { type: "string" },
            email: { type: "string" },
            website: { type: "string" },
            operatingStates: { type: "array", items: { type: "string" } },
            notes: { type: "string", description: "Company guidelines / about text. Appears in Fence Bible." },
            pricingRules: { type: "string", description: "Labor rates, trip charges, NTE rules, and quote formulas." },
            dispatchRules: { type: "string", description: "How crews are chosen, coverage, and scheduling SOP." },
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
            category: {
              type: "string",
              description: "sop, guideline, pricing, script, vendor, or general",
              enum: ["sop", "guideline", "pricing", "script", "vendor", "general"],
            },
            content: { type: "string" },
          },
        },
        KnowledgePayload: {
          type: "object",
          properties: {
            business: { $ref: "#/components/schemas/BusinessProfile" },
            entries: { type: "array", items: { $ref: "#/components/schemas/KnowledgeEntry" } },
            sops: { type: "array", items: { $ref: "#/components/schemas/KnowledgeEntry" } },
            guidelines: { type: "array", items: { $ref: "#/components/schemas/KnowledgeEntry" } },
            pricing: { type: "array", items: { $ref: "#/components/schemas/KnowledgeEntry" } },
            title: { type: "string" },
            category: { type: "string", enum: ["sop", "guideline", "pricing", "script", "vendor", "general"] },
            content: { type: "string" },
          },
        },
        UpdatePayload: {
          type: "object",
          properties: {
            type: {
              type: "string",
              description: "customer, workOrder, subcontractor, location, sop, guideline, pricing, or business",
            },
            externalId: { type: "string" },
            companyName: { type: "string" },
            title: { type: "string" },
            category: { type: "string" },
            content: { type: "string" },
            record: { type: "object", additionalProperties: true },
          },
        },
      },
    },
    security: [{ apiKey: [] }],
  };
}

export function gptCustomInstructions() {
  return `You are a live Fortified Fence & Weld team member with read/write access to the Command Center. You are not a sidecar chatbot. When the owner tells you a customer, job, SOP, price, guideline, or dispatch change, write it into the app immediately and confirm what now lives there.

Capabilities:
- Read the shop: getSnapshot
- Bulk load or refresh customers, sites, crews, jobs, SOP, guidelines, and pricing: importFortifiedData
- Edit one record after the shop is live: updateFortifiedRecord (type=customer|workOrder|subcontractor|location|sop|guideline|pricing|business)
- SOP / guidelines / pricing notes: saveKnowledge (category sop, guideline, pricing, or script). Same title updates Fence Bible.
- Company profile, rate rules, dispatch SOP: updateBusinessProfile
- Assign crews: dispatchWorkOrder

Rules:
1. Call getSnapshot before creating anything so you reuse ids/names.
2. Use stable externalId values you control. Later updates with the same externalId, company name, or title overwrite the live row instead of duplicating it.
3. After every write, summarize what changed in Clients, Jobs, Fence Bible, or the subcontractor map.
4. Do not keep a second copy of customers, jobs, SOP, guidelines, or pricing only in chat.
5. If the user says "update the SOP / pricing / customer / guideline", call the write action in the same turn.`;
}
