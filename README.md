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

    - You will get a public URL that points to your localhost:  e.g. https://xxxxxx.ngrok.io

2. create your own [slack workspace](https://slack.com/get-started) for your local dev environment

3. create a [slack app](https://api.slack.com/apps?new_app=1)
    - copy **Signing Secret** over to .env `SLACK_APP_SIGNING_SECRET`

4. create a bot user
    > Bot Users

    - Set Display name
    - Set username

5. add scope permissions to bot 

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

    > Note:  The bot adds itself to all new public channels created so you can have the functionality instantly available.  You will need to manually `/invite` the bot user to private channels and DMs where you want to use the bot.  Slack prevents bots from adding themselves to non-public chats.

6. install app to workplace

    > OAuth & Permissions

    - click **[Install App to Workplace]**
    - copy `access token` to .env `SLACK_ACCESS_TOKEN`
    - copy `bot token` to .env `SLACK_BOT_TOKEN`
    - restart app

7. enable event subscriptions

    > Event Subscriptions

    - add Request URL:  `https://xxxxxx.ngrok.io/events`
    
    #### Subscribe to events on behalf of users

    - add `channel_created`
    - add `file_shared`
    - add `message.channels`
    - add `message.groups`
    
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

    - Copy the UserId of the Bot User to .env `SLACK_BOT_USER`
    - restart app

12. Run `/util addbot` to add the bot to all existing channels.


The commands `/channel` and `/util` should now be fully working.  The bot user should now get added automatically when a channel is created as well.

Run `/util addbot` if you want to add the bot to all existing public channels.

## NDA Upload

1. Create a private channel where members will upload the NDAs (can be named anything) e.g. `/channel create -p _NDAs`

2. Run `/util channels` to find the chanelId of that new channel.  

3. Copy the Id to the .env `NDAUPLOAD_CHANNEL_ID`

4. Run `/util users` and copy the userId(s) of admins who will be pasting the blank NDAs into the chan into  the .env `NDAUPLOAD_ADMINS`.  One or more, comma separated, no spaces. Note: These admin(s) will not be able to upload the filled NDAs into this chan like the rest of the members.

### Dropbox Setup

1. Visit your Dropbox App Console: `https://www.dropbox.com/developers/apps`

2. Create and app

  - API: `DropBox API`
  - Access: `App Folder`
  - Name: `NDAs`

3. OAuth 2 > Generated access token > Click `Generate`

4. Copy the access token over to .env `DROPBOX_ACCESS`

### How to use

1. Create a new private channel that requires NDA in the format `dd-[project]` e.g. `/channel create -p dd-spacex`

2. Invite the bot to that channel e.g. `/invite @Add`

3. Rename your blank NDA document in the format `[project]-<anything>.pdf` e.g. SpaceX-NDA.pdf or SpaceX.pdf

   > Note: the `[project]` part must match the `[project]` part of the channel name. Case is not important.

4. Post the blank NDA document to the `_NDAs` channel created in the `NDA Upload` section, along with instructions to fill the document and upload the file in the same channel by drag-drop or using the paperclip icon.

5. The bot will detect the file upload, will verify it has not been renamed, will verify that it has been modified from the original, if it passes both it will upload it to the dropbox account (renamed to the format [/project/username.pdf]), delete it from slack, and then invite the user to the dd chan that matches the project name.

