import { Database } from './db'
import { AtpAgent } from "@atproto/api";
import { privateEncrypt } from 'crypto';

export const agent = new AtpAgent({
  service: "https://api.bsky.app",
});

export class UserUpdater {
  public db: Database

  constructor(db: Database) {
    this.db = db
  }
  async writeUserUpdate(userId, isNormal) {
    await this.db.insertInto("user")
    .values({
      id: userId,
      normal: isNormal? 1 : 0,
      lastUpdatedAt: new Date().toISOString(),
    })
    .onConflict((oc) => oc.doUpdateSet({
      normal: isNormal? 1 : 0,
      lastUpdatedAt: new Date().toISOString(),
    }))
    .execute();
  }
  async getUserPosts(userAt) {
    const response = await agent.getAuthorFeed({
      actor: userAt,
      limit: 50,
    });
    return response.data.feed;
  }
  async updateUser(user) {
    const response = await agent.getProfile({ actor: user.id});
    let isNormal = false;
    if (response === undefined) {
      console.log("profile not found");
      return;
    }
    if (response.data.followersCount! > 1000) {
      await this.writeUserUpdate(user.id, false);
      return;
    }
    const posts = await this.getUserPosts(response.data.handle!) as any[];
    const oldPostAt = Date.parse(posts[posts.length - 1].post.indexedAt!);
    if (posts.length >= 50 && oldPostAt > new Date().getTime() - 1000 * 60 * 60 * 24 * 30) {
      await this.writeUserUpdate(user.id, false);
      return;
    }
    await this.writeUserUpdate(user.id, true);
    console.log("updated", response.data.handle!, " to normal");
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
  async loop() {
    try {
      const user = await this.getUserToExamine();
      await this.updateUser(user);
    } catch (e) {
      console.error(e);
    }
    setTimeout(async () => {
      await this.loop();
    }, 1000);
  }

  async start(): Promise<void> {
    setTimeout(async () => {
      await this.loop();
    }, 1000);
    return Promise.resolve();
  }
}