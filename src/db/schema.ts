export type DatabaseSchema = {
  post: Post
  sub_state: SubState
  user: User
}

export type Post = {
  uri: string
  cid: string
  indexedAt: string
}

export type SubState = {
  service: string
  cursor: number
}

export type User = {
  id: string
  normal: number
  lastUpdatedAt: string
  lastActiveAt: string
}