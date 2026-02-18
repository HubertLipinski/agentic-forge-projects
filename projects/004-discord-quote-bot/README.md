# Discord Quote Bot

## Description

A simple Discord bot that allows users to save and retrieve memorable quotes from their server. Useful for preserving funny moments, important discussion points, or inside jokes within a community. Anyone moderating or participating in a Discord server can use it.

## Features

*   **Save a quote:** Associate a keyword with a specific quote.
*   **Retrieve a random quote:** Get a random quote from the saved collection.
*   **Retrieve a quote by keyword:** Fetch a specific quote using its associated keyword.
*   **List all keywords:** View all keywords for which quotes have been saved.
*   **Delete a quote:** Remove a quote from the collection using its keyword.

## Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/discord-quote-bot.git
    cd discord-quote-bot
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Get a Discord Bot Token:**
    *   Go to the [Discord Developer Portal](https://discord.com/developers/applications).
    *   Create a new application.
    *   Navigate to the "Bot" tab and click "Add Bot".
    *   Under "Privileged Gateway Intents", enable "Message Content Intent".
    *   Copy your bot's token.

4.  **Create a `.env` file:**
    In the root of the project directory, create a file named `.env` and add your bot token:
    ```env
    DISCORD_TOKEN=YOUR_DISCORD_BOT_TOKEN_HERE
    ```

## Usage

To run the bot, use the following command in your terminal from the project's root directory:

```bash
npm start
```

The bot will log in and start listening for commands. The default command prefix is `!quote`.

## Examples

Here are some examples of how to use the bot's commands:

**1. Saving a quote:**

```
User: !quote save funnyjoke "Why don't scientists trust atoms? Because they make up everything!"
Bot: Quote "funnyjoke" saved successfully!
```

**2. Retrieving a random quote:**

```
User: !quote get random
Bot: Here's a random quote: "Why don't scientists trust atoms? Because they make up everything!"
```

**3. Retrieving a quote by keyword:**

```
User: !quote get funnyjoke
Bot: Quote for "funnyjoke": "Why don't scientists trust atoms? Because they make up everything!"
```

**4. Listing all keywords:**

```
User: !quote list
Bot: Saved keywords: funnyjoke, importantpoint, insidejoke1
```

**5. Deleting a quote:**

```
User: !quote delete funnyjoke
Bot: Quote with keyword "funnyjoke" deleted successfully.
```

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.