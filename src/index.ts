#!/usr/bin/env node

import dotenv from "dotenv";
import { Command } from "commander";
import chalk from "chalk";
import { ConfigManager } from "./core/config-manager";
import { AskYogiService } from "./services/ask-yogi.service";
import { Loader } from "./core/loader";

dotenv.config({
  path: "./.env",
  override: true,
});

const program = new Command();

program
  .name("ask-yogi")
  .description("CLI to ask Yogi questions")
  .version("1.0.0")
  .helpOption(false)
  .addHelpText(
    "before",
    chalk.blue(`
    ********************************
    * Welcome to the Ask Yogi CLI! *
    ********************************
  `),
  )
  .addHelpText(
    "after",
    chalk.green(`
    Use --question to ask a question or --live-mode to start an infinite question answering loop.
  `),
  );

program
  .option("-q, --question <question>", "Ask a question")
  .option("-l, --liveMode", "Start an infinite question answering loop")
  .option("-r, --reconfigure", "Reconfigure the provider and API key")
  .option("-h, --help", "Display help for command"); // Added help option

async function run() {
  program.parse(process.argv);
  const options = program.opts();

  if (options.help) {
    program.help();
    return;
  }

  const configManager = new ConfigManager();

  // No config and not reconfigure: exit without starting the loader (avoids spinner getting stuck)
  if (!configManager.isConfigured() && !options.reconfigure) {
    console.error(
      chalk.red("Configuration not set. Please run with -r to reconfigure."),
    );
    console.error(chalk.gray("  Example: ask-yogi -r"));
    process.exit(1);
  }

  const loader = new Loader();
  loader.start("Initializing Ask Yogi CLI...", "cyan", "white");

  const initStatus = await configManager.init();

  if (!initStatus && !options.reconfigure) {
    loader.stop();
    console.error(
      chalk.red("Configuration invalid. Please run with -r to reconfigure."),
    );
    console.error(chalk.gray("  Example: ask-yogi -r"));
    process.exit(1);
  }

  if (initStatus && options.reconfigure) {
    console.log(chalk.cyan("Reconfiguring Ask Yogi CLI..."));
  }

  if (!initStatus || options.reconfigure) {
    loader.stop();
    await configManager.setup();
    loader.start("Initializing Ask Yogi CLI...", "cyan", "white");
  }

  const config = configManager.getConfig();
  console.log(chalk.cyan(`Using provider: ${config.provider}`));
  console.log(chalk.cyan(`Using default model: ${config.defaultModel}`));

  const askYogiService = new AskYogiService({
    model: config.defaultModel,
    apiKey: config.apiKey,
  });

  loader.stop("Ask Yogi CLI initialized.");

  if (options.question) {
    console.log(chalk.yellow(`You asked: ${options.question}`));
    loader.start("Thinking...", "cyan", "white");
    const response = await askYogiService.askYogi(options.question);
    loader.stop();
    console.log(chalk.green(`Yogi says: ${response.response}`));
    console.log(chalk.green(`Teachings: ${response.teachings.join(", ")}`));
  } else if (options.liveMode) {
    console.log(chalk.yellow("Entering live mode. Type your questions below:"));
    process.stdin.setEncoding("utf-8");
    console.log(chalk.yellow("Type 'exit' to exit live mode."));

    console.log(
      chalk.green("\nYogi says: Welcome! I am here to answer your questions."),
    );

    process.stdin.on("data", async (data) => {
      loader.start("Thinking...", "cyan", "white");
      const question = data.toString().trim();
      if (question.toLowerCase() === "exit") {
        console.log(chalk.red("Exiting live mode."));
        process.exit();
      }
      await askYogiService.askYogi(question).then((response) => {
        loader.stop();
        console.log(chalk.green(`Yogi says: ${response.response}`));
        console.log(chalk.green(`Teachings: ${response.teachings.join(", ")}`));
        console.log(
          chalk.yellow("\nContinue your conversation or type 'exit' to quit:"),
        );
      });
    });
  } else {
    program.help();
  }
}

if (require.main === module) {
  run();
}
