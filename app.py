from flask import Flask, render_template, request, redirect, url_for, session, jsonify
import google.generativeai as genai
import os

# --- Configuration and Initialization ---

# Configure the Gemini API (use environment variable instead of hardcoding)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable is not set!")

genai.configure(api_key=GEMINI_API_KEY)

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "replace_this_in_production")  # Always change for production

# Define the custom model paths
CATEGORY_MODELS = {
    'housing': 'tunedModels/HousingResourceBot',
    'employment': 'tunedModels/EmploymentResourceBot',
    'education': 'tunedModels/EducationResourceBot',
    'healthcare': 'tunedModels/HealthcareResourceBot',
    'financial': 'tunedModels/FinancialResourceBot',
    'immigration': 'tunedModels/ImmigrationResourceBot',
    'food': 'tunedModels/FoodResourceBot'
}

# --- Routes ---

@app.route('/', methods=['GET'])
def index():
    """Renders the landing page (index.html)."""
    return render_template('index.html')

@app.route('/user_data', methods=['GET', 'POST'])
def user_data():
    """Handles user user_data and saves profile data to the session."""
    if request.method == 'POST':
        # Retrieve data from the user_data form
        session['location'] = request.form.get('location')
        session['status'] = request.form.get('status')
        session['gender'] = request.form.get('gender')
        session['age'] = request.form.get('age')
        
        # Redirect the user to the assistance selection page
        return redirect(url_for('assistance'))
        
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
    
    # Safety check for required data
    if not user_message or not category or 'location' not in session:
        return jsonify({'response': 'Error: Missing user details or message.'}), 400
    
    # 1. Get the appropriate model for this category, fallback to default if not found
    model_name = CATEGORY_MODELS.get(category.lower(), 'gemini-2.5-flash')
    
    # 2. Use the system_instruction parameter for cleaner persona/context definition
    system_instruction = f"""
    You are New2Canada, a helpful and encouraging AI assistant specializing in resources for newcomers to Canada. 
    You are currently providing assistance related to the **{category.capitalize()}** category. 
    
    **User Profile:**
    - Location: {session.get('location')}
    - Status: {session.get('status')}
    - Gender: {session.get('gender')}
    - Age: {session.get('age')}
    
    Please provide a concise, highly relevant, and personalized response to the user's request based on this profile and the specific {category} resources you have been tuned on. Keep the tone friendly and supportive.
    """
    
    try:
        # Initialize the model with the correct model name (your gem) and the system instruction
        model = genai.GenerativeModel(
            model_name=model_name,
            system_instruction=system_instruction
        )
        
        # Now, only pass the user's direct message to the model
        response = model.generate_content(user_message)
        
        return jsonify({'response': response.text})
    except Exception as e:
        # Log the error for debugging
        app.logger.error(f"Gemini API Error for category {category} using model {model_name}: {e}")
        return jsonify({'response': 'Sorry, I ran into an issue connecting with my intelligence. Please check the logs.'}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
