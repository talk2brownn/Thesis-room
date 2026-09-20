// Quick proof-of-life: hits three real signal tools and prints what comes back.
// Run with: node src/smoketest.js
import { callSignalTool } from "./mcpClient.js";

const sentiment = await callSignalTool("sentiment_index", { action: "current" });
console.log("\n--- sentiment_index(current) ---");
console.log(sentiment);

const ta = await callSignalTool("technical_analysis", {
  action: "full_analysis",
  symbol: "BTC/USDT",
  timeframe: "4h",
});
console.log("\n--- technical_analysis(full_analysis, BTC/USDT) ---");
console.log(ta);

const news = await callSignalTool("news_feed", {
  action: "latest",
  feeds: "cointelegraph,coindesk",
  limit: 2,
});
console.log("\n--- news_feed(latest) ---");
console.log(news);

process.exit(0);
