const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let rooms = {};
let roomTimers = {};

const WORDS = [
    // --- THÈME MANGA & ANIME ---
    ["NARUTO", "SASUKE"], ["ONE PIECE", "DRAGON BALL"], ["LUFFY", "ZORO"],
    ["DBZ", "NARUTO"], ["POKÉMON", "DIGIMON"], ["SHINGEKI NO KYOJIN", "DEATH NOTE"],
    ["PIKACHU", "RAICHU"], ["SANGOKU", "VEGETA"], ["HUNTER X HUNTER", "YU-GI-OH"],
    // --- SÉRIES TÉLÉ ---
    ["GAME OF THRONES", "HOUSE OF THE DRAGON"], ["STRANGER THINGS", "DARK"],
    ["LA CASA DE PAPEL", "PRISON BREAK"], ["FRIENDS", "HOW I MET YOUR MOTHER"],
    ["THE WALKING DEAD", "THE LAST OF US"], ["PEAKY BLINDERS", "BOARDWALK EMPIRE"],
    ["SQUID GAME", "ALICE IN BORDERLAND"], ["THE CROWN", "BRIDGERTON"],
    // --- JEUX VIDÉO ---
    ["FORNITE", "WARZONE"], ["FIFA", "PES"], ["MARIO", "SONIC"],
    ["ZELDA", "ELDEN RING"], ["MINECRAFT", "ROBLOX"], ["GTA V", "RED DEAD REDEMPTION"],
    ["LEAGUE OF LEGENDS", "DOTA 2"], ["AMONG US", "FALL GUYS"], ["CALL OF DUTY", "BATTLEFIELD"],
    // --- PERSONNAGES PUBLICS ---
    ["MESSI", "CRISTIANO RONALDO"], ["MBAPPÉ", "HAALAND"], ["ELON MUSK", "JEFF BEZOS"],
    ["DONALD TRUMP", "BARACK OBAMA"], ["JUL", "PNL"], ["EMMANUEL MACRON", "NICOLAS SARKOZY"],
    ["JUSTIN BIEBER", "DRAKE"], ["BEYONCÉ", "RIHANNA"],
    // --- IDÉES BONUS ---
    ["MARSEILLE", "PARIS"], ["NEW YORK", "LOS ANGELES"], ["APPLE", "SAMSUNG"],
    ["MC DONALD'S", "BURGER KING"], ["COCA-COLA", "PEPSI"], ["NETFLIX", "DISNEY+"],
    ["ADIDAS", "NIKE"], ["TESLA", "FERRARI"], ["SNAPCHAT", "INSTAGRAM"]
];

function startRoomTimer(r) {
    const game = rooms[r];
    if (!game) return;
    if (roomTimers[r]) clearInterval(roomTimers[r]);

    let timeLeft = 60; 
    io.to(r).emit('timer_update', timeLeft);

    roomTimers[r] = setInterval(() => {
        timeLeft--;
        io.to(r).emit('timer_update', timeLeft);
        if (timeLeft <= 0) {
            clearInterval(roomTimers[r]);
            if (game.phase.startsWith("indice")) {
                io.to(r).emit('force_clue', "PAS_D_INDICE");
            } else if (game.phase === "vote") {
                io.to(r).emit('force_vote');
            }
        }
    }, 1000);
}

