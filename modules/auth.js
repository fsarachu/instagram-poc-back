const Router = require('express').Router;
const jwt = require('jsonwebtoken');
const Account = require('../db/models/Account');
const GraphApi = require('../libs/GraphApi');
const router = new Router();

const requiredScopes = [
    'public_profile',
    'manage_pages',
    'instagram_basic',
    'instagram_manage_comments'
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
        console.error(error);
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

function getPage(req, res, next) {
    const {pageId} = req.body;
    const {longLivedToken} = req.fbUser;

    if (!pageId) {
        const error = 'Missing required "pageId" parameter';
        return res.status(400).json({error});
    }

    GraphApi.getPage(pageId, longLivedToken)
        .then(page => {

            // Validation
            if (!page.connected_instagram_account) {
                throw new Error(`Facebook page "${page.id}" has no connected Instagram account`);
            }

            // Normalize and save page info to request
            req.fbPage = {
                id: page.id,
                accessToken: page.access_token,
                name: page.name,
                picture: page.picture.data.url,
            };

            req.igProfile = {
                id: page.connected_instagram_account.id,
            };

            next();
        })
        .catch(error => {
            const message = "Error connecting Facebook page";
            console.error(message);
            console.error(error.message);
            return res.status(400).json({error: message});
        })
        .catch(next);
}

function installApp(req, res, next) {
    GraphApi.subscribeAppToPage(req.fbPage.id, req.fbPage.accessToken)
        .then(r => {
            console.log(`Successfully subscribed app to page ${req.fbPage.id}: `, JSON.stringify(r));
            next();
        })
        .catch(error => {
            const message = "Error subscribing app to Facebook page";
            console.error(message);
            console.error(error);
            return res.status(400).json({error: message});
        })
        .catch(next);
}

function getInstagramProfile(req, res, next) {
    const {id} = req.igProfile;
    const {accessToken} = req.fbPage;

    GraphApi.getInstagramProfile(id, accessToken)
        .then(profile => {

            // Normalize and save page info to request
            req.igProfile = {
                id: profile.id,
                igId: profile.ig_id,
                username: profile.username,
                name: profile.name,
                followersCount: profile.followers_count,
                followsCount: profile.follows_count,
                mediaCount: profile.media_count,
                profilePictureUrl: profile.profile_picture_url,
                media: profile.media.data,
            };

            next();
        })
        .catch(error => {
            const message = "Error connecting Instagram profile";
            console.error(message);
            console.error(error.message);
            return res.status(500).json({error: message});
        })
        .catch(next);
}

function upsertAccount(req, res, next) {
    const query = {"instagramProfile.id": req.igProfile.id};
    const accountData = {
        facebookPage: req.fbPage,
        facebookUser: req.fbUser,
        instagramProfile: req.igProfile,
        organizationId: req.body.organizationId,
    };

    return Account.findOne(query)
        .then(account => {
            if (account) {
                console.log(`Account with Instagram Profile "${req.igProfile.id}" found with _id "${account._id}", updating`);
                account.set(accountData);
            } else {
                console.log(`Account with Instagram Profile "${req.igProfile.id}" not found, creating`);
                account = new Account(accountData);
            }

            return account.save().then(savedAccount => {
                req.account = savedAccount;
                next();
            });
        })
        .catch(e => {
            const message = "Couldn't create account";
            console.error(message);
            console.error(e);
            return res.status(400).json({error: message});
        })
        .catch(next);
}

function sendToken(req, res, next) {
    try {
        const token = jwt.sign({id: req.account._id}, process.env.JWT_SECRET);
        return res.status(201).set('Authorization', `Bearer ${token}`).send();
    } catch (e) {
        console.error('Error sending token');
        console.error(e);
        return next(e);
    }
}

router.post('/auth/facebook', validateAccessToken, extendUserToken, getPage, installApp, getInstagramProfile, upsertAccount, sendToken);

module.exports = router;