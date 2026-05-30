import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { JellyfinClient } from "../client.js";
import { ok, fail, refuseUnconfirmed } from "./_util.js";

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter((id) => id.length > 0))];
}

export function registerUserDataTools(server: McpServer, client: JellyfinClient): void {
  server.tool(
    "jellyfin_clear_continue_watching",
    "Clear in-progress playback positions from a user's Continue Watching / resume queue without marking items played. Omit itemIds to clear the current resume queue. Requires confirm: true.",
    {
      userId: z
        .string()
        .trim()
        .min(1)
        .describe("User ID whose Continue Watching queue should be cleared."),
      itemIds: z
        .array(z.string().trim().min(1))
        .min(1)
        .optional()
        .describe("Optional item IDs to clear. Omit to clear every item currently returned by jellyfin_get_resume_items."),
      pageSize: z
        .number()
        .int()
        .positive()
        .max(500)
        .optional()
        .default(100)
        .describe("Resume queue page size when itemIds is omitted."),
      confirm: z
        .boolean()
        .optional()
        .describe("Must be true to proceed because this changes user playback progress."),
    },
    async ({ userId, itemIds, pageSize, confirm }) => {
      if (!confirm) {
        return refuseUnconfirmed(
          `clear Continue Watching playback positions for user ${userId}`,
        );
      }

      try {
        let totalResumeCount: number | null = null;
        let ids = uniqueIds(itemIds ?? []);

        if (ids.length === 0) {
          let startIndex = 0;
          const resumeIds: string[] = [];

          while (totalResumeCount === null || startIndex < totalResumeCount) {
            const resume = await client.getResumeItems(userId, pageSize, startIndex);
            totalResumeCount = resume.TotalRecordCount;
            resumeIds.push(...resume.Items.map((item) => item.Id));
            if (resume.Items.length === 0) break;
            startIndex += resume.Items.length;
          }

          ids = uniqueIds(resumeIds);
        }

        const cleared: string[] = [];
        for (const itemId of ids) {
          await client.clearPlaybackPosition(userId, itemId);
          cleared.push(itemId);
        }

        return ok({
          userId,
          clearedCount: cleared.length,
          clearedItemIds: cleared,
          totalResumeCount,
        });
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.tool(
    "jellyfin_mark_played",
    "Mark an item as watched/played for a user. Updates resume state and play count.",
    {
      userId: z.string().describe("User ID from jellyfin_list_users"),
      itemId: z.string().describe("Item ID from a search or recent-items result"),
    },
    async ({ userId, itemId }) => {
      try {
        await client.markPlayed(userId, itemId);
        return ok({ result: `item ${itemId} marked played for user ${userId}` });
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.tool(
    "jellyfin_mark_unplayed",
    "Mark an item as unwatched/unplayed for a user.",
    {
      userId: z.string().describe("User ID from jellyfin_list_users"),
      itemId: z.string().describe("Item ID from a search or recent-items result"),
    },
    async ({ userId, itemId }) => {
      try {
        await client.markUnplayed(userId, itemId);
        return ok({ result: `item ${itemId} marked unplayed for user ${userId}` });
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.tool(
    "jellyfin_set_favorite",
    "Add an item to a user's favorites.",
    {
      userId: z.string().describe("User ID from jellyfin_list_users"),
      itemId: z.string().describe("Item ID from a search or recent-items result"),
    },
    async ({ userId, itemId }) => {
      try {
        await client.setFavorite(userId, itemId);
        return ok({ result: `item ${itemId} favorited for user ${userId}` });
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.tool(
    "jellyfin_unset_favorite",
    "Remove an item from a user's favorites.",
    {
      userId: z.string().describe("User ID from jellyfin_list_users"),
      itemId: z.string().describe("Item ID from a search or recent-items result"),
    },
    async ({ userId, itemId }) => {
      try {
        await client.unsetFavorite(userId, itemId);
        return ok({ result: `item ${itemId} unfavorited for user ${userId}` });
      } catch (error) {
        return fail(error);
      }
    },
  );
}
