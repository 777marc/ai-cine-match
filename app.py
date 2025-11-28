from flask import Flask, render_template, request, jsonify, session
from flask_socketio import SocketIO, emit, join_room, leave_room
import os
from openai import OpenAI
import json
import secrets
from dotenv import load_dotenv
import time

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
app.secret_key = secrets.token_hex(16)
app.config['SECRET_KEY'] = app.secret_key
socketio = SocketIO(app, cors_allowed_origins="*")

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

# Game difficulty levels
DIFFICULTY_LEVELS = {
    'easy': 'Ask basic movie trivia questions suitable for casual movie watchers.',
    'medium': 'Ask intermediate movie trivia questions that require some movie knowledge.',
    'hard': 'Ask challenging movie trivia questions for serious movie buffs.'
}

# Store active games and players
games = {}  # game_id: {players: {player_id: {name, score, answered}}, current_question: {...}, difficulty: str, asked_movies: []}

@app.route('/')
def index():
    """Render the main game page."""
    return render_template('index.html')

@socketio.on('create_game')
def handle_create_game(data):
    """Create a new multiplayer game."""
    player_name = data.get('player_name', 'Player')
    difficulty = data.get('difficulty', 'medium')
    game_id = secrets.token_hex(4).upper()
    player_id = request.sid
    
    games[game_id] = {
        'players': {
            player_id: {
                'name': player_name,
                'score': 0,
                'answered': False,
                'is_host': True
            }
        },
        'current_question': None,
        'difficulty': difficulty,
        'asked_movies': [],
        'question_count': 0,
        'state': 'waiting'  # waiting, playing, finished
    }
    
    join_room(game_id)
    session['game_id'] = game_id
    session['player_id'] = player_id
    
    emit('game_created', {
        'game_id': game_id,
        'player_id': player_id,
        'player_name': player_name
    })
    
    emit('player_list_update', {
        'players': list(games[game_id]['players'].values())
    }, room=game_id)

@socketio.on('join_game')
def handle_join_game(data):
    """Join an existing game."""
    game_id = data.get('game_id', '').upper()
    player_name = data.get('player_name', 'Player')
    player_id = request.sid
    
    if game_id not in games:
        emit('error', {'message': 'Game not found'})
        return
    
    if games[game_id]['state'] != 'waiting':
        emit('error', {'message': 'Game already in progress'})
        return
    
    games[game_id]['players'][player_id] = {
        'name': player_name,
        'score': 0,
        'answered': False,
        'is_host': False
    }
    
    join_room(game_id)
    session['game_id'] = game_id
    session['player_id'] = player_id
    
    emit('game_joined', {
        'game_id': game_id,
        'player_id': player_id,
        'player_name': player_name
    })
    
    emit('player_list_update', {
        'players': list(games[game_id]['players'].values())
    }, room=game_id)
    
    emit('player_joined', {
        'player_name': player_name
    }, room=game_id, skip_sid=player_id)

@socketio.on('start_game')
def handle_start_game():
    """Start the game (host only)."""
    game_id = session.get('game_id')
    player_id = session.get('player_id')
    
    if not game_id or game_id not in games:
        emit('error', {'message': 'Game not found'})
        return
    
    if not games[game_id]['players'][player_id].get('is_host'):
        emit('error', {'message': 'Only host can start the game'})
        return
    
    games[game_id]['state'] = 'playing'
    emit('game_started', {}, room=game_id)
    
    # Generate first question
    generate_and_send_question(game_id)

