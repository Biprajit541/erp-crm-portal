import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import { openapiSpec } from "./openapi";
import authRoutes from "./routes/auth";
import customerRoutes from "./routes/customers";
import productRoutes from "./routes/products";
import challanRoutes from "./routes/challans";
import dashboardRoutes from "./routes/dashboard";
import contactCenterRoutes from "./routes/contactCenter";
import { errorHandler } from "./middleware/errorHandler";

// The Express app, shared by both entry points:
//   - src/index.ts  : long-running server (local dev, Render)
//   - src/lambda.ts : AWS Lambda behind API Gateway
dotenv.config();

const app = express();
app.use(express.json());

const origins = (process.env.CORS_ORIGIN || "http://localhost:5173").split(",").map((s) => s.trim());
app.use(cors({ origin: origins }));

app.get("/", (_req, res) => res.json({ status: "ok", service: "ERP + CRM Portal API", docs: "/docs" }));
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Interactive API documentation (Swagger UI) at /docs, raw spec at /openapi.json
app.get("/openapi.json", (_req, res) => res.json(openapiSpec));
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec, { customSiteTitle: "ERP + CRM API Docs" }));

app.use("/auth", authRoutes);
app.use("/customers", customerRoutes);
app.use("/products", productRoutes);
app.use("/challans", challanRoutes);
app.use("/dashboard", dashboardRoutes);
// Amazon Connect (IVR) integration - API-key auth, called by AWS Lambda
app.use("/integrations/connect", contactCenterRoutes);

app.use((_req, res) => res.status(404).json({ error: "Route not found" }));
app.use(errorHandler);

export default app;