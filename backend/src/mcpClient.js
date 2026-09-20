/**
 * Thin wrapper around Bitget's live "bitget-signal" MCP server.
 *
 * This is a public, no-auth Model Context Protocol server Bitget runs at
 * https://datahub.noxiaohao.com/mcp (the same one the `bitget-signal` skill
 * package configures for Claude Code / Codex / OpenClaw). Instead of going
 * through a terminal AI agent, we speak MCP directly from our own backend —
 * verified live on 2026-09-14 (server: market-data-mcp v1.26.0).
 *
 * One client connection is opened lazily and reused across requests.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const MCP_URL = "https://datahub.noxiaohao.com/mcp";

let clientPromise = null;

async function getClient() {
  if (!clientPromise) {
    clientPromise = (async () => {
      const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
      const client = new Client(
        { name: "thesis-room", version: "0.1.0" },
        { capabilities: {} }
      );
      await client.connect(transport);
      return client;
    })();
  }
  return clientPromise;
}

/**
 * Call one of the signal server's tools by name.
 * @param {string} name - e.g. "sentiment_index", "technical_analysis", "news_feed"
 * @param {object} args - tool-specific arguments (see TOOLS.md for shapes)
 */
export async function callSignalTool(name, args = {}) {
  const client = await getClient();
  const result = await client.callTool({ name, arguments: args });
  // Tool results come back as a `content` array; our tools return a single
  // JSON text block, so we parse that back into a normal JS object.
  const block = result.content?.[0];
  if (block?.type === "text") {
    try {
      return JSON.parse(block.text);
    } catch {
      return block.text; // some tools (e.g. errors) return plain text
    }
  }
  return result;
}

export async function listSignalTools() {
  const client = await getClient();
  const { tools } = await client.listTools();
  return tools;
}
