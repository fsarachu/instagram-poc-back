const moment = require('moment');
const Router = require('express').Router;
const router = new Router();
const Account = require('../db/models/Account');
const GraphApi = require('../libs/GraphApi');

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

function processInstagramCaptionMention(req, instagramAccountId, mediaId) {
    return Account.findOne({"instagramProfile.id": instagramAccountId})
        .then(acc => {
            const token = acc.facebookPage.accessToken;
            return GraphApi.getMentionedMedia(instagramAccountId, mediaId, token)
                .then(media => {
                    // Format content
                    const content = toUpshowContent(media);

                    // Emit event for screens
                    const orgId = acc.organizationId;
                    req.io.in(`org-${orgId}`).emit('new mention', content);

                    // Save to DB for enterprise
                    acc.mentions.unshift(content);
                    return acc.save();
                });
        })
}

function toUpshowContent(igMediaObject) {
    const {id, caption, comments_count, like_count, media_type, media_url, timestamp, username, owner} = igMediaObject;

    // TODO: Support videos and carousels
    return {
        id,
        "url": media_url,
        "type": media_type === 'VIDEO' ? 2 : 1, // TODO: carousels?
        "thumbnail": media_url, // TODO: video thumbnail?
        "title": null,
        "description": caption,
        "createdAt": {
            "raw_date": moment(timestamp).toString()/*"Tue Jul 03 2018 23:46:33 GMT+0000"*/,
            "date": moment(timestamp).format("YYYY-MM-DD HH:mm:ss.SSSSSS")/*"2018-07-03 23:46:33.000000"*/,
            "timezone": "UTC",
            "timezone_type": 3
        },
        "updatedAt": null,
        "network": "instagram",
        "locationId": null,
        "permalink": "https://www.instagram.com/p/BeEFXJ_nhau/", // TODO
        "reach": like_count + comments_count,
        "favs": like_count,
        "comments": comments_count,
        "rating": null,
        "postedAt": {
            "raw_date": moment(timestamp).toString()/*"Tue Jul 03 2018 23:46:33 GMT+0000"*/,
            "date": moment(timestamp).format("YYYY-MM-DD HH:mm:ss.SSSSSS")/*"2018-07-03 23:46:33.000000"*/,
            "timezone": "UTC",
            "timezone_type": 3
        },
        "isDeleted": false,
        "isPinned": false,
        "user": {
            "id": owner,
            "profileId": owner,
            "userName": username,
            "profilePicture": "https://s3.amazonaws.com/static.upshow.tv/franco/sample_post.jpg", // TODO
            "profileUrl": "https://www.instagram.com/upshow/", // TODO
            "network": "instagram",
            "createdAt": null, // TODO
            "followers": 3092, // TODO
            "updatedAt": null // TODO
        },
        "gridThumbnail": media_url, // TODO: video thumbnail?
        "zoomURL": media_url // TODO: video thumbnail?
    };

}

function processInstagramEvent(req, res) {
    console.log('Got Instagram webhook event:');
    console.log(JSON.stringify(req.body));

    // Process the Instagram updates here
    const entries = req.body.entry;

    const promises = entries.map(entry => {
        const instagramAccountId = entry.id;
        const change = entry.changes[0];

        let promise = Promise.resolve();

        if (change.field === 'mentions') {
            if (change.value.comment_id) {
                promise = processInstagramCommentMention(instagramAccountId, change.value.comment_id, change.value.media_id);
            } else {
                promise = processInstagramCaptionMention(req, instagramAccountId, change.value.media_id);
            }
        } else {
            console.warn(`Unexpected webhook entry field "${change.field}"`);
            promise = Promise.resolve();
        }

        return promise;
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
        return res.sendStatus(401);
    }

    next();
}

router.get(['/webhooks/facebook', '/webhooks/instagram'], verifyWebhookRequest);

router.post('/webhooks/facebook', verifyXhub, processFacebookEvent);

router.post('/webhooks/instagram', verifyXhub, processInstagramEvent);

module.exports = router;