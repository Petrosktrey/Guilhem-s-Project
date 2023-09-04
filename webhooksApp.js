const crypto = require('crypto')
const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const http = require('http');
const socketIO = require('socket.io');


const app = express();
const server = http.createServer(app);
const io = socketIO(server);
//const port = 3000;
//const port = 8080;
const port = 443;
const dataFile = 'data.txt';


// For Testing : 
// This one doesn't work with guilleme's secret
// twitch event trigger subscribe -F http://localhost:443/eventsub/ -s d817pkfq98o453knqkcm9a1h1ir3x1
// TESTING SUBSCRIPTION WITH TIERS : 
// twitch event trigger channel.subscribe -F http://localhost:443/eventsub/ -s d817pkfq98o453knqkcm9a1h1ir3x1 --version 1 --tier 2000
// TESTING FOLLOW : 
// twitch event trigger channel.follow -F http://localhost:443/eventsub/ -s d817pkfq98o453knqkcm9a1h1ir3x1 --version 2
// TESTING CHEERS : 
// twitch event trigger channel.cheer -F http://localhost:443/eventsub/ -s d817pkfq98o453knqkcm9a1h1ir3x1 --version 1 --cost 1500


// Notification request headers
const TWITCH_MESSAGE_ID = 'Twitch-Eventsub-Message-Id'.toLowerCase();
const TWITCH_MESSAGE_TIMESTAMP = 'Twitch-Eventsub-Message-Timestamp'.toLowerCase();
const TWITCH_MESSAGE_SIGNATURE = 'Twitch-Eventsub-Message-Signature'.toLowerCase();
const MESSAGE_TYPE = 'Twitch-Eventsub-Message-Type'.toLowerCase();

// Notification message types
const MESSAGE_TYPE_VERIFICATION = 'webhook_callback_verification';
const MESSAGE_TYPE_NOTIFICATION = 'notification';
const MESSAGE_TYPE_REVOCATION = 'revocation';

// Prepend this string to the HMAC that's created from the message
const HMAC_PREFIX = 'sha256=';

app.get('/getNumber', (req, res) => {
    fs.readFile(dataFile, 'utf-8', (err, data) => {
        if (err) {
            res.status(500).send('Error reading the file.');
        }
        else {
            const callback = req.query.callback; // Get the callback function name
            if (callback) {
                // Wrap the data in the callback function and send it as JSONP
                res.send(`${callback}(${data})`);
            }
            else {
                res.send(data);
            }

        }
    });
});

app.use(express.raw({          // Need raw message body for signature verification
    type: 'application/json'
}))

io.on('connection', (socket) => {
    console.log('A client connected.');

    // Listen for events and send updated number to clients
    socket.on('updateNumber', (number) => {
        io.emit('numberUpdated', number);
    });

    socket.on('disconnect', () => {
        console.log('A client disconnected.');
    });
});


