from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit
import subprocess
import shlex

app = Flask(__name__)
socketio = SocketIO(app)

@app.route('/')
def index():
    return render_template('terminal.html')

@socketio.on('execute_command')
def handle_execute_command(command):
    # Split the command into shell arguments
    args = shlex.split(command)
    
    try:
        # Execute the command
        result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        
        # Send the output back to the client
        output = result.stdout + result.stderr
    except Exception as e:
        output = str(e)
    
    emit('command_output', {'output': output})

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=8080)
