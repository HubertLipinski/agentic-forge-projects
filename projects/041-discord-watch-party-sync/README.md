# Discord Watch Party Sync Bot

A Discord bot that synchronizes YouTube video playback for users in a voice channel. It allows a designated 'host' to control play, pause, seek, and video changes for everyone, creating a seamless co-watching experience. Ideal for communities wanting to watch videos, tutorials, or streams together.

## Features

-   **YouTube Streaming**: Stream high-quality audio from any YouTube video directly into a Discord voice channel.
-   **Host-Controlled Playback**: A designated party host has full control over playback (`play`, `pause`, `resume`, `skip`).
-   **Video Queue**: Line up multiple videos for a continuous watch session.
-   **Dynamic Host Transfer**: The current host can easily transfer control to another user in the channel.
-   **Automatic Cleanup**: The bot automatically leaves the voice channel and cleans up the session when the channel is empty.
-   **Real-time Status Updates**: Get instant feedback in your text channel for actions like "Now Playing", "Paused", and "Added to Queue".
-   **Robust Error Handling**: Gracefully handles invalid links, playback errors, and other common issues.

## Installation

1.  **Clone the repository:**

    ```sh
    git clone https://github.com/your-username/discord-watch-party-sync-bot.git
    cd discord-watch-party-sync-bot
    ```

2.  **Install dependencies:**

    This project uses `npm`. Make sure you have Node.js (v20.0.0 or higher) installed.

    ```sh
    npm install
    ```

3.  **Set up environment variables:**

    Create a `.env` file in the root of the project by copying the example file:

    ```sh
    cp .env.example .env
    ```

    Now, edit the `.env` file with your bot's credentials from the [Discord Developer Portal](https://discord.com/developers/applications):

    ```env
    # .env
    DISCORD_TOKEN="YOUR_DISCORD_BOT_TOKEN"
    CLIENT_ID="YOUR_BOTS_CLIENT_ID"
    GUILD_ID="YOUR_DEVELOPMENT_SERVER_ID"
    LOG_LEVEL="info"
    ```

    -   `DISCORD_TOKEN`: Your bot's secret token.
    -   `CLIENT_ID`: Your bot's application ID.
    -   `GUILD_ID`: The ID of your Discord server (guild). This is used for instantly registering slash commands during development.

## Usage

1.  **Register Slash Commands:**

    Before starting the bot for the first time, you need to register its slash commands with Discord.

    ```sh
    npm run deploy
    ```

    You only need to run this once, or whenever you add or modify commands.

2.  **Start the Bot:**

    Run the following command to bring your bot online.

    ```sh
    npm start
    ```

    The bot should now appear as "Online" in your Discord server.

## Examples

### Starting a Watch Party

To start a watch party, join a voice channel and use the `/play` command with a YouTube URL. The bot will join your channel, and you will become the host.

-   **You type:** `/play url:https://www.youtube.com/watch?v=dQw4w9WgXcQ`
-   **Bot responds:**
    -   `🎉 Watch party started in #General!`
    -   `▶️ Now Playing: Rick Astley - Never Gonna Give You Up (Official Music Video)`

### Adding to the Queue

While a video is playing, any user in the voice channel can add more videos to the queue using the same `/play` command.

-   **Another user types:** `/play url:https://www.youtube.com/watch?v=...`
-   **Bot responds:** `✅ Added to queue: Another Awesome Video (Position: 1)`

### Controlling Playback (Host Only)

Only the host can control the playback.

-   **Host types:** `/pause`
-   **Bot responds:** `⏸️ Paused: Rick Astley - Never Gonna Give You Up (Official Music Video)`

-   **Host types:** `/resume`
-   **Bot responds:** `▶️ Resumed: Rick Astley - Never Gonna Give You Up (Official Music Video)`

-   **Host types:** `/skip`
-   **Bot responds:** `⏭️ Skipped Rick Astley - Never Gonna Give You Up (Official Music Video).` (And then starts the next video in the queue).

## License

This project is licensed under the ISC License. See the `package.json` file for details.