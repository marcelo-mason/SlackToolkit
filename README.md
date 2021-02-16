# Slack Toolkit

## Getting Started

1. install the dependencies

   `npm i`

2. start the server

   `npm start`

3. install [ngrok](https://ngrok.com/) to allow you to respond to slash commands initiated in your local slack workspace through your dev machine

   `brew cask install ngrok`

4. start ngrok

   `ngrok http 3000`

   - You will get a public URL that points to your localhost: e.g. https://xxxxxx.ngrok.io

5. create your own [slack workspace](https://slack.com/get-started) for your local dev environment

6. create a [slack app](https://api.slack.com/apps?new_app=1)

   - copy **Signing Secret** over to .env `ST_SLACK_APP_SIGNING_SECRET`

7. create a bot user

   > Bot Users

   - Set Display name
   - Set username

8. add scope permissions to bot

   > OAuth & Permissions

   #### Bot Token Scopes

   - add `commands`
   - add `channels:manage`
   - add `files:read`
   - add `files:write`

   #### User Token Scopes

   - add `users:read`
   - add `chat:write`
   - add `files:write`
   - add `channels:history`
   - add `channels:read`
   - add `channels:write`

   > To use the bots inside private channels

   - add `groups:history`
   - add `groups:read`
   - add `groups:write`

   > To use the bots inside multi-user DMs

   - add `im:history`
   - add `im:read`
   - add `im:write`

   > Note: The bot adds itself to all new public channels created so you can have the functionality instantly available. You will need to manually `/invite` the bot user to private channels and DMs where you want to use the bot. Slack prevents bots from adding themselves to non-public chats.

9. install app to workplace

   > OAuth & Permissions

   - click **[Install App to Workplace]**
   - copy `access token` to .env `ST_SLACK_ACCESS_TOKEN`
   - copy `bot token` to .env `ST_SLACK_BOT_TOKEN`
   - restart app

10. enable event subscriptions

    > Event Subscriptions

    - add Request URL: `https://xxxxxx.ngrok.io/events`

    #### Subscribe to events on behalf of users

    - add `channel_created`
    - add `file_shared`
    - add `message.channels`
    - add `message.groups`

11. add slash command

    > Slash Commands

    Command: `/channel`

    Request URL: `https://xxxxxx.ngrok.io/channel`

    Short Description: `Channel command`

12. add slash command

    > Slash Commands

    Command: `/util`

    Request URL: `https://xxxxxx.ngrok.io/util`

    Short Description: `Util command`

13. In slack on the General channel type `/util users`. You should get a list of the current slack users, you should find the bot you just created there.

    - Copy the UserId of the Bot User to .env `ST_SLACK_BOT_USER`
    - restart app

14. Run `/util addbot` to add the bot to all existing channels.

The commands `/channel` and `/util` should now be fully working. The bot user should now get added automatically when a channel is created as well.

Run `/util addbot` if you want to add the bot to all existing public channels.
