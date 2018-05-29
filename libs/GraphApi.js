const axios = require("axios").default.create({
    baseURL: 'https://graph.facebook.com/',
});

const {FB_APP_ID, FB_APP_SECRET} = process.env;
const FB_APP_TOKEN = `${FB_APP_ID}|${FB_APP_SECRET}`;

function inspectToken(accessToken) {
    return axios.get(`/debug_token?input_token=${accessToken}&access_token=${FB_APP_TOKEN}`)
        .then((r) => {
            const data = r.data.data;

            if (data.error) {
                throw data.error;
            }

            return data;
        });
}

function getLongLivedToken(shortLivedToken) {
    return axios.get(`/oauth/access_token?grant_type=fb_exchange_token&client_id=${FB_APP_ID}&client_secret=${FB_APP_SECRET}&fb_exchange_token=${shortLivedToken}`)
        .then((r) => {
            const data = r.data;

            if (data.error) {
                throw data.error;
            }

            return data.access_token;
        });
}

function getPage(pageId, accessToken) {
    return axios.get(`/${pageId}?access_token=${accessToken}&fields=connected_instagram_account,name,picture,access_token`)
        .then((r) => {
            const data = r.data;

            if (data.error) {
                throw data.error;
            }

            return data;
        });
}

function getInstagramProfile(instagramAccountId, accessToken) {
    return axios.get(`/${instagramAccountId}?access_token=${accessToken}&fields=biography,followers_count,follows_count,id,ig_id,name,profile_picture_url,username,media{id,ig_id,like_count,media_type,permalink,shortcode,timestamp,username,media_url,caption,comments_count}`)
        .then((r) => {
            const data = r.data;

            if (data.error) {
                throw data.error;
            }

            return data;
        });
}

module.exports = {
    inspectToken,
    getLongLivedToken,
    getPage,
    getInstagramProfile,
};