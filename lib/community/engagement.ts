// Match reactions, polls and pinned notices. Staff actions take the verified user
// and check the role here as well as in the route.

import { randomBytes } from "node:crypto"
import { ApiError, assertRole, type AuthedUser } from "@/lib/api-auth"
import type { DocDb, DocTx } from "@/lib/doc-db"
import { assertNotSanctioned, assertScopeAccess, chatPath, messagesPath, reactionPath, readSanction, type ChatRoomState, type ReportScope, type StoredMessage } from "./chat"
import { assertId, cleanMessage, MATCH_ID, MESSAGE_ID, ROOM_ID } from "./content"
import { requireAccepted } from "./gate"
import { assertRoomOpen, roomPath, type Room } from "./rooms"

export const REACTIONS = ["like", "love", "laugh", "wow", "fire", "sad"] as const
export type Reaction = (typeof REACTIONS)[number]

export const MAX_POLL_OPTIONS = 4
const MAX_POLL_OPTION_LENGTH = 80
const MAX_POLL_QUESTION_LENGTH = 140

export interface StoredReaction {
  uid: string
  scope: ReportScope
  scopeId: string
  messageId: string
  reaction: Reaction
  createdAtUTC: string
}

export interface MatchPoll {
  matchId: string
  question: string
  options: string[]
  status: "open" | "closed"
  createdBy: string
  createdAtUTC: string
}

export interface PollVote {
  uid: string
  pollId: string
  matchId: string
  option: number
  /** A single field to count on: one equality filter never needs a composite index. */
  tally: string
  createdAtUTC: string
}

const pollPath = (id: string) => `match_polls/${id}`
const votePath = (pollId: string, uid: string) => `poll_votes/${pollId}_${uid}`
const tallyKey = (pollId: string, option: number) => `${pollId}_${option}`

async function assertChatOpen(tx: Pick<DocTx, "get">, scope: ReportScope, scopeId: string, now: Date): Promise<void> {
  if (scope === "room") {
    await assertRoomOpen(tx, await tx.get<Room>(roomPath(scopeId)), now)
    return
  }
  if ((await tx.get<ChatRoomState>(chatPath(scopeId)))?.locked) throw new ApiError(423, "room_locked", "This chat is locked")
}

/** One reaction per person per message: the same choice takes it back, another replaces it. */
export async function reactToMessage(
  db: DocDb,
  input: { scope: ReportScope; scopeId: string; messageId: string; uid: string; reaction: unknown },
  now: Date,
): Promise<{ reaction: Reaction | null }> {
  const { scope, scopeId, messageId, uid } = input
  assertId(scopeId, scope === "match" ? MATCH_ID : ROOM_ID)
  assertId(messageId, MESSAGE_ID)
  if (!REACTIONS.includes(input.reaction as Reaction)) throw new ApiError(400, "invalid_reaction", "Choose a reaction")
  const reaction = input.reaction as Reaction
  const messagePath = `${messagesPath(scope, scopeId)}/${messageId}`
  const path = reactionPath(scopeId, messageId, uid)

  return db.transaction(async (tx) => {
    await assertScopeAccess(tx, scope, scopeId, uid)
    await requireAccepted(tx, uid)
    assertNotSanctioned(await readSanction(tx, uid), now, "participate")
    await assertChatOpen(tx, scope, scopeId, now)
    const message = await tx.get<StoredMessage>(messagePath)
    if (!message || message.removed || message.formerMember) throw new ApiError(404, "not_found", "Not found")
    const existing = await tx.get<StoredReaction>(path)

    const counts = { ...message.reactionCounts }
    if (existing) counts[existing.reaction] = Math.max(0, (counts[existing.reaction] ?? 0) - 1)
    const takenBack = existing?.reaction === reaction
    if (takenBack) tx.delete(path)
    else {
      counts[reaction] = (counts[reaction] ?? 0) + 1
      const stored: StoredReaction = { uid, scope, scopeId, messageId, reaction, createdAtUTC: now.toISOString() }
      tx.set(path, stored)
    }
    tx.set(messagePath, { reactionCounts: counts }, { merge: true })
    return { reaction: takenBack ? null : reaction }
  })
}

