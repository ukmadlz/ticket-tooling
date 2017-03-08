'use strict';

// Load ENV
require('dotenv').load({ silent: true });

// Libs
const Cfenv = require('cfenv');
const Hapi = require('hapi');
const Boom = require('boom');
const Crypto = require('crypto');
const Subtext = require('subtext');
const MailChimp = require('mailchimp-api-v3');
const MD5 = require('md5');
const Request = require('request');

// Settings
const appEnv = Cfenv.getAppEnv();

// Create a server with a host and port
const server = new Hapi.Server();
server.connection({
  port: process.env.PORT || appEnv.port
});

// Handle inbound tito tickets
server.route({
  method: 'POST',
  path: '/ticket',
  config: {
    payload: {
      output: 'data',
      parse: false
    },
    handler: function(request, reply) {
      // Validate webhook
      var titoSignature = request.headers['tito-signature'];
      if (!validateTitoSignature(titoSignature, request.payload)){
        return reply(Boom.unauthorized('Invalid Signature'));
      }

      // parse the payload buffer
      var parsedPayload = JSON.parse(request.payload.toString());

      // Traverse all tickets
      parsedPayload.tickets.forEach((ticket) => {
        // Only process if the ticket has an associated email
        if(ticket.email) {
          // Process the unique sub to mailchimp
          if(process.env.MAILCHIMP_API_KEY) {
            addEmailToMailChimp(ticket, process.env.MAILCHIMP_LIST_ID);
          }
          // Process the invite to slack
          if(process.env.SLACK_API_TOKEN) {
            addEmailToSlack(ticket);
          }
        }
      });

      // Return something other than fail
      return reply(parsedPayload || {});
    }
  }
});

// Validate WebHook
const validateTitoSignature = (titoSignature, data) => {
  let hmacSig = Crypto
    .createHmac('sha256', process.env.TITO_WEBHOOK_SECURITY_TOKEN)
    .update(data)
    .digest('base64');
  return titoSignature === hmacSig;
}

// Add email to mailchimp list
const addEmailToMailChimp = (ticket, listId) => {
  const mailchimp = new MailChimp(process.env.MAILCHIMP_API_KEY);
  let memberId = MD5(ticket.email);
  let subscriberbody = {
    email_address: ticket.email,
    status: "subscribed",
    merge_fields: {
      "FNAME": ticket.first_name,
      "LNAME": ticket.last_name
    }
  };
  mailchimp.get({
    path : '/lists/' + listId + '/members/' + memberId
  })
  .then((result) => {
    console.log('%s already in list ' + listId, ticket.email);
  })
  .catch((err) => {
    mailchimp.post({
      path : '/lists/' + listId + '/members/',
      body: subscriberbody
    })
    .then(function (result) {
      console.log('%s added to list ' + listId, ticket.email);
    })
    .catch(function (err) {
      console.error(err);
    });
  });
}

// Send email an invite to Slack
const addEmailToSlack = (ticket) => {
  Request.post({
    url: 'https://'+ process.env.SLACK_TEAM + '.slack.com/api/users.admin.invite',
    form: {
      email: ticket.email,
      token: process.env.SLACK_API_TOKEN,
      set_active: true
    }
  }, function(err, httpResponse, body) {
    if (err) { console.error('Error: %s', err); }
    if(typeof body !== 'object') {
      body = JSON.parse(body);
    }
    if (body.ok) {
      console.log('%s invited to Slack ' + process.env.SLACK_TEAM, ticket.email);
    }
  });
}

// Start the server
server.start((err) => {

  if (err) {
    throw err;
  }

  console.log('Server running at:', server.info.uri);
});
