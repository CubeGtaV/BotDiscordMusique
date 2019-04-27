const { Client, Util, Discord } = require('discord.js');
const YouTube = require('simple-youtube-api');
const ytdl = require('ytdl-core');

const radio = {
    "franceinfo": "http://roo8ohho.cdn.dvmr.fr/live/franceinfo-midfi.mp3",
    "nrj": "http://185.52.127.132/fr/30001/mp3_128.mp3?origine=fluxradios",
    "rtl2": "http://streaming.radio.rtl2.fr/rtl2-1-48-192",
    "skyrock": "http://icecast.skyrock.net/s/natio_mp3_128k?tvr_name=tunein16&tvr_section1=128mp3",
    "rtl": "http://streaming.radio.rtl.fr/rtl-1-48-192",
    "rfm": "http://rfm-live-mp3-128.scdn.arkena.com/rfm.mp3",
    "bfm": "http://chai5she.cdn.dvmr.fr/bfmbusiness"
}

var PREFIX = process.env.PREFIX;


const client = new Client({ disableEveryone: true });

const youtube = new YouTube(process.env.YT_API);

const queue = new Map();

client.on('warn', console.warn);

client.on('error', console.error);

client.on('ready', () => console.log('Bot prêt'));

client.on('disconnect', () => console.log('Je viens de me deconnecter, je suis en train de me reconnecter maintenant ...'));

client.on('reconnecting', () => console.log('JE suis reconnecte'));

let statuses = [`${PREFIX}help | Version alpha`]
client.on('ready', () => {
    setInterval(function () {
        let status = statuses[Math.floor(Math.random() * statuses.length)];

        client.user.setPresence({ game: { name: status }, status: 'streaming' });
    }, 10000)
});

client.on('message', msg => {
    if (msg.content === PREFIX + "help") {
        msg.channel.send(
            {
                embed: {
                    color: process.env.COLOR,
                    title: `Help
              Toute les functions:`,
                    fields: [{
                        name: `${PREFIX}music | <fonctions>`,
                        value: "Voici toutes les fonctions de la musique"
                    },
		    {
                        name: "Play",
                        value: `play <url> ou <recherche> : 
                            Ajouter le(s) musiques ou la playlist a la file d'attente . PS: si vous mettez une playlist attendez un peux le temps que la playlist charge`,
                        inline: true
                    },
                    {
                        name: "Skip",
                        value: `skip : Passer la musique actuelle `,
                        inline: true
                    },
                    {
                        name: "Pause",
                        value: `pause : Met pause la musique .`,
                        inline: true
                    },
                    {
                        name: "Resume",
                        value: `resume : Reprendre/continuer la musique .`,
                        inline: true
                    },
                    {
                        name: "Queue",
                        value: `queue : Afficher la/les musique(s) de la file d'attente. PS: mais si par fois la queue ne s'affiche pas ne vous inquetiez pas c'est normal (en dev)`,
                        inline: true
                    },
                    {
                        name: "Purge",
                        value: `purge : Effacer la/les musique(s) de la file d'attente .`,
                        inline: true
                    },
                    {
                        name: "np",
                        value: `np : Afficher le titre de la musique actuelle .`,
                        inline: true
                    },
                    {
                        name: "Volume",
                        value: `vol <0-5> : Regler le volume.`,
                        inline: true
                    },
                    {
                        name: "Join",
                        value: `join : Rejoins votre salon vocal.`,
                        inline: true
                    },
                    {
                        name: "Leave",
                        value: `leave : Quitte le salon vocal.`,
                        inline: true
                    },
                    {
                        name: "Stop",
                        value: `stop : Quitte le salon vocal et stoppe la musique.`,
                        inline: true
                    },
		     {
                            name: "Radio",
                            value: `Faite ${PREFIX}radio pour afficher les radio disponible`,
                            inline: true
                        }
                    ],
                    timestamp: new Date(),
                    footer: {
                        text: "Bot Radio/Musique"
                    }
                }
            });
    }
});

