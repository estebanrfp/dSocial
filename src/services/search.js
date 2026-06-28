// Field-level full-text search via GenosDB's native `$text` operator. Each type
// is queried with an `$or` over its searchable fields, scoped by `type`. $text is
// accent-folded and matches whole words within a field.
import { db } from "../db/gdb.js";
import { TYPE } from "../db/schema.js";

async function searchType(type, fields, query) {
  const q = { type, $or: fields.map((f) => ({ [f]: { $text: query } })) };
  const { results } = await db.map({ query: q });
  return results.map((n) => n.value);
}

/** Search communities, posts, polls and people at once. Returns grouped matches. */
export async function searchAll(query) {
  const q = String(query).trim();
  if (q.length < 2) return { communities: [], posts: [], polls: [], users: [] };
  const [communities, posts, polls, users] = await Promise.all([
    searchType(TYPE.community, ["name", "displayName", "description"], q),
    searchType(TYPE.post, ["title", "content"], q),
    searchType(TYPE.poll, ["question", "description"], q),
    searchType(TYPE.user, ["displayName", "bio"], q),
  ]);
  return { communities, posts, polls, users };
}
