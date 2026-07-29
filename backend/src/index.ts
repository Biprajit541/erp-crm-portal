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
import { errorHandler } from "./middleware/errorHandler";

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

app.use((_req, res) => res.status(404).json({ error: "Route not found" }));
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));