// Community-scoped delete delegation. When content (post, comment, poll) is
// created, its author grants the community owner + current moderators `delete` on
// the node — scoped to that community, never global. Best-effort and cooperative.
import { db } from "../db/gdb.js";
import { activeAddress } from "./identity.js";

/** Grant `delete` on `nodeId` to the community's owner + moderators (skips self). */
export async function grantCommunityModerators(nodeId, communityId) {
  if (!communityId) return;
  const me = activeAddress();
  const { result } = await db.get(communityId);
  const value = result?.value;
  if (!value) return;

  const targets = new Set();
  const owner = value.owner || value.creatorId;
  if (owner) targets.add(owner);
  if (Array.isArray(value.moderators)) value.moderators.forEach((m) => m && targets.add(m));

  for (const addr of targets) {
    if (!me || addr.toLowerCase() === me.toLowerCase()) continue;
    try {
      await db.sm.acls.grant(nodeId, addr, "delete");
    } catch {
      /* best-effort, cooperative */
    }
  }
}
