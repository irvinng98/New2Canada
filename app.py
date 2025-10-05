from flask import Flask, render_template, request, redirect, url_for, session, jsonify
import google.generativeai as genai
import os

# Configure the Gemini API
# NOTE: Replace the placeholder API key below with a secure environment variable or a real key.
# For security in a production environment, use os.environ.get("GEMINI_API_KEY")
genai.configure(api_key="AIzaSyDHHx8-136Q5Cw0b6bVe8ud2Q3J3uSmDNU")

app = Flask(__name__)
# It's highly recommended to generate a strong, unique key for production
app.secret_key = 'supersecretkey'

@app.route('/', methods=['GET'])
def index():
    """Renders the landing page (index.html)."""
    # The home page only needs to render the HTML. Navigation to /onboarding is done via the button.
    return render_template('index.html')

@app.route('/onboarding', methods=['GET', 'POST'])
def onboarding():
    """
    Handles GET request to display the onboarding form (onboarding.html)
    and POST request to save user data to the session and redirect to assistance.
    """
    if request.method == 'POST':
        # Retrieve data from the onboarding form
        session['location'] = request.form.get('location')
        session['status'] = request.form.get('status')
        session['gender'] = request.form.get('gender')
        session['age'] = request.form.get('age')
        
        # Redirect the user to the assistance selection page
        return redirect(url_for('assistance'))
        
    # For GET request, render the onboarding form
    return render_template('onboarding.html')

@app.route('/about')
def about():
    """
    Handles GET request to display the about us form (about.html)    
    """
    # For GET request, render the onboarding form
    return render_template('about.html')

@app.route('/assistance')
def assistance():
    """Renders the assistance category selection page (assistance.html)."""
    # Check if essential session data exists before letting the user proceed
    if 'location' not in session:
        return redirect(url_for('onboarding'))
        
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
    
    # Map each category to its specific Gem model
    CATEGORY_MODELS = {
        'housing': 'tunedModels/HousingResourceBot',
        'employment': 'tunedModels/EmploymentResourceBot',
        'education': 'tunedModels/EducationResourceBot',
        'healthcare': 'tunedModels/HealthcareResourceBot',
        'financial': 'tunedModels/FinancialResourceBot',
        'clothing': 'tunedModels/ClothingResourceBot',
        'food': 'tunedModels/FoodResourceBot'
    }
    
    # Get the appropriate model for this category, fallback to default if not found
    model_name = CATEGORY_MODELS.get(category.lower(), 'gemini-2.5-flash')
    
    # Create a detailed system prompt for personalization
    prompt = f"""
    You are New2Canada, a helpful and encouraging AI assistant specializing in resources for newcomers to Canada. 
    The user is asking about {category}. 
    
    User Profile:
    - Location: {session.get('location')}
    - Status: {session.get('status')}
    - Gender: {session.get('gender')}
    - Age: {session.get('age')}
    
    Please provide a concise, relevant, and personalized response to the user's request based on their profile.
    User message: "{user_message}"
    """
    
    try:
        model = genai.GenerativeModel(model_name)
        response = model.generate_content(prompt)
        
        return jsonify({'response': response.text})
    except Exception as e:
        # Log the error for debugging
        app.logger.error(f"Gemini API Error for category {category}: {e}")
        return jsonify({'response': 'Sorry, I ran into an issue connecting with my intelligence. Please try again.'}), 500

if __name__ == '__main__':
    # Flask is configured to run when the script is executed directly
    app.run(debug=True)