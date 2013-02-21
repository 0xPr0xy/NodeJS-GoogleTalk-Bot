exports.settings = {
    "status_message": "Google Talk Bot running on Node.js",
    "client": {
        "jid": "0xpr0xy.bot@gmail.com",
        "password": process.env.JID_PASSWORD,
        "host": "talk.google.com",
        "port": 5222,
        "reconnect": true
    },
    "allow_auto_subscribe": true,
    "command_argument_separator": /\s*\;\s*/
};
