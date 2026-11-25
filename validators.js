import { ObjectId } from "mongodb";

export const EVENT_TYPES = ["Iftar Packet", "Sehri Meal", "Food Pack", "Water & Dates", "Eid Gift"];

// returns an error message, or null if the event is fine
export const validateEvent = (body) => {
    if (!body || typeof body !== "object" || Array.isArray(body)) return "Event data must be an object.";
    const { title, description, eventType, thumbnail, location, eventDate } = body;
    if ([title, description, thumbnail, location, eventDate].some((value) => typeof value !== "string"))
        return "Title, description, image URL, location and date must be text.";
    if (!title.trim()) return "Title is required.";
    if (!description.trim()) return "Description is required.";
    if (!EVENT_TYPES.includes(eventType)) return "Please choose a valid event type.";
    if (!thumbnail || !/^https?:\/\/.+/i.test(thumbnail)) return "Thumbnail must be a valid image URL.";
    if (!location?.trim()) return "Location is required.";
    const date = new Date(eventDate);
    if (Number.isNaN(date.getTime())) return "Event date is invalid.";
    if (date <= new Date()) return "Event date must be in the future.";
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
});

export const validId = (id) => ObjectId.isValid(id);
