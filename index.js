require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { Player } = require('discord-player');
const { YoutubeiExtractor } = require('discord-player-youtubei');
const fs = require('fs');
const http = require('http');

// --- 1. 24/7 KEEP-ALIVE WEB SERVER FOR FREE CLOUD HOSTING ---
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Jamun Playz Music Bot is Online 24/7!');
}).listen(PORT, () => {
    console.log(`🌐 24/7 Web Server is running on port ${PORT}`);
});

// --- 2. DISCORD CLIENT SETUP ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const player = new Player(client, {
    skipFFmpeg: false
});

// Helper functions to load & save playlists
const PLAYLIST_FILE = './playlists.json';
function getPlaylists() {
    try {
        if (!fs.existsSync(PLAYLIST_FILE)) return {};
        return JSON.parse(fs.readFileSync(PLAYLIST_FILE, 'utf8'));
    } catch (e) {
        return {};
    }
}
function savePlaylists(data) {
    fs.writeFileSync(PLAYLIST_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// --- 3. SLASH COMMAND DEFINITIONS (For Live Search Dropdown) ---
const commands = [
    new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play a song with live search results dropdown')
        .addStringOption(option =>
            option.setName('search')
                .setDescription('Song name or link')
                .setRequired(true)
                .setAutocomplete(true)
        ),
    new SlashCommandBuilder()
        .setName('playlist-create')
        .setDescription('Create a new custom playlist')
        .addStringOption(opt => opt.setName('name').setDescription('Playlist name (e.g., my_favs)').setRequired(true)),
    new SlashCommandBuilder()
        .setName('playlist-add')
        .setDescription('Add a song to your custom playlist')
        .addStringOption(opt => opt.setName('name').setDescription('Playlist name').setRequired(true).setAutocomplete(true))
        .addStringOption(opt => opt.setName('song').setDescription('Song name or YouTube URL').setRequired(true)),
    new SlashCommandBuilder()
        .setName('genre')
        .setDescription('Play an entire category or custom playlist')
        .addStringOption(opt => opt.setName('name').setDescription('Choose category or playlist').setRequired(true).setAutocomplete(true)),
    new SlashCommandBuilder()
        .setName('genres')
        .setDescription('View all available song categories and custom playlists'),
    new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stop the music and clear the queue'),
    new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skip to the next song in the queue'),
    new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show all Jamun Playz Music Bot commands in English')
].map(cmd => cmd.toJSON());

// --- 4. BOT INITIALIZATION ---
client.once('ready', async () => {
    try {
        await player.extractors.register(YoutubeiExtractor, {});
        console.log('🎵 Default YouTube & Soundcloud Extractors 100% READY!');
    } catch (err) {
        console.error('Extractor Error:', err);
    }

    // Register Slash Commands automatically
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ Slash Commands (/play with live search dropdown) Registered!');
    } catch (err) {
        console.error('Slash Command Error:', err);
    }

    console.log(`🔥 Awesome! ${client.user.tag} is now ONLINE in English Mode!`);
});

// Player Events (English)
player.events.on('playerStart', (queue, track) => {
    const embed = new EmbedBuilder()
        .setColor('#00FF7F')
        .setTitle('🎶 Now Playing')
        .setDescription(`**[${track.title}](${track.url})**\n👤 **Artist:** ${track.author}\n⏱️ **Duration:** \`[${track.duration}]\``)
        .setThumbnail(track.thumbnail);
    queue.metadata.channel.send({ embeds: [embed] }).catch(() => {});
});

player.events.on('error', (queue, error) => console.log(`Queue error: ${error.message}`));
player.events.on('playerError', (queue, error) => console.log(`Player error: ${error.message}`));

// --- 5. LIVE SEARCH AUTOCOMPLETE & SLASH COMMAND HANDLER ---
client.on('interactionCreate', async (interaction) => {
    // A. Handle Live Search Dropdown (Just like your screenshot!)
    if (interaction.isAutocomplete()) {
        if (interaction.commandName === 'play') {
            const query = interaction.options.getFocused();
            if (!query || query.length < 2) return interaction.respond([]).catch(() => {});

            try {
                const results = await player.search(query);
                const tracks = results.tracks.slice(0, 12).map(t => {
                    const formatted = `${t.title} – ${t.author} [${t.duration}]`;
                    return {
                        name: formatted.length > 100 ? formatted.slice(0, 97) + '...' : formatted,
                        value: t.url
                    };
                });
                return await interaction.respond(tracks).catch(() => {});
            } catch (err) {
                return await interaction.respond([]).catch(() => {});
            }
        }

        if (interaction.commandName === 'genre' || interaction.commandName === 'playlist-add') {
            const focused = interaction.options.getFocused().toLowerCase();
            const playlists = getPlaylists();
            const choices = Object.keys(playlists)
                .filter(k => k.toLowerCase().includes(focused))
                .slice(0, 25)
                .map(k => ({ name: `📂 ${k.toUpperCase()} (${playlists[k].length} songs)`, value: k }));
            return await interaction.respond(choices).catch(() => {});
        }
    }

    // B. Handle Slash Commands Execution
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'help') {
        return interaction.reply({ embeds: [createHelpEmbed()] });
    }

    if (commandName === 'genres') {
        return interaction.reply({ embeds: [createGenresEmbed()] });
    }

    if (commandName === 'playlist-create') {
        const name = interaction.options.getString('name').toLowerCase().replace(/\s+/g, '_');
        const playlists = getPlaylists();
        if (playlists[name]) {
            return interaction.reply({ content: `❌ Playlist **\`${name}\`** already exists! Use \`/playlist-add\` to add songs to it.`, ephemeral: true });
        }
        playlists[name] = [];
        savePlaylists(playlists);
        return interaction.reply(`✅ Successfully created new custom playlist: **\`${name}\`**! Now add songs using \`/playlist-add\` or \`!addplaylist ${name} <song>\`.`);
    }

    if (commandName === 'playlist-add') {
        const name = interaction.options.getString('name').toLowerCase();
        const song = interaction.options.getString('song');
        const playlists = getPlaylists();
        if (!playlists[name]) {
            return interaction.reply({ content: `❌ Playlist **\`${name}\`** does not exist! Create it first using \`/playlist-create\`.`, ephemeral: true });
        }
        playlists[name].push(song);
        savePlaylists(playlists);
        return interaction.reply(`✅ Added **${song}** to your custom playlist **\`${name}\`**! (Total songs: ${playlists[name].length})`);
    }

    if (commandName === 'play') {
        const vc = interaction.member.voice.channel;
        if (!vc) return interaction.reply({ content: '❌ Please join a Voice Channel first!', ephemeral: true });

        const query = interaction.options.getString('search');
        await interaction.deferReply();

        try {
            const { track } = await player.play(vc, query, {
                nodeOptions: { metadata: { channel: interaction.channel } }
            });
            return interaction.followUp(`✅ Added to queue: **${track.title}** \`[${track.duration}]\``);
        } catch (e) {
            return interaction.followUp(`❌ Could not play that song: ${e.message}`);
        }
    }

    if (commandName === 'genre') {
        const vc = interaction.member.voice.channel;
        if (!vc) return interaction.reply({ content: '❌ Please join a Voice Channel first!', ephemeral: true });

        const name = interaction.options.getString('name').toLowerCase();
        const playlists = getPlaylists();
        const songs = playlists[name];

        if (!songs || songs.length === 0) {
            return interaction.reply(`❌ Playlist **\`${name}\`** is empty or does not exist! Type \`/genres\` to view available playlists.`);
        }

        await interaction.reply(`⏳ Loading **${songs.length} songs** from playlist **\`${name.toUpperCase()}\`**...`);
        for (const song of songs) {
            try {
                await player.play(vc, song, {
                    nodeOptions: { metadata: { channel: interaction.channel } }
                });
            } catch (err) {}
        }
    }

    if (commandName === 'skip') {
        const queue = player.nodes.get(interaction.guildId);
        if (!queue || !queue.isPlaying()) return interaction.reply('❌ No music is currently playing.');
        queue.node.skip();
        return interaction.reply('⏭️ Skipped to the next song!');
    }

    if (commandName === 'stop') {
        const queue = player.nodes.get(interaction.guildId);
        if (!queue) return interaction.reply('❌ No music is currently playing.');
        queue.delete();
        return interaction.reply('⏹️ Stopped the music and cleared the queue!');
    }
});

