const socket = io();
let monPseudo = "", isHost = false;

// --- AUDIO ---
const bgMusic = new Audio('music.mp3'); 
bgMusic.loop = true; 
bgMusic.volume = 0.2;
const dropSfx = new Audio('https://assets.mixkit.co/active_storage/sfx/710/710-preview.mp3');

function playClick() { 
    const s = dropSfx.cloneNode(); 
    s.play().catch(() => {}); 
}

// --- NAVIGATION & LOGIN ---
document.getElementById('mode-create').onclick = () => { 
    playClick(); 
    document.getElementById('area-create').classList.toggle('hidden'); 
    document.getElementById('area-join').classList.add('hidden'); 
};

document.getElementById('mode-join').onclick = () => { 
    playClick(); 
    document.getElementById('area-join').classList.toggle('hidden'); 
    document.getElementById('area-create').classList.add('hidden'); 
};

document.getElementById('btn-confirm-create').onclick = () => {
    playClick();
    monPseudo = document.getElementById('username').value.trim().toUpperCase();
    const room = document.getElementById('new-roomid').value.trim().toUpperCase();
    if(monPseudo && room) { 
        isHost = true; 
        socket.emit('join_room', { room, username: monPseudo, isCreating: true }); 
    }
};

document.getElementById('btn-confirm-join').onclick = () => {
    playClick();
    monPseudo = document.getElementById('username').value.trim().toUpperCase();
    const room = document.getElementById('join-roomid').value.trim().toUpperCase();
    if(monPseudo && room) { 
        socket.emit('join_room', { room, username: monPseudo, isCreating: false }); 
    }
};

document.getElementById('btn-leave-room').onclick = () => { 
    playClick(); 
    location.reload(); 
};

document.getElementById('btn-ready').onclick = () => { 
    playClick(); 
    socket.emit('set_ready'); 
};

// --- GESTION DE LA MODALE INDICES ---
const modalIndices = document.getElementById('modal-indices');
document.getElementById('btn-open-indices').onclick = () => {
    playClick();
    const contenuIndices = document.getElementById('clue-list').innerHTML;
    document.getElementById('clue-list-full').innerHTML = contenuIndices;
    modalIndices.classList.remove('hidden');
};

const fermerDossier = () => {
    playClick();
    modalIndices.classList.add('hidden');
};
document.getElementById('btn-close-indices').onclick = fermerDossier;
document.getElementById('btn-close-indices-bottom').onclick = fermerDossier;

// --- JEU : ACTIONS ---
document.getElementById('btn-send-clue').onclick = () => {
    playClick();
    const input = document.getElementById('clue-input');
    // Sécurité : Uniquement le premier mot
    const premierMot = input.value.trim().split(' ')[0].toUpperCase();
    if (premierMot) {
        socket.emit('send_clue', premierMot);
        input.value = ""; 
    }
};

document.getElementById('btn-replay').onclick = () => { 
    playClick(); 
    socket.emit('restart_game'); 
};

