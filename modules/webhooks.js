const moment = require('moment');
const Router = require('express').Router;
const router = new Router();
const Account = require('../db/models/Account');

function verifyWebhookRequest(req, res) {
    if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === process.env.FB_WEBHOOK_TOKEN) {
        return res.send(req.query['hub.challenge']);
    } else {
        return res.sendStatus(400);
    }
}

function processFacebookEvent(req, res) {
    console.log('Got Facebook webhook event:');
    console.log(JSON.stringify(req.body));

    if (!req.isXHubValid()) {
        console.warn('Warning - request header X-Hub-Signature not present or invalid');
        return res.sendStatus(401);
    }

    return res.sendStatus(200);
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

    return Account.find({})
        .then(accounts => {
            return Promise.all(accounts.map(acc => {
                const activityItem = {
                    event: 'comment_mention',
                    data: mentionMock
                };

                acc.instagramProfile.activity.unshift(activityItem);
                return acc.save();
            }));
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

    return Account.find({})
        .then(accounts => {
            return Promise.all(accounts.map(acc => {
                const activityItem = {
                    event: 'caption_mention',
                    data: mentionMock
                };

                acc.instagramProfile.activity.unshift(activityItem);
                return acc.save();
            }));
        });
}

function saveMockedMention(req) {
    const mockedMention = {
        "id": Date.now(),
        "url": "https://s3.amazonaws.com/static.upshow.tv/franco/sample_post.jpg",
        "type": 1,
        "thumbnail": "https://s3.amazonaws.com/static.upshow.tv/franco/sample_post.jpg",
        "title": null,
        "description": "This is a test @mention!",
        "createdAt": {
            "raw_date": moment().toString()/*"Tue Jul 03 2018 23:46:33 GMT+0000"*/,
            "date": moment().format("YYYY-MM-DD HH:mm:ss.SSSSSS")/*"2018-07-03 23:46:33.000000"*/,
            "timezone": "UTC",
            "timezone_type": 3
        },
        "updatedAt": null,
        "network": "instagram",
        "locationId": null,
        "permalink": "https://www.instagram.com/p/BeEFXJ_nhau/",
        "reach": 11,
        "favs": 0,
        "comments": 0,
        "rating": null,
        "postedAt": {
            "raw_date": moment().toString()/*"Tue Jul 03 2018 23:46:33 GMT+0000"*/,
            "date": moment().format("YYYY-MM-DD HH:mm:ss.SSSSSS")/*"2018-07-03 23:46:33.000000"*/,
            "timezone": "UTC",
            "timezone_type": 3
        },
        "isDeleted": false,
        "isPinned": false,
        "user": {
            "id": 123,
            "profileId": "12345",
            "userName": "upshow",
            "profilePicture": "https://s3.amazonaws.com/static.upshow.tv/franco/sample_post.jpg",
            "profileUrl": "https://www.instagram.com/upshow/",
            "network": "instagram",
            "createdAt": null,
            "followers": 3092,
            "updatedAt": null
        },
        "gridThumbnail": "https://s3.amazonaws.com/static.upshow.tv/franco/sample_post.jpg",
        "zoomURL": "https://s3.amazonaws.com/static.upshow.tv/franco/sample_post.jpg"
    };

    return Account.find({})
        .then(accounts => {
            return Promise.all(accounts.map(acc => {
                //Emit new mention
                const orgId = acc.organizationId;
                req.io.in(`org-${orgId}`).emit('new mention', mockedMention);

                acc.mentions.unshift(mockedMention);
                return acc.save();
            }));
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

        if (changeField === 'mentions') {
            if (changeValue.comment_id) {
                promise = processInstagramCommentMention(instagramAccountId, changeValue.comment_id, changeValue.media_id);
            } else {
                promise = processInstagramCaptionMention(instagramAccountId, changeValue.media_id);
            }
        } else {
            console.warn(`Unexpected webhook field "${changeField}"`);
            promise = Promise.resolve();
        }

        return promise.then(() => saveMockedMention(req));
    });

    Promise.all(promises)
        .then(() => {
            console.log(`Successfully processed Instagram Webhook with ${entries.length} entries`);
            return res.sendStatus(200);
        })
        .catch(e => {
            console.error('Error processing Instagram Webhook: ', e);
            return res.sendStatus(500);
        });

}

function verifyXhub(req, res, next) {
    if (!req.isXHub || !req.isXHubValid()) {
        console.error('Invalid X-Hub signature in webhook request: ', req.headers);
        return res.status(401).send();
    }

    next();
}

router.get(['/webhooks/facebook', '/webhooks/instagram'], verifyWebhookRequest);

router.post('/webhooks/facebook', verifyXhub, processFacebookEvent);

router.post('/webhooks/instagram', verifyXhub, processInstagramEvent);

module.exports = router;