const Router = require('express').Router;
const jwt = require('jsonwebtoken');
const expressJwt = require('express-jwt');
const passport = require('passport');
const FacebookTokenStrategy = require('passport-facebook-token');
const User = require('../db/models/User');
const router = new Router();


// Setup passport
passport.use(new FacebookTokenStrategy({
        clientID: process.env.FB_ID,
        clientSecret: process.env.FB_SECRET
    },
    function (accessToken, refreshToken, profile, done) {
        User.upsertFbUser(accessToken, refreshToken, profile, function(err, user) {
            return done(err, user);
        });
    }));


const createToken = function(auth) {
    return jwt.sign({
            id: auth.id
        }, 'my-secret',
        {
            expiresIn: 60 * 120 * 1000
        });
};

const generateToken = function (req, res, next) {
    req.token = createToken(req.auth);
    next();
};

const sendToken = function (req, res) {
    res.setHeader('x-auth-token', req.token);
    res.status(200).send(req.auth);
};

const authenticate = expressJwt({
    secret: 'my-secret',
    requestProperty: 'auth',
    getToken: function(req) {
        if (req.headers['x-auth-token']) {
            return req.headers['x-auth-token'];
        }
        return null;
    }
});

const getCurrentUser = function(req, res, next) {
    User.findById(req.auth.id, function(err, user) {
        if (err) {
            next(err);
        } else {
            req.user = user;
            next();
        }
    });
};

const getOne = function (req, res) {
    const user = req.user.toObject();

    delete user['facebookProvider'];
    delete user['__v'];

    res.json(user);
};


router.route('/auth/facebook')
    .post(passport.authenticate('facebook-token', {session: false}), function(req, res, next) {
        if (!req.user) {
            return res.send(401, 'User Not Authenticated');
        }

        // prepare token for API
        req.auth = {
            id: req.user.id
        };

        next();
    }, generateToken, sendToken);

router.route('/auth/me')
    .get(authenticate, getCurrentUser, getOne);

module.exports = router;