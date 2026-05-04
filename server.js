const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Remplace tes lignes actuelles par celles-ci :
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    // Ligne 15 : On envoie l'index qui est à la racine
    res.sendFile(path.join(__dirname, 'index.html'));
});

let rooms = {};
let roomTimers = {};

const THEMES = {
    "Classique": [
        ["AVION", "OISEAU"], ["POMME", "POIRE"], ["SOLEIL", "LUNE"], ["CHIEN", "CHAT"],
        ["FEU", "GLACE"], ["LUMIÈRE", "OMBRE"], ["FORÊT", "JUNGLE"], ["STÉTHOSCOPE", "THERMOMÈTRE"],
        ["VÉLO", "TROTTINETTE"], ["PIZZA", "BURGER"], ["LIT", "CANAPÉ"], ["MER", "OCÉAN"],
        ["PLUIE", "NEIGE"], ["CAYENNE", "PIMENT"], ["LUNETTES", "LENTILLES"], ["DENTS", "GENCIVES"],
        ["HIVER", "AUTOMNE"], ["MÉRO", "BUS"], ["PARAPLUIE", "IMPERMÉABLE"], ["CAUR", "POUMON"]
    ],
    "Anime": [
    ["NARUTO", "SANGOKU"], ["LUFFY", "PIKACHU"], ["SASUKE", "VEGETA"], ["ZORO", "LEVI ACKERMAN"],
    ["SAITAMA", "GON"], ["TANJIRO", "NATSU"], ["ICHIGO", "EREN JAGER"], ["KIRITO", "MELIODAS"],
    ["SHARK (YU-GI-OH)", "ASH (POKEMON)"], ["DORAEMON", "CHOPPER"], ["SAKURA", "NAMI"], ["HINATA", "MIKASA"],
    ["ITACHI", "HISOKA"], ["CELL", "SUKUNA"], ["FRIEZA", "OROCHIMARU"], ["MADARA", "AIZEN"],
    ["GOJO SATORU", "ALL MIGHT"], ["KAKASHI", "JIRAIYA"], ["GAARA", "GAROU"], ["KILLUA", "BAKUGO"],
    ["TRUNKS", "EDWARD ELRIC"], ["SOMA (FOOD WARS)", "SANJI"], ["L (DEATH NOTE)", "CONAN"], ["RYUK", "POCHITA"],
    ["LIGHT YAGAMI", "LELOUCH"], ["BROLY", "GUMGUM (LUFFY)"], ["SHARINGAN", "DRAGON BALL"], ["KUNAI", "SABRE LASER"],
    ["KAMEHAMEHA", "RASENGAN"], ["VILLAGE DE KONOHA", "GRAND LINE"], ["SHINIGAMI", "SAIYAN"], ["NINJA", "PIRATE"],
    ["PICCOLO", "SUIREI"], ["MAJIN BUU", "KORO-SENSEI"], ["SHOTO TODOROKI", "GRAY FULLBUSTER"], ["NEJI", "BYAKUYA"],
    ["SABO", "PORTGAS D. ACE"], ["YAMI YUGI", "KAIBA"], ["ASH KETCHUM", "TAI (DIGIMON)"], ["BULMA", "WINRY"],
    ["ERZA SCARLET", "SABER"], ["JOTARO", "KENSHIRO"], ["IPPO", "ROCK LEE"], ["MUGEN", "SPIKE SPIEGEL"],
    ["CELL", "MERUEM"], ["FRIEREN", "ASUNA"], ["REMV", "RAM"], ["BROOK", "LORD DEATH"],
    ["BOA HANCOCK", "MITSURI"], ["MUZAN", "DIO BRANDO"]
],
    "Séries & Films": [
        ["GAME OF THRONES", "WITCHER"], ["STRANGER THINGS", "DARK"], ["LA CASA DE PAPEL", "PRISON BREAK"],
        ["MARVEL", "DC COMICS"], ["SQUID GAME", "ALICE IN BORDERLAND"], ["BATMAN", "SUPERMAN"],
        ["HARRY POTTER", "VOLDEMORT"], ["STAR WARS", "STAR TREK"], ["TITANIC", "AVATAR"], ["JOKER", "BANE"],
        ["TOP GUN", "MISSION IMPOSSIBLE"], ["WEDNESDAY", "SABRINA"], ["BREAKING BAD", "BETTER CALL SAUL"],
        ["SHERLOCK", "LUPIN"], ["JAMES BOND", "ETHAN HUNT"], ["SPIDERMAN", "IRON MAN"],
        ["GLADIATOR", "300"], ["GREY'S ANATOMY", "HOUSE"], ["THE BOYS", "INVINCIBLE"], ["ELITE", "EUPHORIA"]
    ],
    "Jeux Vidéo": [
        ["FORNITE", "WARZONE"], ["FIFA", "PES"], ["MARIO", "SONIC"], ["ZELDA", "ELDEN RING"],
        ["GTA V", "RED DEAD"], ["MINECRAFT", "ROBLOX"], ["LEAGUE OF LEGENDS", "DOTA 2"], ["PAC-MAN", "TETRIS"],
        ["PLAYSTATION", "XBOX"], ["NINTENDO", "SEGA"], ["KART", "VOITURE"], ["LINK", "ZELDA"],
        ["CALL OF DUTY", "BATTLEFIELD"], ["VALORANT", "OVERWATCH"], ["GENSHIN IMPACT", "HONKAI"],
        ["POKÉMON", "DIGIMON"], ["WOW", "FF14"], ["CS:GO", "RAINBOW SIX"], ["SONY", "MICROSOFT"], ["Kratos", "Atreus"]
    ]
};

