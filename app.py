from flask import Flask, render_template, request, redirect, url_for, session, jsonify
import google.generativeai as genai
import os

# --- Configuration and Initialization ---

# Configure the Gemini API (use environment variable instead of hardcoding)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    # Set a placeholder key if running outside of a system that sets the ENV var
    # NOTE: You MUST set GEMINI_API_KEY in your environment for this to work correctly.
    # The canvas environment automatically provides a key, but for local Flask testing, you'll need one.
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

# Define the custom model paths
CATEGORY_MODELS = {
    # We keep the full path here for clear reference, but the code will strip it before API use.
    'housing': 'tunedModels/HousingResourceBot',
    'employment': 'tunedModels/EmploymentResourceBot',
    'education': 'tunedModels/EducationResourceBot',
    'healthcare': 'tunedModels/HealthcareResourceBot',
    'financial': 'tunedModels/FinancialResourceBot',
    'immigration': 'tunedModels/ImmigrationResourceBot',
    'food': 'tunedModels/FoodResourceBot'
}
# Fallback model for categories not in CATEGORY_MODELS or when a tuned model fails
FALLBACK_MODEL = 'gemini-2.5-flash'

def sanitize_model_name(model_path):
    """Strips the 'tunedModels/' prefix if present to get the final resource name."""
    if model_path.startswith('tunedModels/'):
        return model_path.split('/')[-1]
    return model_path

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
    
    # 1. Get the appropriate model name path
    model_path = CATEGORY_MODELS.get(category.lower(), FALLBACK_MODEL)
    
    # 2. SANITIZE the model name for the API call
    model_name = sanitize_model_name(model_path)
    
    # 3. Define the System Instruction for context
    system_instruction = f"""
    You are New2Canada, a helpful and encouraging AI assistant specializing in resources for newcomers to Canada. 
    You are currently providing assistance related to the **{category.capitalize()}** category. 
    
    **User Profile:**
    - Location: {session.get('location')}
    - Status: {session.get('status')}
    - Gender: {session.get('gender')}
    - Age: {session.get('age')}
    
    Please provide a concise, highly relevant, and personalized response to the user's request based on this profile and the specific {category} resources. Keep the tone friendly and supportive.
    """
    
    try:
        # If it's a standard model, we use the system_instruction config
        if model_name == FALLBACK_MODEL:
             response = client.models.generate_content(
                model=model_name,
                contents=[user_message],
                config=genai.types.GenerateContentConfig(
                    system_instruction=system_instruction
                )
            )
        # If it's a tuned model, we must pass the context in the contents array.
        else:
            # We will create the combined prompt: system_instruction + user_message
            full_prompt = system_instruction + "\n\nUser message: " + user_message
            
            response = client.models.generate_content(
                model=model_name,
                contents=[full_prompt]
            )

        return jsonify({'response': response.text})
    except Exception as e:
        app.logger.error(f"Gemini API Error for category {category} using sanitized model name {model_name} (Original: {model_path}): {e}")
        # Provide user-friendly feedback
        return jsonify({
            'response': f'Sorry, I ran into a communication issue ({model_name} failed). Please try again or switch categories.'
        }), 500


if __name__ == '__main__':
    # Flask is configured to run when the script is executed directly
    app.run(host='0.0.0.0', port=5000, debug=True)
