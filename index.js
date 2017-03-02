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

// Settings
const appEnv = Cfenv.getAppEnv();

// Create a server with a host and port
const server = new Hapi.Server();
server.connection({
  port: process.env.PORT || appEnv.port,
  host: appEnv.bind
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

      // Add each ticket with a valid email to MailChimp
      const mailchimp = new MailChimp(process.env.MAILCHIMP_API_KEY);

      // Traverse all tickets
      parsedPayload.tickets.forEach((ticket) => {
        console.log(ticket);
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
          path : '/lists/' + process.env.MAILCHIMP_LIST_ID + '/members/' + memberId
        })
        .then((result) => {
          mailchimp.put({
            path : '/lists/' + process.env.MAILCHIMP_LIST_ID + '/members/' + memberId,
            body: subscriberbody
          })
          .then(function (result) {
            console.log('%s updated in list ' + process.env.MAILCHIMP_LIST_ID, ticket.email)
          })
          .catch(function (err) {
            console.error(err);
          });
        })
        .catch((err) => {
          mailchimp.post({
            path : '/lists/' + process.env.MAILCHIMP_LIST_ID + '/members/',
            body: subscriberbody
          })
          .then(function (result) {
            console.log('%s added to list ' + process.env.MAILCHIMP_LIST_ID, ticket.email)
          })
          .catch(function (err) {
            console.error(err);
          });
        });
      })

      // Return something other than fail
      return reply(parsedPayload || {});
    }
  }
});

const validateTitoSignature = (titoSignature, data) => {
  let hmacSig = Crypto
    .createHmac('sha256', process.env.TITO_WEBHOOK_SECURITY_TOKEN)
    .update(data)
    .digest('base64');
  return titoSignature === hmacSig;
}

// Start the server
server.start((err) => {

  if (err) {
    throw err;
  }

  console.log('Server running at:', server.info.uri);
});
