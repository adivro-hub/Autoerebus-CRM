import express from "express";
import cors from "cors";
import helmet from "helmet";
import { vehicleRoutes } from "./routes/vehicles";
import { customerRoutes } from "./routes/customers";
import { leadRoutes } from "./routes/leads";
import { dealRoutes } from "./routes/deals";
import { serviceRoutes } from "./routes/service-orders";
import { claimRoutes } from "./routes/claims";
import { testDriveRoutes } from "./routes/test-drives";
import { dashboardRoutes } from "./routes/dashboard";
import { authRoutes } from "./routes/auth";
import { errorHandler } from "./middleware/error-handler";
import { authMiddleware } from "./middleware/auth";

const app = express();
const PORT = process.env.API_PORT || 4000;

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGINS?.split(",") || "*" }));
app.use(express.json({ limit: "10mb" }));

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Public routes
app.use("/api/auth", authRoutes);

// Protected routes
app.use("/api/dashboard", authMiddleware, dashboardRoutes);
app.use("/api/vehicles", authMiddleware, vehicleRoutes);
app.use("/api/customers", authMiddleware, customerRoutes);
app.use("/api/leads", authMiddleware, leadRoutes);
app.use("/api/deals", authMiddleware, dealRoutes);
app.use("/api/service-orders", authMiddleware, serviceRoutes);
app.use("/api/claims", authMiddleware, claimRoutes);
app.use("/api/test-drives", authMiddleware, testDriveRoutes);

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Autoerebus CRM API running on port ${PORT}`);
});
