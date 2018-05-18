// Load .env file in dev mode
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').load();
}

// Modules
const express = require('express');
const app = express();

// Route handlers
app.get('/', (req, res) => res.json({msg: 'hello'}));

// Bring it up
app.listen(process.env.PORT, () => console.log(`Listening on port ${process.env.PORT}`));