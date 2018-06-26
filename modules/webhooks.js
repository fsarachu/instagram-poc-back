const Router = require('express').Router;
const router = new Router();
const Account = require('../db/models/Account');

function verifyRequest(req, res) {
    if (req.param('hub.mode') == 'subscribe' && req.param('hub.verify_token') == process.env.FB_WEBHOOK_TOKEN) {
        res.send(req.param('hub.challenge'));
    } else {
        res.sendStatus(400);
    }
}

function processFacebookEvent(req, res) {
    console.log('Got Facebook webhook event:');
    console.log(JSON.stringify(req.body));

    if (!req.isXHubValid()) {
        console.warn('Warning - request header X-Hub-Signature not present or invalid');
        return res.sendStatus(401);
    }

    console.log('request header X-Hub-Signature validated');

    res.sendStatus(200);
}


function findAccount(instagramAccountId) {
    return Account.findOne({"instagramProfile.id": instagramAccountId})
        .then(account => {
            if (!account) {
                const message = `Instagram Account "${instagramAccountId}" not found`;
                console.error(message);
                throw new Error(message);
            }

            return account;
        });
}

function processInstagramPostComment(instagramAccountId, commentId, commentText) {
    // Mocked, but should query this node: https://developers.facebook.com/docs/instagram-api/reference/comment#reading
    const commentMock = {
        commentId: commentId,
        mediaId: '17909981962114643',
        username: 'Someone',
        timestamp: Date.now(),
        text: commentText,
        likeCount: 0,
    };

    return findAccount(instagramAccountId)
        .then(acc => {
            const activityItem = {
                event: 'post_comment',
                data: commentMock
            };

            acc.instagramProfile.activity.unshift(activityItem);
            return acc.save();
        });
}

function processInstagramCommentMention(instagramAccountId, commentId, mediaId) {
    // Mocked, but should query this node: https://developers.facebook.com/docs/instagram-api/reference/user/mentioned_comment
    const mentionMock = {
        commentId,
        mediaId,
        username: 'Someone',
        timestamp: Date.now(),
        likesCount: 0,
        text: '@example This is some dummy text',
    };

    return findAccount(instagramAccountId)
        .then(acc => {
            const activityItem = {
                event: 'comment_mention',
                data: mentionMock
            };

            acc.instagramProfile.activity.unshift(activityItem);
            return acc.save();
        });
}

function processInstagramCaptionMention(instagramAccountId, mediaId) {
    // Mocked, but should query this node: https://developers.facebook.com/docs/instagram-api/reference/user/mentioned_media
    const mentionMock = {
        commentId: "17841405309211844",
        mediaId,
        caption: "@upshow This is a mocked caption!",
        username: 'Someone',
        mediaType: "IMAGE",
        timestamp: Date.now(),
        likesCount: 0,
        mediaUrl: 'https://s3.amazonaws.com/spotlights.upshow.tv/7bcc7f1b-e707-418c-b8be-f12a8246d4c4_nice-background.png',
    };

    return findAccount(instagramAccountId)
        .then(acc => {
            const activityItem = {
                event: 'caption_mention',
                data: mentionMock
            };

            acc.instagramProfile.activity.unshift(activityItem);
            return acc.save();
        });
}

function processInstagramEvent(req, res) {
    console.log('Got Instagram webhook event:');
    console.log(JSON.stringify(req.body));

    // Process the Instagram updates here
    const entries = req.body.entry;

    const promises = entries.map(entry => {
        // const instagramAccountId = entry.id;
        const instagramAccountId = '17841403676748313'; // Hardcoded, test id wont work
        const changeField = entry.changes[0].field;
        const changeValue = entry.changes[0].value;

        let promise;

        if (changeField === 'comments') {
            promise = processInstagramPostComment(instagramAccountId, changeValue.id, changeValue.text);
        } else if (changeField === 'mentions') {
            if (changeValue.comment_id) {
                promise = processInstagramCommentMention(instagramAccountId, changeValue.comment_id, changeValue.media_id);
            } else {
                promise = processInstagramCaptionMention(instagramAccountId, changeValue.media_id);
            }
        } else {
            console.warn(`Unexpected webhook field "${changeField}"`);
            promise = Promise.resolve();
        }

        return promise;
    });

    Promise.all(promises)
        .then(() => {
            console.log('Successfully processed Instagram Webhook');
            return res.sendStatus(200);
        })
        .catch(e => {
            console.error('Error processing Instagram Webhook: ', e);
            return res.sendStatus(500);
        });

}

router.get(['/webhooks/facebook', '/webhooks/instagram'], verifyRequest);

router.post('/webhooks/facebook', processFacebookEvent);

router.post('/webhooks/instagram', processInstagramEvent);

module.exports = router;