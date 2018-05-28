const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
    facebookProvider: {
        id: String,
        scopes: Array,
        shortLivedToken: String,
        longLivedToken: String,
    }
});

module.exports = mongoose.model('User', userSchema);