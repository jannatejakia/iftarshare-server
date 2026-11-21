import { Router } from "express";
import { ObjectId } from "mongodb";
import { eventsCol, joinsCol } from "../db.js";
import { verifyToken } from "../middleware/auth.js";
import { validateEvent, pickEventFields, validId } from "../validators.js";

const router = Router();

// only upcoming events. Optional: ?limit=6&type=...&search=...
router.get("/", async (req, res) => {
    try {
        const { limit, type, search } = req.query;
        const filter = { eventDate: { $gt: new Date() } };
        if (type) filter.eventType = type;
        if (search) {
            const rx = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
            filter.$or = [{ title: rx }, { location: rx }];
        }

        let cursor = eventsCol.find(filter).sort({ eventDate: 1 });
        if (limit) cursor = cursor.limit(Math.min(Number(limit) || 6, 50));
        res.send(await cursor.toArray());
    } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Failed to fetch events." });
    }
});

router.get("/:id", async (req, res) => {
    if (!validId(req.params.id)) return res.status(400).send({ message: "Invalid event ID." });
    try {
        const event = await eventsCol.findOne({ _id: new ObjectId(req.params.id) });
        if (!event) return res.status(404).send({ message: "Event not found." });
        const joined = await joinsCol.countDocuments({ eventId: event._id });
        res.send({ ...event, joinedCount: joined });
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
            creatorName: req.user.name ?? "",
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
            { _id: new ObjectId(req.params.id), creatorEmail: req.user.email }, // ownership check
            { $set: { ...pickEventFields(req.body), updatedAt: new Date() } }
        );
        if (result.matchedCount === 0)
            return res.status(403).send({ message: "You can only update your own events." });
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
        const result = await eventsCol.deleteOne({ _id, creatorEmail: req.user.email });
        if (result.deletedCount === 0)
            return res.status(403).send({ message: "You can only delete your own events." });
        await joinsCol.deleteMany({ eventId: _id });
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
        const event = await eventsCol.findOne({ _id: eventId });
        if (!event) return res.status(404).send({ message: "Event not found." });
        if (event.eventDate <= new Date())
            return res.status(400).send({ message: "This event has already passed." });
        if (event.creatorEmail === req.user.email)
            return res.status(400).send({ message: "You cannot join your own event." });

        const joined = await joinsCol.countDocuments({ eventId });
        if (joined >= event.capacity)
            return res.status(400).send({ message: "This event is full." });

        await joinsCol.insertOne({
            eventId,
            userEmail: req.user.email,
            userName: req.user.name ?? "",
            joinedAt: new Date(),
        });
        res.status(201).send({ message: "You joined this event." });
    } catch (err) {
        if (err.code === 11000)
            return res.status(409).send({ message: "You have already joined this event." });
        console.error(err);
        res.status(500).send({ message: "Failed to join event." });
    }
});

export default router;