client.on('message', async msg => { // eslint-disable-line
    if (msg.author.bot) return undefined;
    if (!msg.content.startsWith(process.env.PREFIX)) return undefined;

    const args = msg.content.split(' ');
    const searchString = args.slice(1).join(' ');
    const url = args[1] ? args[1].replace(/<(.+)>/g, '$1') : '';
    const serverQueue = queue.get(msg.guild.id);

    let command = msg.content.toLowerCase().split(' ')[0];
    command = command.slice(PREFIX.length);

    if (command === 'play') {
        const voiceChannel = msg.member.voiceChannel;
        if (!voiceChannel) return msg.channel.send('Vous devez etre dans un channel vocal pour utiliser cettecommande');
        const permissions = voiceChannel.permissionsFor(msg.client.user);
        if (!permissions.has('CONNECT')) {
            return msg.channel.send('Je n\'ai pas la permission de me connecter au salon');
        }
        if (!permissions.has('SPEAK')) {
            return msg.channel.send('Je n\'ai pas la permisson de parler');
        }

        if (url.match(/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/)) {
            const playlist = await youtube.getPlaylist(url);
            const videos = await playlist.getVideos();
            for (const video of Object.values(videos)) {
                const video2 = await youtube.getVideoByID(video.id); // eslint-disable-line no-await-in-loop
                await handleVideo(video2, msg, voiceChannel, true); // eslint-disable-line no-await-in-loop
            }
            return msg.channel.send(`:white_check_mark: Playlist: **${playlist.title}** a bien ete ajoute a la queue!`);
        } else {
            try {
                var video = await youtube.getVideo(url);
            } catch (error) {
                try {
                    var videos = await youtube.searchVideos(searchString, 10);
                    let index = 0;
                    msg.channel.send(`
__**Song selection:**__
${videos.map(video2 => `**${++index} -** ${video2.title}`).join('\n')}

Veuillez fournir une valeur pour sélectionner l'un des resultats de la recherche, allant de 1 a 10.
					`);
                    // eslint-disable-next-line max-depth
                    try {
                        var response = await msg.channel.awaitMessages(msg2 => msg2.content > 0 && msg2.content < 11, {
                            maxMatches: 1,
                            time: 10000,
                            errors: ['time']
                        });
                    } catch (err) {
                        console.error(err);
                        return msg.channel.send('Aucune valeur ou valeur invalide entree, annulation de la sélection de video.');
                    }
                    const videoIndex = parseInt(response.first().content);
                    var video = await youtube.getVideoByID(videos[videoIndex - 1].id);
                } catch (err) {
                    console.error(err);
                    return msg.channel.send(':sos: Je n\'ai pu obtenir aucun resultat de recherche.');
                }
            }
            return handleVideo(video, msg, voiceChannel);
        }
    } else if (command === 'skip') {
        if (!msg.member.voiceChannel) return msg.channel.send('Vous n\'etes pas dans un channel vocal');
        if (!serverQueue) return msg.channel.send('Il n\'y a pas de musique qui joue actuellement ');
        serverQueue.connection.dispatcher.end('Skip command has been used!');
        return undefined;
    } else if (command === 'stop') {
        if (!msg.member.voiceChannel) return msg.channel.send('Vous n\'etes pas dans un channel vocal');
        if (!serverQueue) return msg.channel.send('Il n\'y a pas de musique qui joue actuellement');
        serverQueue.songs = [];
        serverQueue.connection.dispatcher.end('Stop command has been used!');
        return undefined;
    } else if (command === 'volume') {
        if (!msg.member.voiceChannel) return msg.channel.send('Vous n\'etes pas dans un channel vocal');
        if (!serverQueue) return msg.channel.send('Il n\'y a pas de musique qui joue actuellement');

        if (args[1] > 5) {
            msg.channel.send('Vous ne pouvez pas mettre le volume superieur a 5 pour le confort de vos oreilles')
        } else {
            if (!args[1]) return msg.channel.send(`Le volume est a : **${serverQueue.volume}**`);
            serverQueue.volume = args[1];
            serverQueue.connection.dispatcher.setVolumeLogarithmic(args[1] / 5);
            return msg.channel.send(`Le volume est a : **${args[1]}**`);
        }


    } else if (command === 'np') {
        if (!serverQueue) return msg.channel.send('Il n\'y a pas de musique qui joue actuellement');
        return msg.channel.send(`:notes: actuellement a l'ecoute: **${serverQueue.songs[0].title}**`);
    } else if (command === 'queue') {
        if (!serverQueue) return msg.channel.send('Il n\'y a pas de musique qui joue actuellement');

        try {
            msg.channel.send(`
                __**Song queue:**__
                ${serverQueue.songs.map(song => `**-** ${song.title}`).join('\n')}
                **actuellement a l'ecoute:** ${serverQueue.songs[0].title}
		`);
        } catch (err) {
            console.error(`Je ne peux pas afficher la queue: ${err}`);
            return msg.channel.send(`Je ne peux pas afficher la queue raison : ${err}`);
        }

    } else if (command === 'pause') {
        if (serverQueue && serverQueue.playing) {
            serverQueue.playing = false;
            serverQueue.connection.dispatcher.pause();
            return msg.channel.send(':pause_button: musique en pause');
        }
        return msg.channel.send('Il n\'y a pas de musique qui joue actuellement.');
    } else if (command === 'resume') {
        if (serverQueue && !serverQueue.playing) {
            serverQueue.playing = true;
            serverQueue.connection.dispatcher.resume();
            return msg.channel.send(':arrow_forward: la musique rejoue');
        }
        return msg.channel.send('Il n\'y a pas de musique qui joue actuellement.');
    } else if (command === 'purge') {
        serverQueue.songs = [];
        msg.channel.send("La queue a ete efface");
    } else if (command === "join") {
        if (!msg.member.voiceChannel) {
            msg.channel.send('Vous n\'etes pas dans un channel vocal');
        } else {
            msg.member.voiceChannel.join();
            msg.channel.send("Le bot a bien rejoint le vocal")
        }

    } else if (command === "leave") {
        if (msg.guild.me.voiceChannel) {
            msg.member.voiceChannel.leave();
            msg.channel.send("Le bot a bien quitte le vocal");
        } else {
            msg.channel.send('Je ne suis pas dans un channel vocal');
        }

    } else if (command === "radio") {
        if (!msg.member.voiceChannel) return msg.channel.send(`Vous devez être connecté dans un salon-vocal !`)

        if (!msg.member.voiceChannel.joinable) return msg.channel.send(`Je n'ai pas la permission de \`rejoindre\` ou \`parler\` dans ce salon !`).catch(err => console.log(err));

        if (!msg.member.voiceChannel.speakable) return msg.channel.send(`Je n'ai pas la permission de \`rejoindre\` ou \`parler\` dans ce salon !`).catch(err => console.log(err));

        if (!args[1]) return msg.channel.send(`Veuillez spécifier un nom de radio, voici la liste des radios pour stopper ${PREFIX}radio stop ou ${PREFIX}radio leave: **franceinfo**, **nrj**, **rtl2**, **skyrock**, **rtl**, **rfm**, **bfm**`);


        if (args[1] === ("stop") || args[1] === ("leave")) {
            if (msg.guild.voiceConnection) {
                msg.member.voiceChannel.leave();
                msg.channel.send(`Radio stoppée`);


            } else {
                if (!msg.member.voiceChannel) {
                    msg.channel.send(`⚠ Vous devez être connecté dans un salon-vocal !`);
                } else {
                    msg.channel.send(`Je ne suis pas dans un canal vocal!`);
                }

            }
        } else {
            console.log(args[1]);
            if (!radio[args[1]]) return msg.channel.send(`Radio invalide veuillez faire ${PREFIX}radio ,Pour la liste des radios`);

            msg.member.voiceChannel.join().then(connection => {

                require('http').get(radio[args[1]], (res) => {

                    connection.playStream(res);

                    msg.channel.send(
                        {
                            embed: {
                                color: process.env.COLOR,
                                title: `📻 En joue:`,
                                fields: [{
                                    name: `• Radio`,
                                    value: "`" + args + "`",
                                    inline: true
                                },
                                {
                                    name: `• Lien`,
                                    value: "`" + radio[args[1]] + "`",
                                    inline: true
                                }],
                                timestamp: new Date(),
                                footer: {
                                    text: `demandé par @${msg.author.username}`
                                }
                            }
                        });

                });
            });
        }
    }

    return undefined;
});

