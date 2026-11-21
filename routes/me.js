import { Router } from "express";
import { eventsCol, joinsCol } from "../db.js";
import { verifyToken } from "../middleware/auth.js";

const router = Router();

router.get("/my-events", verifyToken, async (req, res) => {
    try {
        const events = await eventsCol
            .find({ creatorEmail: req.user.email })
            .sort({ eventDate: 1 })
            .toArray();
        res.send(events);
    } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Failed to fetch your events." });
    }
});

// events the user joined, soonest first
router.get("/my-joined", verifyToken, async (req, res) => {
    try {
        const result = await joinsCol
            .aggregate([
                { $match: { userEmail: req.user.email } },
                {
                    $lookup: {
                        from: "events",
                        localField: "eventId",
                        foreignField: "_id",
                        as: "event",
                    },
                },
                { $unwind: "$event" },
                { $sort: { "event.eventDate": 1 } },
            ])
            .toArray();
        res.send(result);
    } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Failed to fetch joined events." });
    }
});

export default router;
