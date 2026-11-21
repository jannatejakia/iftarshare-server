import { ObjectId } from "mongodb";

export const EVENT_TYPES = ["Iftar Packet", "Sehri Meal", "Food Pack", "Water & Dates", "Eid Gift"];

// returns an error message, or null if the event is fine
export const validateEvent = (body) => {
    const { title, description, eventType, thumbnail, location, eventDate, capacity } = body;
    if (!title?.trim() || title.trim().length < 5) return "Title must be at least 5 characters.";
    if (!description?.trim() || description.trim().length < 20)
        return "Description must be at least 20 characters.";
    if (!EVENT_TYPES.includes(eventType)) return "Please choose a valid event type.";
    if (!thumbnail || !/^https?:\/\/.+/i.test(thumbnail)) return "Thumbnail must be a valid image URL.";
    if (!location?.trim()) return "Location is required.";
    const date = new Date(eventDate);
    if (Number.isNaN(date.getTime())) return "Event date is invalid.";
    if (date <= new Date()) return "Event date must be in the future.";
    if (!Number.isInteger(Number(capacity)) || Number(capacity) < 1)
        return "Capacity must be a whole number of at least 1.";
    return null;
};

// only keep the fields we allow
export const pickEventFields = (body) => ({
    title: body.title.trim(),
    description: body.description.trim(),
    eventType: body.eventType,
    thumbnail: body.thumbnail.trim(),
    location: body.location.trim(),
    eventDate: new Date(body.eventDate),
    capacity: Number(body.capacity),
});

export const validId = (id) => ObjectId.isValid(id);
