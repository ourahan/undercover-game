const socket = io();
let monPseudo = "", isHost = false;
let isMuted = localStorage.getItem('gameMuted') === 'true'; // On récupère la mémoire

// --- AUDIO ---
window.bgMusic = new Audio('music.mp3'); 
window.bgMusic.loop = true; 
window.bgMusic.volume = isMuted ? 0 : 0.2; // Volume à 0 direct si c'est muet
const dropSfx = new Audio('https://assets.mixkit.co/active_storage/sfx/710/710-preview.mp3');

function playClick() { 
    if (isMuted) return; // Si c'est muet, on arrête tout de suite
    
    const s = dropSfx.cloneNode(); 
    s.volume = 1; // Ou le volume que tu veux
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
    // --- 1. BARRE PRINCIPALE (Indice / Vote) ---
    const timerEl = document.getElementById('timer-display');
    const timerBar = document.getElementById('timer-bar');
    
    if(timerEl) {
        timerEl.innerText = `TEMPS RESTANT : ${time}s`;
        timerEl.style.color = time <= 10 ? "#ff4444" : "#22d3ee";
    }
    
    if(timerBar) {
        // La barre principale reste TOUJOURS sur une base de 60s
        const width = (time / 60) * 100;
        timerBar.style.width = `${Math.min(100, width)}%`;
        timerBar.style.backgroundColor = time <= 10 ? "#ff4444" : "#22d3ee";
    }

    // --- 2. BARRE INDÉPENDANTE DU CHAT ---
    const chatBar = document.getElementById('chat-timer-bar');
    const chatText = document.getElementById('chat-timer-display');

    if(chatBar) {
        // Cette barre est indépendante : elle calcule sur 120s
        const chatWidth = (time / 120) * 100;
        chatBar.style.width = `${Math.min(100, chatWidth)}%`;
        chatBar.style.backgroundColor = time <= 10 ? "#ef4444" : "#22d3ee";
    }
    if(chatText) {
        chatText.innerText = `${time}s`;
    }

    // --- 3. SÉCURITÉ ANTI-BLOCAGE (Ton code original inchangé) ---
    if (time <= 0) {
        const cBox = document.getElementById('clue-box');
        if (cBox && !cBox.classList.contains('hidden')) {
            socket.emit('send_clue', "PAS D'INDICE");
            cBox.classList.add('hidden');
        }
        const vSec = document.getElementById('vote-section');
        if (vSec && !vSec.classList.contains('hidden')) {
            const voteButtons = document.querySelectorAll('#vote-list button');
            if (voteButtons.length > 0) {
                const randomBtn = voteButtons[Math.floor(Math.random() * voteButtons.length)];
                randomBtn.click();
            }
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

socket.on('host_left', () => {
    console.log("URGENCE : L'hôte est parti.");

    // 1. On éteint manuellement les gros blocs qui bloquent la vue
    const toHide = ['screen-game', 'chat-section', 'screen-lobby', 'modal-indices'];
    toHide.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            el.classList.add('hidden');
            el.style.display = 'none';
        }
    });

    // 2. On affiche l'overlay
    const overlay = document.getElementById('screen-host-left');
    if(overlay) {
        overlay.classList.remove('hidden');
        overlay.style.setProperty('display', 'flex', 'important');
    }
});
// --- BLOCAGE ESPACE ET LIMITATION INDICE ---
const clueInput = document.getElementById('clue-input');

if (clueInput) {
    clueInput.addEventListener('keydown', (e) => {
        // Si la touche pressée est la barre espace (code 32 ou " ")
        if (e.key === " " || e.keyCode === 32) {
            e.preventDefault(); // On empêche le caractère de s'afficher
            return false;
        }
    });

    // Sécurité supplémentaire : on nettoie si l'utilisateur tente un copier-coller
    clueInput.addEventListener('input', () => {
        // On remplace tous les espaces par rien du tout au cas où
        clueInput.value = clueInput.value.replace(/\s/g, '');
        
        // On s'assure que ça ne dépasse pas 13 (même si maxlength est là)
        if (clueInput.value.length > 13) {
            clueInput.value = clueInput.value.slice(0, 13);
        }
    });
}

// --- RENDER FUNCTIONS ---
function showScreen(id) {
    // Si l'écran de déconnexion est affiché, on bloque tout autre changement d'écran
    const hostLeft = document.getElementById('screen-host-left');
    if (hostLeft && hostLeft.style.display === 'flex' && id !== 'screen-host-left') return;

    const allScreens = ['screen-login', 'screen-lobby', 'screen-game', 'screen-host-left'];
    allScreens.forEach(s => {
        const el = document.getElementById(s);
        if(el) {
            if(s === id) {
                el.classList.remove('hidden');
                el.style.display = (s === 'screen-host-left') ? 'flex' : 'block';
            } else {
                el.classList.add('hidden');
                el.style.display = 'none';
            }
        }
    });
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
    // AJOUTE CES 3 LIGNES : Le mur de sécurité
    const hostLeftCheck = document.getElementById('screen-host-left');
    if (hostLeftCheck && !hostLeftCheck.classList.contains('hidden')) {
        return; // On arrête TOUT, on ne redessine rien si l'hôte est parti
    }

    const moi = game.players.find(p => p.id === socket.id);
    if (!moi) return;
    // ... reste de ton code

    const ind = document.getElementById('turn-indicator');
    const cBox = document.getElementById('clue-box');
    const vSec = document.getElementById('vote-section');
    const rSec = document.getElementById('result-section');
    // NOUVEAU : On récupère la section chat
    const chatSec = document.getElementById('chat-section');
    
    const wordDisplay = document.getElementById('secret-word');
    const tapMsg = document.getElementById('tap-to-reveal');

    // 1. MISE À JOUR DU MOT ET DU FLOU (Ton code actuel...)
    if (wordDisplay) {
        if (wordDisplay.innerText !== moi.mot) {
            wordDisplay.innerText = moi.mot;
            wordDisplay.classList.add('blur-md'); 
            if (tapMsg) tapMsg.classList.remove('hidden');
            wordDisplay.classList.remove('animate-stamp');
            void wordDisplay.offsetWidth; 
            wordDisplay.classList.add('animate-stamp');
        }
    }

    // 2. INDICATEUR DE TOUR
    ind.style.color = (moi.role === 'hacker') ? "#a855f7" : "#22d3ee";

    // 3. LISTE DES INDICES (Ton code actuel...)
    const clList = document.getElementById('clue-list');
    clList.innerHTML = game.clues.map(c => `
        <div class="bg-white/5 p-3 rounded-xl border-l-2 mb-2 animate-pop" style="border-color:${c.color}">
            <div class="text-[8px] font-black opacity-30 uppercase">${c.auteur}</div>
            <div class="text-sm font-bold text-white uppercase font-mono">${c.texte}</div>
        </div>
    `).join('');
    clList.scrollTo({ top: clList.scrollHeight, behavior: 'smooth' });

    // 4. GESTION DES PHASES (On cache tout par défaut)
    // MODIFIÉ : On ajoute chatSec à la liste des éléments à cacher
    [cBox, vSec, rSec, chatSec].forEach(el => { if(el) el.classList.add('hidden'); });

    if (game.phase === "indice") {
        const activePlayer = game.players.find(p => p.id === game.turnOrder[game.tour]);
        if (activePlayer) {
            ind.innerText = (socket.id === activePlayer.id) ? "À VOUS DE TRANSMETTRE L'INDICE" : `ANALYSE : ${activePlayer.nom} TRANSMET...`;
            if (socket.id === activePlayer.id) cBox.classList.remove('hidden');
        }
    } 
    // --- NOUVEAU BLOC : PHASE DISCUSSION ---
    else if (game.phase === "discussion") {
        if (chatSec) {
            chatSec.classList.remove('hidden');
            ind.innerText = "DÉBAT STRATÉGIQUE";
            
            // Mise à jour du compteur de "Skip"
            const skipCount = document.getElementById('skip-count');
            const totalPlayers = document.getElementById('total-players');
            if(skipCount) skipCount.innerText = game.skipChatVotes ? game.skipChatVotes.length : 0;
            if(totalPlayers) totalPlayers.innerText = game.players.length;

            // Affichage des messages
            const msgBox = document.getElementById('chat-messages');
            if(msgBox) {
                msgBox.innerHTML = game.discussionMessages.map(m => `
                    <div class="mb-1 text-[11px] leading-tight">
                        <span style="color:${m.color}" class="font-black uppercase">${m.auteur}:</span> 
                        <span class="text-white/90">${m.texte}</span>
                    </div>
                `).join('');
                msgBox.scrollTop = msgBox.scrollHeight;
            }
        }
    }
    // ----------------------------------------
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
        ind.innerText = "MISSION TERMINÉE";
        rSec.classList.remove('hidden');
        if (typeof afficherResultats === 'function') {
            afficherResultats(game);
        }
    }
}

function calculateFinal(game) {
    // 1. On récupère TOUS les undercovers
    const allUnders = game.players.filter(p => p.role === 'undercover');
    
    // 2. On récupère le hacker (s'il y en a un)
    const hack = game.players.find(p => p.role === 'hacker');
    
    // 3. On récupère un civil pour avoir le mot des civils
    const civ = game.players.find(p => p.role === 'civil');

    return {
        // ICI : On transforme la liste des noms en un seul texte avec " & "
        uNom: allUnders.map(p => p.nom).join(' & ') || "AUCUN",
        
        hNom: hack ? hack.nom : "AUCUN",
        
        // Mot secret undercover (on prend celui du premier infiltré trouvé)
        uWord: allUnders.length > 0 ? allUnders[0].mot : "???",
        
        // Mot secret civil
        cWord: civ ? civ.mot : "???",
        
        // Condition de victoire
        win: game.winnerRole === 'Les Civils',
        
        // On rajoute cette variable pour gérer le pluriel dans ton HTML
        isPluriel: allUnders.length > 1
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

        <div class="mt-6 space-y-2">
            ${game.players.map(p => `
                <div class="flex justify-between items-center bg-white/5 p-2 rounded-lg border border-white/5">
                    <span class="font-bold" style="color:${p.color}">${p.nom}</span>
                    <span class="text-[10px] font-black uppercase opacity-60 px-2 py-1 rounded bg-white/10">
                        ${p.role}
                    </span>
                </div>
            `).join('')}
        </div>
    </div>
`;

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
function playSfx(id) {
    if (isMuted) return; // Si c'est muet, on ne fait rien
    
    const audio = document.getElementById(id);
    if (audio) {
        audio.currentTime = 0;
        audio.play().catch(e => console.log("Erreur son:", e));
    }
}
window.addEventListener('load', () => {
    const btnMute = document.getElementById('btn-mute');
    if (btnMute) {
        // Apparence initiale du bouton selon la mémoire
        const icon = document.getElementById('mute-icon');
        if (icon) icon.innerText = isMuted ? "🔇" : "🔊";
        btnMute.style.opacity = isMuted ? "0.5" : "1";

        btnMute.addEventListener('click', () => {
            isMuted = !isMuted;
            localStorage.setItem('gameMuted', isMuted); // ON ENREGISTRE LE CHOIX ICI

            if (icon) icon.innerText = isMuted ? "🔇" : "🔊";
            btnMute.style.opacity = isMuted ? "0.5" : "1";

            if (window.bgMusic) {
                window.bgMusic.muted = isMuted;
                window.bgMusic.volume = isMuted ? 0 : 0.2;
                if (!isMuted) window.bgMusic.play().catch(() => {});
            }
            
            if (dropSfx) dropSfx.muted = isMuted;
            
            // Protection pour les autres sons
            document.querySelectorAll('audio, video').forEach(m => {
                m.muted = isMuted;
                m.volume = isMuted ? 0 : 1;
            });
        });
    }
});
// --- LOGIQUE D'INTERACTION DU CHAT ---

// --- BRANCHEMENT DES BOUTONS DE CHAT ---

// Envoyer un message
document.getElementById('btn-send-chat').onclick = () => {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (msg) {
        console.log("Envoi message :", msg); // Pour vérifier dans ta console
        socket.emit('send_chat_message', msg);
        input.value = "";
    }
};

// Voter pour passer
document.getElementById('btn-skip-chat').onclick = () => {
    console.log("Vote pour skip le chat");
    socket.emit('vote_skip_chat');
};

// Permettre d'envoyer avec la touche "Entrée"
document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-send-chat').click();
});
// Fonction pour afficher/cacher les règles
function toggleRules() {
    const modal = document.getElementById('rules-modal');
    if (modal) {
        modal.classList.toggle('hidden');
    }
}