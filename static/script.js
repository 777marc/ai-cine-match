// Socket.IO connection
const socket = io();

// Game state
let selectedDifficulty = "medium";
let currentGameId = null;
let currentPlayerId = null;
let playerName = "";
let isHost = false;

// Initialize the game
document.addEventListener("DOMContentLoaded", () => {
  setupDifficultyButtons();
  setupSocketListeners();

  // Auto-focus on player name input
  document.getElementById("playerNameInput").focus();

  // Enter key handlers
  document
    .getElementById("playerNameInput")
    .addEventListener("keypress", (e) => {
      if (e.key === "Enter") showCreateGame();
    });

  document.getElementById("gameCodeInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") joinGame();
  });
});

function setupDifficultyButtons() {
  const buttons = document.querySelectorAll(".difficulty-btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedDifficulty = btn.dataset.difficulty;
    });
  });
}

function setupSocketListeners() {
  // Game creation
  socket.on("game_created", (data) => {
    currentGameId = data.game_id;
    currentPlayerId = data.player_id;
    playerName = data.player_name;
    isHost = true;

    showScreen("lobbyScreen");
    document.getElementById("gameCodeDisplay").textContent = currentGameId;
    document.getElementById("hostControls").classList.remove("hidden");
    document.getElementById("guestControls").classList.add("hidden");
  });

  // Game joined
  socket.on("game_joined", (data) => {
    currentGameId = data.game_id;
    currentPlayerId = data.player_id;
    playerName = data.player_name;
    isHost = false;

    showScreen("lobbyScreen");
    document.getElementById("gameCodeDisplay").textContent = currentGameId;
    document.getElementById("hostControls").classList.add("hidden");
    document.getElementById("guestControls").classList.remove("hidden");
  });

  // Player list updates
  socket.on("player_list_update", (data) => {
    updatePlayersList(data.players);
  });

  // Player joined notification
  socket.on("player_joined", (data) => {
    showNotification(`${data.player_name} joined the game!`);
  });

  // Player left notification
  socket.on("player_left", (data) => {
    showNotification(`${data.player_name} left the game`);
    if (data.players) {
      updatePlayersList(data.players);
    }
  });

  // Game started
  socket.on("game_started", () => {
    showScreen("gameScreen");
    document.getElementById("gameCodeSmall").textContent = currentGameId;
    document.querySelector(".loading").style.display = "block";
    document.querySelector(".question-card").style.display = "none";
  });

  // New question
  socket.on("new_question", (data) => {
    displayQuestion(data.question, data.options, data.question_number);
  });

  // Answer result
  socket.on("answer_result", (data) => {
    showAnswerFeedback(data);
  });

  // Question complete
  socket.on("question_complete", (data) => {
    showQuestionResults(data);
  });

  // Game ended
  socket.on("game_ended", (data) => {
    showFinalResults(data);
  });

  // Errors
  socket.on("error", (data) => {
    alert("Error: " + data.message);
  });
}

function showScreen(screenId) {
  const screens = [
    "mainMenu",
    "createGameScreen",
    "joinGameScreen",
    "lobbyScreen",
    "gameScreen",
    "resultsScreen",
  ];
  screens.forEach((id) => {
    document.getElementById(id).classList.add("hidden");
  });
  document.getElementById(screenId).classList.remove("hidden");
}

function showCreateGame() {
  playerName = document.getElementById("playerNameInput").value.trim();
  if (!playerName) {
    alert("Please enter your name!");
    return;
  }
  showScreen("createGameScreen");
}

function showJoinGame() {
  playerName = document.getElementById("playerNameInput").value.trim();
  if (!playerName) {
    alert("Please enter your name!");
    return;
  }
  showScreen("joinGameScreen");
  document.getElementById("gameCodeInput").focus();
}

function createGame() {
  socket.emit("create_game", {
    player_name: playerName,
    difficulty: selectedDifficulty,
  });
}

function joinGame() {
  const gameCode = document
    .getElementById("gameCodeInput")
    .value.trim()
    .toUpperCase();
  if (!gameCode) {
    alert("Please enter a game code!");
    return;
  }

  socket.emit("join_game", {
    game_id: gameCode,
    player_name: playerName,
  });
}

function startMultiplayerGame() {
  socket.emit("start_game");
}

function leaveLobby() {
  socket.disconnect();
  socket.connect();
  currentGameId = null;
  currentPlayerId = null;
  isHost = false;
  backToMenu();
}

function backToMenu() {
  showScreen("mainMenu");
  document.getElementById("playerNameInput").value = "";
  document.getElementById("gameCodeInput").value = "";
  selectedDifficulty = "medium";
}

