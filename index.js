import express from "express";
import cors from "cors";
import "dotenv/config";
import eventsRouter from "./routes/events.js";
import meRouter from "./routes/me.js";

const app = express();
const port = process.env.PORT || 8000;

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());

app.get("/", (_req, res) => res.send({ message: "IftarShare server is running." }));
app.use("/events", eventsRouter);
app.use(meRouter);

// no route matched
app.use((_req, res) => res.status(404).send({ message: "Route not found." }));

// send errors back as JSON (e.g. broken request body)
app.use((err, _req, res, _next) => {
    const status = err.status && err.status < 500 ? err.status : 500;
    if (status === 500) console.error(err);
    res.status(status).send({ message: status === 500 ? "Internal server error." : "Invalid request." });
});

// Vercel runs the exported app itself, so only listen when running locally
if (!process.env.VERCEL) {
    app.listen(port, () => console.log(`IftarShare server listening on port ${port}`));
}

export default app;
