require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActivityType } = require('discord.js');
const fetch = require('node-fetch');
const schedule = require('node-schedule');
const fs = require('fs');

// Discord bot configuration
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// YouTube channels data storage
const DATA_FILE = './youtube-channels.json';
let youtubeChannels = [];

// Load YouTube channels from file
const loadChannels = () => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      youtubeChannels = JSON.parse(data);
      console.log(`Loaded ${youtubeChannels.length} YouTube channels from file.`);
    } else {
      console.log('No channels file found. Starting with empty list.');
      youtubeChannels = [];
    }
  } catch (err) {
    console.error('Error loading channels:', err);
    youtubeChannels = [];
  }
};

// Save YouTube channels to file
const saveChannels = () => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(youtubeChannels, null, 2));
    console.log(`Saved ${youtubeChannels.length} YouTube channels to file.`);
  } catch (err) {
    console.error('Error saving channels:', err);
  }
};

// Parse YouTube channel ID from URL
function getYoutubeChannelId(url) {
  const regex = /(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:channel\/|c\/|@)([a-zA-Z0-9_-]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// Check if a YouTube channel is live
async function checkYouTubeLiveStatus(channelId) {
  try {
    if (!process.env.YOUTUBE_API_KEY) {
      console.error('YouTube API key is not set!');
      return null;
    }
    
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&eventType=live&key=${process.env.YOUTUBE_API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error(`YouTube API returned ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
      // Channel is live
      const liveStream = data.items[0];
      return {
        isLive: true,
        videoId: liveStream.id.videoId,
        title: liveStream.snippet.title,
        thumbnailUrl: liveStream.snippet.thumbnails.high.url,
        channelTitle: liveStream.snippet.channelTitle
      };
    } else {
      // Channel is not live
      return { isLive: false };
    }
  } catch (error) {
    console.error(`Error checking YouTube live status for ${channelId}:`, error);
    return null;
  }
}

// Schedule live stream checks
function scheduleChecks() {
  // Schedule to run every 5 minutes
  const job = schedule.scheduleJob('*/5 * * * *', async function() {
    console.log(`[${new Date().toISOString()}] Checking YouTube channels...`);
    
    for (const channel of youtubeChannels) {
      // Skip channels that were recently found live to avoid spam
      if (channel.lastNotified && (new Date() - new Date(channel.lastNotified)) < 60 * 60 * 1000) {
        continue;
      }
      
      const status = await checkYouTubeLiveStatus(channel.channelId);
      
      if (!status) {
        console.log(`Could not check status for ${channel.channelName}`);
        continue;
      }
      
      if (status.isLive && channel.notificationChannelId) {
        const wasLiveBefore = channel.isLive || false;
        
        // Only send notification if status changed from offline to live
        if (!wasLiveBefore) {
          const discordChannel = await client.channels.fetch(channel.notificationChannelId);
          
          if (discordChannel) {
            const embed = new EmbedBuilder()
              .setColor('#FF0000')
              .setTitle(status.title)
              .setURL(`https://www.youtube.com/watch?v=${status.videoId}`)
              .setAuthor({
                name: `${status.channelTitle} is LIVE!`,
                iconURL: 'https://i.imgur.com/yjy9ZLH.png'
              })
              .setImage(status.thumbnailUrl)
              .setTimestamp();
            
            await discordChannel.send({ content: `@everyone ${status.channelTitle} is now live on YouTube!`, embeds: [embed] });
            console.log(`Sent live notification for ${channel.channelName}`);
            
            // Update channel status
            channel.isLive = true;
            channel.lastNotified = new Date().toISOString();
            saveChannels();
          }
        }
      } else if (!status.isLive && channel.isLive) {
        // Update status when channel goes offline
        channel.isLive = false;
        saveChannels();
      }
    }
  });
  
  console.log('Scheduled YouTube livestream checks.');
  return job;
}

// Discord.js Bot events
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
  
  // Set bot status
  client.user.setPresence({
    activities: [{ 
      name: 'YouTube livestreams', 
      type: ActivityType.Watching 
    }],
    status: 'online',
  });
  
  // Load channels and start scheduled checks
  loadChannels();
  scheduleChecks();
});

