// Run manually against the IftarShare production deployment.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';
config({ path: '.env.production.local', quiet: true });
const web = 'https://iftarshare-client.vercel.app';
const api = 'https://iftarshare-server.vercel.app';
const suffix = randomUUID();
const emails = [`owner-${suffix}@example.invalid`, `guest-${suffix}@example.invalid`];
const mongo = new MongoClient(process.env.MONGODB_URI);
let eventId;
async function account(email) {
    const response = await fetch(`${web}/api/auth/sign-up/email`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Origin: web },
        body: JSON.stringify({ name: 'Deployment test', email, password: 'Aa9x2q' }),
    });
    assert.equal(response.status, 200, `Registration status ${response.status}`);
    const cookie = response.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
    assert.ok(cookie, 'Registration sets a session cookie');
    const tokenResponse = await fetch(`${web}/api/auth/token`, { headers: { Cookie: cookie } });
    if (tokenResponse.status !== 200) {
        console.log('Session cookie names:', response.headers.getSetCookie().map(c => c.split('=')[0]));
        console.log('Token endpoint error:', await tokenResponse.text());
    }
    assert.equal(tokenResponse.status, 200);
    const { token } = await tokenResponse.json();
    assert.ok(token);
    const privatePage = await fetch(`${web}/manage-events`, { headers: { Cookie: cookie }, redirect: 'manual' });
    assert.equal(privatePage.status, 200, 'Authenticated private route reload');
    return { token, cookie };
}
async function request(path, token, method = 'GET', body) {
    const response = await fetch(`${api}${path}`, {
        method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    return { status: response.status, data };
}
try {
    await mongo.connect();
    const anonymous = await fetch(`${web}/manage-events`, { redirect: 'manual' });
    assert.ok([302, 307].includes(anonymous.status));
    const owner = await account(emails[0]);
    const guest = await account(emails[1]);
    const event = { title: 'Temporary deployment verification', description: 'Temporary integration check; removed automatically.',
        eventType: 'Food Pack', thumbnail: 'https://example.com/test.jpg', location: 'Dhaka',
        eventDate: new Date(Date.now() + 86400000).toISOString(), capacity: 2 };
    const created = await request('/events', owner.token, 'POST', event);
    assert.equal(created.status, 201, JSON.stringify(created.data));
    eventId = created.data.insertedId;
    assert.equal((await request(`/events/${eventId}/join`, guest.token, 'POST')).status, 201);
    assert.equal((await request(`/events/${eventId}/join`, guest.token, 'POST')).status, 409);
    const joined = await request('/my-joined', guest.token);
    assert.ok(joined.data.some(j => j.event._id === eventId));
    assert.equal((await request(`/events/${eventId}`, guest.token, 'PATCH', event)).status, 403);
    assert.equal((await request(`/events/${eventId}`, owner.token, 'PATCH', { ...event, capacity: 3 })).status, 200);
    assert.equal((await request(`/events/${eventId}`, owner.token, 'DELETE')).status, 200);
    const login = await fetch(`${web}/api/auth/sign-in/email`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Origin: web },
        body: JSON.stringify({ email: emails[0], password: 'Aa9x2q' }),
    });
    assert.equal(login.status, 200);
    console.log('PASS: registration (6 chars), login, private route reload, JWT, event CRUD, join, duplicate and ownership guards.');
} finally {
    const db = mongo.db('iftarshareDB');
    if (eventId) {
        await db.collection('joins').deleteMany({ eventId: new ObjectId(eventId) });
        await db.collection('events').deleteOne({ _id: new ObjectId(eventId) });
    }
    const auth = mongo.db('iftarshareAuthDB');
    const users = await auth.collection('user').find({ email: { $in: emails } }).toArray();
    const ids = users.flatMap(u => [u._id, String(u._id), ...(u.id ? [u.id] : [])]);
    await auth.collection('session').deleteMany({ userId: { $in: ids } });
    await auth.collection('account').deleteMany({ userId: { $in: ids } });
    await auth.collection('user').deleteMany({ email: { $in: emails } });
    await mongo.close();
}
