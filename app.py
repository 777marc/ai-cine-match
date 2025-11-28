from flask import Flask, render_template, request, jsonify, session
import os
from openai import OpenAI
import json
import secrets
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
app.secret_key = secrets.token_hex(16)

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

# Game difficulty levels
DIFFICULTY_LEVELS = {
    'easy': 'Ask basic movie trivia questions suitable for casual movie watchers.',
    'medium': 'Ask intermediate movie trivia questions that require some movie knowledge.',
    'hard': 'Ask challenging movie trivia questions for serious movie buffs.'
}

@app.route('/')
def index():
    """Render the main game page."""
    return render_template('index.html')

@app.route('/start_game', methods=['POST'])
def start_game():
    """Initialize a new game session."""
    data = request.json
    difficulty = data.get('difficulty', 'medium')
    
    # Reset session
    session['score'] = 0
    session['questions_asked'] = 0
    session['difficulty'] = difficulty
    session['asked_movies'] = []  # Track movies already used
    
    return jsonify({
        'status': 'success',
        'message': 'Game started!',
        'score': 0,
        'questions_asked': 0
    })

@app.route('/get_question', methods=['POST'])
def get_question():
    """Generate a new trivia question using OpenAI."""
    try:
        difficulty = session.get('difficulty', 'medium')
        questions_asked = session.get('questions_asked', 0)
        asked_movies = session.get('asked_movies', [])
        
        # Create prompt for OpenAI with exclusion list
        exclusion_text = ""
        if asked_movies:
            exclusion_text = f"\n\nDo NOT ask questions about these movies (already asked): {', '.join(asked_movies)}"
        
        prompt = f"""Generate a movie trivia question. {DIFFICULTY_LEVELS[difficulty]}

Return the response in the following JSON format:
{{
    "question": "The trivia question",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_answer": "The correct option text",
    "explanation": "Brief explanation of the answer",
    "movie_title": "The main movie the question is about"
}}

Make sure the question is unique and interesting. Include 4 multiple choice options.{exclusion_text}"""

        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a movie trivia expert. Always respond with valid JSON only."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.8,
            max_tokens=300
        )
        
        # Parse the response
        content = response.choices[0].message.content.strip()
        question_data = json.loads(content)
        
        # Track the movie to avoid repeats
        movie_title = question_data.get('movie_title', 'Unknown')
        if movie_title not in asked_movies:
            asked_movies.append(movie_title)
            session['asked_movies'] = asked_movies
        
        # Store correct answer in session
        session['current_correct_answer'] = question_data['correct_answer']
        session['current_explanation'] = question_data['explanation']
        
        return jsonify({
            'status': 'success',
            'question': question_data['question'],
            'options': question_data['options']
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Error generating question: {str(e)}'
        }), 500

@app.route('/check_answer', methods=['POST'])
def check_answer():
    """Check if the submitted answer is correct."""
    data = request.json
    user_answer = data.get('answer')
    
    correct_answer = session.get('current_correct_answer')
    explanation = session.get('current_explanation')
    
    if not correct_answer:
        return jsonify({
            'status': 'error',
            'message': 'No active question'
        }), 400
    
    is_correct = user_answer == correct_answer
    
    # Update score and questions count
    score = session.get('score', 0)
    questions_asked = session.get('questions_asked', 0)
    
    if is_correct:
        score += 1
    
    questions_asked += 1
    
    session['score'] = score
    session['questions_asked'] = questions_asked
    
    return jsonify({
        'status': 'success',
        'is_correct': is_correct,
        'correct_answer': correct_answer,
        'explanation': explanation,
        'score': score,
        'questions_asked': questions_asked
    })

@app.route('/get_stats', methods=['GET'])
def get_stats():
    """Get current game statistics."""
    return jsonify({
        'score': session.get('score', 0),
        'questions_asked': session.get('questions_asked', 0),
        'difficulty': session.get('difficulty', 'medium')
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
