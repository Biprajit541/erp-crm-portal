// OpenAPI 3.0 specification for the ERP + CRM Portal API.
// Served interactively via Swagger UI at /docs.

export const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "ERP + CRM Portal API",
    version: "1.0.0",
    description:
      "REST API for the Mini ERP + CRM Operations Portal (wholesale/distribution).\n\n" +
      "**How to use:** Call `POST /auth/login` with a test account, copy the returned `token`, " +
      "click the **Authorize** button at the top right, paste the token, and all protected " +
      "endpoints become callable.\n\n" +
      "Test accounts (password `Password@123`): admin@erp.com, sales@erp.com, warehouse@erp.com, accounts@erp.com.",
  },
  servers: [
    { url: "/", description: "This server" },
  ],
  tags: [
    { name: "Auth", description: "Login and current user" },
    { name: "Customers", description: "Customer CRM and follow-ups" },
    { name: "Products", description: "Products, stock and movement log" },
    { name: "Challans", description: "Sales challans and PDF export" },
    { name: "Dashboard", description: "Summary counts" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", example: "admin@erp.com" },
          password: { type: "string", example: "Password@123" },
        },
      },
      LoginResponse: {
        type: "object",
        properties: {
          token: { type: "string" },
          user: { $ref: "#/components/schemas/User" },
        },
      },
      User: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          name: { type: "string", example: "Admin User" },
          email: { type: "string", example: "admin@erp.com" },
          role: { type: "string", enum: ["ADMIN", "SALES", "WAREHOUSE", "ACCOUNTS"] },
        },
      },
      CustomerInput: {
        type: "object",
        required: ["customer_name", "mobile", "customer_type"],
        properties: {
          customer_name: { type: "string", example: "Rajesh Kumar" },
          mobile: { type: "string", example: "9876543210", description: "10 digits" },
          email: { type: "string", example: "rajesh@sharmastores.com" },
          business_name: { type: "string", example: "Sharma Stores" },
          gst_number: { type: "string", example: "22AAAAA0000A1Z5" },
          customer_type: { type: "string", enum: ["RETAIL", "WHOLESALE", "DISTRIBUTOR"] },
          address: { type: "string", example: "12 MG Road, Bhubaneswar" },
          status: { type: "string", enum: ["LEAD", "ACTIVE", "INACTIVE"], default: "LEAD" },
          follow_up_date: { type: "string", format: "date", example: "2026-08-15" },
          notes: { type: "string" },
        },
      },
      FollowupInput: {
        type: "object",
        required: ["note"],
        properties: { note: { type: "string", example: "Called about bulk order." } },
      },
      ProductInput: {
        type: "object",
        required: ["product_name", "sku", "unit_price"],
        properties: {
          product_name: { type: "string", example: "Basmati Rice 25kg" },
          sku: { type: "string", example: "RICE-BAS-25" },
          category: { type: "string", example: "Grains" },
          unit_price: { type: "number", example: 1850.0 },
          current_stock: { type: "integer", example: 120, description: "Opening stock (create only)" },
          min_stock_alert: { type: "integer", example: 20 },
          location: { type: "string", example: "Rack A1" },
        },
      },
      StockMovementInput: {
        type: "object",
        required: ["product_id", "quantity", "movement_type", "reason"],
        properties: {
          product_id: { type: "integer", example: 1 },
          quantity: { type: "integer", example: 50 },
          movement_type: { type: "string", enum: ["IN", "OUT"] },
          reason: { type: "string", example: "New shipment received" },
        },
      },
      ChallanInput: {
        type: "object",
        required: ["customer_id", "items"],
        properties: {
          customer_id: { type: "integer", example: 1 },
          status: { type: "string", enum: ["DRAFT", "CONFIRMED"], default: "DRAFT" },
          items: {
            type: "array",
            items: {
              type: "object",
              required: ["product_id", "quantity"],
              properties: {
                product_id: { type: "integer", example: 1 },
                quantity: { type: "integer", example: 10 },
              },
            },
          },
        },
      },
      ChallanStatusInput: {
        type: "object",
        required: ["status"],
        properties: { status: { type: "string", enum: ["CONFIRMED", "CANCELLED"] } },
      },
      Error: {
        type: "object",
        properties: {
          error: { type: "string" },
          details: {
            type: "array",
            items: {
              type: "object",
              properties: {
                field: { type: "string" },
                message: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Log in and receive a JWT",
        security: [],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } },
        },
        responses: {
          "200": {
            description: "Authenticated",
            content: { "application/json": { schema: { $ref: "#/components/schemas/LoginResponse" } } },
          },
          "401": { description: "Invalid credentials", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get the current authenticated user",
        responses: {
          "200": { description: "Current user", content: { "application/json": { schema: { type: "object", properties: { user: { $ref: "#/components/schemas/User" } } } } } },
          "401": { description: "Not authenticated" },
        },
      },
    },
    "/customers": {
      get: {
        tags: ["Customers"],
        summary: "List customers (search, filter, paginate)",
        parameters: [
          { name: "search", in: "query", schema: { type: "string" }, description: "Name, mobile or business" },
          { name: "status", in: "query", schema: { type: "string", enum: ["LEAD", "ACTIVE", "INACTIVE"] } },
          { name: "type", in: "query", schema: { type: "string", enum: ["RETAIL", "WHOLESALE", "DISTRIBUTOR"] } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 10 } },
        ],
        responses: { "200": { description: "Paginated customer list" }, "401": { description: "Not authenticated" } },
      },
      post: {
        tags: ["Customers"],
        summary: "Create a customer (SALES or ADMIN)",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CustomerInput" } } } },
        responses: {
          "201": { description: "Created" },
          "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "403": { description: "Forbidden (wrong role)" },
        },
      },
    },
    "/customers/{id}": {
      get: {
        tags: ["Customers"],
        summary: "Get a customer with follow-ups",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "Customer detail" }, "404": { description: "Not found" } },
      },
      put: {
        tags: ["Customers"],
        summary: "Update a customer (SALES or ADMIN)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CustomerInput" } } } },
        responses: { "200": { description: "Updated" }, "403": { description: "Forbidden" }, "404": { description: "Not found" } },
      },
    },
    "/customers/{id}/followups": {
      post: {
        tags: ["Customers"],
        summary: "Add a follow-up note (SALES or ADMIN)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/FollowupInput" } } } },
        responses: { "201": { description: "Note added" }, "403": { description: "Forbidden" }, "404": { description: "Customer not found" } },
      },
    },
    "/products": {
      get: {
        tags: ["Products"],
        summary: "List products (search, low-stock filter, paginate)",
        parameters: [
          { name: "search", in: "query", schema: { type: "string" }, description: "Name or SKU" },
          { name: "category", in: "query", schema: { type: "string" } },
          { name: "lowStock", in: "query", schema: { type: "string", enum: ["true"] }, description: "Only items at/below min alert" },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 10 } },
        ],
        responses: { "200": { description: "Paginated product list" }, "401": { description: "Not authenticated" } },
      },
      post: {
        tags: ["Products"],
        summary: "Create a product (WAREHOUSE or ADMIN)",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ProductInput" } } } },
        responses: {
          "201": { description: "Created (initial stock logged as an IN movement)" },
          "400": { description: "Validation error" },
          "403": { description: "Forbidden" },
          "409": { description: "Duplicate SKU" },
        },
      },
    },
    "/products/{id}": {
      get: {
        tags: ["Products"],
        summary: "Get a product with recent stock movements",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "Product detail + movements" }, "404": { description: "Not found" } },
      },
      put: {
        tags: ["Products"],
        summary: "Update product details, not stock (WAREHOUSE or ADMIN)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ProductInput" } } } },
        responses: { "200": { description: "Updated" }, "403": { description: "Forbidden" }, "404": { description: "Not found" } },
      },
    },
    "/products/movements": {
      post: {
        tags: ["Products"],
        summary: "Record a stock IN/OUT movement (WAREHOUSE or ADMIN)",
        description: "Adjusts stock inside a transaction with a row lock. OUT that would make stock negative returns 400.",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/StockMovementInput" } } } },
        responses: {
          "201": { description: "Movement recorded, returns new_stock" },
          "400": { description: "Insufficient stock or validation error" },
          "403": { description: "Forbidden" },
          "404": { description: "Product not found" },
        },
      },
    },
    "/challans": {
      get: {
        tags: ["Challans"],
        summary: "List challans (search, status filter, paginate)",
        parameters: [
          { name: "search", in: "query", schema: { type: "string" }, description: "Challan number or customer" },
          { name: "status", in: "query", schema: { type: "string", enum: ["DRAFT", "CONFIRMED", "CANCELLED"] } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 10 } },
        ],
        responses: { "200": { description: "Paginated challan list" }, "401": { description: "Not authenticated" } },
      },
      post: {
        tags: ["Challans"],
        summary: "Create a challan, DRAFT or CONFIRMED (SALES or ADMIN)",
        description: "Confirming reduces stock in a transaction and stores a product snapshot. Insufficient stock returns 400.",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ChallanInput" } } } },
        responses: {
          "201": { description: "Created" },
          "400": { description: "Insufficient stock or validation error" },
          "403": { description: "Forbidden" },
          "404": { description: "Customer/product not found" },
        },
      },
    },
    "/challans/{id}": {
      get: {
        tags: ["Challans"],
        summary: "Get a challan with snapshot line items",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "Challan detail" }, "404": { description: "Not found" } },
      },
    },
    "/challans/{id}/status": {
      patch: {
        tags: ["Challans"],
        summary: "Confirm or cancel a DRAFT challan (SALES or ADMIN)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ChallanStatusInput" } } } },
        responses: {
          "200": { description: "Status updated" },
          "400": { description: "Not a draft, or insufficient stock on confirm" },
          "403": { description: "Forbidden" },
          "404": { description: "Not found" },
        },
      },
    },
    "/challans/{id}/pdf": {
      get: {
        tags: ["Challans"],
        summary: "Download the challan as a PDF invoice",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: {
          "200": { description: "PDF file", content: { "application/pdf": { schema: { type: "string", format: "binary" } } } },
          "404": { description: "Not found" },
        },
      },
    },
    "/dashboard/summary": {
      get: {
        tags: ["Dashboard"],
        summary: "Get summary counts for the dashboard",
        responses: { "200": { description: "Counts" }, "401": { description: "Not authenticated" } },
      },
    },
    "/health": {
      get: {
        tags: ["Dashboard"],
        summary: "Health check",
        security: [],
        responses: { "200": { description: "OK" } },
      },
    },
  },
};