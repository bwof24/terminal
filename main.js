const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const pty = require('node-pty');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const { execSync } = require('child_process');

// Create an instance of Express app
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public'));
app.use(session({ secret: 'your-secret-key', resave: false, saveUninitialized: false }));

// Serve the login page
app.get('/login', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Login</title>
        </head>
        <body>
            <h1>Login</h1>
            <form action="/login" method="POST">
                <label for="username">Username:</label>
                <input type="text" id="username" name="username" required>
                <br>
                <label for="password">Password:</label>
                <input type="password" id="password" name="password" required>
                <br>
                <button type="submit">Login</button>
            </form>
        </body>
        </html>
    `);
});

// Handle login POST request
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (validateUser(username, password)) {
        req.session.username = username;
        res.redirect('/');
    } else {
        res.redirect('/login');
    }
});

// Serve the terminal page
app.get('/', (req, res) => {
    if (req.session.username) {
        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Web Terminal</title>
                <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm/css/xterm.css" />
                <style>
                    body, html {
                        height: 100%;
                        margin: 0;
                        display: flex;
                        flex-direction: column;
                        background-color: black;
                        overflow: hidden;
                    }
                    #terminal-container {
                        flex: 1;
                        display: flex;
                        background-color: black;
                        overflow: auto;
                    }
                    .xterm {
                        background-color: black;
                        color: white;
                        width: 100%;
                        height: 100%;
                        user-select: text; /* Enable text selection */
                        -webkit-user-select: text; /* For Safari and other WebKit browsers */
                    }
                    #controls {
                        display: flex;
                        justify-content: center;
                        padding: 10px;
                        background-color: #333;
                    }
                    button {
                        margin: 0 5px;
                        padding: 5px 10px;
                        color: white;
                        background-color: #555;
                        border: none;
                        cursor: pointer;
                    }
                    button:hover {
                        background-color: #777;
                    }
                    /* Custom scrollbar */
                    ::-webkit-scrollbar {
                        width: 10px;
                    }
                    ::-webkit-scrollbar-thumb {
                        background-color: #555;
                    }
                </style>
            </head>
            <body>
                <div id="controls">
                    <button id="clear-btn">Clear</button>
                    <button id="save-btn">Save</button>
                    <button id="exit-btn">Exit</button>
                    <button id="copy-btn">Copy</button>
                </div>
                <div id="terminal-container"></div>
                <script src="https://cdn.jsdelivr.net/npm/xterm/lib/xterm.js"></script>
                <script src="https://cdn.jsdelivr.net/npm/xterm-addon-fit/lib/xterm-addon-fit.js"></script>
                <script src="https://cdn.jsdelivr.net/npm/xterm-addon-web-links/lib/xterm-addon-web-links.js"></script>
                <script>
                    const terminalContainer = document.getElementById('terminal-container');
                    const term = new Terminal({
                        cursorBlink: true,
                        fontFamily: 'monospace',
                        theme: {
                            background: 'black',
                            foreground: 'white'
                        },
                        scrollback: 1000,
                        disableStdin: false,
                        rendererType: 'canvas'
                    });
                    const fitAddon = new FitAddon.FitAddon();
                    const webLinksAddon = new WebLinksAddon.WebLinksAddon();
                    term.loadAddon(fitAddon);
                    term.loadAddon(webLinksAddon);
                    term.open(terminalContainer);
                    fitAddon.fit();

                    const socket = new WebSocket(\`ws://${window.location.host}\`);

                    socket.onopen = () => {
                        console.log('WebSocket connection established');
                    };

                    socket.onmessage = (event) => {
                        term.write(event.data);
                    };

                    socket.onerror = (error) => {
                        console.error('WebSocket error:', error);
                    };

                    term.onData((data) => {
                        socket.send(data);
                    });

                    window.addEventListener('resize', () => {
                        fitAddon.fit();
                    });

                    document.getElementById('clear-btn').addEventListener('click', () => {
                        term.clear();
                    });

                    document.getElementById('save-btn').addEventListener('click', () => {
                        socket.send('\x13'); // Send Ctrl+S
                    });

                    document.getElementById('exit-btn').addEventListener('click', () => {
                        socket.send('\x18'); // Send Ctrl+X
                    });

                    document.getElementById('copy-btn').addEventListener('click', () => {
                        const selection = term.getSelection();
                        if (selection) {
                            navigator.clipboard.writeText(selection).then(() => {
                                console.log('Text copied to clipboard');
                            }).catch((err) => {
                                console.error('Failed to copy text:', err);
                            });
                        }
                    });
                </script>
            </body>
            </html>
        `);
    } else {
        res.redirect('/login');
    }
});

// Function to validate Linux user credentials
const validateUser = (username, password) => {
    try {
        // Check if the username exists
        execSync(`id -u ${username}`);
        // Check password using PAM (Pluggable Authentication Modules)
        const result = execSync(`echo "${password}" | su - ${username} -c 'true'`, { stdio: 'pipe' });
        return result.status === 0;
    } catch (error) {
        return false;
    }
};

// WebSocket connection handler
wss.on('connection', (ws, req) => {
    if (!req.session.username) {
        ws.close(); // Close WebSocket connection if not authenticated
        return;
    }

    const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';

    const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd: process.env.HOME,
        env: process.env
    });

    ptyProcess.on('data', (data) => {
        ws.send(data);
    });

    ws.on('message', (msg) => {
        ptyProcess.write(msg);
    });

    ws.on('close', () => {
        ptyProcess.kill();
    });

    ws.onerror = (err) => {
        console.error('WebSocket error:', err);
    };
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
