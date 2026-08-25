import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import interviewRoutes from "./routes/interview.js";
import storiesRoutes from "./routes/stories.js";
import dashboardRoutes from "./routes/dashboard.js";
import devRoutes from "./routes/dev.js";
import marketplaceRoutes from "./routes/marketplace.js";
import paymentsRoutes from "./routes/payments.js";
import v1Routes from "./routes/v1.js";
import { seed } from "./seed-run.js";

export function createApp(): express.Express {
  seed();

  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use(cookieParser());
  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
      credentials: true,
    })
  );

  app.get("/api/health", (_req, res) =>
    res.json({ ok: true, service: "cultory-api", time: new Date().toISOString() })
  );

  app.use("/api/auth", authRoutes);
  app.use("/api/interview", interviewRoutes);
  app.use("/api/stories", storiesRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/dev", devRoutes);
  app.use("/api/marketplace", marketplaceRoutes);
  app.use("/api/payments", paymentsRoutes);
  app.use("/api/v1", v1Routes);

  // error handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || "Internal server error" });
  });

  return app;
}
