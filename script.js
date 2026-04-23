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

// --- BOUTON WHATSAPP (RESTAURÉ) ---
document.getElementById('btn-invite-whatsapp').onclick = () => {
    const roomName = socket.roomName || "MISSION SECRÈTE";
    const msg = `CODE DE MISSION : ${roomName}\nPoint de ralliement : ${window.location.origin}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
};
// --- BOUTON REJOUER (À RAJOUTER) ---
document.getElementById('btn-replay').onclick = () => { 
    playClick(); 
    console.log("Demande de redémarrage envoyée...");
    socket.emit('restart_game'); 
};

document.getElementById('btn-ready').onclick = () => { 
    playClick(); 
    if (isHost) {
        const options = {
            extraUndercover: document.getElementById('opt-extra-u').checked,
            enableHacker: document.getElementById('opt-hacker').checked
        };
        socket.emit('set_ready', options); 
    } else {
        socket.emit('set_ready'); 
    }
};

// --- MODALE INDICES ---
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
if(document.getElementById('btn-close-indices')) document.getElementById('btn-close-indices').onclick = fermerDossier;
if(document.getElementById('btn-close-indices-bottom')) document.getElementById('btn-close-indices-bottom').onclick = fermerDossier;

// --- ACTIONS JEU ---
document.getElementById('btn-send-clue').onclick = () => {
    playClick();
    const input = document.getElementById('clue-input');
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

// --- SOCKET EVENTS ---
socket.on('timer_update', (time) => {
    const timerEl = document.getElementById('timer-display');
    const timerBar = document.getElementById('timer-bar');
    if(timerEl) {
        timerEl.innerText = `TEMPS RESTANT : ${time}s`;
        timerEl.style.color = time <= 10 ? "#ff4444" : "#22d3ee";
    }
    if(timerBar) {
        const width = (time / 60) * 100;
        timerBar.style.width = `${width}%`;
        timerBar.style.backgroundColor = time <= 10 ? "#ff4444" : "#22d3ee";
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
        const el = document.getElementById(s);
        if(el) el.classList.add('hidden');
    });
    const target = document.getElementById(id);
    if(target) target.classList.remove('hidden');
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
    
    const hostControls = document.getElementById('host-controls');
    if (isHost && hostControls) {
        hostControls.classList.remove('hidden');
        const hRow = document.getElementById('hacker-toggle-row');
        const hInp = document.getElementById('opt-hacker');
        const uInp = document.getElementById('opt-extra-u');
        const uRow = uInp.parentElement;

        const canEnable = game.players.length >= 5;
        if(hRow) hRow.style.opacity = canEnable ? "1" : "0.3";
        if(uRow) uRow.style.opacity = canEnable ? "1" : "0.3";
        if(hInp) hInp.disabled = !canEnable;
        if(uInp) uInp.disabled = !canEnable;
    }

    const moiInLobby = game.players.find(p => p.id === socket.id);
    if(moiInLobby) {
        document.getElementById('btn-ready').innerText = moiInLobby.ready ? "ANNULER BRIEFING" : "CONFIRMER DISPONIBILITÉ";
    }
}

function renderGame(game) {
    const moi = game.players.find(p => p.id === socket.id);
    if (!moi) return;

    const ind = document.getElementById('turn-indicator');
    const cBox = document.getElementById('clue-box');
    const vSec = document.getElementById('vote-section');
    const rSec = document.getElementById('result-section');
    const wordDisplay = document.getElementById('secret-word');
    const tapMsg = document.getElementById('tap-to-reveal');

    // 1. MISE À JOUR DU MOT ET DU FLOU
    if (wordDisplay) {
        // Si le mot a changé (nouvelle partie), on remet le flou
        if (wordDisplay.innerText !== moi.mot) {
            wordDisplay.innerText = moi.mot;
            wordDisplay.classList.add('blur-md'); 
            if (tapMsg) tapMsg.classList.remove('hidden');
            
            // Petite animation de "tampon" quand le mot change
            wordDisplay.classList.remove('animate-stamp');
            void wordDisplay.offsetWidth; 
            wordDisplay.classList.add('animate-stamp');
        }
    }

    // 2. INDICATEUR DE TOUR
    ind.style.color = (moi.role === 'hacker') ? "#a855f7" : "#22d3ee";

    // 3. LISTE DES INDICES
    document.getElementById('clue-list').innerHTML = game.clues.map(c => `
        <div class="bg-white/5 p-3 rounded-xl border-l-2 mb-2 animate-pop" style="border-color:${c.color}">
            <div class="text-[8px] font-black opacity-30 uppercase">${c.auteur}</div>
            <div class="text-sm font-bold text-white uppercase font-mono">${c.texte}</div>
        </div>
    `).join('');

    // 4. GESTION DES PHASES (On cache tout par défaut)
    [cBox, vSec, rSec].forEach(el => el.classList.add('hidden'));

    if (game.phase === "indice") {
        const activePlayer = game.players.find(p => p.id === game.turnOrder[game.tour]);
        if (activePlayer) {
            ind.innerText = (socket.id === activePlayer.id) ? "À VOUS DE TRANSMETTRE L'INDICE" : `ANALYSE : ${activePlayer.nom} TRANSMET...`;
            if (socket.id === activePlayer.id) cBox.classList.remove('hidden');
        }
    } 
    else if (game.phase === "vote") {
        vSec.classList.remove('hidden');
        ind.innerText = "ÉLIMINATION DE LA CIBLE";
        const vL = document.getElementById('vote-list');
        
        if (game.votes[moi.nom]) {
            vL.innerHTML = "<div class='py-8 opacity-20 font-black text-center'>Rapport envoyé. Attente...</div>";
        } else {
            vL.innerHTML = "";
            game.players.forEach(p => {
                if (p.id !== socket.id) {
                    const btn = document.createElement('button');
                    btn.className = "glass p-4 rounded-xl border border-white/10 font-black mb-2 w-full text-white active:scale-95 transition-all";
                    btn.innerHTML = `<span style="color:${p.color}">${p.nom}</span>`;
                    btn.onclick = () => { playClick(); socket.emit('vote_player', p.nom); };
                    vL.appendChild(btn);
                }
            });
        }
    } 
    else if (game.phase === "resultats") {
        // Appelle ta fonction d'affichage ou remplis le rSec ici
        ind.innerText = "MISSION TERMINÉE";
        rSec.classList.remove('hidden');
        // On s'assure que le contenu n'est pas vide (pour éviter les "...")
        if (typeof afficherResultats === 'function') {
            afficherResultats(game);
        }
    }
}

function calculateFinal(game) {
    let counts = {};
    Object.values(game.votes).forEach(nom => counts[nom] = (counts[nom] || 0) + 1);
    let sorted = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    let u = game.players.find(p => p.role === "undercover");
    let h = game.players.find(p => p.role === "hacker");
    let c = game.players.find(p => p.role === "civil");
    return { 
        win: sorted[0] === u?.nom, 
        uNom: u ? u.nom : "Inconnu", 
        hNom: h ? h.nom : "Aucun",
        uWord: u ? u.mot : "?", 
        cWord: c ? c.mot : "?" 
    };
}

function afficherResultats(game) {
    const rSec = document.getElementById('result-section');
    rSec.classList.remove('hidden');
    document.getElementById('turn-indicator').classList.add('hidden');
    
    const res = calculateFinal(game);
    const winMsg = document.getElementById('win-message');
    winMsg.innerText = res.win ? "SUCCÈS DE L'AGENCE" : "ÉCHEC DE LA MISSION";
    winMsg.style.color = res.win ? "#4ade80" : "#ef4444";

    document.getElementById('final-reveal').innerHTML = `
        <div class='bg-white/5 p-8 rounded-[35px] font-black uppercase text-xs border border-white/5'>
            <p class='opacity-20 mb-2'>L'infiltré était</p>
            <span class='text-xl tracking-tighter'>${res.uNom}</span><br>
            <p class='opacity-20 mb-2 mt-4'>Le hacker était</p>
            <span class='text-xl tracking-tighter'>${res.hNom}</span><br>
            <p class='opacity-30 mt-4'>${res.uWord} VS ${res.cWord}</p>
        </div>`;

    const btnReplay = document.getElementById('btn-replay');
    if(isHost) {
        btnReplay.classList.remove('hidden');
        document.getElementById('wait-host-msg').classList.add('hidden');
    } else {
        btnReplay.classList.add('hidden');
        document.getElementById('wait-host-msg').classList.remove('hidden');
    }
}

// --- INITIALISATION ---
document.addEventListener('click', () => { 
    bgMusic.play().catch(() => {}); 
}, { once: true });

const roleCard = document.getElementById('role-card');
if (roleCard) {
    roleCard.onclick = () => {
        document.getElementById('secret-word').classList.toggle('blur-md');
        document.getElementById('tap-to-reveal').classList.toggle('hidden');
    };
}

socket.on('hacker_init', (data) => {
    const modal = document.getElementById('hacker-modal');
    document.getElementById('hacker-target-name').innerText = data.targetName;
    modal.classList.remove('hidden');
    document.getElementById('hacker-submit').onclick = () => {
        const val = document.getElementById('hacker-input').value.trim().toUpperCase();
        if(val) {
            socket.emit('set_hacker_word', val);
            modal.classList.add('hidden');
        }
    };
});