function startRoomTimer(r, duration = 60) {
    const game = rooms[r];
    if (!game) return;
    if (roomTimers[r]) clearInterval(roomTimers[r]);

    let timeLeft = duration; 
    io.to(r).emit('timer_update', timeLeft);

    roomTimers[r] = setInterval(() => {
        timeLeft--;
        io.to(r).emit('timer_update', timeLeft);
        if (timeLeft <= 0) {
            clearInterval(roomTimers[r]);
           if (game.phase.startsWith("indice")) {
                io.to(r).emit('force_clue', "PAS_D_INDICE");
            } else if (game.phase === "discussion") {
                game.phase = "vote";
                game.skipChatVotes = [];
                startRoomTimer(r); 
                io.to(r).emit('update_room', game);
            } else if (game.phase === "vote") {
                io.to(r).emit('force_vote');
            }
        }
    }, 1000);
}

function startGame(r) {
    const game = rooms[r];
    if (!game) return;

    game.phase = "indice";
    game.tour = 0;
    game.round = 1;
    game.clues = [];
    game.votes = {}; 
    game.hackerUsed = false; 
    
    // --- LOGIQUE DE THÈME CORRIGÉE ---
    // On récupère le thème depuis les options du jeu, sinon "Classique" par défaut
    const themeChoisi = (game.options && game.options.theme) ? game.options.theme : "Classique";
    
    // On récupère la liste correspondante dans notre dictionnaire THEMES
    const listeMots = THEMES[themeChoisi] || THEMES["Classique"];
    
    // On tire une paire au hasard dans cette liste
    const pair = listeMots[Math.floor(Math.random() * listeMots.length)];
    // ---------------------------------

    const shufflePlayers = [...game.players].sort(() => Math.random() - 0.5);
    game.turnOrder = shufflePlayers.map(p => p.id);

    game.players.forEach(p => {
        // L'Undercover et le Hacker reçoivent le mot "intrus", les Civils le mot "normal"
        if (p.role === "undercover" || p.role === "hacker") {
            p.mot = pair[1];
        } else {
            p.mot = pair[0];
        }
    });

    io.to(r).emit('update_room', game);
    startRoomTimer(r);
}

// Fonction utilitaire pour envoyer la liste des salons publics à tout le monde
function broadcastPublicRooms() {
    const publicRooms = Object.values(rooms)
        .filter(r => r.isPrivate === false && r.phase === "attente")
        .map(r => ({ name: r.room, count: r.players.length }));
    io.emit('list_rooms', publicRooms);
}

