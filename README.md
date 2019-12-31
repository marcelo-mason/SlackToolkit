# Slack Toolkit

This repository contains the source for many of the slack [slash commands ](https://api.slack.com/slash-commands) used in the Private Presales Slack group.

## Getting Started

1. install the dependencies

    `npm i`

2. start the server

    `npm start`

3. install [ngrok](https://ngrok.com/) to allow you to respond to slash commands initiated in your local slack workspace through your dev machine

    `brew cask install ngrok`

4. start ngrok

    `ngrok http 3000`

    - You will get a public URL that points to your localhost:  e.g. https://xxxxxx.ngrok.io


2. create your own [slack workspace](https://slack.com/get-started) for your local dev environment

3. create a [slack app](https://api.slack.com/apps?new_app=1)
    - copy **Signing Secret** over to .env

4. create a bot user
    > Bot Users

    - Set Display name
    - Set username

5. add scope permissions to bot 

    > OAuth & Permissions

    - add `channels:read`
    - add `channels:write`
    - add `channels:history`
    - add `groups:read`
    - add `groups:write`
    - add `groups:history`
    - add `users:read`
    - add `chat:write:bot`

6. install app to workplace

    > OAuth & Permissions

    - click **[Install App to Workplace]**
    - copy `access token` to .env
    - copy `bot token` to .env
    - restart app

7. enable event subscriptions

    > Event Subscriptions

    - add Request URL:  `https://xxxxxx.ngrok.io/events`
    - subscribe to the workspace event: `channel_created` event

9. add slash command

    > Slash Commands
    
    Command: `/channel`

    Request URL:  `https://xxxxxx.ngrok.io/channel`

    Short Description:  `Channel command`

10. add slash command

    > Slash Commands
    
    Command: `/util`

    Request URL:  `https://xxxxxx.ngrok.io/util`

    Short Description:  `Util command`

11. In slack on the General channel type `/util users`.  You should get a list of the current slack users, you should find the bot you just created there.  

    - Copy the UserId of the Bot User to .env
    - restart app

12. Run `/util addbot` to add the bot to all existing channels.