client.on('messageCreate', async message => {
  // Ignore bot messages
  if (message.author.bot) return;
  
  const prefix = '!';
  if (!message.content.startsWith(prefix)) return;
  
  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  
  if (command === 'addchannel') {
    // Check if user has admin permission
    if (!message.member.permissions.has('ADMINISTRATOR')) {
      return message.reply('You need administrator permissions to use this command.');
    }
    
    if (args.length < 1) {
      return message.reply('Please provide a YouTube channel URL.');
    }
    
    const channelUrl = args[0];
    const channelId = getYoutubeChannelId(channelUrl);
    
    if (!channelId) {
      return message.reply('Invalid YouTube channel URL. Please provide a valid YouTube channel URL.');
    }
    
    // Check if channel already exists
    const existingChannel = youtubeChannels.find(c => c.channelId === channelId);
    if (existingChannel) {
      return message.reply(`This YouTube channel is already being monitored in ${existingChannel.notificationChannelId ? `<#${existingChannel.notificationChannelId}>` : 'a channel'}.`);
    }
    
    try {
      // Verify channel exists by making a test API call
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelId}&key=${process.env.YOUTUBE_API_KEY}`
      );
      
      if (!response.ok) {
        throw new Error(`YouTube API returned ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.items || data.items.length === 0) {
        return message.reply('Could not find this YouTube channel. Please check the URL and try again.');
      }
      
      const channelName = data.items[0].snippet.title;
      
      // Add channel to monitoring list
      youtubeChannels.push({
        channelId,
        channelName,
        notificationChannelId: message.channel.id,
        addedBy: message.author.tag,
        addedAt: new Date().toISOString(),
        isLive: false
      });
      
      saveChannels();
      
      return message.reply(`Added YouTube channel "${channelName}" to monitoring list. Livestream notifications will be sent in this channel.`);
    } catch (error) {
      console.error('Error adding channel:', error);
      return message.reply(`Error adding channel: ${error.message}`);
    }
  }
  
  if (command === 'removechannel') {
    // Check if user has admin permission
    if (!message.member.permissions.has('ADMINISTRATOR')) {
      return message.reply('You need administrator permissions to use this command.');
    }
    
    if (args.length < 1) {
      return message.reply('Please provide a YouTube channel URL or channel name.');
    }
    
    const query = args.join(' ');
    const channelId = getYoutubeChannelId(query);
    
    let removed = false;
    if (channelId) {
      // Remove by channel ID
      const initialLength = youtubeChannels.length;
      youtubeChannels = youtubeChannels.filter(c => c.channelId !== channelId);
      removed = youtubeChannels.length < initialLength;
    } else {
      // Try to remove by channel name
      const initialLength = youtubeChannels.length;
      youtubeChannels = youtubeChannels.filter(c => 
        !c.channelName.toLowerCase().includes(query.toLowerCase())
      );
      removed = youtubeChannels.length < initialLength;
    }
    
    if (removed) {
      saveChannels();
      return message.reply('YouTube channel removed from monitoring list.');
    } else {
      return message.reply('Could not find this YouTube channel in the monitoring list.');
    }
  }
  
  if (command === 'listchannels') {
    if (youtubeChannels.length === 0) {
      return message.reply('No YouTube channels are being monitored.');
    }
    
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Monitored YouTube Channels')
      .setDescription('These channels will trigger notifications when they go live:')
      .addFields(
        youtubeChannels.map(channel => ({
          name: channel.channelName,
          value: channel.isLive ? '🔴 Currently Live!' : '⚪ Offline',
          inline: true
        }))
      )
      .setTimestamp();
    
    return message.reply({ embeds: [embed] });
  }
  
  if (command === 'help') {
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('YouTube Livestream Bot Commands')
      .setDescription('Here are the commands you can use:')
      .addFields([
        {
          name: '!addchannel [YouTube Channel URL]',
          value: 'Add a YouTube channel to monitor for livestreams (Admin only)'
        },
        {
          name: '!removechannel [YouTube Channel URL or Name]',
          value: 'Remove a YouTube channel from monitoring (Admin only)'
        },
        {
          name: '!listchannels',
          value: 'List all monitored YouTube channels and their current status'
        },
        {
          name: '!help',
          value: 'Show this help message'
        }
      ])
      .setTimestamp();
    
    return message.reply({ embeds: [embed] });
  }
});

// Error handling
client.on('error', error => {
  console.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN);