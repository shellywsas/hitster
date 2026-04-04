let currentMode = 'year'; 
let currentSongsList = [];
let unusedFilteredSongs = []; 
let currentSongIndex = 0;
let score = 0;

let historyGuesses = []; 
let highestIndex = 0; 

let isWaitingForNext = false;
let currentAudio = null;
let currentAlbumCoverUrl = null; 

function normalizeString(str) {
    return str.toLowerCase().replace(/[^a-zא-ת0-9]/g, "").trim();
}

function levenshteinDistance(s1, s2) {
    if (!s1 || !s1.length) return s2 ? s2.length : 0;
    if (!s2 || !s2.length) return s1.length;
    const matrix = [];
    for (let i = 0; i <= s2.length; i++) matrix[i] = [i];
    for (let j = 0; j <= s1.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= s2.length; i++) {
        for (let j = 1; j <= s1.length; j++) {
            if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
            }
        }
    }
    return matrix[s2.length][s1.length];
}

function isNameCloseEnough(guess, actual) {
    const g = normalizeString(guess);
    const a = normalizeString(actual);
    if (g === a) return true;
    if (a.includes(g) && g.length >= 4) return true; 
    
    const dist = levenshteinDistance(g, a);
    const allowedTypos = a.length <= 4 ? 1 : 2; 
    return dist <= allowedTypos;
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function showStartScreen() {
    document.getElementById("endScreen").classList.add("hidden");
    document.getElementById("gameScreen").classList.add("hidden");
    document.getElementById("startScreen").classList.remove("hidden");
    document.getElementById("progressBar").style.width = "0%";
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
}

function getFilteredSongs() {
    const langPref = document.querySelector('input[name="langPref"]:checked').value;
    
    if (langPref === 'both') {
        return [...allSongs];
    }
    
    if (langPref === 'festigal') {
        return allSongs.filter(song => song.isFestigal === true);
    }

    return allSongs.filter(song => {
        const hasHebrew = /[א-ת]/.test(song.artist + song.title);
        if (langPref === 'he') return hasHebrew;
        if (langPref === 'en') return !hasHebrew;
    });
}

function startGame(mode) {
    currentMode = mode;
    document.getElementById("startScreen").classList.add("hidden");
    document.getElementById("endScreen").classList.add("hidden");
    document.getElementById("gameScreen").classList.remove("hidden");

    let filteredSongs = getFilteredSongs();
    shuffleArray(filteredSongs);
    
    const numSongsSelected = parseInt(document.querySelector('input[name="numSongs"]:checked').value);
    
    const songsToPlay = Math.min(numSongsSelected, filteredSongs.length);
    
    currentSongsList = filteredSongs.slice(0, songsToPlay);
    unusedFilteredSongs = filteredSongs.slice(songsToPlay);
    
    score = 0;
    historyGuesses = new Array(songsToPlay); 
    currentSongIndex = 0;
    highestIndex = 0;
    
    updateScoreBoard();
    loadSong();
}

function prevSong() {
    if (currentSongIndex > 0) {
        currentSongIndex--;
        loadSong();
        updateScoreBoard();
    }
}

async function loadSong() {
    const isReviewMode = currentSongIndex < highestIndex;
    const song = currentSongsList[currentSongIndex];
    
    const titleEl = document.getElementById("songTitle");
    const nameInput = document.getElementById("nameInput");
    const yearInput = document.getElementById("yearInput");
    const instruction = document.getElementById("gameInstruction");
    const prevBtn = document.getElementById("prevBtn");
    const submitBtn = document.getElementById("submitBtn");

    if (currentSongIndex > 0) {
        prevBtn.classList.remove("hidden");
    } else {
        prevBtn.classList.add("hidden");
    }

    if (currentMode === 'year') {
        instruction.innerText = "באיזו שנה יצא השיר הבא?";
        titleEl.innerText = song.title;
        nameInput.classList.add("hidden");
        yearInput.classList.remove("hidden");
    } else if (currentMode === 'name') {
        instruction.innerText = "איך קוראים לשיר הזה?";
        titleEl.innerText = "???";
        nameInput.classList.remove("hidden");
        yearInput.classList.add("hidden");
    } else if (currentMode === 'both') {
        instruction.innerText = "אתגר כפול! נחשי את השם ואת השנה:";
        titleEl.innerText = "???";
        nameInput.classList.remove("hidden");
        yearInput.classList.remove("hidden");
    }

    document.getElementById("songArtist").innerText = song.artist;
    
    if (currentAudio) {
        currentAudio.pause();
    }

    if (isReviewMode) {
        const history = historyGuesses[currentSongIndex];
        
        nameInput.value = history.guessName || "";
        yearInput.value = history.guessYear || "";
        nameInput.disabled = true;
        yearInput.disabled = true;
        
        document.getElementById("feedbackMsg").innerHTML = history.feedbackHtml;
        
        if (history.coverUrl) {
            document.getElementById("albumArt").src = history.coverUrl;
            document.getElementById("albumArt").style.display = "block";
            currentAlbumCoverUrl = history.coverUrl;
        } else {
            document.getElementById("albumArt").style.display = "none";
        }
        
        titleEl.innerText = song.title;
        
        submitBtn.innerText = currentSongIndex === highestIndex - 1 ? "חזור לשיר הנוכחי ⏭️" : "הבא ⏭️";
        isWaitingForNext = true;
        
        fetchAudioPreview(song.title, song.artist, true);
    } 
    else {
        nameInput.value = "";
        yearInput.value = "";
        nameInput.disabled = false;
        yearInput.disabled = false;
        
        document.getElementById("feedbackMsg").innerHTML = "";
        submitBtn.innerText = "שלחי ניחוש";
        document.getElementById("albumArt").style.display = "none"; 
        
        if (currentMode === 'name' || currentMode === 'both') nameInput.focus();
        else yearInput.focus();
        
        isWaitingForNext = false;
        currentAlbumCoverUrl = null;

        await fetchAudioPreview(song.title, song.artist, false);
    }
}

// ==== הפונקציה המעודכנת עם הדילוג השקט והמהיר! ====
async function fetchAudioPreview(title, artist, isReview) {
    const audioContainer = document.getElementById("audioContainer");
    audioContainer.innerHTML = '<span class="loading-text" id="loadingText">טוען שיר... ⏳</span>';
    
    try {
        const query = encodeURIComponent(`${title} ${artist}`);
        const response = await fetch(`https://itunes.apple.com/search?term=${query}&media=music&limit=1`);
        const data = await response.json();

        if (data.results && data.results.length > 0 && data.results[0].previewUrl) {
            const result = data.results[0];
            
            if (result.artworkUrl100) {
                currentAlbumCoverUrl = result.artworkUrl100.replace('100x100bb', '300x300bb');
                if (isReview && historyGuesses[currentSongIndex]) {
                     document.getElementById("albumArt").src = currentAlbumCoverUrl;
                }
            }

            const audioElement = document.createElement('audio');
            audioElement.controls = true;
            audioElement.src = result.previewUrl;
            
            audioContainer.innerHTML = '';
            audioContainer.appendChild(audioElement);
            currentAudio = audioElement;
        } else {
            // הדילוג השקט - אין יותר הודעות באדום!
            if (!isReview && unusedFilteredSongs.length > 0) {
                // לוקחים שיר אחר ושמים במקום השיר הנוכחי מיד
                currentSongsList[currentSongIndex] = unusedFilteredSongs.pop();
                loadSong(); 
            } else {
                audioContainer.innerHTML = '<span style="color: #b3b3b3; font-size: 0.9em;">השמע לא זמין כרגע 🎧</span>';
            }
        }
    } catch (error) {
        // גם במקרה של שגיאת תקשורת ננסה לדלג
        if (!isReview && unusedFilteredSongs.length > 0) {
            currentSongsList[currentSongIndex] = unusedFilteredSongs.pop();
            loadSong();
        } else {
            audioContainer.innerHTML = '<span style="color: #D32F2F; font-size: 0.9em;">בעיית חיבור 😔</span>';
        }
    }
}

function checkGuess() {
    if (isWaitingForNext || currentSongIndex < highestIndex) {
        currentSongIndex++;
        if (currentSongIndex < currentSongsList.length) {
            if (currentSongIndex === highestIndex) {
                isWaitingForNext = false;
            }
            loadSong();
            updateScoreBoard();
        } else {
            endGame();
        }
        return;
    }

    const song = currentSongsList[currentSongIndex];
    const nameInputVal = document.getElementById("nameInput").value;
    const yearInputVal = document.getElementById("yearInput").value;
    const feedback = document.getElementById("feedbackMsg");
    const albumArtImg = document.getElementById("albumArt");
    
    if (currentMode === 'year' && !yearInputVal) { feedback.innerText = "נא להכניס שנה."; return; }
    if (currentMode === 'name' && !nameInputVal) { feedback.innerText = "נא לכתוב את שם השיר."; return; }
    if (currentMode === 'both' && (!yearInputVal || !nameInputVal)) { feedback.innerText = "נא למלא את שני השדות."; return; }

    let roundScore = 0;
    let feedbackText = "";

    if (currentMode === 'year' || currentMode === 'both') {
        const guessYear = parseInt(yearInputVal);
        const diff = Math.abs(guessYear - song.year);
        
        const guessDecade = Math.floor(guessYear / 10);
        const actualDecade = Math.floor(song.year / 10);

        if (diff === 0) {
            feedbackText += `📅 שנה: בול פגיעה! (${song.year}) <span style="color:#2E7D32">+3 נק'</span><br>`;
            roundScore += 3;
        } else if (guessDecade === actualDecade) {
            feedbackText += `📅 שנה: עשור נכון! השנה היא ${song.year} <span style="color:#E65100">+2 נק'</span><br>`;
            roundScore += 2;
        } else {
            feedbackText += `📅 שנה: טעות. השנה היא ${song.year}.<br>`;
        }
    }

    if (currentMode === 'name' || currentMode === 'both') {
        if (isNameCloseEnough(nameInputVal, song.title)) {
            feedbackText += `🎤 שם שיר: מדויק! ("${song.title}") <span style="color:#2E7D32">+3 נק'</span><br>`;
            roundScore += 3;
        } else {
            feedbackText += `🎤 שם שיר: לא מדויק. השם הוא "${song.title}".<br>`;
        }
    }

    score += roundScore;

    historyGuesses[currentSongIndex] = {
        guessName: nameInputVal,
        guessYear: yearInputVal,
        feedbackHtml: feedbackText,
        coverUrl: currentAlbumCoverUrl
    };
    highestIndex = currentSongIndex + 1; 

    if (currentAlbumCoverUrl) {
        albumArtImg.src = currentAlbumCoverUrl;
        albumArtImg.style.display = "block";
    }
    document.getElementById("songTitle").innerText = song.title; 
    document.getElementById("nameInput").disabled = true; 
    document.getElementById("yearInput").disabled = true; 

    if (roundScore > 0) {
        feedback.style.color = "#333333";
    } else {
        feedback.style.color = "#D32F2F"; 
    }
    
    feedback.innerHTML = feedbackText;

    isWaitingForNext = true;
    document.getElementById("submitBtn").innerText = "לשיר הבא ⏭️";
    updateScoreBoard();
}

function updateScoreBoard() {
    document.getElementById("scoreDisplay").innerText = `נקודות: ${score}`;
    document.getElementById("progressDisplay").innerText = `שיר ${currentSongIndex + 1} / ${currentSongsList.length}`;
    
    const progressPercentage = ((currentSongIndex) / currentSongsList.length) * 100;
    document.getElementById("progressBar").style.width = progressPercentage + "%";
}

function endGame() {
    if (currentAudio) currentAudio.pause();
    document.getElementById("progressBar").style.width = "100%";
    document.getElementById("gameScreen").classList.add("hidden");
    document.getElementById("endScreen").classList.remove("hidden");
    
    document.getElementById("finalScore").innerText = score;
    
    const pointsPerSong = (currentMode === 'both') ? 6 : 3;
    const maxScore = currentSongsList.length * pointsPerSong;
    document.getElementById("maxScoreDisplay").innerText = maxScore;
    
    let message = "";
    if (score >= maxScore * 0.8) {
        message = "וואו, מטורף! יש לך ידע פנומנלי במוזיקה! 👑";
    } else if (score >= maxScore * 0.4) {
        message = "יפה מאוד! שלטת יפה בציר הזמן 👏";
    } else {
        message = "לא נורא, תמיד אפשר לשחק שוב ולהשתפר 😉";
    }
    
    document.getElementById("finalMessage").innerText = message;
}

document.addEventListener("keypress", function(event) {
    if (event.key === "Enter" && !document.getElementById("gameScreen").classList.contains("hidden")) {
        event.preventDefault();
        checkGuess();
    }
});

window.onload = showStartScreen;