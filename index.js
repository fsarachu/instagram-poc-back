// Load .env file in dev mode
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').load();
}

// Modules
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const initDB = require('./db');
const registerModules = require('./modules');
const app = express();

// Setup middleware
const corsOptions = {
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    exposedHeaders: ['Authorization'],
};

app.use(cors(corsOptions));
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

// Register route handlers
registerModules(app);

// Bring it up
initDB()
    .then(() => {
        console.log('Connected to database');
        app.listen(process.env.PORT, () => console.log(`Listening on port ${process.env.PORT}`));
    })
    .catch(e => {
        console.error('Error connecting to database');
        console.error(e);
    });
