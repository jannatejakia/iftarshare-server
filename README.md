# IftarShare Server

Express + MongoDB API for the IftarShare events platform. Requests to protected routes must carry the BetterAuth JWT issued by the client as `Authorization: Bearer <token>`.

## Setup
```bash
cp .env.example .env     # fill in MONGODB_URI and CLIENT_URL
npm install
npm run db               # optional: local replica-set MongoDB, no install needed
npm start
```

## Routes
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/events` | public | Upcoming events. Supports `limit`, `type`, `search` |
| GET | `/events/:id` | public | One event with `joinedCount` |
| POST | `/events` | JWT | Create an event (future date only) |
| GET | `/my-events` | JWT | Events created by the caller |
| PATCH | `/events/:id` | JWT, owner | Update an event |
| DELETE | `/events/:id` | JWT, owner | Delete an event and its joins |
| POST | `/events/:id/join` | JWT | Join an event (once, capacity enforced) |
| GET | `/my-joined` | JWT | Events the caller joined, sorted by date |

The creator email is always taken from the verified token, never from the request body.

Protected event operations verify the caller's JWT and enforce creator ownership for updates and deletion. Joining also prevents duplicate registrations and checks the event date and capacity before storing the join record.
