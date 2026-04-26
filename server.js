const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Remplace tes lignes actuelles par celles-ci :
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    // On précise que le fichier est dans le dossier 'public'
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

let rooms = {};
let roomTimers = {};

const WORDS = [
    ["NARUTO", "SASUKE"], ["ONE PIECE", "DRAGON BALL"], ["LUFFY", "ZORO"],
    ["DBZ", "NARUTO"], ["POKÉMON", "DIGIMON"], ["SHINGEKI NO KYOJIN", "DEATH NOTE"],
    ["PIKACHU", "RAICHU"], ["SANGOKU", "VEGETA"], ["HUNTER X HUNTER", "YU-GI-OH"],
    ["GAME OF THRONES", "HOUSE OF THE DRAGON"], ["STRANGER THINGS", "DARK"],
    ["LA CASA DE PAPEL", "PRISON BREAK"], ["FRIENDS", "HOW I MET YOUR MOTHER"],
    ["THE WALKING DEAD", "THE LAST OF US"], ["PEAKY BLINDERS", "BOARDWALK EMPIRE"],
    ["SQUID GAME", "ALICE IN BORDERLAND"], ["THE CROWN", "BRIDGERTON"],
    ["FORNITE", "WARZONE"], ["FIFA", "PES"], ["MARIO", "SONIC"],
    ["ZELDA", "ELDEN RING"], ["MINECRAFT", "ROBLOX"], ["GTA V", "RED DEAD REDEMPTION"],
    ["LEAGUE OF LEGENDS", "DOTA 2"], ["AMONG US", "FALL GUYS"], ["CALL OF DUTY", "BATTLEFIELD"],
    ["MESSI", "CRISTIANO RONALDO"], ["MBAPPÉ", "HAALAND"], ["ELON MUSK", "JEFF BEZOS"],
    ["DONALD TRUMP", "BARACK OBAMA"], ["JUL", "PNL"], ["EMMANUEL MACRON", "NICOLAS SARKOZY"],
    ["JUSTIN BIEBER", "DRAKE"], ["BEYONCÉ", "RIHANNA"],
    ["MARSEILLE", "PARIS"], ["NEW YORK", "LOS ANGELES"], ["APPLE", "SAMSUNG"],
    ["MC DONALD'S", "BURGER KING"], ["COCA-COLA", "PEPSI"], ["NETFLIX", "DISNEY+"],
    ["ADIDAS", "NIKE"], ["TESLA", "FERRARI"], ["SNAPCHAT", "INSTAGRAM"]
];

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
                // AJOUT ICI : Si le temps du chat est fini
                game.phase = "vote";
                game.skipChatVotes = [];
                // On relance le timer pour les 60s du vote
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

    // --- RÉINITIALISATION CRUCIALE ---
    game.phase = "indice";
    game.tour = 0;
    game.round = 1;
    game.clues = [];
    game.votes = {}; // On vide les anciens votes
    game.hackerUsed = false; // On permet au hacker de re-pirater
    // On ne vide PAS hackerTrapWord ici, il sera écrasé par le nouveau choix
    
    // ... reste de ta fonction (choix des mots et turnOrder)

    const pair = WORDS[Math.floor(Math.random() * WORDS.length)];
    const shufflePlayers = [...game.players].sort(() => Math.random() - 0.5);
    game.turnOrder = shufflePlayers.map(p => p.id);

    game.players.forEach(p => {
        if (p.role === "undercover" || p.role === "hacker") {
            p.mot = pair[1];
        } else {
            p.mot = pair[0];
        }
        game.players.forEach(p => {
    // Le Hacker reçoit le même mot que l'Undercover pour ne pas être découvert
    if (p.role === "undercover" || p.role === "hacker") {
        p.mot = pair[1];
    } else {
        p.mot = pair[0];
    }
});
    });

    io.to(r).emit('update_room', game);
    startRoomTimer(r);
}