document.getElementById('btn-invite-whatsapp').onclick = () => {
    const msg = `CODE DE MISSION : ${socket.roomName}\nPoint de ralliement : ${window.location.origin}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
};

// --- SOCKET EVENTS ---
socket.on('timer_update', (time) => {
    const timerEl = document.getElementById('timer-display');
    if(timerEl) {
        timerEl.innerText = `TEMPS RESTANT : ${time}s`;
        timerEl.style.color = time <= 10 ? "#ff4444" : "#22d3ee";
    }
});

socket.on('force_clue', (msg) => {
    const cBox = document.getElementById('clue-box');
    if (cBox && !cBox.classList.contains('hidden')) {
        socket.emit('send_clue', msg);
        document.getElementById('clue-input').value = "";
    }
});
socket.on('force_vote', () => {
    const vL = document.getElementById('vote-list');
    // On vérifie si la section de vote est active et si l'agent n'a pas encore voté
    const rapportEnvoye = vL.innerHTML.includes('Rapport envoyé');
    const sectionVoteVisible = !document.getElementById('vote-section').classList.contains('hidden');

    if (sectionVoteVisible && !rapportEnvoye) {
        const buttons = vL.querySelectorAll('button');
        if (buttons.length > 0) {
            // Choix d'une cible au hasard
            const randomBtn = buttons[Math.floor(Math.random() * buttons.length)];
            playClick();
            randomBtn.click(); // Simule le clic sur le bouton de vote
        }
    }
});

socket.on('error_msg', (msg) => {
    const el = document.getElementById('error-msg'); 
    el.innerText = msg; 
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 3000);
});

socket.on('update_room', (game) => {
    socket.roomName = game.room || socket.roomName;
    document.getElementById('screen-login').classList.add('hidden');
    document.getElementById('btn-leave-room').classList.remove('hidden');
    
    if (game.phase === "attente") { 
        showScreen('screen-lobby'); 
        renderLobby(game); 
    } else { 
        showScreen('screen-game'); 
        renderGame(game); 
    }
});

socket.on('host_left_event', () => {
    showScreen('screen-host-left');
    document.getElementById('btn-leave-room').classList.add('hidden');
});

// --- RENDER FUNCTIONS ---
function showScreen(id) {
    ['screen-login', 'screen-lobby', 'screen-game', 'screen-host-left'].forEach(s => {
        document.getElementById(s).classList.add('hidden');
    });
    document.getElementById(id).classList.remove('hidden');
}

function renderLobby(game) {
    document.getElementById('display-room').innerText = "CANAL: " + socket.roomName;
    const list = document.getElementById('player-list');
    list.innerHTML = game.players.map(p => `
        <div class="glass p-4 rounded-2xl flex justify-between font-black animate-pop" style="border-left: 4px solid ${p.color}">
            <span style="color: ${p.color}">${p.nom}</span>
            <span class="${p.ready ? 'text-cyan-400' : 'text-white/10'} text-[9px] uppercase">${p.ready ? 'ACTIF' : 'ATTENTE'}</span>
        </div>
    `).join('');
    
    // Correction ici : on cherche le joueur par son ID socket pour être sûr
    const moiInLobby = game.players.find(p => p.id === socket.id);
    const btnReady = document.getElementById('btn-ready');
    if(moiInLobby) {
        btnReady.innerText = moiInLobby.ready ? "ANNULER BRIEFING" : "CONFIRMER DISPONIBILITÉ";
    }
}

function renderGame(game) {
    const moi = game.players.find(p => p.nom === monPseudo || p.id === socket.id);
    if (!moi) return;

    // Animation du mot secret
    const wordDisplay = document.getElementById('secret-word');
    if (wordDisplay.innerText !== moi.mot) {
        wordDisplay.innerText = moi.mot;
        wordDisplay.classList.remove('animate-stamp');
        void wordDisplay.offsetWidth;
        wordDisplay.classList.add('animate-stamp');
    }
    
    // Indices
    const clueHTML = game.clues.map(c => `
        <div class="bg-white/5 p-3 rounded-xl border-l-2 mb-2 animate-pop" style="border-color:${c.color}">
            <div class="text-[8px] font-black opacity-30 uppercase">${c.auteur}</div>
            <div class="text-sm font-bold text-white uppercase font-mono">${c.texte}</div>
        </div>
    `).join('');
    
    document.getElementById('clue-list').innerHTML = clueHTML;
    document.getElementById('clue-list').scrollTop = document.getElementById('clue-list').scrollHeight;

    const ind = document.getElementById('turn-indicator');
    const cBox = document.getElementById('clue-box');
    const vSec = document.getElementById('vote-section');
    const vL = document.getElementById('vote-list');
    const rSec = document.getElementById('result-section');

    // Reset visibilité
    [cBox, vSec, rSec].forEach(el => el.classList.add('hidden'));
    ind.classList.remove('hidden');

    if(game.phase.startsWith("indice")) {
        const activePlayerId = game.turnOrder[game.tour];
        const activePlayer = game.players.find(p => p.id === activePlayerId);

        if (activePlayer) {
            ind.style.color = activePlayer.color;
            if(socket.id === activePlayerId) {
                cBox.classList.remove('hidden');
                ind.innerText = "À VOUS DE TRANSMETTRE L'INDICE";
            } else {
                ind.innerText = `ANALYSE : ${activePlayer.nom} TRANSMET...`;
            }
        }
    } 
    else if(game.phase === "vote") {
        ind.innerText = "ÉLIMINATION DE LA CIBLE";
        vSec.classList.remove('hidden');
        
        // On vérifie si l'utilisateur local a déjà voté
        const jAiVote = game.votes[monPseudo] || game.votes[moi.nom];

        if(jAiVote) {
            vL.innerHTML = "<div class='py-8 opacity-20 font-black uppercase text-[10px] tracking-widest text-center animate-pulse'>Rapport envoyé. Attente des autres agents...</div>";
        } else {
            vL.innerHTML = ""; 
            game.players.forEach(p => {
                // On affiche tous les joueurs SAUF l'utilisateur local (celui qui regarde l'écran)
                if (p.id !== socket.id && p.nom !== moi.nom) {
                    const btn = document.createElement('button');
                    btn.className = "glass p-4 rounded-xl border border-white/10 font-black mb-2 w-full text-white active:scale-95 transition-all uppercase text-[10px] tracking-widest";
                    btn.innerHTML = `<span style="color:${p.color}">${p.nom}</span>`;
                    btn.onclick = () => {
                        playClick();
                        socket.emit('vote_player', p.nom);
                    };
                    vL.appendChild(btn);
                }
            });
        }
    
    } 
    else if(game.phase === "resultats") {
        rSec.classList.remove('hidden'); 
        ind.classList.add('hidden');
        const res = calculateFinal(game);
        const winMsg = document.getElementById('win-message');
        winMsg.innerText = res.win ? "SUCCÈS DE L'AGENCE" : "ÉCHEC DE LA MISSION";
        winMsg.style.color = res.win ? "#4ade80" : "#ef4444";
        
        document.getElementById('final-reveal').innerHTML = `
            <div class='bg-white/5 p-8 rounded-[35px] font-black uppercase text-xs border border-white/5'>
                <p class='opacity-20 mb-2'>L'infiltré était</p>
                <span class='text-xl tracking-tighter'>${res.uNom}</span><br>
                <p class='opacity-30 mt-4'>${res.uWord} VS ${res.cWord}</p>
            </div>`;
        
        if(isHost) {
            document.getElementById('btn-replay').classList.remove('hidden');
            document.getElementById('wait-host-msg').classList.add('hidden');
        } else {
            document.getElementById('btn-replay').classList.add('hidden');
            document.getElementById('wait-host-msg').classList.remove('hidden');
        }
    }
}

function calculateFinal(game) {
    let counts = {};
    Object.values(game.votes).forEach(nom => {
        counts[nom] = (counts[nom] || 0) + 1;
    });
    let sortedVotes = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    let target = sortedVotes[0] || "";
    let u = game.players.find(p => p.role === "undercover");
    let c = game.players.find(p => p.role === "civil");
    return { win: target === u?.nom, uNom: u ? u.nom : "Inconnu", uWord: u ? u.mot : "?", cWord: c ? c.mot : "?" };
}

// Musique au premier clic
document.addEventListener('click', () => { 
    bgMusic.play().catch(() => {}); 
}, { once: true });
