const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
    email: {
        type: String,
        required: true,
        trim: true,
        unique: true,
        match: /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/
    },
    facebookProvider: {
        type: {
            id: String,
            token: String
        },
        // select: false
    }
});

userSchema.statics.upsertFbUser = function(accessToken, refreshToken, profile, cb) {
    return this.findOne({'facebookProvider.id': profile.id}, (err, user) => {
        // no user was found, lets create a new one
        if (!user) {
            const newUser = new this({
                email: profile.emails[0].value,
                facebookProvider: {
                    id: profile.id,
                    token: accessToken
                }
            });

            newUser.save(function(error, savedUser) {
                if (error) {
                    console.log(error);
                }
                return cb(error, savedUser);
            });
        } else {
            return cb(err, user);
        }
    });
};

module.exports = mongoose.model('User', userSchema);