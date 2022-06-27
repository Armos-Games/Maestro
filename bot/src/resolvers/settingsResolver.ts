import { Mutation, Query, Resolver } from "type-graphql";
import { Bot } from "../bot.js";
import { logger } from "../logger.js";
import { Settings } from "../schema/settings.js";
import { spawn } from "child_process";

export function createSettingsResolver(bot: Bot) {
  @Resolver(Settings)
  class SettingsResolver {
    private hasAlreadyRegisteredCommands = false;
    private isRestarting = false;

    @Mutation(() => Boolean)
    async registerCommands() {
      await bot.registerCommands();
      this.hasAlreadyRegisteredCommands = true;
      return true;
    }

    @Mutation(() => Boolean)
    async restart() {
      if (this.isRestarting) return false;
      this.isRestarting = true;

      logger.warn("Manual restart requested");
      setTimeout(function () {
        process.on("exit", function () {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          spawn(process.argv.shift()!, process.argv, {
            cwd: process.cwd(),
            detached: true,
            stdio: "inherit",
          });
        });
        process.exit();
      }, 5000);
      return true;
    }

    @Query(() => Settings)
    async settings() {
      return { hasAlreadyRegisteredCommands: this.hasAlreadyRegisteredCommands };
    }
  }

  return SettingsResolver;
}
