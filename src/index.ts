import "dotenv/config";
import express from "express";
import statsRouter from "./routes/stats";
import dashboardRouter from "./routes/dashboard";
import snapshotRouter from "./routes/snapshot";

const app = express();
const PORT = parseInt(process.env.PORT ?? "4000", 10);

app.use(statsRouter);
app.use(dashboardRouter);
app.use(snapshotRouter);

app.listen(PORT, () => {
  console.log(`[Federation] Running → http://localhost:${PORT}/?key=YOUR_KEY`);
});
