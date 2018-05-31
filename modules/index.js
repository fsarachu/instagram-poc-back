const auth = require('./auth');
const me = require('./me');
const webhooks = require('./webhooks');

module.exports = function (app) {
    app
        .use(auth)
        .use(me)
        .use(webhooks)
    ;
};