// --- 6. PREFIX COMMANDS (!help, !play, etc. in 100% English) ---
function createHelpEmbed() {
    return new EmbedBuilder()
        .setColor('#00FF7F')
        .setTitle('🎧 Jamun Playz Music Bot Commands')
        .setDescription('Use **Slash Commands** (type `/play`) for the **Live Song Search Dropdown**, or use classic `!` prefix commands below:')
        .addFields(
            { name: '🔍 `/play <song>` or `!play <song/link>`', value: 'Play any song (Use `/play` to see live search results with duration!)' },
            { name: '📂 `!genres` or `/genres`', value: 'View all built-in song categories & your custom playlists' },
            { name: '🎶 `!genre <name>` or `/genre <name>`', value: 'Play an entire category or custom playlist (Ex: `!genre bollywood`)' },
            { name: '➕ `!createplaylist <name>`', value: 'Create your own new custom playlist (Ex: `!createplaylist myvibes`)' },
            { name: '🎵 `!addplaylist <name> <song>`', value: 'Add any song to your playlist (Ex: `!addplaylist myvibes Kesariya`)' },
            { name: '🗑️ `!removeplaylist <name>`', value: 'Delete a custom playlist' },
            { name: '⏭️ `!skip` | ⏹️ `!stop`', value: 'Skip current song or stop music and clear the queue' }
        );
}

