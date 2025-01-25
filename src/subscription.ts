import {
  OutputSchema as RepoEvent,
  isCommit,
} from './lexicon/types/com/atproto/sync/subscribeRepos'
import { FirehoseSubscriptionBase, getOpsByType } from './util/subscription'

export class FirehoseSubscription extends FirehoseSubscriptionBase {
  async handleEvent(evt: RepoEvent) {
    if (!isCommit(evt)) return

    const ops = await getOpsByType(evt)

    // This logs the text of every post off the firehose.
    // Just for fun :)
    // Delete before actually using
    for (const post of ops.posts.creates) {
      //console.log(post.author, post.record.text)
    }

    const postsToDelete = ops.posts.deletes.map((del) => del.uri)
    const postsToCreate = (await Promise.all(ops.posts.creates.map(async (create) => {
      await this.registerUserIfNotExists(create.author)
      return {
        value: create,
        include: await this.getUserIsNormal(create.author),
      }})))
      .filter(v => v.include)
      .map(v => v.value)
      .map((create) => {
        // map posts to a db row
        return {
          uri: create.uri,
          cid: create.cid,
          indexedAt: new Date().toISOString(),
        }
      })

    if (postsToDelete.length > 0) {
      await this.db
        .deleteFrom('post')
        .where('uri', 'in', postsToDelete)
        .execute()
    }
    if (postsToCreate.length > 0) {
      console.log("Got poosts!")
      await this.db
        .insertInto('post')
        .values(postsToCreate)
        .onConflict((oc) => oc.doNothing())
        .execute()
    }
  }

  async getUserIsNormal(id: string) {
    return await this.db
      .selectFrom('user').select(['normal'])
      .where('id', '=', id)
      .execute()[0]?.normal === 1
  }

  async registerUserIfNotExists(id: string) {
    await this.db
      .insertInto('user')
      .values([{ id, normal: 0, lastUpdatedAt: new Date().toISOString(), lastActiveAt: new Date().toISOString() }])
      .onConflict((oc) => oc.doNothing())
      .execute()
  }
}
