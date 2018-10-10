const Router = require('express').Router;
const jwt = require('jsonwebtoken');
const Account = require('../db/models/Account');
const GraphApi = require('../libs/GraphApi');
const router = new Router();

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


function deleteAccount(req, res) {
    return req.account.remove()
        .then(() => {
            return res.status(204).send();
        })
        .catch(e => {
            console.error(e);
            return res.status(500).json({error: 'Failed removing account'});
        });
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

router.delete('/me', verifyJwt, loadAccount, deleteAccount);

router.post('/me/sync', verifyJwt, loadAccount, refreshInstagramAccount, getAccount);

module.exports = router;