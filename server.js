const express = require('express');
const WebSocket = require('ws');
const pty = require('node-pty');
const http = require('http');
const path = require('path');
const bodyParser = require('body-parser');
const multer = require('multer');
const session = require('express-session');
const rateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

const upload = multer({ dest: 'uploads/' });

// Rate limiting middleware
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // Limit each IP to 100 requests per windowMs
});
app.use(limiter);

// File operations
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

app.post('/save-preferences', (req, res) => {
    const { userId, preferences } = req.body;
    // Implement saving preferences logic here
    res.send('Preferences saved successfully.');
});

function ensureAuthenticated(req, res, next) {
    if (req.session.authenticated) {
        return next();
    }
    res.redirect('/login');
}

// Use middleware for protected routes
app.use('/secure', ensureAuthenticated);

wss.on('connection', (ws) => {
    const sessionId = generateUniqueId();
    const shell = pty.spawn('bash', [], {
        name: 'xterm-color',
        cols: 80,
        rows: 24,
        cwd: process.env.HOME,
        env: process.env,
    });

    sessions[sessionId] = shell;

    shell.on('data', (data) => {
        ws.send(JSON.stringify({ sessionId, data }));
    });

    ws.on('message', (msg) => {
        const { sessionId, data } = JSON.parse(msg);
        if (sessions[sessionId]) {
            sessions[sessionId].write(data);
        }
    });

    ws.on('close', () => {
        if (sessions[sessionId]) {
            sessions[sessionId].kill();
            delete sessions[sessionId];
        }
    });
});

function generateUniqueId() {
    return '_' + Math.random().toString(36).substr(2, 9);
}

server.listen(8080, () => {
    console.log('Server running on http://localhost:8080');
});