io.on('connection', (socket) => {
    
    // --- REJOINDRE UN SALON ---
    socket.on('join_room', ({ room, username, isCreating }) => {
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
                room: room,
                options: { enableHacker: false, extraUndercover: false },
                hackerVictimId: null,
                hackerTrapWord: "",
                hackerUsed: false,
                // --- AJOUTE CES DEUX LIGNES ICI ---
                discussionMessages: [], 
                skipChatVotes: []
                // ----------------------------------
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

        io.to(room).emit('update_room', rooms[room]);
    }); // <--- ICI LE JOIN_ROOM EST PROPREMENT FERMÉ
// --- LOGIQUE DU DÉBAT (CHAT) ---
    socket.on('send_chat_message', (msg) => {
        const r = socket.roomName;
        const game = rooms[r];
        const p = game?.players.find(pl => pl.id === socket.id);

        if (game && game.phase === 'discussion' && p) {
            // Sécurité au cas où l'objet n'est pas initialisé
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
            
            if (!game.skipChatVotes.includes(socket.id)) {
                game.skipChatVotes.push(socket.id);
            }

            // Si tout le monde a cliqué sur "Passer"
            if (game.skipChatVotes.length >= game.players.length) {
                game.phase = "vote";
                if (typeof startRoomTimer === "function") startRoomTimer(r, 60);
            }
            io.to(r).emit('update_room', game);
        }
    });
    // --- RELANCER LA PARTIE (À PLACER ICI) ---
    socket.on('restart_game', () => {
    const r = socket.roomName;
    const game = rooms[r];

    if (game && socket.id === game.hostId) {
        //On remet la phase en attente (Lobby)
        game.phase = "attente";
        game.tour = 0;
        game.round = 1;
        game.clues = [];
        game.votes = {};
        game.hackerTrapWord = "";
        game.hackerUsed = false;

        // IMPORTANT : On remet tout le monde en "Non Prêt"
        game.players.forEach(p => {
            p.ready = false;
            p.role = "";
            p.mot = "";
        });

        console.log(`Retour au lobby pour la room : ${r}`);
        
        // On envoie la mise à jour : les clients vont afficher le lobby automatiquement
        io.to(r).emit('update_room', game);
    }
});

    // --- LA SUITE DE TES ÉVÉNEMENTS (set_ready, send_clue, etc.) ---

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

            // --- LOGIQUE HACKER : ON DÉSIGNE LA CIBLE ICI ---
            if (roles.includes('hacker')) {
                const hacker = game.players.find(pl => pl.role === 'hacker');
                const civils = game.players.filter(pl => pl.role === 'civil');
                if (civils.length > 0) {
                    const target = civils[Math.floor(Math.random() * civils.length)];
                    game.hackerVictimId = target.id;
                    // On prévient le hacker avec le nom de sa victime
                    io.to(hacker.id).emit('hacker_init', { targetName: target.nom });
                }
            }
            // À mettre juste avant la ligne 204
game.discussionMessages = []; 
game.skipChatVotes = [];
            startGame(r);
        } else {
            io.to(r).emit('update_room', game);
        }
    });
