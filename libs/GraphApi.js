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

function subscribeAppToPage(pageId, accessToken) {
    return axios.post(`${pageId}/subscribed_apps?access_token=${accessToken}`)
        .then((r) => {
            const data = r.data;

            if (!data.success) {
                throw data.error || `Cannot install app on facebook page with id ${pageId}`;
            }

            return data;
        })
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

function getMentionedMedia(instagramAccountId, mediaId, accessToken) {
    // TODO: We could also update the account data (profile pic, followers, etc) in this request
    const fields = [
        'caption',
        'comments',
        'comments_count',
        'like_count',
        'media_type',
        'media_url',
        'owner',
        'timestamp',
        'username',
    ];

    const url = `/${instagramAccountId}?access_token=${accessToken}&fields=mentioned_media.media_id(${mediaId}){${fields.join(',')}}`;

    return axios.get(url)
        .then((r) => {
            const data = r.data;

            if (data.error) {
                throw data.error;
            }

            return data.mentioned_media;
        });
}

module.exports = {
    inspectToken,
    getLongLivedToken,
    getPage,
    getInstagramProfile,
    subscribeAppToPage,
    getMentionedMedia
};