def generate_and_send_question(game_id):
    """Generate a new question and send to all players."""
    if game_id not in games:
        return
    
    game = games[game_id]
    difficulty = game['difficulty']
    asked_movies = game['asked_movies']
    
    # Reset answered status for all players
    for player in game['players'].values():
        player['answered'] = False
    
    try:
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
            game['asked_movies'].append(movie_title)
        
        game['current_question'] = {
            'question': question_data['question'],
            'options': question_data['options'],
            'correct_answer': question_data['correct_answer'],
            'explanation': question_data['explanation'],
            'start_time': time.time()
        }
        
        game['question_count'] += 1
        
        # Send question to all players (without correct answer)
        socketio.emit('new_question', {
            'question': question_data['question'],
            'options': question_data['options'],
            'question_number': game['question_count']
        }, room=game_id)
        
    except Exception as e:
        socketio.emit('error', {
            'message': f'Error generating question: {str(e)}'
        }, room=game_id)

@socketio.on('submit_answer')
def handle_submit_answer(data):
    """Handle player's answer submission."""
    game_id = session.get('game_id')
    player_id = session.get('player_id')
    answer = data.get('answer')
    
    if not game_id or game_id not in games:
        emit('error', {'message': 'Game not found'})
        return
    
    game = games[game_id]
    
    if player_id not in game['players']:
        emit('error', {'message': 'Player not in game'})
        return
    
    if game['players'][player_id]['answered']:
        emit('error', {'message': 'Already answered this question'})
        return
    
    current_question = game['current_question']
    if not current_question:
        emit('error', {'message': 'No active question'})
        return
    
    # Mark player as answered
    game['players'][player_id]['answered'] = True
    
    # Check if answer is correct
    is_correct = answer == current_question['correct_answer']
    
    # Calculate time bonus (faster = more points)
    time_elapsed = time.time() - current_question['start_time']
    time_bonus = max(0, 10 - int(time_elapsed / 2))  # Up to 10 bonus points
    
    if is_correct:
        points = 10 + time_bonus
        game['players'][player_id]['score'] += points
    else:
        points = 0
    
    # Send result to player
    emit('answer_result', {
        'is_correct': is_correct,
        'points_earned': points,
        'your_answer': answer
    })
    
    # Check if all players have answered
    all_answered = all(p['answered'] for p in game['players'].values())
    
    if all_answered:
        # Send results to all players
        socketio.emit('question_complete', {
            'correct_answer': current_question['correct_answer'],
            'explanation': current_question['explanation'],
            'leaderboard': sorted(
                [{'name': p['name'], 'score': p['score']} for p in game['players'].values()],
                key=lambda x: x['score'],
                reverse=True
            )
        }, room=game_id)

@socketio.on('next_question')
def handle_next_question():
    """Request next question (host only)."""
    game_id = session.get('game_id')
    player_id = session.get('player_id')
    
    if not game_id or game_id not in games:
        emit('error', {'message': 'Game not found'})
        return
    
    if not games[game_id]['players'][player_id].get('is_host'):
        emit('error', {'message': 'Only host can advance questions'})
        return
    
    generate_and_send_question(game_id)

@socketio.on('end_game')
def handle_end_game():
    """End the game and show final results."""
    game_id = session.get('game_id')
    player_id = session.get('player_id')
    
    if not game_id or game_id not in games:
        return
    
    if not games[game_id]['players'][player_id].get('is_host'):
        emit('error', {'message': 'Only host can end the game'})
        return
    
    game = games[game_id]
    game['state'] = 'finished'
    
    final_results = sorted(
        [{'name': p['name'], 'score': p['score']} for p in game['players'].values()],
        key=lambda x: x['score'],
        reverse=True
    )
    
    socketio.emit('game_ended', {
        'final_results': final_results,
        'total_questions': game['question_count']
    }, room=game_id)

@socketio.on('disconnect')
def handle_disconnect():
    """Handle player disconnection."""
    game_id = session.get('game_id')
    player_id = session.get('player_id')
    
    if game_id and game_id in games and player_id in games[game_id]['players']:
        player_name = games[game_id]['players'][player_id]['name']
        del games[game_id]['players'][player_id]
        
        # If no players left, delete game
        if not games[game_id]['players']:
            del games[game_id]
        else:
            socketio.emit('player_left', {
                'player_name': player_name,
                'players': list(games[game_id]['players'].values())
            }, room=game_id)

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)