async function handleVideo(video, msg, voiceChannel, playlist = false) {
    const serverQueue = queue.get(msg.guild.id);
    console.log(video);
    const song = {
        id: video.id,
        title: Util.escapeMarkdown(video.title),
        url: `https://www.youtube.com/watch?v=${video.id}`
    };
    if (!serverQueue) {
        const queueConstruct = {
            textChannel: msg.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: 5,
            playing: true
        };
        queue.set(msg.guild.id, queueConstruct);

        queueConstruct.songs.push(song);

        try {
            var connection = await voiceChannel.join();
            queueConstruct.connection = connection;
            play(msg.guild, queueConstruct.songs[0]);
        } catch (error) {
            console.error(`I could not join the voice channel: ${error}`);
            queue.delete(msg.guild.id);
            return msg.channel.send(`Je ne peux pas rejoindre le channel vocal: ${error}`);
        }
    } else {
        serverQueue.songs.push(song);
        console.log(serverQueue.songs);
        if (playlist) return undefined;
        else return msg.channel.send(`:white_check_mark: **${song.title}** a bien ete ajoute a la queue`);
    }
    return undefined;
}

function play(guild, song) {
    const serverQueue = queue.get(guild.id);

    if (!song) {
        serverQueue.voiceChannel.leave();
        queue.delete(guild.id);
        return;
    }
    console.log(serverQueue.songs);

    const dispatcher = serverQueue.connection.playStream(ytdl(song.url))
        .on('end', reason => {
            if (reason === 'Stream is not generating quickly enough.') console.log('Song ended.');
            else console.log(reason);
            serverQueue.songs.shift();
            play(guild, serverQueue.songs[0]);
        })
        .on('error', error => console.error(error));
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);

    serverQueue.textChannel.send(`:notes: Joue actuellement: **${song.title}**`);
}

client.login(process.env.TOKEN);
