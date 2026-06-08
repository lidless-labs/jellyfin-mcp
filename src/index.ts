import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getConfig } from "./config.js";
import { JellyfinClient } from "./client.js";
import { registerSystemTools } from "./tools/system.js";
import { registerLibraryTools } from "./tools/libraries.js";
import { registerUserTools } from "./tools/users.js";
import { registerSessionTools } from "./tools/sessions.js";
import { registerItemTools } from "./tools/items.js";
import { registerTaskTools } from "./tools/tasks.js";
import { registerUserDataTools } from "./tools/userdata.js";
import { registerPlaylistTools } from "./tools/playlists.js";
import { registerCollectionTools } from "./tools/collections.js";
import { registerDiscoveryTools } from "./tools/discovery.js";
import { registerQuickConnectTools } from "./tools/quickconnect.js";

async function main(): Promise<void> {
  const config = getConfig();

  // TLS verification skipping (when JELLYFIN_VERIFY_SSL=false) is scoped to the
  // Jellyfin connection inside JellyfinClient via a per-instance undici
  // dispatcher. We deliberately do NOT set NODE_TLS_REJECT_UNAUTHORIZED, which
  // would disable certificate validation for every outbound TLS connection in
  // the process.

  const server = new McpServer({
    name: "jellyfin-mcp",
    version: "0.3.0",
    description:
      "MCP server for Jellyfin: control playback sessions (pause/resume/seek/volume/cast), manage users and libraries, mark watched/favorite, manage Continue Watching and resume state, manage playlists and collections, run scheduled tasks, query content, discover resume/next-up/similar items, authorize Quick Connect codes, and inspect activity logs.",
  });

  const client = new JellyfinClient(config);

  registerSystemTools(server, client);
  registerLibraryTools(server, client);
  registerUserTools(server, client);
  registerSessionTools(server, client);
  registerItemTools(server, client);
  registerTaskTools(server, client);
  registerUserDataTools(server, client);
  registerPlaylistTools(server, client);
  registerCollectionTools(server, client);
  registerDiscoveryTools(server, client);
  registerQuickConnectTools(server, client);

  const transport = new StdioServerTransport();
  // Strip the draft-07 `$schema` the MCP SDK stamps on tool schemas; Anthropic
  // rejects it ("must match JSON Schema draft 2020-12") when the full tool set
  // is sent, e.g. on subagent spawns. Intercept tools/list output here.
  const __send = transport.send.bind(transport);
  (transport as any).send = (message: any) => {
    const tools = message?.result?.tools;
    if (Array.isArray(tools)) {
      for (const t of tools) {
        if (t?.inputSchema) delete t.inputSchema.$schema;
        if (t?.outputSchema) delete t.outputSchema.$schema;
      }
    }
    return __send(message);
  };
  await server.connect(transport);
}

main().catch((error: unknown) => {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`jellyfin-mcp fatal: ${msg}`);
  process.exit(1);
});
