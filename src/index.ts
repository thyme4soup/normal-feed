import dotenv from 'dotenv'
import FeedGenerator from './server'
import { UserUpdater } from './user-updater'
import * as jetstream from './util/jetstream'
import { createDb, migrateToLatest } from './db'

const run = async () => {
  dotenv.config()
  /*
  const hostname = maybeStr(process.env.FEEDGEN_HOSTNAME) ?? 'example.com'
  const serviceDid =
    maybeStr(process.env.FEEDGEN_SERVICE_DID) ?? `did:web:${hostname}`
  const server = FeedGenerator.create({
    port: maybeInt(process.env.FEEDGEN_PORT) ?? 3000,
    listenhost: maybeStr(process.env.FEEDGEN_LISTENHOST) ?? 'localhost',
    sqliteLocation: maybeStr(process.env.FEEDGEN_SQLITE_LOCATION) ?? ':memory:',
    subscriptionEndpoint:
      maybeStr(process.env.FEEDGEN_SUBSCRIPTION_ENDPOINT) ??
      'wss://bsky.network',
    publisherDid:
      maybeStr(process.env.FEEDGEN_PUBLISHER_DID) ?? 'did:example:alice',
    subscriptionReconnectDelay:
      maybeInt(process.env.FEEDGEN_SUBSCRIPTION_RECONNECT_DELAY) ?? 3000,
    hostname,
    serviceDid,
  })
  */
  const db = createDb(':memory:');
  migrateToLatest(db);
  await jetstream.start(db);
  const userUpdater = new UserUpdater(db);
  userUpdater.start();
  const server = FeedGenerator.create({
    port: 3000,
    listenhost: 'localhost',
    publisherDid: 'did:example:alice',
    subscriptionReconnectDelay: 3000,
    hostname: 'example.com',
    serviceDid: 'did:web:example.com',
  }, db);
  await server.start();
}

const maybeStr = (val?: string) => {
  if (!val) return undefined
  return val
}

const maybeInt = (val?: string) => {
  if (!val) return undefined
  const int = parseInt(val, 10)
  if (isNaN(int)) return undefined
  return int
}

run()
