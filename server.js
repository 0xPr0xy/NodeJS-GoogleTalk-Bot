const config = require('./config.js').settings;


var express = require('express');
var app = express();
var port = process.env.PORT || 5000;
var request = require('request');
var zlib = require('zlib');


app.configure(function(){
  app.set('view engine', 'jade');
  app.set('view options', { layout: false });
  app.set('views', __dirname + '/views');
  app.use("/css", express.static(__dirname + '/css'));
});

app.get('/', function(req, res){
  var data = {
    title: config.status_message,
    bot_email: config.client.jid
  };
  res.render('index.jade', data);
});

app.listen(port, function() {
  console.log("Listening on " + port);
});



execute_bot();





function execute_bot() {
    /**
     * A simple XMPP client bot aimed specifically at Google Talk
     * @author Simon Holywell
     * @version 2011.09.16
     */
    const xmpp = require('node-xmpp');
    const util = require('util');
    // const zlib = require('zlib');
    const request_helper = require('request');
    const conn = new xmpp.Client(config.client);
    conn.socket.setTimeout(0);
    conn.socket.setKeepAlive(true, 10000);

    var commands = {};

    /**
     * Request the roster from the Google identity query service
     * http://code.google.com/apis/talk/jep_extensions/roster_attributes.html#3
     */
    function request_google_roster() {
        var roster_elem = new xmpp.Element('iq', { from: conn.jid, type: 'get', id: 'google-roster'})
                        .c('query', { xmlns: 'jabber:iq:roster', 'xmlns:gr': 'google:roster', 'gr:ext': '2' });
        conn.send(roster_elem);
    }

    /**
     * Accept any subscription request stanza that is sent over the wire
     * @param {Object} stanza
     */
    function accept_subscription_requests(stanza) {
        if(stanza.is('presence') 
           && stanza.attrs.type === 'subscribe') {
            var subscribe_elem = new xmpp.Element('presence', {
                to: stanza.attrs.from,
                type: 'subscribed'
            });
            conn.send(subscribe_elem);
            send_help_information(stanza.attrs.from);
        }
    }

    /**
     * Set the status message of the bot to the supplied string
     * @param {String} status_message
     */
    function set_status_message(status_message) {
        var presence_elem = new xmpp.Element('presence', { })
                                .c('show').t('chat').up()
                                .c('status').t(status_message);
        conn.send(presence_elem);
    }

    /**
     * Send a XMPP ping element to the server
     * http://xmpp.org/extensions/xep-0199.html
     */
    function send_xmpp_ping() {
        var elem = new xmpp.Element('iq', { from: conn.jid, type: 'get', id: 'c2s1' })
                 .c('ping', { 'xmlns': 'urn:xmpp:ping' });
        conn.send(elem);
    }

    /**
     * Send a message to the supplied JID
     * @param {String} to_jid
     * @param {String} message_body
     */
    function send_message(to_jid, message_body) {
        var elem = new xmpp.Element('message', { to: to_jid, type: 'chat' })
                 .c('body').t(message_body);
        conn.send(elem);
        util.log('[message] SENT: ' + elem.up().toString());
    }

    /**
     * A wrapper for send message to wrap the supplied command in help
     * text
     */
    function send_unknown_command_message(request) {
        send_message(request.stanza.attrs.from, 'Unknown command: "' + request.command + '". Type "help" for more information.');
    }

    /**
     * Send out some help information detailing the available
     * bot commands
     * @param {String} to_jid
     */
    function send_help_information(to_jid) {

        var message_body = "\n*Available Commands:*\n";
        message_body += "*HackerNews* hn;\n";
        message_body += "*StackOverflow* so;search query\n";
        message_body += "*SoundCloud* sc;artist name\n";
        message_body += "*Twitter* t;some search string\n";
        message_body += "*Status* s;A new status message\n";
        message_body += "*Bounce* b;example text\n";

        send_message(to_jid, message_body);
    }

    /**
     * Break the message up into components
     * @param {Object} stanza
     */
    function split_request(stanza) {
        var message_body = stanza.getChildText('body');
        if(null !== message_body) {
            message_body = message_body.split(config.command_argument_separator);
            var command = message_body[0].trim().toLowerCase();
            if(typeof message_body[1] !== "undefined") {
                return { "command" : command,
                         "argument": message_body[1].trim(),
                         "stanza"  : stanza };
            } else {
                send_help_information(stanza.attrs.from);
            }
        }
        return false;
    }

    /**
     * Dispatch requests sent in message stanzas
     * @param {Object} stanza
     */
    function message_dispatcher(stanza) {
        if('error' === stanza.attrs.type) {
            util.log('[error] ' + stanza.toString());
        } else if(stanza.is('message')) {
            var request = split_request(stanza);
            if(request) {
                if(!execute_command(request)) {
                    send_unknown_command_message(request);
                }
            }
        }
    }

    /**
     * Add a command to the bot for processing
     * @param {String} command
     * @param {Function} callback (should return true on success)
     */
    function add_command(command, callback) {
        commands[command] = callback;
    }

    /**
     * Execute a command
     * @param {Object} request
     */
    function execute_command(request) {
        if(typeof commands[request.command] === "function") {
            return commands[request.command](request);
        }
        return false;
    }

    /**
     * Bounce any message the user sends to the bot back to them
     * @param {Object} request
     */
    add_command('b', function(request) {
        send_message(request.stanza.attrs.from, request.stanza.getChildText('body'));
        return true;
    });

    /**
     * Search twitter for the provided term and give back 5 tweets
     * @param {Object} request
     */
    add_command('t', function(request) {
        var to_jid = request.stanza.attrs.from;
        send_message(to_jid, 'Searching twitter, please be patient...');
        var url = 'http://search.twitter.com/search.json?rpp=5&show_user=true&lang=en&q='
                + encodeURIComponent(request.argument);
        request_helper(url, function(error, response, body){
            if (!error && response.statusCode == 200) {
                var body = JSON.parse(body);
                if(body.results.length) {
                    for(var i in body.results) {
                        send_message(to_jid, body.results[i].text);
                    }
                } else {
                    send_message(to_jid, 'There are no results for your query. Please try again.');
                }
            } else {
                send_message(to_jid, 'Twitter was unable to provide a satisfactory response. Please try again.');
            }
        });
        return true;
    });

    /**
     * Search soundcloud for the provided term and give back 5 tracks
     * @param {Object} request
     */
     add_command('sc', function(request){
        var to_jid = request.stanza.attrs.from;
        send_message(to_jid, 'Searching soundcloud, please be patient...');
        var url = 'http://api.soundcloud.com/tracks.json?client_id=570f56acefe61658492d4ee040a0a0cd&limit=5&q='
                + encodeURIComponent(request.argument);
        request_helper(url, function(error, response, body){
            if (!error && response.statusCode == 200) {
                var body = JSON.parse(body);
                if(body.length) {
                    for(var i in body) {
                        if(body[i].uri){
                            send_message(to_jid, body[i].title + '\n' + body[i].permalink_url);
                        }
                    }
                } else {
                    send_message(to_jid, 'There are no results for your query. Please try again.');
                }
            } else {
                send_message(to_jid, 'Soundcloud was unable to provide a satisfactory response. Please try again.');
            }
        });
        return true;
     });

    /**
     * Give back 5 results from hackernews frontpage
     * @param {Object} request
     */
     add_command('hn', function(request){
        var to_jid = request.stanza.attrs.from;
        send_message(to_jid, 'Searching hackernews, please be patient...');
        var url = 'http://api.ihackernews.com/page/';

        request_helper(url, function(error, response, body){
            if (!error && response.statusCode == 200) {
                var body = JSON.parse(body);
                if(body.items.length) {
                    for(var i in body.items) {
                        if(body.items[i].url){
                            send_message(to_jid, body.items[i].title + '\n' + body.items[i].url);
                        }
                    }
                } else {
                    send_message(to_jid, 'There are no results for your query. Please try again.');
                }
            } else {
                send_message(to_jid, 'Hackernews was unable to provide a satisfactory response. Please try again.');
            }
        });
        return true;
     });

    /**
     * Give back 5 results from stackoverflow
     * @param {Object} request
     */

    function gunzipJSON(response, to_jid){

        var gunzip = zlib.createGunzip();
        var json = "";

        gunzip.on('data', function(data){
            json += data.toString();
        });
        
        gunzip.on('end', function(){
            parseJSON(json, to_jid);
        });

        return response.pipe(gunzip);
    }

    function parseJSON(json, to_jid){

        var json = JSON.parse(json);

        if(json.items.length){
            
            for(var i in json.items){
                send_message(to_jid, json.items[i].title + '\n' + json.items[i].link);
                // console.log(json.items[i].title + '\n' + json.items[i].link);
            }
            return true;
        } else {
            send_message(to_jid, 'There are no results for your query. Please try again.');
        }
    }

    add_command('so', function(request){
        var to_jid = request.stanza.attrs.from;
        send_message(to_jid, 'Searching stackoverflow, please be patient...');
        var url = 'https://api.stackexchange.com/2.1/search?pagesize=5&order=desc&sort=activity&intitle='+ encodeURIComponent(request.argument) +'&site=stackoverflow';
        var headers = {'Accept-Encoding': 'gzip'};
        var response = request_helper(url, headers);
        return gunzipJSON(response, to_jid);
    });


    /**
     * Set the bot's status message to the provided term
     * @param {Object} request
     */
    add_command('s', function(request) {
        set_status_message(request.argument);
        send_message(request.stanza.attrs.from, "Status message now set to " + request.argument);
        //send_message(request.stanza.attrs.from, "This feature has been disabled on this public bot due to abuse. Sorry");
        return true;
    });

    if(config.allow_auto_subscribe) {
        // allow the bot to respond to subscription requests
        // and automatically accept them if enabled in the config
        conn.addListener('online', request_google_roster);
        conn.addListener('stanza', accept_subscription_requests);
    }

    conn.addListener('stanza', message_dispatcher);

    conn.on('online', function() {
        set_status_message(config.status_message);

        // send whitespace to keep the connection alive
        // and prevent timeouts
        setInterval(function() {
            conn.send(' ');
        }, 30000);
    });

    conn.on('error', function(stanza) {
        util.log('[error] ' + stanza.toString());
    });
}
