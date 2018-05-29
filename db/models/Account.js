const mongoose = require('mongoose');

const accountSchema = mongoose.Schema({
    facebookPage: {
        id: String,
        name: String,
        accessToken: String,
        picture: String,
    },
    instagramAccount: {
        id: String,
        igId: Number,
        username: String,
        name: String,
        followersCount: Number,
        followsCount: Number,
        mediaCount: Number,
        profilePictureUrl: String,
    },
});

module.exports = mongoose.model('Account', accountSchema);