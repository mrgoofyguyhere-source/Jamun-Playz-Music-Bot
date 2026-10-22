require('dotenv').config();
const fs = require('fs');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { Player } = require('discord-player');
const { DefaultExtractors } = require('@discord-player/extractor');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const player = new Player(client);

// Load default extractors safely (No external package crash)
async function initBot() {
    try {
        await player.extractors.loadMulti(DefaultExtractors);
        console.log('🎵 Default YouTube & Soundcloud Extractors 100% READY!');
    } catch (err) {
        console.error('Extractor Error:', err.message);
    }
}

player.events.on('playerStart', (queue, track) => {
    const embed = new EmbedBuilder()
        .setColor('#FF0055')
        .setTitle('🎶 Now Playing')
        .setDescription(`**[${track.title}](${track.url})**`)
        .setThumbnail(track.thumbnail)
        .addFields(
            { name: '⏱️ Duration', value: `${track.duration}`, inline: true },
            { name: '👤 Requested By', value: `${track.requestedBy?.username || 'Member'}`, inline: true }
        );
    queue.metadata.channel.send({ embeds: [embed] });
});

client.once('clientReady', async () => {
    await initBot();
    console.log(`🔥 Badhiya! ${client.user.tag} Music System ke sath ONLINE hai!`);
});

function getPlaylists() {
    if (!fs.existsSync('./playlists.json')) {
        const defaultData = {
            lofi: ["Indian lofi chill beats", "Bollywood lofi mashup"],
            bollywood: ["Kesariya Brahmastra", "Apna Bana Le Bhediya", "Tum Se Hi Jab We Met"],
            punjabi: ["295 Sidhu Moose Wala", "Softly Karan Aujla", "Lover Diljit Dosanjh"],
            hollywood: ["Blinding Lights The Weeknd", "Starboy The Weeknd", "Believer Imagine Dragons"],
            hindi: ["Kun Faya Kun Rockstar", "Agar Tum Saath Ho"]
        };
        fs.writeFileSync('./playlists.json', JSON.stringify(defaultData, null, 2));
    }
    return JSON.parse(fs.readFileSync('./playlists.json', 'utf8'));
}

function savePlaylists(data) {
    fs.writeFileSync('./playlists.json', JSON.stringify(data, null, 2));
}

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'help') {
        const helpEmbed = new EmbedBuilder()
            .setColor('#00FFAA')
            .setTitle('🎧 Jamun Playz Music Bot Commands')
            .addFields(
                { name: '▶️ `!play <song name/link>`', value: 'Koi bhi gaana play karo' },
                { name: '📂 `!genres`', value: 'Custom playlists dekho (Lofi, Bollywood, etc.)' },
                { name: '🎶 `!genre <name>`', value: 'Poori playlist bajao (Ex: `!genre bollywood`)' },
                { name: '⏹️ `!stop`', value: 'Music stop karo aur queue clear karo' }
            );
        return message.reply({ embeds: [helpEmbed] });
    }

    if (command === 'genres') {
        const playlists = getPlaylists();
        const genreList = Object.keys(playlists).map(g => `• **${g.toUpperCase()}** (${playlists[g].length} songs)`).join('\n');
        return message.reply(`📂 **Available Custom Playlists:**\n${genreList}`);
    }

    if (['play', 'genre', 'stop'].includes(command)) {
        const channel = message.member.voice.channel;
        if (!channel) return message.reply('🔊 Pehle kisi Voice Channel mein join ho jao!');

        if (command === 'play') {
            const query = args.join(' ');
            if (!query) return message.reply('⚠️ Gaane ka naam toh likho! Ex: `!play Kesariya`');

            const searchmsg = await message.reply(`🔍 Searching **${query}**...`);
            try {
                await player.play(channel, query, {
                    nodeOptions: { metadata: { channel: message.channel } },
                    requestedBy: message.author
                });
                searchmsg.edit(`✅ Queue mein add ho gaya!`);
            } catch (e) {
                console.error(e);
                searchmsg.edit(`❌ Error: ${e.message}`);
            }
        }

        if (command === 'genre') {
            const genre = args[0]?.toLowerCase();
            const playlists = getPlaylists();
            if (!genre || !playlists[genre]) return message.reply('⚠️ Yeh genre nahi mila! `!genres` check karo.');

            const songs = playlists[genre];
            message.reply(`🎶 **${genre.toUpperCase()}** playlist load ho rahi hai (${songs.length} songs)...`);
            for (const song of songs) {
                try {
                    await player.play(channel, song, {
                        nodeOptions: { metadata: { channel: message.channel } },
                        requestedBy: message.author
                    });
                } catch (e) {
                    console.log(`Skipped ${song}`);
                }
            }
        }

        const queue = player.nodes.get(message.guild.id);
        if (command === 'stop' && queue) {
            queue.delete();
            return message.reply('⏹️ Music Stop kar diya!');
        }
    }
});

client.login(process.env.DISCORD_TOKEN);