# 🎬 Movie Trivia Game

A fun and interactive movie trivia game built with Flask and powered by OpenAI's GPT models. Test your movie knowledge with AI-generated questions across different difficulty levels!

## Features

- 🤖 AI-generated trivia questions using OpenAI
- 🎯 Three difficulty levels: Easy, Medium, and Hard
- 📊 Real-time score tracking and accuracy statistics
- 🎨 Beautiful, responsive UI with smooth animations
- 💡 Detailed explanations for each answer

## Prerequisites

- Python 3.8 or higher
- OpenAI API key ([Get one here](https://platform.openai.com/api-keys))

## Installation

1. **Clone or navigate to the project directory:**

   ```powershell
   cd c:\github\PYTHON\ai-cine-match
   ```

2. **Create a virtual environment:**

   ```powershell
   python -m venv venv
   ```

3. **Activate the virtual environment:**

   ```powershell
   .\venv\Scripts\Activate.ps1
   ```

4. **Install dependencies:**

   ```powershell
   pip install -r requirements.txt
   ```

5. **Set up your environment variables:**
   - Copy `.env.example` to `.env`:
     ```powershell
     Copy-Item .env.example .env
     ```
   - Edit `.env` and add your OpenAI API key:
     ```
     OPENAI_API_KEY=your_actual_api_key_here
     ```

## Running the Application

1. **Make sure your virtual environment is activated**

2. **Set the environment variable (if not using .env):**

   ```powershell
   $env:OPENAI_API_KEY="your_api_key_here"
   ```

3. **Run the Flask app:**

   ```powershell
   python app.py
   ```

4. **Open your browser and navigate to:**
   ```
   http://localhost:5000
   ```

## How to Play

1. Choose your difficulty level (Easy, Medium, or Hard)
2. Click "Start Game" to begin
3. Read each question carefully and select your answer
4. Get instant feedback with explanations
5. Click "Next Question" to continue
6. Track your score and accuracy throughout the game
7. Click "Restart Game" to start over with a new difficulty

## Project Structure

```
ai-cine-match/
├── app.py                 # Main Flask application
├── requirements.txt       # Python dependencies
├── .env.example          # Environment variables template
├── README.md             # This file
├── static/
│   ├── style.css         # CSS styles
│   └── script.js         # JavaScript functionality
└── templates/
    └── index.html        # Main HTML template
```

## API Endpoints

- `GET /` - Main game page
- `POST /start_game` - Initialize a new game session
- `POST /get_question` - Generate a new trivia question
- `POST /check_answer` - Check if the submitted answer is correct
- `GET /get_stats` - Get current game statistics

## Technologies Used

- **Backend:** Flask (Python web framework)
- **AI:** OpenAI GPT-3.5-turbo
- **Frontend:** HTML5, CSS3, JavaScript
- **Session Management:** Flask sessions

## Configuration

The app uses the following OpenAI settings:

- Model: `gpt-3.5-turbo`
- Temperature: `0.8` (for varied questions)
- Max tokens: `300`

You can modify these settings in `app.py` if needed.

## Troubleshooting

**Issue: "OpenAI API key not found"**

- Make sure you've set the `OPENAI_API_KEY` environment variable or created a `.env` file

**Issue: "Module not found"**

- Ensure you've activated the virtual environment and installed all requirements

**Issue: "Port 5000 already in use"**

- Change the port in `app.py`: `app.run(debug=True, port=5001)`

## Future Enhancements

- Add categories (Action, Comedy, Drama, etc.)
- Implement leaderboards
- Add multiplayer support
- Save game history
- Add sound effects
- Include image-based questions

## License

This project is open source and available for educational purposes.

## Credits

Built with ❤️ using Flask and OpenAI
