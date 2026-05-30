import { describe, it, expect, vi } from "vitest";
import { registerUserDataTools } from "../src/tools/userdata.js";
import type { JellyfinClient } from "../src/client.js";

interface CapturedTool {
  name: string;
  handler: (args: Record<string, unknown>) => Promise<{
    content: { type: string; text: string }[];
    isError?: boolean;
  }>;
}

function makeFakeServer(): { server: unknown; tools: Map<string, CapturedTool> } {
  const tools = new Map<string, CapturedTool>();
  const server = {
    tool: (
      name: string,
      _description: string,
      _schema: unknown,
      handler: CapturedTool["handler"],
    ) => {
      tools.set(name, { name, handler });
    },
  };
  return { server, tools };
}

describe("jellyfin_clear_continue_watching", () => {
  it("refuses without confirm and does not call the client", async () => {
    const client = {
      getResumeItems: vi.fn(),
      clearPlaybackPosition: vi.fn(),
    } as unknown as JellyfinClient;
    const { server, tools } = makeFakeServer();
    registerUserDataTools(server as never, client);

    const tool = tools.get("jellyfin_clear_continue_watching");
    expect(tool).toBeDefined();

    const result = await tool!.handler({ userId: "user-42" });

    expect(result.isError).toBe(true);
    expect(client.getResumeItems).not.toHaveBeenCalled();
    expect(client.clearPlaybackPosition).not.toHaveBeenCalled();
    expect(result.content[0].text).toContain("confirm: true");
  });

  it("clears explicit item IDs once each", async () => {
    const client = {
      getResumeItems: vi.fn(),
      clearPlaybackPosition: vi.fn().mockResolvedValue({ PlaybackPositionTicks: 0 }),
    } as unknown as JellyfinClient;
    const { server, tools } = makeFakeServer();
    registerUserDataTools(server as never, client);

    const tool = tools.get("jellyfin_clear_continue_watching");
    const result = await tool!.handler({
      userId: "user-42",
      itemIds: ["ep-1", "ep-1", "ep-2"],
      confirm: true,
    });

    expect(client.getResumeItems).not.toHaveBeenCalled();
    expect(client.clearPlaybackPosition).toHaveBeenCalledTimes(2);
    expect(client.clearPlaybackPosition).toHaveBeenNthCalledWith(1, "user-42", "ep-1");
    expect(client.clearPlaybackPosition).toHaveBeenNthCalledWith(2, "user-42", "ep-2");
    expect(JSON.parse(result.content[0].text)).toMatchObject({
      userId: "user-42",
      clearedCount: 2,
      clearedItemIds: ["ep-1", "ep-2"],
      totalResumeCount: null,
    });
  });

  it("fetches every resume queue page when item IDs are omitted", async () => {
    const client = {
      getResumeItems: vi
        .fn()
        .mockResolvedValueOnce({
          TotalRecordCount: 3,
          Items: [
            { Id: "ep-1", Name: "Episode 1", Type: "Episode" },
            { Id: "ep-2", Name: "Episode 2", Type: "Episode" },
          ],
        })
        .mockResolvedValueOnce({
          TotalRecordCount: 3,
          Items: [{ Id: "ep-3", Name: "Episode 3", Type: "Episode" }],
        }),
      clearPlaybackPosition: vi.fn().mockResolvedValue({ PlaybackPositionTicks: 0 }),
    } as unknown as JellyfinClient;
    const { server, tools } = makeFakeServer();
    registerUserDataTools(server as never, client);

    const tool = tools.get("jellyfin_clear_continue_watching");
    const result = await tool!.handler({
      userId: "user-42",
      pageSize: 2,
      confirm: true,
    });

    expect(client.getResumeItems).toHaveBeenNthCalledWith(1, "user-42", 2, 0);
    expect(client.getResumeItems).toHaveBeenNthCalledWith(2, "user-42", 2, 2);
    expect(client.clearPlaybackPosition).toHaveBeenCalledTimes(3);
    expect(JSON.parse(result.content[0].text)).toMatchObject({
      clearedCount: 3,
      totalResumeCount: 3,
    });
  });
});
