Node.js Google Talk Bot
------------------------

Supported Commands
-------------------
This bot supports the following commands:
	
	SoundCloud sc;artist
	StackOverflow so;query
	HackerNews hn;
	Twitter t;query
	Status s;status
	Bounce b;message

Dependencies
-------------
	"express": "~3.1.0",
	"jade": "~0.28.1",
	"node-expat": "~1.6.1",
	"node-xmpp": "~0.3.2",
	"request": "~2.12.0"


Running locally
--------------------------------
Make sure you have Node and Npm installed
Edit the config.js with your Gmail Account

	npm install
	"export JID_PASSWORD=<yourpassword>" >> .bashrc
	node server.js



Deploying to Heroku
--------------------
Install the Heroku toolbelt : https://toolbelt.heroku.com/
	
	heroku login
	heroku config:add JID_PASSWORD=<yourpassword>
	git init
	git add .
	git commit -m 'init'
	heroku create
	git push heroku master