export async function createPoll(db: DocDb, actor: AuthedUser, input: { matchId: string; question: string; options: string[] }, now: Date) {
  assertRole(actor, "moderator")
  const question = cleanMessage(input.question)
  const options = input.options.map(cleanMessage)
  if ([...question].length > MAX_POLL_QUESTION_LENGTH || options.some((option) => [...option].length > MAX_POLL_OPTION_LENGTH)) {
    throw new ApiError(400, "invalid_poll", "This poll is too long")
  }
  if (options.length < 2 || options.length > MAX_POLL_OPTIONS || new Set(options).size !== options.length) {
    throw new ApiError(400, "invalid_poll", "A poll needs two to four different options")
  }

  return db.transaction(async (tx) => {
    const open = await tx.query<MatchPoll>("match_polls", { where: [["matchId", input.matchId], ["status", "open"]], limit: 1 })
    if (open.length) throw new ApiError(409, "poll_open", "Close the current poll first")
    const id = randomBytes(12).toString("hex")
    const poll: MatchPoll = { matchId: input.matchId, question, options, status: "open", createdBy: actor.uid, createdAtUTC: now.toISOString() }
    tx.set(pollPath(id), poll)
    return { id }
  })
}

export async function closePoll(db: DocDb, actor: AuthedUser, input: { matchId: string }): Promise<void> {
  assertRole(actor, "moderator")
  await db.transaction(async (tx) => {
    const open = await tx.query<MatchPoll>("match_polls", { where: [["matchId", input.matchId], ["status", "open"]], limit: 1 })
    if (!open.length) throw new ApiError(404, "not_found", "There is no open poll")
    tx.set(pollPath(open[0].id), { status: "closed" }, { merge: true })
  })
}

/** Votes never touch the poll document, so a busy poll does not hit a per-document write limit. */
export async function voteInPoll(db: DocDb, input: { matchId: string; uid: string; option: unknown }, now: Date): Promise<void> {
  const { matchId, uid, option } = input
  await db.transaction(async (tx) => {
    await requireAccepted(tx, uid)
    assertNotSanctioned(await readSanction(tx, uid), now, "participate")
    await assertChatOpen(tx, "match", matchId, now)
    const [poll] = await tx.query<MatchPoll>("match_polls", { where: [["matchId", matchId], ["status", "open"]], limit: 1 })
    if (!poll) throw new ApiError(409, "poll_closed", "This poll is closed")
    if (!Number.isInteger(option) || (option as number) < 0 || (option as number) >= poll.options.length) {
      throw new ApiError(400, "invalid_vote", "Choose an option")
    }
    if (await tx.get(votePath(poll.id, uid))) throw new ApiError(409, "already_voted", "You already voted in this poll")
    const vote: PollVote = { uid, pollId: poll.id, matchId, option: option as number, tally: tallyKey(poll.id, option as number), createdAtUTC: now.toISOString() }
    tx.set(votePath(poll.id, uid), vote)
  })
}

export async function setPinnedNotice(db: DocDb, actor: AuthedUser, input: { matchId: string; text: string | null }, now: Date): Promise<void> {
  assertRole(actor, "moderator")
  const notice = input.text === null ? null : { text: cleanMessage(input.text), by: actor.uid, pinnedAtUTC: now.toISOString() }
  await db.set(chatPath(input.matchId), { notice }, { merge: true })
}

/** What every reader of a match chat sees besides the messages. Staff uids stay out of it. */
export async function getMatchChatState(db: Pick<DocDb, "get" | "query" | "count">, matchId: string, viewerUid: string | null) {
  const chat = await db.get<ChatRoomState>(chatPath(matchId))
  const polls = await db.query<MatchPoll>("match_polls", { where: [["matchId", matchId]] })
  const poll = polls.sort((a, b) => b.createdAtUTC.localeCompare(a.createdAtUTC))[0] ?? null
  const votes = poll ? await Promise.all(poll.options.map((_, option) => db.count("poll_votes", { where: [["tally", tallyKey(poll.id, option)]] }))) : []
  const mine = poll && viewerUid ? await db.get<PollVote>(votePath(poll.id, viewerUid)) : null
  const participants = await db.count("match_chat_participants", { where: [["matchId", matchId]] })
  return {
    locked: chat?.locked === true,
    participants,
    notice: chat?.notice ? { text: chat.notice.text, pinnedAtUTC: chat.notice.pinnedAtUTC } : null,
    poll: poll && {
      question: poll.question,
      open: poll.status === "open",
      options: poll.options.map((text, index) => ({ text, votes: votes[index] })),
      myVote: mine?.option ?? null,
    },
  }
}
