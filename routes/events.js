import { Router } from "express";
import { ObjectId } from "mongodb";
import { client, eventsCol, joinsCol } from "../db.js";
import { verifyToken } from "../middleware/auth.js";
import { validateEvent, pickEventFields, validId } from "../validators.js";

const router = Router();

// Upcoming events; the homepage requests limit=6.
router.get("/", async (req, res) => {
    try {
        const { limit } = req.query;
        const filter = { eventDate: { $gt: new Date() } };
        let cursor = eventsCol.find(filter, { projection: { capacity: 0, joinRevision: 0 } }).sort({ eventDate: 1 });
        if (limit) {
            const count = Number(limit);
            if (!Number.isSafeInteger(count) || count < 1)
                return res.status(400).send({ message: "Limit must be a positive whole number." });
            cursor = cursor.limit(count);
        }
        res.send(await cursor.toArray());
    } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Failed to fetch events." });
    }
});

router.get("/:id", async (req, res) => {
    if (!validId(req.params.id)) return res.status(400).send({ message: "Invalid event ID." });
    try {
        const event = await eventsCol.findOne({ _id: new ObjectId(req.params.id) }, { projection: { capacity: 0, joinRevision: 0 } });
        if (!event) return res.status(404).send({ message: "Event not found." });
        res.send(event);
    } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Failed to fetch event." });
    }
});

// everything below needs a login token
router.post("/", verifyToken, async (req, res) => {
    const error = validateEvent(req.body);
    if (error) return res.status(400).send({ message: error });

    try {
        const doc = {
            ...pickEventFields(req.body),
            creatorEmail: req.user.email, // from the token, not from the request body
            createdAt: new Date(),
        };
        const result = await eventsCol.insertOne(doc);
        res.status(201).send({ message: "Event created.", insertedId: result.insertedId });
    } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Failed to create event." });
    }
});

router.patch("/:id", verifyToken, async (req, res) => {
    if (!validId(req.params.id)) return res.status(400).send({ message: "Invalid event ID." });
    const error = validateEvent(req.body);
    if (error) return res.status(400).send({ message: error });

    try {
        const result = await eventsCol.updateOne(
            { _id: new ObjectId(req.params.id), creatorEmail: req.user.email },
            { $set: pickEventFields(req.body) },
        );
        if (!result.matchedCount) return res.status(403).send({ message: "You can only update your own events." });
        res.send({ message: "Event updated." });
    } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Failed to update event." });
    }
});

router.delete("/:id", verifyToken, async (req, res) => {
    if (!validId(req.params.id)) return res.status(400).send({ message: "Invalid event ID." });

    try {
        const _id = new ObjectId(req.params.id);
        const deleted = await client.withSession((session) => session.withTransaction(async () => {
            const result = await eventsCol.deleteOne({ _id, creatorEmail: req.user.email }, { session });
            if (!result.deletedCount) return false;
            await joinsCol.deleteMany({ eventId: _id }, { session });
            return true;
        }));
        if (!deleted)
            return res.status(403).send({ message: "You can only delete your own events." });
        res.send({ message: "Event deleted." });
    } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Failed to delete event." });
    }
});

router.post("/:id/join", verifyToken, async (req, res) => {
    if (!validId(req.params.id)) return res.status(400).send({ message: "Invalid event ID." });

    try {
        const eventId = new ObjectId(req.params.id);
        const found = await client.withSession((session) => session.withTransaction(async () => {
            // Coordinate with deletion so a concurrent join cannot leave an orphan record.
            const event = await eventsCol.findOneAndUpdate({ _id: eventId }, { $inc: { joinRevision: 1 } }, { session });
            if (!event) return false;
            await joinsCol.insertOne({ eventId, userEmail: req.user.email,
                joinedAt: new Date() }, { session });
            return true;
        }));
        if (!found) return res.status(404).send({ message: "Event not found." });
        res.status(201).send({ message: "You joined this event." });
    } catch (err) {
        if (err.code === 11000)
            return res.status(409).send({ message: "You have already joined this event." });
        console.error(err);
        res.status(500).send({ message: "Failed to join event." });
    }
});

export default router;
