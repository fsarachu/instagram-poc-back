// Load .env file in dev mode
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').load();
}

// Modules
const express = require('express');
const xhub = require('express-x-hub');
const bodyParser = require('body-parser');
const cors = require('cors');
const initDB = require('./db');
const registerModules = require('./modules');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);

server.listen(process.env.PORT);
console.log(`Listening on port ${process.env.PORT}`);

// handle incoming connections from clients
io.on('connection', function(socket) {
    console.log('Connected');
    // once a client has connected, we expect to get a ping from them saying what room they want to join
    socket.on('join room', function(room) {
        console.log(`Joining room ${room}`);
        socket.join(room);
    });
});

// Setup middleware
const corsOptions = {
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    exposedHeaders: ['Authorization'],
};

// Make io accessible to our router
app.use(function(req,res,next){
    req.io = io;
    next();
});
app.use(cors(corsOptions));
app.use(xhub({ algorithm: 'sha1', secret: process.env.FB_APP_SECRET }));
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

// Register route handlers
registerModules(app);

// Bring it up
initDB()
    .then(() => {
        console.log('Connected to database');
    })
    .catch(e => {
        console.error('Error connecting to database');
        console.error(e);
    });