socket.on('set_hacker_word', (trapWord) => {
    const r = socket.roomName;
    const game = rooms[r];
    
    if (!game || game.hackerUsed) return;

    // On cherche la victime pour être sûr qu'elle existe
    const target = game.players.find(p => p.nom === game.hackerTarget || p.id === game.hackerVictimId);

    if (target) {
        // ON NE TOUCHE PAS à target.mot (sinon il voit le changement sur son écran)
        // On stocke le piège pour le prochain message
        game.hackerTrapWord = trapWord.toUpperCase(); 
        game.hackerUsed = true;
        
        console.log("PIÈGE POSÉ : Le prochain message de " + target.nom + " sera " + trapWord);

        // On avertit le hacker que c'est bon
        socket.emit('hacker_trap_set'); 
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
        console.log(`LE HACK A OPÉRÉ : ${p.nom} a dit "${texteFinal}"`);
    }

    game.clues.push({ 
        auteur: p.nom, 
        texte: texteFinal, 
        color: p.color 
    });

    // --- LOGIQUE DE PASSAGE ---
    if (game.tour < game.turnOrder.length - 1) {
        game.tour++;
    } else {
        if (game.round < 2) {
            game.round++;
            game.tour = 0;
        } else {
            game.phase = "discussion";
            game.discussionMessages = []; 
            game.skipChatVotes = [];
            if (typeof startRoomTimer === "function") startRoomTimer(r, 120);
        }
    }

    // --- CES LIGNES DOIVENT ÊTRE ICI (HORS DU ELSE) ---
    // On prévient tout le monde que le tour a changé, PEU IMPORTE le tour
    io.to(r).emit('update_room', game);

    // On relance le petit timer pour le joueur suivant (seulement si on est encore en phase indice)
    if (game.phase === "indice") {
        if (typeof startRoomTimer === "function") startRoomTimer(r);
    }
});

   socket.on('vote_player', (targetNom) => {
    const r = socket.roomName;
    const game = rooms[r];
    if (!game || game.phase !== "vote") return;

    // --- MODIFICATION ICI ---
    // Au lieu de chercher par socket.id, on cherche par le pseudo stocké dans le socket
    let voter = game.players.find(pl => pl.nom === socket.username);
    
    // Si vraiment on ne trouve pas (cas rare), on cherche par ID
    if (!voter) voter = game.players.find(pl => pl.id === socket.id);

    if (voter && !game.votes[voter.nom]) {
        game.votes[voter.nom] = targetNom;
        console.log(`Vote enregistré pour ${voter.nom}`);
        io.to(r).emit('update_room', game);
    }

    // 2. Vérification si tout le monde a voté
    if (Object.keys(game.votes).length === game.players.length) {
        if (roomTimers[r]) clearInterval(roomTimers[r]);

        // Compte des votes
        const voteCounts = {};
        Object.values(game.votes).forEach(nom => {
            voteCounts[nom] = (voteCounts[nom] || 0) + 1;
        });

        // Qui a le plus de votes ?
        let maxVotes = 0;
        let quiEstElimine = "";
        for (const [nom, count] of Object.entries(voteCounts)) {
            if (count > maxVotes) {
                maxVotes = count;
                quiEstElimine = nom;
            }
        }

        const elimineJoueur = game.players.find(p => p.nom === quiEstElimine);
        
        // --- RÉCUPÉRATION DES RÔLES POUR LE MESSAGE FINAL ---
        const undercover = game.players.find(p => p.role === 'undercover');
        const hacker = game.players.find(p => p.role === 'hacker');
        const uNom = undercover ? undercover.nom : "Inconnu";
        const hNom = hacker ? hacker.nom : "Inconnu";

        // Détermination du gagnant et préparation du message
        if (elimineJoueur && (elimineJoueur.role === 'undercover' || elimineJoueur.role === 'hacker')) {
            game.winnerRole = "Les Civils";
            game.endMessage = `Mission accomplie ! Vous avez démasqué l'infiltré (${uNom}) et le hacker (${hNom}).`;
        } else {
            game.winnerRole = "Les Undercovers";
            game.endMessage = `Échec de la mission ! L'infiltré était ${uNom} et le complice hacker était ${hNom}.`;
        }

        // --- ENVOI DES RÉSULTATS ---
        game.phase = "resultats";
        io.to(r).emit('update_room', game);
   } 
}); // <--- ICI on ferme UNIQUEMENT vote_player

// ON N'UTILISE PAS DE }); ICI CAR ON EST ENCORE DANS io.on('connection')

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
    });

}); // <--- CETTE ACCOLADE FERME LE IO.ON('CONNECTION') DEPUIS LE DÉBUT
function forceVote(roomName) {
    const game = rooms[roomName];
    if (game && game.phase === 'discussion') {
        console.log(`[TIMER] Temps écoulé pour ${roomName}. Passage au vote forcé.`);
        game.phase = "vote";
        game.skipChatVotes = []; // On reset pour la suite
        
        // On lance le timer de la phase de vote (60s comme dans ton code)
        if (typeof startRoomTimer === "function") {
            startRoomTimer(roomName, 60);
        }
        
        io.to(roomName).emit('update_room', game);
    }
}
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Serveur sur port ${PORT}`));