app.post('/eventsub', (req, res) => {
    let secret = getSecret();
    let message = getHmacMessage(req);
    let hmac = HMAC_PREFIX + getHmac(secret, message);  // Signature to compare

    if (true === verifyMessage(hmac, req.headers[TWITCH_MESSAGE_SIGNATURE])) {
        console.log("signatures match");

        // Get JSON object from body, so you can process the message.
        // THIS IS THE DATA
        let notification = JSON.parse(req.body);

        if (MESSAGE_TYPE_NOTIFICATION === req.headers[MESSAGE_TYPE]) {
            // FOLLOW NOTIFICATION
            if (notification.subscription.type === "channel.follow") {
                fs.readFile(dataFile, 'utf-8', (err, data) => {
                    if (err) {
                        res.status(500).send('Error reading the file.');
                    }
                    else {
                        const currentNumber = parseInt(data);
                        const updatedNumber = currentNumber + 1;

                        fs.writeFile(dataFile, updatedNumber.toString(), 'utf-8', (err) => {
                            if (err) {
                                res.status(500).send("Error updating the file");
                            }
                            else {
                                // Emit the updated number to connected clients
                                io.emit('updateNumber', updatedNumber);
                            }
                        });
                    }
                });
                console.log("Hey I'm a Follow !! ");
            }
            // CHEER NOTIFICATION
            else if (notification.subscription.type === "channel.cheer") {
                fs.readFile(dataFile, 'utf-8', (err, data) => {
                    if (err) {
                        res.status(500).send('Error reading the file.');
                    }
                    else {
                        const currentNumber = parseInt(data);
                        const updatedNumber = currentNumber + (parseInt(notification.event.bits) / 100);

                        fs.writeFile(dataFile, updatedNumber.toString(), 'utf-8', (err) => {
                            if (err) {
                                res.status(500).send("Error updating the file");
                            }
                            else {
                                // Emit the updated number to connected clients
                                io.emit('updateNumber', updatedNumber);
                            }
                        });
                    }
                });
                console.log("Hey I'm a Cheer of " + notification.event.bits + "bits !");
            }
            // SUBSCRIPTION NOTIFICATION
            else if (notification.subscription.type === "channel.subscribe") {
                fs.readFile(dataFile, 'utf-8', (err, data) => {
                    if (err) {
                        res.status(500).send('Error reading the file.');
                    }
                    else {
                        const currentNumber = parseInt(data);
                        const updatedNumber = currentNumber + 5 * (parseInt(notification.event.tier) / 1000);

                        fs.writeFile(dataFile, updatedNumber.toString(), 'utf-8', (err) => {
                            if (err) {
                                res.status(500).send("Error updating the file");
                            }
                            else {
                                // Emit the updated number to connected clients
                                io.emit('updateNumber', updatedNumber);
                            }
                        });
                    }
                });
                console.log("Someone just Subbed with tier " + (parseInt(notification.event.tier) / 1000));
            }
            // CHANNEL RESUBSCRIPTION NOTIFICATION
            else if (notification.subscription.type === "channel.subscription.message") {
                fs.readFile(dataFile, 'utf-8', (err, data) => {
                    if (err) {
                        res.status(500).send('Error reading the file.');
                    }
                    else {
                        const currentNumber = parseInt(data);
                        const updatedNumber = currentNumber + 5 * (parseInt(notification.event.tier) / 1000);

                        fs.writeFile(dataFile, updatedNumber.toString(), 'utf-8', (err) => {
                            if (err) {
                                res.status(500).send("Error updating the file");
                            }
                            else {
                                // Emit the updated number to connected clients
                                io.emit('updateNumber', updatedNumber);
                            }
                        });
                    }
                });
                console.log("Someone just RE-Subbed with tier " + (parseInt(notification.event.tier) / 1000));
            }

            // GIFT SUBSCRIPTION NOTIFICATION
            else if (notification.subscription.type === "channel.subscription.gift") {
                fs.readFile(dataFile, 'utf-8', (err, data) => {
                    if (err) {
                        res.status(500).send('Error reading the file.');
                    }
                    else {
                        const currentNumber = parseInt(data);
                        const updatedNumber = currentNumber + parseInt(notification.event.total) * (5 * (parseInt(notification.event.tier) / 1000));

                        fs.writeFile(dataFile, updatedNumber.toString(), 'utf-8', (err) => {
                            if (err) {
                                res.status(500).send("Error updating the file");
                            }
                            else {
                                // Emit the updated number to connected clients
                                io.emit('updateNumber', updatedNumber);
                            }
                        });
                    }
                });
                console.log("Someone just Gifted " + parseInt(notification.event.total) + " Subbes with tier " + (parseInt(notification.event.tier) / 1000));
            }
            // TODO: Do something with the event's data.

            console.log(`Event type: ${notification.subscription.type}`);
            console.log(JSON.stringify(notification.event, null, 4));

            res.sendStatus(204);
        }
        else if (MESSAGE_TYPE_VERIFICATION === req.headers[MESSAGE_TYPE]) {
            res.status(200).send(notification.challenge);
        }
        else if (MESSAGE_TYPE_REVOCATION === req.headers[MESSAGE_TYPE]) {
            res.sendStatus(204);

            console.log(`${notification.subscription.type} notifications revoked!`);
            console.log(`reason: ${notification.subscription.status}`);
            console.log(`condition: ${JSON.stringify(notification.subscription.condition, null, 4)}`);
        }
        else {
            res.sendStatus(204);
            console.log(`Unknown message type: ${req.headers[MESSAGE_TYPE]}`);
        }
    }
    else {
        console.log('403');    // Signatures didn't match.
        res.sendStatus(403);
    }
})

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
})

// Change this to Guilleme's Secret
function getSecret() {

    // TODO: Get secret from secure storage. This is the secret you pass 
    // when you subscribed to the event.
    return 'd817pkfq98o453knqkcm9a1h1ir3x1';
}

// Build the message used to get the HMAC.
function getHmacMessage(request) {
    return (request.headers[TWITCH_MESSAGE_ID] +
        request.headers[TWITCH_MESSAGE_TIMESTAMP] +
        request.body);
}

// Get the HMAC.
function getHmac(secret, message) {
    return crypto.createHmac('sha256', secret)
        .update(message)
        .digest('hex');
}

// Verify whether our hash matches the hash that Twitch passed in the header.
function verifyMessage(hmac, verifySignature) {
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(verifySignature));
}