const Router = require('express').Router;
const User = require('../db/models/User');
const GraphApi = require('../libs/GraphApi');
const router = new Router();

const requiredScopes = [
    "read_insights",
    "read_audience_network_insights",
    "manage_pages",
    "pages_show_list",
    "instagram_basic",
    "instagram_manage_comments",
    "instagram_manage_insights",
    "public_profile",
];

function hasRequiredScopes(scopes) {
    for (const reqScope of requiredScopes) {
        if (!scopes.includes(reqScope)) {
            return false;
        }
    }

    return true;
}

function validateAccessToken(req, res, next) {
    const {accessToken} = req.body;

    if (!accessToken) {
        const error = 'Missing required "accessToken" parameter';
        return res.status(400).json({error});
    }

    GraphApi.inspectToken(accessToken)
        .then(tokenInfo => {

            // Validation
            if (tokenInfo.type !== 'USER') {
                throw new Error(`Access token has invalid type. Expected "USER" got "${tokenInfo.type}"`);
            }

            if (tokenInfo.app_id !== process.env.FB_APP_ID) {
                throw new Error(`Access token has wrong APP ID. Expected "${process.env.FB_APP_ID}" got "${tokenInfo.app_id}"`);
            }

            if (!hasRequiredScopes(tokenInfo.scopes)) {
                throw new Error(`Access token missing required scopes. Expected ${requiredScopes} got ${tokenInfo.scopes}`);
            }

            // Normalize and save token info to request
            req.fbUser = {
                id: tokenInfo.user_id,
                shortLivedToken: accessToken,
                scopes: tokenInfo.scopes,
            };

            next();
        })
        .catch(error => {
            const message = "Error validating access token";
            console.error(message);
            console.error(error);
            return res.status(400).json({error: message});
        })
        .catch(next);
}

function extendUserToken(req, res, next) {
    const {shortLivedToken} = req.fbUser;

    GraphApi.getLongLivedToken(shortLivedToken)
        .then(accessToken => {
            req.fbUser.longLivedToken = accessToken;
            next();
        })
        .catch(error => {
            const message = "Error extending access token";
            console.error(message);
            console.error(error);
            return res.status(400).json({error: message});
        })
        .catch(next);

}

function upsertUser(req, res, next) {
    const query = {"facebookProvider.id": req.fbUser.id};
    const userData = {facebookProvider: req.fbUser};

    User.findOne(query)
        .then(user => {
            if (user) {
                console.log(`Facebook user ${req.fbUser.id} found with _id ${user._id}, updating`);
                user.set(userData);
            } else {
                console.log(`Facebook user ${req.fbUser.id} not found, creating`);
                user = new User(userData);
            }

            return user.save().then(savedUser => {
                req.localUser = savedUser;
                next();
            });
        })
        .catch(e => {
            const message = "Couldn't create user";
            console.error(message);
            console.error(e);
            return res.status(400).json({error: message});
        })
        .catch(next);

}

function logger(req, res, next) {
    const {fbUser, localUser} = req;
    return res.json({fbUser, localUser});
}

router.post('/auth/facebook', validateAccessToken, extendUserToken, upsertUser, logger);

module.exports = router;