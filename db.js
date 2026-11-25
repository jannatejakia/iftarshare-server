import "dotenv/config";
import { MongoClient } from "mongodb";

export const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();

export const db = client.db("iftarshareDB");
export const eventsCol = db.collection("events");
export const joinsCol = db.collection("joins");

// one join per user per event
await joinsCol.createIndex({ eventId: 1, userEmail: 1 }, { unique: true });