function createGenresEmbed() {
    const playlists = getPlaylists();
    const list = Object.keys(playlists).map(k => `• **\`${k}\`** (${playlists[k].length} tracks)`).join('\n');
    return new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📂 Available Music Categories & Custom Playlists')
        .setDescription(list || 'No playlists found.')
        .setFooter({ text: 'Type !genre <name> or /genre <name> to play any playlist!' });
}

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith('!')) return;
    const args = message.content.slice(1).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    if (cmd === 'help') return message.reply({ embeds: [createHelpEmbed()] });
    if (cmd === 'genres' || cmd === 'playlists') return message.reply({ embeds: [createGenresEmbed()] });

    if (cmd === 'createplaylist') {
        const name = args[0]?.toLowerCase();
        if (!name) return message.reply('❌ Usage: `!createplaylist <playlist_name>` (Example: `!createplaylist workout_mix`)');
        const playlists = getPlaylists();
        if (playlists[name]) return message.reply(`❌ Playlist **\`${name}\`** already exists!`);
        playlists[name] = [];
        savePlaylists(playlists);
        return message.reply(`✅ Custom playlist **\`${name}\`** created! Add songs using \`!addplaylist ${name} <song name>\``);
    }

    if (cmd === 'addplaylist') {
        const name = args.shift()?.toLowerCase();
        const song = args.join(' ');
        if (!name || !song) return message.reply('❌ Usage: `!addplaylist <playlist_name> <song name or link>`');
        const playlists = getPlaylists();
        if (!playlists[name]) return message.reply(`❌ Playlist **\`${name}\`** not found! Create it first with \`!createplaylist ${name}\`.`);
        playlists[name].push(song);
        savePlaylists(playlists);
        return message.reply(`✅ Added **${song}** to playlist **\`${name}\`**! (Total tracks: ${playlists[name].length})`);
    }

    if (cmd === 'removeplaylist') {
        const name = args[0]?.toLowerCase();
        if (!name) return message.reply('❌ Usage: `!removeplaylist <playlist_name>`');
        const playlists = getPlaylists();
        if (!playlists[name]) return message.reply(`❌ Playlist **\`${name}\`** does not exist.`);
        delete playlists[name];
        savePlaylists(playlists);
        return message.reply(`🗑️ Deleted playlist **\`${name}\`**!`);
    }

    if (cmd === 'play') {
        const vc = message.member.voice.channel;
        if (!vc) return message.reply('❌ Please join a Voice Channel first!');
        const query = args.join(' ');
        if (!query) return message.reply('❌ Please provide a song name or link!');

        const loadingMsg = await message.reply(`🔍 Searching and playing: **${query}**...`);
        try {
            const { track } = await player.play(vc, query, {
                nodeOptions: { metadata: { channel: message.channel } }
            });
            loadingMsg.edit(`✅ Added to queue: **${track.title}** \`[${track.duration}]\``);
        } catch (e) {
            loadingMsg.edit(`❌ Could not play the song: ${e.message}`);
        }
    }

    if (cmd === 'genre') {
        const vc = message.member.voice.channel;
        if (!vc) return message.reply('❌ Please join a Voice Channel first!');
        const name = args[0]?.toLowerCase();
        const playlists = getPlaylists();
        if (!name || !playlists[name] || playlists[name].length === 0) {
            return message.reply('❌ Invalid or empty playlist! Type `!genres` to see all available categories.');
        }

        message.reply(`⏳ Queueing **${playlists[name].length} songs** from **\`${name.toUpperCase()}\`** playlist...`);
        for (const song of playlists[name]) {
            try {
                await player.play(vc, song, {
                    nodeOptions: { metadata: { channel: message.channel } }
                });
            } catch (e) {}
        }
    }

    if (cmd === 'skip') {
        const queue = player.nodes.get(message.guild.id);
        if (!queue || !queue.isPlaying()) return message.reply('❌ No music is currently playing.');
        queue.node.skip();
        return message.reply('⏭️ Skipped to the next song!');
    }

    if (cmd === 'stop') {
        const queue = player.nodes.get(message.guild.id);
        if (!queue) return message.reply('❌ No music is currently playing.');
        queue.delete();
        return message.reply('⏹️ Stopped the music and cleared the queue!');
    }
});

client.login(process.env.DISCORD_TOKEN);