io.on('connection', (socket) => {
    
    socket.on('join_room', ({ room, username, isCreating }) => {
        // Sécurité : Salon inexistant ou déjà occupé
        if (!isCreating && !rooms[room]) {
            return socket.emit('error_msg', "CE SALON N'EXISTE PAS");
        }
        if (isCreating && rooms[room]) {
            return socket.emit('error_msg', "CE SALON EST DÉJÀ OCCUPÉ");
        }

        socket.join(room);
        socket.roomName = room;
        socket.username = username;

        if (!rooms[room]) {
            rooms[room] = { 
                phase: "attente", players: [], clues: [], tour: 0, 
                round: 1, votes: {}, turnOrder: [], hostId: socket.id, room: room 
            };
        }

        const colors = ["#22d3ee", "#fbbf24", "#f87171", "#c084fc", "#4ade80", "#fb923c"];
        rooms[room].players.push({
            id: socket.id, nom: username, ready: false,
            color: colors[rooms[room].players.length % colors.length],
            role: "", mot: ""
        });

        io.to(room).emit('update_room', rooms[room]);
    });

    socket.on('set_ready', () => {
        const r = socket.roomName;
        if (!rooms[r]) return;
        const p = rooms[r].players.find(pl => pl.id === socket.id);
        if (p) p.ready = !p.ready;

        if (rooms[r].players.length >= 3 && rooms[r].players.every(pl => pl.ready)) {
            startGame(r);
        } else {
            io.to(r).emit('update_room', rooms[r]);
        }
    });

    function startGame(r) {
        const game = rooms[r];
        game.phase = "indice";
        game.tour = 0;
        game.round = 1;
        game.clues = [];
        game.votes = {};

        const pair = WORDS[Math.floor(Math.random() * WORDS.length)];
        const shufflePlayers = [...game.players].sort(() => Math.random() - 0.5);
        const undercoverIdx = Math.floor(Math.random() * shufflePlayers.length);
        
        game.turnOrder = shufflePlayers.map(p => p.id);
        game.players.forEach(p => {
            const isUnder = (p.id === game.turnOrder[undercoverIdx]);
            p.role = isUnder ? "undercover" : "civil";
            p.mot = isUnder ? pair[1] : pair[0];
        });

        io.to(r).emit('update_room', game);
        startRoomTimer(r);
    }

    socket.on('send_clue', (texte) => {
        const r = socket.roomName;
        const game = rooms[r];
        if (!game || game.phase !== "indice" || game.turnOrder[game.tour] !== socket.id) return;

        const p = game.players.find(pl => pl.id === socket.id);
        game.clues.push({ auteur: p.nom, texte, color: p.color });

        if (game.tour < game.turnOrder.length - 1) {
            game.tour++;
        } else {
            if (game.round < 2) {
                game.round++;
                game.tour = 0;
            } else {
                game.phase = "vote";
                game.votes = {};
            }
        }
        io.to(r).emit('update_room', game);
        startRoomTimer(r);
    });

    socket.on('vote_player', (targetNom) => {
        const r = socket.roomName;
        const game = rooms[r];
        if (!game || game.phase !== "vote") return;

        const voter = game.players.find(pl => pl.id === socket.id);
        if (voter && !game.votes[voter.nom]) {
            game.votes[voter.nom] = targetNom;
        }

        if (Object.keys(game.votes).length === game.players.length) {
            if (roomTimers[r]) clearInterval(roomTimers[r]);
            game.phase = "resultats";
        }
        io.to(r).emit('update_room', game);
    });

    socket.on('restart_game', () => {
        const r = socket.roomName;
        if (rooms[r] && socket.id === rooms[r].hostId) startGame(r);
    });

    socket.on('disconnect', () => {
        const r = socket.roomName;
        if (rooms[r]) {
            if (socket.id === rooms[r].hostId) {
                io.to(r).emit('host_left_event');
                if (roomTimers[r]) clearInterval(roomTimers[r]);
                delete rooms[r];
            } else {
                rooms[r].players = rooms[r].players.filter(p => p.id !== socket.id);
                if (rooms[r].players.length === 0) {
                    if (roomTimers[r]) clearInterval(roomTimers[r]);
                    delete rooms[r];
                    return;
                }
                const game = rooms[r];
                if (game.phase === "indice") {
                    game.turnOrder = game.turnOrder.filter(id => id !== socket.id);
                    if (game.tour >= game.turnOrder.length) game.tour = 0;
                    io.to(r).emit('update_room', game);
                    startRoomTimer(r);
                }
                if (game.phase === "vote") {
                    if (Object.keys(game.votes).length >= game.players.length && game.players.length > 0) {
                        if (roomTimers[r]) clearInterval(roomTimers[r]);
                        game.phase = "resultats";
                    }
                    io.to(r).emit('update_room', game);
                }
            }
        }
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Serveur sur port ${PORT}`));
