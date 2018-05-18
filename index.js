// Load .env file in dev mode
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').load();
}

// Modules
const express = require('express');
const initDB = require('./db');
const app = express();
const User = require('./db/models/User');

// Register route handlers
app.get('/', (req, res) => res.json({msg: 'hello'}));

app.get('/users', (req, res) => {
    return User.find()
        .then(users => {
            return res.json({data: users});
        })
        .catch(e => {
            return res.json({error: e});
        });
});

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
