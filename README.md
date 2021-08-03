## About
This back-end is built for this [ReactJS PWA](https://github.com/codeforkansascity/tagging-tracker-pwa) primarily used for auth(JWT), S3 upload and data syncing. The data sync eg. the address/tag-info/owner-info tables are held in `MySQL` and photos are stored in S3.

The structure is pretty basic, the `index.js` file detects if it is live/if that is the case it will deploy to `https` these certificate files need to exist.

At the moment I am not using a multi-ssl approach eg. this server only supports one domain at a time which sucks but it's fine it's a cheap VPS bought in bulk.

The cert is applied at the node app level not as a port forward proxy (`443 to 5000/3000` etc...) which would be ideal/support multiple domains. There is a `sudo` level `crontab` that checks to renew the cert every week. The certs are renewed/same file path so the `pm2` service just has to restart to pick up the new certs (seems odd). But that's part of the callback in the `crontab` job after the certs are renewed.

### Routes
`/login-user`

`/upload-tag`

`/sync-up`

`/sync-down`

## Dependencies
* Node, MySQL, AWS S3 Bucket(optional -- up to you)

## Local Dev
Use `npm start` to run the server locally

## Installation
Assuming you have node/npm installed, you should be able to install all the dependencies as they're in `package.json` through `npm install`. Then run the backend with `node index.js` or `nodemon server`

The backend for dev is hosted on `localhost:5000` this only matters because the PWA react app is mapped to it through the proxy in the PWA's `package.json`

## AWS S3
You will need the `access_key_id` and `secret_access_key`. The `access_key_id` and `secret_access_key` go inside the credentials file(no extension)
These should be in your respective locations depending on platform(Windows or Linux):
* windows - `C:\Users\USER_NAME\.aws\credentials`
* linux - `~/.aws/credentials`

### credentials file structure:
```
[default]
aws_access_key_id = <YOUR_ACCESS_KEY_ID>
aws_secret_access_key = <YOUR_SECRET_ACCESS_KEY>
```

The node `aws-sdk` package will try to read/find that file. I just made that file from VS code, didn't even bother with the AWS CLI stuff.

## References
#### AWS S3 - assumes you have access to a bucket
[Creating IAM user](https://aws.amazon.com/premiumsupport/knowledge-center/create-access-key/) - getting access-secret key(I used console eg. web interface)
Check out this [summary on IAM and AWS SDK configuration](./AWS_CLI_SDK_CONFIG.md)

[JS SDK demo code](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/s3-example-creating-buckets.html) - like upload/list buckets/etc...

[Big list of demo commands](https://github.com/awsdocs/aws-doc-sdk-examples/tree/master/javascript/example_code/s3) - eg. CRUD

## Node Auth
The PWA/Node is using `jsonwebtoken` for auth and storing it in a state variable on the ReactJS PWA.

Regarding safety of tokens, different opinions if holding token on localStorage or httpWebOnly token, cookie, etc... see links below for more info. The users are limited to their accounts so while they have full read/write access, they can only affect their own files.
* [link 1](https://stackoverflow.com/questions/44133536/is-it-safe-to-store-a-jwt-in-localstorage-with-reactjs)
* [link 2](https://stackoverflow.com/questions/20504846/why-is-it-common-to-put-csrf-prevention-tokens-in-cookies)
* [link 3](https://security.stackexchange.com/questions/179498/is-it-safe-to-store-a-jwt-in-sessionstorage)

## Deployment
You need to install `MySQL`, `MariaDB` was used on `Debian 10`. The node `mysql2` client is just that, it's not the server itself, so you have to install MySQL on your local dev environment/the remote server and create auth/set credentials to connect to `MySQL` from `Node` in a `.env` file. The user would either need full privileges or create the `tagging_tracker` database first and give that user read/write access to that database in order to run the `seed-database.js` file.

You will also need to run the private `createUser` function in `/utils/users` since there isn't a registration aspect to this app yet. You can just run `createUser('username','pass')` while running the node app locally.

### Table seeding
The `seed-database.js` file should run completely provided you have a working local/remote `MySQL` install with a user which as I mentioned has full privileges or you create the `tagging_tracker` database first then create/assign the user to have full access to that databse. Which you can then use that(put credentials in `.env` file) to run the `seed-database.js` file to make all the tables.

## Deploying with Systemd
One way to deploy the node back end is through [systemd](https://www.axllent.org/docs/view/nodejs-service-with-systemd/) a service manager in `Linux`, this takes the place of running the `node` app by `node index.js` directly in terminal. If you go this route, note that when you make changes you will have to reload the daemon i.e. `systemctl daemon-reload` and then restart the service i.e. `systemctl restart nameofservice.service`.

## Potential issues
`max_packet_size` this should be at least `100MB` just to pull a number out of thin air but a `ECONNRESET` issue appeared once while development due to a large file. The `100MB` is insane but [apparently](https://dba.stackexchange.com/questions/45665/what-max-allowed-packet-is-big-enough-and-why-do-i-need-to-change-it) it's fine with a max of `1GB`. It is important to keep in mind that a `base64` file grows significantly eg. an original `~4MB` file jumps to over `10MB` when converted to `base64`.

Check in `MYSQL CLI` with `SHOW VARIABLES LIKE `max_allowed_packet`;`
Update with `SET GLOBAL max_allowed_packet=value_in_bytes;`
Note: the variable shown by the `SHOW...` command will not change, I think because they're not the same e.g. `GLOBAL`. But if you were running into the `ECONNRESET` issue it's probably fixed now, try it. The other alternative is the connection being [terminated](https://stackoverflow.com/questions/22900931/mysql-giving-read-econnreset-error-after-idle-time-on-node-js-server/22906189#22906189) too early but I checked(in Windows 10) and it was set to the default of `28800`.

## Work in progress
[Link](./TODO.md) to current to do list

### Live API
[This link](https://api.byx1a2gixtvvnjwxde5y.com/) is a live API being used by the [ReactJS PWA](https://github.com/codeforkansascity/tagging-tracker-pwa) as of 02/17/2020
