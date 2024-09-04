const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const pty = require('node-pty');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const sessions = {};

// Middleware setup
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Login endpoint
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    const sudoProcess = pty.spawn('sudo', ['-S', '-u', username, 'echo', 'Authentication successful'], {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd: process.env.HOME,
        env: process.env
    });

    sudoProcess.write(`${password}\n`);

    sudoProcess.on('data', (data) => {
        if (data.includes('Authentication successful')) {
            const sessionId = Date.now().toString();
            sessions[sessionId] = username;
            res.cookie('sessionId', sessionId, { httpOnly: true });
            res.status(200).send();
        } else {
            res.status(401).send('Invalid credentials');
        }
    });

    sudoProcess.on('exit', (code) => {
        if (code !== 0) {
            res.status(401).send('Invalid credentials');
        }
    });
});

// Middleware to check authentication
const checkAuth = (req, res, next) => {
    const sessionId = req.cookies.sessionId;
    if (sessions[sessionId]) {
        next();
    } else {
        res.redirect('/');
    }
};

// Serve the single-page application
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// WebSocket setup
wss.on('connection', (ws, req) => {
    const sessionId = req.headers.cookie.split('=')[1];
    const username = sessions[sessionId];

    if (!username) {
        ws.close();
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
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(data);
        }
    });

    ws.on('message', (msg) => {
        ptyProcess.write(msg);
    });

    ws.on('close', () => {
        ptyProcess.kill();
    });

    ws.on('error', () => {
        ptyProcess.kill();
    });
});

// Start the server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
