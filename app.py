from flask import Flask, render_template, request, redirect, url_for, session, jsonify
import google.generativeai as genai
import os

# Configure the Gemini API
genai.configure(api_key="AIzaSyDHHx8-136Q5Cw0b6bVe8ud2Q3J3uSmDNU")

app = Flask(__name__)
app.secret_key = 'supersecretkey'

@app.route('/', methods=['GET', 'POST'])
def index():
    if request.method == 'POST':
        session['location'] = request.form['location']
        session['status'] = request.form['status']
        session['gender'] = request.form['gender']
        session['age'] = request.form['age']
        return redirect(url_for('assistance'))
    return render_template('index.html')

@app.route('/assistance')
def assistance():
    return render_template('assistance.html')

@app.route('/chat')
def chat():
    category = request.args.get('category')
    return render_template('chat.html', category=category)

@app.route('/get_chat_response', methods=['POST'])
def get_chat_response():
    data = request.get_json()
    user_message = data['message']
    category = data['category']
    
    # Create a prompt for the Gemini model
    prompt = f"You are a helpful assistant for newcomers to Canada. The user is asking about {category}. Their details are: Location - {session.get('location')}, Status - {session.get('status')}, Gender - {session.get('gender')}, Age - {session.get('age')}. Please provide a helpful and encouraging response to the following message: {user_message}"
    
    model = genai.GenerativeModel('gemini-pro-latest')
    response = model.generate_content(prompt)
    
    return jsonify({'response': response.text})

if __name__ == '__main__':
    app.run(debug=True)
