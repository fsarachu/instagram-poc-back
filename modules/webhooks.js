const Router = require('express').Router;
const router = new Router();

const receivedUpdates = []

function verifyRequest(req, res) {
    if (req.param('hub.mode') == 'subscribe' && req.param('hub.verify_token') == process.env.FB_WEBHOOK_TOKEN) {
        res.send(req.param('hub.challenge'));
    } else {
        res.sendStatus(400);
    }
}

function processFacebookEvent(req, res) {
    console.log('Got Facebook webhook event:');
    console.log(req.body);

    if (!req.isXHubValid()) {
        console.warn('Warning - request header X-Hub-Signature not present or invalid');
        return res.sendStatus(401);
    }

    console.log('request header X-Hub-Signature validated');

    // Process the Facebook updates here
    receivedUpdates.unshift(req.body);

    res.sendStatus(200);
}

function processInstagramEvent(req, res) {
    console.log('Got Instagram webhook event:');
    console.log(req.body);

    // Process the Instagram updates here
    receivedUpdates.unshift(req.body);

    return res.sendStatus(200);
}


router.get('/webhooks', function(req, res) {
    res.json(receivedUpdates);
});

router.get(['/webhooks/facebook', '/webhooks/instagram'], verifyRequest);

router.post('/webhooks/facebook', processFacebookEvent);

router.post('/webhooks/instagram', processInstagramEvent);

module.exports = router;