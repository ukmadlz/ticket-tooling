# ticket-tooling
Application to handle auto subscription of people from ti.to to MailChimp and check-in app

## Setup

You will require `node >= 7` to run this.

### Locally

You'll need to clone the repo with `git clone git@github.com:ukmadlz/ticket-tooling.git`

Next, you can execute `cp .env.example .env` to create a copy of ENV necessary

```
TITO_WEBHOOK_SECURITY_TOKEN= // Ti.to signature provided when creating webhooks
MAILCHIMP_API_KEY= // API key for accessing MailChimp - Optional
MAILCHIMP_LIST_ID= // The List ID associated with the MailChimp list
SLACK_API_TOKEN= // API key for accessing Slack - Optional
SLACK_TEAM= // The subdomain used for the Slack team
```
Finally, to execute just `npm start`

### Remote

You can quickly deploy to

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)