io.on('connection', (socket) => {
    
    // Envoyer la liste dès la connexion
    broadcastPublicRooms();

    // --- REJOINDRE UN SALON (CORRIGÉ) ---
    socket.on('join_room', ({ room, username, isCreating, isPrivateMode }) => {
        if (!isCreating && !rooms[room]) return socket.emit('error_msg', "CE SALON N'EXISTE PAS");
        if (isCreating && rooms[room]) return socket.emit('error_msg', "CE SALON EST DÉJÀ OCCUPÉ");

        socket.join(room);
        socket.roomName = room;
        socket.username = username;

        if (!rooms[room]) {
            rooms[room] = { 
                phase: "attente", 
                players: [], 
                clues: [], 
                tour: 0, 
                round: 1, 
                votes: {}, 
                turnOrder: [], 
                hostId: socket.id,
                isPrivate: isPrivateMode, // VARIABLE MAINTENANT DÉFINIE
                room: room,
                options: { enableHacker: false, extraUndercover: false },
                hackerVictimId: null,
                hackerTrapWord: "",
                hackerUsed: false,
                discussionMessages: [], 
                skipChatVotes: [],
                roomName: room
            };
        }

        const colors = ["#22d3ee", "#fbbf24", "#f87171", "#c084fc", "#4ade80", "#fb923c"];
        rooms[room].players.push({
            id: socket.id, 
            nom: username, 
            ready: false,
            color: colors[rooms[room].players.length % colors.length],
            role: "", 
            mot: ""
        });

        // Mise à jour pour les joueurs du salon
        io.to(room).emit('update_room', rooms[room]);
        
        // Mise à jour de la liste publique pour les gens au menu
        broadcastPublicRooms();

        // Envoi de l'état initial (Hôte ou non)
        socket.emit('init_state', { 
            isHost: rooms[room].hostId === socket.id,
            phase: rooms[room].phase 
        });
    });

    socket.on('send_chat_message', (msg) => {
        const r = socket.roomName;
        const game = rooms[r];
        const p = game?.players.find(pl => pl.id === socket.id);

        if (game && game.phase === 'discussion' && p) {
            if (!game.discussionMessages) game.discussionMessages = [];
            game.discussionMessages.push({
                auteur: p.nom,
                texte: msg.toUpperCase(),
                color: p.color
            });
            io.to(r).emit('update_room', game);
        }
    });

    socket.on('vote_skip_chat', () => {
        const r = socket.roomName;
        const game = rooms[r];
        if (game && game.phase === 'discussion') {
            if (!game.skipChatVotes) game.skipChatVotes = [];
            if (!game.skipChatVotes.includes(socket.id)) game.skipChatVotes.push(socket.id);
            if (game.skipChatVotes.length >= game.players.length) {
                game.phase = "vote";
                startRoomTimer(r, 60);
            }
            io.to(r).emit('update_room', game);
        }
    });

    socket.on('restart_game', () => {
        const r = socket.roomName;
        const game = rooms[r];
        if (game && socket.id === game.hostId) {
            game.phase = "attente";
            game.tour = 0;
            game.round = 1;
            game.clues = [];
            game.votes = {};
            game.hackerTrapWord = "";
            game.hackerUsed = false;
            game.players.forEach(p => {
                p.ready = false;
                p.role = "";
                p.mot = "";
            });
            io.to(r).emit('update_room', game);
            broadcastPublicRooms(); // Le salon redevient "En attente", on le remontre
        }
    });

    socket.on('set_ready', (options) => {
        const r = socket.roomName;
        if (!rooms[r]) return;
        const game = rooms[r];
        const p = game.players.find(pl => pl.id === socket.id);
        if (p) p.ready = !p.ready;

        if (socket.id === game.hostId && options) game.options = options;

        if (game.players.length >= 3 && game.players.every(pl => pl.ready)) {
            let roles = [];
            if (game.options.enableHacker && game.players.length >= 5) roles.push('hacker');
            roles.push('undercover');
            if (game.options.extraUndercover && game.players.length >= 5) roles.push('undercover');
            while (roles.length < game.players.length) roles.push('civil');
            
            roles = roles.sort(() => Math.random() - 0.5);
            game.players.forEach((pl, i) => pl.role = roles[i]);

            if (roles.includes('hacker')) {
                const hacker = game.players.find(pl => pl.role === 'hacker');
                const civils = game.players.filter(pl => pl.role === 'civil');
                if (civils.length > 0) {
                    const target = civils[Math.floor(Math.random() * civils.length)];
                    game.hackerVictimId = target.id;
                    io.to(hacker.id).emit('hacker_init', { targetName: target.nom });
                }
            }
            game.discussionMessages = []; 
            game.skipChatVotes = [];
            startGame(r);
            broadcastPublicRooms(); // La partie commence, on l'enlève de la liste publique
        } else {
            io.to(r).emit('update_room', game);
        }
    });
    // --- LOGIQUE DU HACKER ---
socket.on('set_hacker_word', (word) => {
    const r = socket.roomName;
    const game = rooms[r];
    if (game) {
        // On enregistre le mot de substitution dans le salon
        game.hackerTrapWord = word.toUpperCase();
        console.log("Le hacker a piégé le mot : " + game.hackerTrapWord);
    }
});

    socket.on('send_clue', (texte) => {
        const r = socket.roomName;
        const game = rooms[r];
        if (!game || game.phase !== "indice") return;
        if (game.turnOrder[game.tour] !== socket.id) return;

        const p = game.players.find(pl => pl.id === socket.id);
        let texteFinal = texte;

        if (game.round === 1 && socket.id === game.hackerVictimId && game.hackerTrapWord) {
            texteFinal = game.hackerTrapWord;
            game.hackerTrapWord = ""; 
        }

        game.clues.push({ auteur: p.nom, texte: texteFinal, color: p.color });

        if (game.tour < game.turnOrder.length - 1) {
            game.tour++;
        } else {
            if (game.round < 2) {
                game.round++;
                game.tour = 0;
            } else {
                game.phase = "discussion";
                startRoomTimer(r, 120);
            }
        }
        io.to(r).emit('update_room', game);
        if (game.phase === "indice") startRoomTimer(r);
    });

    socket.on('vote_player', (targetNom) => {
        const r = socket.roomName;
        const game = rooms[r];
        if (!game || game.phase !== "vote") return;

        let voter = game.players.find(pl => pl.nom === socket.username) || game.players.find(pl => pl.id === socket.id);

        if (voter && !game.votes[voter.nom]) {
            game.votes[voter.nom] = targetNom;
            io.to(r).emit('update_room', game);
        }

        if (Object.keys(game.votes).length === game.players.length) {
            if (roomTimers[r]) clearInterval(roomTimers[r]);
            const voteCounts = {};
            Object.values(game.votes).forEach(nom => { voteCounts[nom] = (voteCounts[nom] || 0) + 1; });

            let maxVotes = 0;
            let quiEstElimine = "";
            for (const [nom, count] of Object.entries(voteCounts)) {
                if (count > maxVotes) { maxVotes = count; quiEstElimine = nom; }
            }

            const elimineJoueur = game.players.find(p => p.nom === quiEstElimine);
            const undercover = game.players.find(p => p.role === 'undercover');
            const hacker = game.players.find(p => p.role === 'hacker');
            const uNom = undercover ? undercover.nom : "Inconnu";
            const hNom = hacker ? hacker.nom : "Inconnu";

            if (elimineJoueur && (elimineJoueur.role === 'undercover' || elimineJoueur.role === 'hacker')) {
                game.winnerRole = "Les Civils";
                game.endMessage = `Mission accomplie ! Vous avez démasqué l'infiltré (${uNom}) et le hacker (${hNom}).`;
            } else {
                game.winnerRole = "Les Undercovers";
                game.endMessage = `Échec de la mission ! L'infiltré était ${uNom} et le complice hacker était ${hNom}.`;
            }
            game.phase = "resultats";
            io.to(r).emit('update_room', game);
       } 
    });

    socket.on('disconnect', () => {
        Object.keys(rooms).forEach(roomName => {
            const game = rooms[roomName];
            if (game.hostId === socket.id) {
                io.to(roomName).emit('host_left');
                delete rooms[roomName];
            } else {
                const pIdx = game.players.findIndex(p => p.id === socket.id);
                if (pIdx !== -1) {
                    game.players.splice(pIdx, 1);
                    io.to(roomName).emit('update_room', game);
                }
            }
        });
        broadcastPublicRooms();
    });

    socket.on('get_public_rooms', () => {
        broadcastPublicRooms();
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Serveur sur port ${PORT}`));
