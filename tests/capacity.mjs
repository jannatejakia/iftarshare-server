// Integration check: requires the configured development MongoDB replica set.
import assert from 'node:assert/strict';
import router from '../routes/events.js';
import { client, eventsCol, joinsCol } from '../db.js';
import { ObjectId } from 'mongodb';

const id = new ObjectId();
const owner = 'capacity-test-owner@example.invalid';
async function invoke(method, path, body, email) {
    const layer = router.stack.find(l => l.route?.path === path && l.route.methods[method]);
    const handler = layer.route.stack.at(-1).handle;
    let status = 200;
    const res = { status(n) { status = n; return this; }, send() { return this; } };
    await handler({ params: { id: String(id) }, body, user: { email, name: 'Capacity test' } }, res);
    return status;
}
const body = {
    title: 'Temporary capacity test', description: 'Temporary record for concurrency verification.',
    eventType: 'Food Pack', thumbnail: 'https://example.com/test.jpg', location: 'Test',
    eventDate: new Date(Date.now() + 86400000).toISOString(), capacity: 1,
};
try {
    await eventsCol.insertOne({ _id: id, ...body, eventDate: new Date(body.eventDate), creatorEmail: owner });
    const users = ['capacity-test-a@example.invalid', 'capacity-test-b@example.invalid'];
    const outcomes = await Promise.all(users.map(email => invoke('post', '/:id/join', {}, email)));
    assert.deepEqual([...outcomes].sort(), [201, 400]);
    assert.equal(await joinsCol.countDocuments({ eventId: id }), 1);
    await eventsCol.updateOne({ _id: id }, { $set: { capacity: 2 } });
    assert.equal(await invoke('post', '/:id/join', {}, users[outcomes.indexOf(400)]), 201);
    assert.equal(await invoke('patch', '/:id', { ...body, capacity: 1 }, owner), 400);
    assert.equal(await invoke('delete', '/:id', {}, owner), 200);
    assert.equal(await joinsCol.countDocuments({ eventId: id }), 0);
    console.log('Concurrent joins, capacity reduction and transactional deletion passed.');
} finally {
    await joinsCol.deleteMany({ eventId: id });
    await eventsCol.deleteOne({ _id: id });
    await client.close();
}
