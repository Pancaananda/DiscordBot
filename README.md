# YouTube Livestream Discord Bot

A Discord bot that monitors YouTube channels and sends notifications when they go live.

## Features

- Monitor multiple YouTube channels for livestreams
- Automatic notifications when a channel goes live
- Commands to add, remove, and list monitored channels
- Persistent storage of channel data

## Setup Instructions

### Prerequisites

- Discord Bot Token (from [Discord Developer Portal](https://discord.com/developers/applications))
- YouTube API Key (from [Google Cloud Console](https://console.cloud.google.com/))

### Setting up on Replit

1. Create a new Replit project
2. Upload these files to your Replit project:
   - `index.js`
   - `package.json`
   - Other project files

3. Set up environment variables in Replit using Secrets:
   - Click on the lock icon (🔒) in the sidebar or select "Secrets" from the Tools menu
   - Add the following secrets:
     - Key: `DISCORD_TOKEN` Value: your Discord bot token
     - Key: `YOUTUBE_API_KEY` Value: your YouTube API key
   - Make sure to click "Save" after adding each secret

4. Note: **DO NOT** use a `.env` file on Replit as it might expose your tokens

5. Click "Run" to start the bot

### Bot Commands

- `!addchannel [YouTube Channel URL]` - Add a YouTube channel to monitor (Admin only)
- `!removechannel [YouTube Channel URL or Name]` - Remove a YouTube channel (Admin only)
- `!listchannels` - List all monitored YouTube channels
- `!help` - Display help information

### Inviting the Bot to Your Server

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application and go to the "OAuth2" tab
3. In "URL Generator", select the following scopes and permissions:
   - Scopes: `bot`
   - Bot Permissions:
     - Send Messages
     - Embed Links
     - Mention Everyone
     - Read Message History
     - Read Messages/View Channels
4. Copy the generated URL and open it in a browser to invite the bot

## Notes

- The bot checks for livestreams every 5 minutes
- YouTube API has quotas; be mindful of how many channels you're monitoring
- Bot requires administrator permissions to use the add/remove commands

## Troubleshooting

- If the bot isn't detecting livestreams, verify your YouTube API key is correct
- Make sure the bot has proper permissions in the Discord channel
- Check the Replit console for any error messages