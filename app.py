from flask import Flask, render_template, request, redirect, url_for, session, jsonify
import google.generativeai as genai
import os

# --- Configuration and Initialization ---

# Configure the Gemini API (use environment variable instead of hardcoding)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    # Set a placeholder key if running outside of a system that sets the ENV var
    print("Warning: GEMINI_API_KEY environment variable not set. Using fallback model if needed.")
    pass

# Initialize the Gemini client and application
try:
    client = genai.Client(api_key=GEMINI_API_KEY)
except Exception:
    # Create a dummy client if the API key is not available, which will likely fail on API calls but allow the app to run locally for testing.
    client = None

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "replace_this_in_production")  # Always change for production

# Define the single, primary model to use for all requests
PRIMARY_MODEL = 'gemini-2.5-flash'


# --- Routes ---

@app.route('/', methods=['GET'])
def index():
    """Renders the landing page (index.html)."""
    return render_template('index.html')

@app.route('/user_data', methods=['GET', 'POST'])
def user_data():
    """
    Handles GET request to display the user_data form (user_data.html)
    and POST request to save user data to the session and redirect to assistance.
    """
    if request.method == 'POST':
        # Retrieve data from the user_data form
        session['location'] = request.form.get('location')
        session['status'] = request.form.get('status')
        session['gender'] = request.form.get('gender')
        session['age'] = request.form.get('age')
        
        # Redirect the user to the assistance selection page
        return redirect(url_for('assistance'))
        
    # For GET request, render the user_data form
    return render_template('user_data.html')

@app.route('/about')
def about():
    """Renders the about us page (about.html)."""
    return render_template('about.html')

@app.route('/assistance')
def assistance():
    """Renders the assistance category selection page (assistance.html)."""
    # Check if essential session data exists before letting the user proceed
    if 'location' not in session:
        # Redirect to user_data if user profile is missing
        return redirect(url_for('user_data'))
        
    return render_template('assistance.html')

@app.route('/chat')
def chat():
    """Renders the chat interface for a specific category (chat.html)."""
    category = request.args.get('category')
    
    # Ensure a category is selected and user details exist
    if not category or 'location' not in session:
        return redirect(url_for('assistance'))
        
    return render_template('chat.html', category=category)

@app.route('/get_chat_response', methods=['POST'])
def get_chat_response():
    """Handles the AJAX request to get a personalized response from the Gemini model."""
    data = request.get_json()
    user_message = data.get('message')
    category = data.get('category')
    
    if not client:
        app.logger.error("Gemini client is not initialized.")
        return jsonify({'response': 'API connection error: The Gemini client is unavailable.'}), 500

    # Safety check for required data
    if not user_message or not category or 'location' not in session:
        return jsonify({'response': 'Error: Missing user details or message.'}), 400
    
    # The model is fixed to the PRIMARY_MODEL
    model_name = PRIMARY_MODEL
    
    # Define the System Instruction based on the user's request for tailored assistance
    system_instruction = f"""
    Your purpose is to provide essential and tailored resource information and assistance to new immigrants in Canada.
    You are currently responding to a query related to the **{category.capitalize()}** category (e.g., Housing, Employment, etc.).
    
    **User Profile (Context for Personalization):**
    - Location: {session.get('location', 'N/A')}
    - Immigration Status: {session.get('status', 'N/A')}
    - Gender: {session.get('gender', 'N/A')}
    - Age: {session.get('age', 'N/A')}
    
    Given this profile, provide a concise, friendly, and highly relevant response to the user's message, focusing on resources and guidance within the **{category.capitalize()}** topic.
    """
    
    try:
        # Call the standard generate_content API, passing the personalization context via system_instruction
        response = client.models.generate_content(
            model=model_name,
            contents=[user_message],
            config=genai.types.GenerateContentConfig(
                system_instruction=system_instruction
            )
        )

        return jsonify({'response': response.text})
    except Exception as e:
        app.logger.error(f"Gemini API Error for category {category} using model {model_name}: {e}")
        # Provide user-friendly feedback
        return jsonify({
            'response': f'Sorry, I ran into an error communicating with the AI model ({model_name}). Please try again.'
        }), 500


if __name__ == '__main__':
    # Flask is configured to run when the script is executed directly
    app.run(host='0.0.0.0', port=5000, debug=True)
