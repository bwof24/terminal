const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');
const pty = require('node-pty');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// File upload setup
const upload = multer({ dest: 'uploads/' });

app.post('/upload', upload.single('file'), (req, res) => {
    res.send('File uploaded successfully.');
});

app.get('/download/:filename', (req, res) => {
    const file = path.join(__dirname, 'uploads', req.params.filename);
    res.download(file);
});

app.post('/create-file', (req, res) => {
    const { filename } = req.body;
    fs.writeFile(path.join(__dirname, filename), '', (err) => {
        if (err) {
            return res.status(500).send('Failed to create file.');
        }
        res.send('File created successfully.');
    });
});

app.post('/save-file', (req, res) => {
    const { filename, content } = req.body;
    fs.writeFile(path.join(__dirname, filename), content, (err) => {
        if (err) {
            return res.status(500).send('Failed to save file.');
        }
        res.send('File saved successfully.');
    });
});

// WebSocket connection for terminal
wss.on('connection', (ws) => {
    const shell = pty.spawn('bash', [], {
        name: 'xterm-color',
        cols: 80,
        rows: 24,
        cwd: process.env.HOME,
        env: process.env
    });

    shell.on('data', (data) => {
        ws.send(data);
    });

    ws.on('message', (message) => {
        shell.write(message);
    });

    ws.on('close', () => {
        shell.kill();
    });
});

server.listen(8080, () => {
    console.log('Server running on http://localhost:8080');
});