function updatePlayersList(players) {
  const container = document.getElementById("playersList");
  const countSpan = document.getElementById("playerCount");

  countSpan.textContent = players.length;
  container.innerHTML = "";

  players.forEach((player) => {
    const playerDiv = document.createElement("div");
    playerDiv.className = "player-item";
    playerDiv.innerHTML = `
            <span class="player-name">${player.name}</span>
            ${player.is_host ? '<span class="host-badge">👑 Host</span>' : ""}
            <span class="player-score">${player.score} pts</span>
        `;
    container.appendChild(playerDiv);
  });
}

function displayQuestion(question, options, questionNumber) {
  document.querySelector(".loading").style.display = "none";
  document.querySelector(".question-card").style.display = "block";
  document.getElementById("feedback").classList.add("hidden");
  document.getElementById("waitingMessage").classList.add("hidden");
  document.getElementById("nextQuestionBtn").classList.add("hidden");

  document.getElementById("questionNumber").textContent = questionNumber;
  document.getElementById("questionText").textContent = question;

  const container = document.getElementById("optionsContainer");
  container.innerHTML = "";

  options.forEach((option) => {
    const button = document.createElement("button");
    button.className = "option-btn";
    button.textContent = option;
    button.onclick = () => submitAnswer(option);
    container.appendChild(button);
  });
}

function submitAnswer(answer) {
  const buttons = document.querySelectorAll(".option-btn");
  buttons.forEach((btn) => (btn.disabled = true));

  socket.emit("submit_answer", { answer: answer });

  document.getElementById("waitingMessage").classList.remove("hidden");
}

function showAnswerFeedback(data) {
  const feedback = document.getElementById("feedback");
  feedback.classList.remove("hidden");

  if (data.is_correct) {
    feedback.className = "feedback correct";
    feedback.innerHTML = `
            <h3>✅ Correct! +${data.points_earned} points</h3>
            <p>Great job!</p>
        `;
  } else {
    feedback.className = "feedback incorrect";
    feedback.innerHTML = `
            <h3>❌ Incorrect</h3>
            <p>You answered: ${data.your_answer}</p>
        `;
  }
}

function showQuestionResults(data) {
  const feedback = document.getElementById("feedback");
  feedback.classList.remove("hidden");
  feedback.className = "feedback results";

  feedback.innerHTML = `
        <h3>📊 Question Results</h3>
        <p><strong>Correct Answer:</strong> ${data.correct_answer}</p>
        <p class="explanation">${data.explanation}</p>
    `;

  // Update leaderboard
  updateLeaderboard(data.leaderboard);

  // Show next button for host
  if (isHost) {
    document.getElementById("nextQuestionBtn").classList.remove("hidden");
  }

  document.getElementById("waitingMessage").classList.add("hidden");
}

function updateLeaderboard(leaderboard) {
  const container = document.getElementById("leaderboardCompact");
  container.innerHTML = "";

  leaderboard.forEach((player, index) => {
    const div = document.createElement("div");
    div.className = "leaderboard-item";

    const medal =
      index === 0
        ? "🥇"
        : index === 1
        ? "🥈"
        : index === 2
        ? "🥉"
        : `${index + 1}.`;

    div.innerHTML = `
            <span class="rank">${medal}</span>
            <span class="name">${player.name}</span>
            <span class="score">${player.score}</span>
        `;
    container.appendChild(div);
  });
}

function nextQuestion() {
  socket.emit("next_question");
  document.querySelector(".loading").style.display = "block";
  document.querySelector(".question-card").style.display = "none";
  document.getElementById("nextQuestionBtn").classList.add("hidden");
}

function endGame() {
  if (confirm("Are you sure you want to end the game?")) {
    socket.emit("end_game");
  }
}

function showFinalResults(data) {
  showScreen("resultsScreen");

  const container = document.getElementById("finalLeaderboard");
  container.innerHTML = "";

  data.final_results.forEach((player, index) => {
    const div = document.createElement("div");
    div.className = "final-result-item";

    const medal =
      index === 0
        ? "🥇"
        : index === 1
        ? "🥈"
        : index === 2
        ? "🥉"
        : `${index + 1}.`;

    div.innerHTML = `
            <span class="rank-large">${medal}</span>
            <div class="player-info">
                <div class="player-name-large">${player.name}</div>
                <div class="player-score-large">${player.score} points</div>
            </div>
        `;
    container.appendChild(div);
  });

  document.getElementById("totalQuestions").textContent = data.total_questions;
}

function showNotification(message) {
  // Simple notification - you could enhance this with a toast system
  console.log("Notification:", message);
}
