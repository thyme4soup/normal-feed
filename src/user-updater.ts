import { Database } from './db'
import { AtpAgent } from "@atproto/api";

export const agent = new AtpAgent({
  service: "https://api.bsky.app",
});

export class UserUpdater {
  public db: Database

  constructor(db: Database) {
    this.db = db
  }
  async removeUser(id: string) {
    await this.db.deleteFrom("user")
      .where("id", "=", id)
      .execute();
  }
  async writeUserUpdate(userId, isNormal) {
    await this.db.insertInto("user")
    .values({
      id: userId,
      normal: isNormal? 1 : 0,
      lastUpdatedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    })
    .onConflict((oc) => oc.doUpdateSet({
      normal: isNormal? 1 : 0,
      lastUpdatedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    }))
    .execute();
  }
  async getUserPosts(userAt) {
    const response = await agent.getAuthorFeed({
      actor: userAt,
      filter: "posts_no_replies",
      limit: 10,
    });
    return response.data.feed;
  }
  async getUserIsNormal(id: string) {
    return await this.db
      .selectFrom('user').select(['normal'])
      .where('id', '=', id)
      .execute()[0]?.normal === 1
  }
  async updateUser(user) {
    let response;
    try {
      response = await agent.getProfile({ actor: user.id});
    } catch (e) {
      console.error(e);
      if (e instanceof Error && e.message.includes("Profile not found")) {
        console.log("Profile is missing, removing user", user.id);
        await this.removeUser(user.id);
        return;
      } else {
        await this.writeUserUpdate(user.id, false);
      }
    }
    let isNormal = false;
    if (response === undefined) {
      console.log("Profile not found, not-normal until proved innocent");
      return;
    }
    const createdAt = Date.parse(response.data.createdAt!);
    if (createdAt > new Date().getTime() - 1000 * 60 * 60 * 24 * 7) {
      await this.writeUserUpdate(user.id, false);
      return;
    }
    if (response.data.followersCount! > 1000) {
      await this.writeUserUpdate(user.id, false);
      return;
    }
    const posts = await this.getUserPosts(response.data.handle!) as any[];
    if (posts === undefined || posts.length === 0) {
      console.log("no posts found for", response.data.handle!);
      await this.writeUserUpdate(user.id, false);
      return;
    }
    const oldPostAt = Date.parse(posts[posts.length - 1].post.indexedAt!);
    console.log("old post at", oldPostAt, "with", posts.length, "posts");
    if (posts.length >= 10 && oldPostAt > new Date().getTime() - 1000 * 60 * 60 * 24 * 10) {
      console.log(response.data.handle!, "posts too much");
      await this.writeUserUpdate(user.id, false);
      return;
    }
    if (await this.getUserIsNormal(user.id)) {
      await this.writeUserUpdate(user.id, true);
      return;
    } else {
      console.log("updating", response.data.handle!, "to normal");
      await this.writeUserUpdate(user.id, true);
      await this.addPosts(posts);
    }
  }
  async getUserToExamine() {
    const users = await this.db.selectFrom("user")
    .select(['id'])
    .orderBy('lastUpdatedAt', 'asc')
    .limit(1)
    .execute();
    if (users === undefined || users.length === 0) {
      throw new Error("No users to examine");
    }
    else {
      return users[0];
    }
  }
  async addPosts(posts) {
    posts.forEach(async (post) => {
      if (post.reason !== undefined) {
        // skip repost events
        return;
      }
      await this.db.insertInto("post")
        .values({
          uri: post.post.uri,
          cid: post.post.cid,
          indexedAt: new Date(Date.parse(post.post.indexedAt)).toISOString(),
        })
        .onConflict((oc) => oc.doNothing())
        .execute();
    });
  }
  async reapPosts() {
    await this.db.deleteFrom("post")
      .where("indexedAt", "<", `${new Date().getTime() - 1000 * 60 * 60 * 24 * 2}`)
      .execute();
  }
  async reapUsers() {
    await this.db.deleteFrom("user")
      .where("lastActiveAt", "<", `${new Date().getTime() - 1000 * 60 * 60 * 24 * 30}`)
  }
  async userMonitorLoop() {
    try {
      const user = await this.getUserToExamine();
      await this.updateUser(user);
    } catch (e) {
      console.error(e);
    }
    setTimeout(async () => {
      await this.userMonitorLoop();
    }, 1000);
  }
  async postReaperLoop() {
    try {
      await this.reapPosts();
    } catch (e) {
      console.error(e);
    }
    setTimeout(async () => {
      await this.postReaperLoop();
    }, 1000);
  }
  async userReaperLoop() {
    try {
    } catch (e) {
      console.error(e);
    }
    setTimeout(async () => {
      await this.userReaperLoop();
    }, 1000);
  }

  async start(): Promise<void> {
    setTimeout(async () => {
      await this.userMonitorLoop();
      await this.postReaperLoop();
      await this.userReaperLoop();
    }, 1000);
    return Promise.resolve();
  }
}
