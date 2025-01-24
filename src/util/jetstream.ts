import { WebSocket } from 'ws';
import * as zstd from 'zstd-napi';

// read jsons over wss
const dictionary_url = "https://github.com/bluesky-social/jetstream/raw/refs/heads/main/pkg/models/zstd_dictionary";
const wss = "wss://jetstream2.us-west.bsky.network/subscribe?wantedCollections=app.bsky.feed.post&compress=true";

let ws;
let db;
const decompress = new zstd.Decompressor();
decompress.setParameters({windowLogMax: 24});
const onopen = function () {
    console.log("Connected to " + wss);
};
const onmessage = (db) => async function (event) {
    event = decompress.decompress(new Uint8Array(event.data));
    let eventJSON = JSON.parse(event);
    //console.log(eventJSON);
    try {
        if (eventJSON.kind !== "commit") {
            // skip non-commit events
            return;
        }
        if (eventJSON.commit.operation !== "create") {
            // skip non-create events
            return;
        }
        if (eventJSON.commit.record.reply !== undefined) {
            // skip reply events
            return;
        }
        await registerUserIfNotExists(db, eventJSON.did);
        if(await getUserIsNormal(db, eventJSON.did)) {
            await db
                .insertInto('post')
                .values({
                    uri: `at://${eventJSON.did}/${eventJSON.commit.collection}/${eventJSON.commit.rkey}`,
                    cid: eventJSON.commit.cid,
                    indexedAt: new Date().toISOString(),
                })
                .onConflict((oc) => oc.doNothing())
                .execute()
        }
    } catch (e) {
        console.log("Error processing event", eventJSON);
        console.error(e);
    }
};
const onclose = function () {
    console.log("Disconnected from " + wss);
    console.log("Reconnecting in 3 seconds...");
    setTimeout(() => ws = new WebSocket(wss, {headers: {"Socket-Encoding": "ztsd"}}), 3000);
};

async function getUserIsNormal(db, id: string) {
    return await db
      .selectFrom('user').select(['normal'])
      .where('id', '=', id)
      .execute()[0]?.normal === 1
}

async function registerUserIfNotExists(db, id: string) {
    await db
        .insertInto('user')
        .values([{ id, normal: 0, lastUpdatedAt: new Date().toISOString(), lastActiveAt: new Date().toISOString() }])
        .onConflict((oc) => oc.doUpdateSet({ lastActiveAt: new Date().toISOString() }))
        .execute()
}

export async function start(db) {
    // wait for ws to connect
    const dictionary = await fetch(dictionary_url).then(res => res.ok ? res.arrayBuffer() : null);
    if (!dictionary) {
        throw new Error("Failed to download dictionary");
    }
    decompress.loadDictionary(new Uint8Array(dictionary));
    ws = new WebSocket(wss, {headers: {"Socket-Encoding": "ztsd"}});
    ws.onopen = onopen;
    ws.onmessage = onmessage(db);
    ws.onclose = onclose;
    await new Promise((resolve) => ws.onopen = resolve);

    console.log("Subscribed to bsky jetstream");
    return ws;
}