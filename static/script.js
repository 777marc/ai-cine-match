let selectedDifficulty = "medium";

// Initialize the game
document.addEventListener("DOMContentLoaded", () => {
  setupDifficultyButtons();
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

async function startGame() {
  try {
    const response = await fetch("/start_game", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ difficulty: selectedDifficulty }),
    });

    const data = await response.json();

    if (data.status === "success") {
      document.querySelector(".game-setup").style.display = "none";
      document.querySelector(".game-area").style.display = "block";
      updateStats(data.score, data.questions_asked);
      getNewQuestion();
    }
  } catch (error) {
    console.error("Error starting game:", error);
    alert("Failed to start game. Please try again.");
  }
}

async function getNewQuestion() {
  const loadingDiv = document.querySelector(".loading");
  const questionCard = document.querySelector(".question-card");
  const feedbackDiv = document.querySelector(".feedback");
  const nextBtn = document.getElementById("nextBtn");

  loadingDiv.style.display = "block";
  questionCard.style.display = "none";
  feedbackDiv.style.display = "none";
  nextBtn.style.display = "none";

  try {
    const response = await fetch("/get_question", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (data.status === "success") {
      displayQuestion(data.question, data.options);
    } else {
      alert("Error: " + data.message);
    }
  } catch (error) {
    console.error("Error getting question:", error);
    alert("Failed to get question. Please try again.");
  } finally {
    loadingDiv.style.display = "none";
    questionCard.style.display = "block";
  }
}

function displayQuestion(question, options) {
  const questionText = document.querySelector(".question-text");
  const optionsDiv = document.querySelector(".options");

  questionText.textContent = question;
  optionsDiv.innerHTML = "";

  options.forEach((option, index) => {
    const button = document.createElement("button");
    button.className = "option-btn";
    button.textContent = option;
    button.onclick = () => checkAnswer(option);
    optionsDiv.appendChild(button);
  });
}

async function checkAnswer(answer) {
  const optionButtons = document.querySelectorAll(".option-btn");
  optionButtons.forEach((btn) => (btn.disabled = true));

  try {
    const response = await fetch("/check_answer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ answer: answer }),
    });

    const data = await response.json();

    if (data.status === "success") {
      displayFeedback(
        data.is_correct,
        data.correct_answer,
        data.explanation,
        answer
      );
      updateStats(data.score, data.questions_asked);
      document.getElementById("nextBtn").style.display = "inline-block";
    }
  } catch (error) {
    console.error("Error checking answer:", error);
    alert("Failed to check answer. Please try again.");
  }
}

function displayFeedback(isCorrect, correctAnswer, explanation, userAnswer) {
  const feedbackDiv = document.querySelector(".feedback");
  const optionButtons = document.querySelectorAll(".option-btn");

  // Highlight the correct and incorrect answers
  optionButtons.forEach((btn) => {
    if (btn.textContent === correctAnswer) {
      btn.classList.add("correct");
    } else if (btn.textContent === userAnswer && !isCorrect) {
      btn.classList.add("incorrect");
    }
  });

  feedbackDiv.className = "feedback " + (isCorrect ? "correct" : "incorrect");
  feedbackDiv.innerHTML = `
        <h3>${isCorrect ? "🎉 Correct!" : "❌ Incorrect"}</h3>
        <p><strong>Correct Answer:</strong> ${correctAnswer}</p>
        <p class="explanation">${explanation}</p>
    `;
  feedbackDiv.style.display = "block";
}

function updateStats(score, questionsAsked) {
  document.getElementById("scoreValue").textContent = score;
  document.getElementById("questionsValue").textContent = questionsAsked;

  if (questionsAsked > 0) {
    const percentage = Math.round((score / questionsAsked) * 100);
    document.getElementById("accuracyValue").textContent = percentage + "%";
  }
}

function restartGame() {
  document.querySelector(".game-area").style.display = "none";
  document.querySelector(".game-setup").style.display = "block";
  document.getElementById("scoreValue").textContent = "0";
  document.getElementById("questionsValue").textContent = "0";
  document.getElementById("accuracyValue").textContent = "0%";
}
