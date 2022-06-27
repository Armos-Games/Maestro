import "reflect-metadata";
import { buildSchema } from "type-graphql";
import { Bot } from "./bot.js";
import { Config } from "./config.js";
import * as path from "path";
import { fileURLToPath } from "url";
import { createGuildResolver } from "./resolvers/guildResolver.js";
import { createSettingsResolver } from "./resolvers/settingsResolver.js";
import { createLogResolver } from "./resolvers/logResolver.js";
import { logger } from "./logger.js";
import { ApolloServer } from "apollo-server-express";
import { ApolloServerPluginDrainHttpServer } from "apollo-server-core";
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/lib/use/ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

logger.info("Loading config...");
const config = new Config();

logger.info("Instanciating bot...");
const bot = await Bot.create(config);

logger.info("Building API schema...");
const schema = await buildSchema({
  resolvers: [createGuildResolver(bot), createSettingsResolver(bot), createLogResolver()],
  emitSchemaFile: path.resolve(__dirname, "schema.gql"),
});

logger.info("Creating HTTP server...");
const app = express();
const httpServer = createServer(app);

logger.info("Creating WebSocket server...");
const wsServer = new WebSocketServer({
  server: httpServer,
  path: "/",
});
const serverCleanup = useServer({ schema }, wsServer);

logger.info("Creating Apollo server...");
const server = new ApolloServer({
  schema,
  plugins: [
    // Shutdown the HTTP server
    ApolloServerPluginDrainHttpServer({ httpServer }),

    // Shutdown the WS server
    {
      async serverWillStart() {
        return {
          async drainServer() {
            await serverCleanup.dispose();
          },
        };
      },
    },
  ],
});

logger.info("Starting Apollo server...");
await server.start();
server.applyMiddleware({ app, path: "/" });
await new Promise<void>((resolve) => httpServer.listen({ port: config.apolloServerPort }, resolve));
logger.info(`Listening on: http://localhost:${config.apolloServerPort}`);

process.addListener("SIGINT", () => {
  bot.shutdown();
});

process.addListener("SIGTERM", () => {
  bot.shutdown();
});
