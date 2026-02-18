import { Client, GatewayIntentBits, Partials } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

const QUOTES_FILE_PATH = path.join(process.cwd(), 'quotes.json');
const BOT_PREFIX = '!quote'; // Define a consistent prefix for commands

// --- Helper Functions ---

/**
 * Reads quotes from the JSON file.
 * @returns {Promise<object>} A promise that resolves with the quotes object.
 */
async function readQuotes() {
  try {
    const data = await fs.readFile(QUOTES_FILE_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, return an empty object
      return {};
    }
    console.error('Error reading quotes file:', error);
    throw new Error('Failed to read quotes from storage.');
  }
}

/**
 * Writes quotes to the JSON file.
 * @param {object} quotes - The quotes object to write.
 * @returns {Promise<void>} A promise that resolves when the file is written.
 */
async function writeQuotes(quotes) {
  try {
    await fs.writeFile(QUOTES_FILE_PATH, JSON.stringify(quotes, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing quotes file:', error);
    throw new Error('Failed to save quotes to storage.');
  }
}

/**
 * Parses the command and arguments from a message.
 * @param {string} content - The message content.
 * @returns {{command: string, args: string[]}} An object containing the command and its arguments.
 */
function parseCommand(content) {
  const [command, ...args] = content.slice(BOT_PREFIX.length).trim().split(/\s+/);
  return { command: command ? command.toLowerCase() : '', args };
}

// --- Bot Initialization ---

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
  console.log(`Bot is ready and listening for commands with prefix "${BOT_PREFIX}".`);
});

// --- Event Listener for Messages ---

client.on('messageCreate', async (message) => {
  // Ignore messages from bots and messages that don't start with the prefix
  if (message.author.bot || !message.content.startsWith(BOT_PREFIX)) {
    return;
  }

  const { command, args } = parseCommand(message.content);

  try {
    switch (command) {
      case 'save':
        await handleSaveQuote(message, args);
        break;
      case 'get':
        await handleGetQuote(message, args);
        break;
      case 'list':
        await handleListKeywords(message);
        break;
      case 'delete':
        await handleDeleteQuote(message, args);
        break;
      default:
        await message.reply(`Unknown command. Use \`${BOT_PREFIX} help\` for a list of commands.`);
    }
  } catch (error) {
    console.error(`Error processing command "${command}":`, error);
    await message.reply(`An error occurred while processing your command. Please try again later. \nError: ${error.message}`);
  }
});

// --- Command Handlers ---

/**
 * Handles the 'save' command to save a new quote.
 * @param {object} message - The Discord message object.
 * @param {string[]} args - The arguments provided with the command.
 */
async function handleSaveQuote(message, args) {
  if (args.length < 2) {
    await message.reply(`Usage: \`${BOT_PREFIX} save <keyword> <quote content>\``);
    return;
  }

  const keyword = args[0].toLowerCase();
  const quoteContent = args.slice(1).join(' ');

  const quotes = await readQuotes();

  if (quotes[keyword]) {
    await message.reply(`A quote with the keyword "${keyword}" already exists. Use \`${BOT_PREFIX} delete ${keyword}\` to remove it first.`);
    return;
  }

  quotes[keyword] = quoteContent;
  await writeQuotes(quotes);

  await message.reply(`Quote saved successfully with keyword "${keyword}"!`);
}

/**
 * Handles the 'get' command to retrieve a quote.
 * @param {object} message - The Discord message object.
 * @param {string[]} args - The arguments provided with the command.
 */
async function handleGetQuote(message, args) {
  const quotes = await readQuotes();

  if (args.length === 0) {
    // Retrieve a random quote if no keyword is provided
    const keywords = Object.keys(quotes);
    if (keywords.length === 0) {
      await message.reply('No quotes have been saved yet!');
      return;
    }
    const randomKeyword = keywords[Math.floor(Math.random() * keywords.length)];
    await message.reply(`**${randomKeyword}:**\n${quotes[randomKeyword]}`);
  } else {
    // Retrieve a specific quote by keyword
    const keyword = args[0].toLowerCase();
    const quote = quotes[keyword];

    if (!quote) {
      await message.reply(`No quote found with the keyword "${keyword}".`);
      return;
    }

    await message.reply(`**${keyword}:**\n${quote}`);
  }
}

/**
 * Handles the 'list' command to list all saved keywords.
 * @param {object} message - The Discord message object.
 */
async function handleListKeywords(message) {
  const quotes = await readQuotes();
  const keywords = Object.keys(quotes);

  if (keywords.length === 0) {
    await message.reply('No quotes have been saved yet!');
    return;
  }

  const keywordList = keywords.map(kw => `- \`${kw}\``).join('\n');
  await message.reply(`Here are all the saved keywords:\n${keywordList}`);
}

/**
 * Handles the 'delete' command to delete a quote.
 * @param {object} message - The Discord message object.
 * @param {string[]} args - The arguments provided with the command.
 */
async function handleDeleteQuote(message, args) {
  if (args.length === 0) {
    await message.reply(`Usage: \`${BOT_PREFIX} delete <keyword>\``);
    return;
  }

  const keywordToDelete = args[0].toLowerCase();
  const quotes = await readQuotes();

  if (!quotes[keywordToDelete]) {
    await message.reply(`No quote found with the keyword "${keywordToDelete}".`);
    return;
  }

  // Use structuredClone for a deep copy to avoid modifying the original object before deletion
  const updatedQuotes = structuredClone(quotes);
  delete updatedQuotes[keywordToDelete];

  await writeQuotes(updatedQuotes);

  await message.reply(`Quote with keyword "${keywordToDelete}" deleted successfully.`);
}

// --- Bot Login ---

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error('DISCORD_BOT_TOKEN not found in .env file!');
  process.exit(1);
}

client.login(token);

// Export the client for potential external use or testing
export { client };