const mongoose = require('mongoose');
const timestamps = require('mongoose-timestamp');

const accountSchema = mongoose.Schema({
    organizationId: {
        type: Number,
        required: true,
        unique: true
    },
    facebookPage: {
        id: String,
        name: String,
        accessToken: String,
        picture: String,
    },
    facebookUser: {
        id: String,
        scopes: Array,
        shortLivedToken: String,
        longLivedToken: String,
    },
    instagramProfile: {
        id: String,
        igId: Number,
        username: String,
        name: String,
        followersCount: Number,
        followsCount: Number,
        mediaCount: Number,
        profilePictureUrl: String,
        media: Array,
        activity: {
            type: Array,
            'default': Array
        }
    },
});

accountSchema.plugin(timestamps);

module.exports = mongoose.model('Account', accountSchema);