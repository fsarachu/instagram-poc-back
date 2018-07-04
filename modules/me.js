const Router = require('express').Router;
const jwt = require('jsonwebtoken');
const Account = require('../db/models/Account');
const GraphApi = require('../libs/GraphApi');
const router = new Router();


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
    };

    Account.findOne(query)
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
        next(e);
    }
}

function verifyJwt(req, res, next) {

    try {
        const auth = req.header('Authorization');

        if (typeof auth !== 'string') {
            return res.status(401).json({error: 'Missing Authorization header'});
        }

        const token = auth.slice(7);
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.accountId = verified.id;

        return next();
    } catch (e) {
        return res.status(401).json({error: 'Failed verifying token'});
    }

}

function loadAccount(req, res, next) {
    return Account.findById(req.accountId)
        .then(account => {

            if(!account) {
                throw new Error('Account not found');
            }

            req.account = account;
            return next();
        })
        .catch(e => {
            console.error(e);
            return res.status(401).json({error: 'Failed loading account'});
        });
}

function getAccount(req, res) {
    return res.json(req.account.instagramProfile);
}

function getMentions(req, res) {
    const data = {
        username: req.account.instagramProfile.username,
        profilePictureUrl: req.account.instagramProfile.profilePictureUrl,
        mentions: req.account.mentions,
    };
    return res.json(data);
}

function refreshInstagramAccount(req, res, next) {
    const {id} = req.account.instagramProfile;
    const {accessToken} = req.account.facebookPage;

    GraphApi.getInstagramProfile(id, accessToken)
        .then(profile => {

            // Normalize and save page info to request
            const updatedData = {
                instagramProfile: {
                    username: profile.username,
                    name: profile.name,
                    followersCount: profile.followers_count,
                    followsCount: profile.follows_count,
                    mediaCount: profile.media_count,
                    profilePictureUrl: profile.profile_picture_url,
                    media: profile.media.data,
                }
            };

            console.log('Updating instagram profile: ', JSON.stringify(updatedData));

            req.account.set(updatedData);

            return req.account.save()
                .then(() => next())
                .catch(next);
        })
        .catch(error => {
            const message = "Error updating Instagram profile";
            console.error(message);
            console.error(error.message);
            return res.status(500).json({error: message});
        })
        .catch(next);
}

router.get('/me/mentions', verifyJwt, loadAccount, getMentions);

router.get('/me', verifyJwt, loadAccount, getAccount);

router.post('/me/sync', verifyJwt, loadAccount, refreshInstagramAccount, getAccount);

module.exports = router;