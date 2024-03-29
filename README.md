# Zero Rabbit

Zero Rabbit is a RabbitMQ client library. At it's core it provides a simple abstraction over amqplib. It is fairly well developed however if you find any issues with it please open them up on the github page. I am actively maintaining this and would like to make it as resilient as possible.

The feature that Zero Rabbit implements that I have not seen in any other RabbitMQ client library is the ability to control which channel you publish/consume on. This is very important for applications that need to listen to more than one queue at a time.

---

## Table of Contents

- [Config](#config)
- [Examples](#examples)
- [Classes](#classes)
- [Methods](#methods)
- [Tests](#tests)

---

# Config

## Config Object and Setup

```javascript
const conf = {
  connection: {
    protocol: "amqp",
    hostname: "rabbitmq",
    port: 5672,
    username: "guest",
    password: "guest",
    locale: "en_US",
    frameMax: 0,
    heartbeat: 60,
    vhost: "/",
  },
  exchanges: [
    {
      channel: "batch.listen.1",
      name: "user.ids.ex.1",
      type: "fanout",
      options: {},
    },
    {
      channel: "batch.listen.1",
      name: "threadIds.topic.ex.1",
      type: "topic",
      options: {},
    },
  ],
  queues: [
    {
      channel: "batch.listen.1",
      name: "batch.user.id.q.1",
      options: { autoDelete: false },
    },
  ],
  bindings: [
    {
      channel: "batch.listen.1",
      queue: "batch.user.id.q.1",
      exchange: "user.ids.ex.1",
      key: "",
      options: {},
    },
  ],
};
```

_options_ and _key_ are optional, but if you are experiencing any issues try including them as {} and ' ' respectively.

Optionally you can include a url parameter instead of the connection object above, like so:

```javascript
let conf = {
  url: "amqp://localhost:5672",
};
```

Technically a url string or connection object is the only required parameter of a conf object.

**Note:** You MUST declare a channel for all queues, exchanges, and bindings...This is actually a benefit as you will see (It allows you to safely consume off of multiple queues at the same time).

**IMPORTANT:** channels are created idempotently and automatically within all function calls and config object declarations, with the _exception_ of rabbit.ack(_..._), rabbit.ackAll(_..._), rabbit.nack(_..._), rabbit.nackAll(_..._), rabbit.closeChannel(_..._), and rabbit.cancelChannel(_..._). This means that if you misspell a channel name somewhere later on in your code it will result in the creation of a new channel as well as possibly unexpected behavior.

**_Channels are created automatically_** either by declaration in a config object or dynamically via functions such as rabbit.assertQueue().

**_Channels can be deleted_** (in other words closed/cancelled) with rabbit.closeChannel() and rabbit.cancelChannel() (see below).

To avoid channels accumulating or unexpected behavior try to stick with using as few as you possibly can throughout your app and reuse the same channel where appropriate (i.e. use the same channel to publish on as you used to create the exchange and use the same channel to consume on as the one you used to create and bind a queue that it reads from).

If your app only consumes from a single queue you can actually just use one
channel for everything (publishing and consuming).

---

# Examples:

## Simple Examples

**Sending (Publishing):**

```javascript
const rabbit = require("zero-rabbit");

let conf = {
  connection: {
    protocol: "amqp",
    hostname: "localhost",
    port: 5672,
    username: "guest",
    password: "guest",
    locale: "en_US",
    frameMax: 0,
    heartbeat: 60,
    vhost: "/",
  },
  exchanges: [
    {
      channel: "myapp.send.1",
      name: "myapp.ex.1",
      type: "direct",
      options: {},
    },
  ],
};

let userId = "s8sdfl234k";
let access_token = "lk3r3jil32";
let some_data = ["123jrl23", "32432jll23", "234lk3j"];

let message = {
  userId: userId,
  access_token: access_token,
  some_data: some_data,
};

rabbit.connect(conf, (err, conn) => {
  rabbit.publish("myapp.send.1", "myapp.ex.1", "", message, {
    contentType: "application/json",
    type: "some-data",
    appId: "my-app",
    timestamp: 1234567,
    encoding: "encoding",
    persistent: true,
  });
});
```

You only need to connect once somewhere in your main module. Once you have connected you can publish anywhere in your app.

_const rabbit = require('zero-rabbit')_ and then _rabbit.publish(..)_.

The _message_ payload that rabbit.publish(_channel_, _exchange_, _message_, ...) expects is any plain Javascript object. The internals of ZeroRabbit will stringify, turn it into a Buffer, and then publish the message over the wire for you.

**Receiving (Subscribing):**

```javascript
const rabbit = require("zero-rabbit");

const conf = {
  url: "amqp://localhost:5672",
  exchanges: [
    {
      channel: "myapp.listen.1",
      name: "myapp.ex.1",
      type: "direct",
      options: {},
    },
  ],
  queues: [
    {
      channel: "myapp.listen.1",
      name: "myapp.q.1",
      options: { autoDelete: true },
    },
  ],
  bindings: [
    {
      channel: "myapp.listen.1",
      queue: "myapp.q.1",
      exchange: "myapp.ex.1",
      key: "",
      options: {},
    },
  ],
};

rabbit.connect(conf, (err, conn) => {
  rabbit.setChannelPrefetch("myapp.listen.1", 1);

  rabbit.consume(
    "myapp.listen.1",
    "myapp.q.1",
    (msg) => {
      let userId = msg.content.userId;
      let access_token = msg.content.access_token;
      let some_data = msg.content.some_data;

      rabbit.ack("myapp.listen.1", msg);

      do_something_with_some_data(userId, access_token, some_data);
    },
    { noAck: false }
  );
});
```

## Complicated examples:

**Example of Receiving from two queues at the same time on two different channels**

```javascript
const rabbit = require("zero-rabbit");

const conf = {
  // ...connection object or url

  exchanges: [
    {
      channel: "myapp.listen.1",
      name: "myapp.ex.1",
      type: "direct",
      options: {},
    },
    {
      channel: "myapp.listen.2",
      name: "myapp.ex.2",
      type: "direct",
      options: {},
    },
  ],
  queues: [
    {
      channel: "myapp.listen.1",
      name: "myapp.q.1",
      options: { autoDelete: true },
    },
    {
      channel: "myapp.listen.2",
      name: "myapp.q.2",
      options: { autoDelete: true },
    },
  ],
  bindings: [
    {
      channel: "myapp.listen.1",
      queue: "myapp.q.1",
      exchange: "myapp.ex.1",
      key: "",
      options: {},
    },
    {
      channel: "myapp.listen.2",
      queue: "myapp.q.2",
      exchange: "myapp.ex.2",
      key: "",
      options: {},
    },
  ],
};

rabbit.connect(conf, (err, conn) => {
  rabbit.setChannelPrefetch("myapp.listen.1", 1);
  rabbit.consume(
    "myapp.listen.1",
    "myapp.q.1",
    (message1) => {
      let JsonContent = message1.content;
      rabbit.ack("myapp.listen.1", message1);

      console.log(JsonContent);
    },
    { noAck: false }
  );

  rabbit.setChannelPrefetch("myapp.listen.2", 1);
  rabbit.consume(
    "myapp.listen.2",
    "myapp.q.2",
    (message2) => {
      let JsonContent2 = message2.getJsonMsg();
      rabbit.ack("batch.listen.2", message2);

      console.log(JsonContent2);
    },
    { noAck: false }
  );
});
```

**Example of Receiving from a queue on one channel and publishing on another channel**

```javascript
const rabbit = require("zero-rabbit");

const conf = {
  // ...connection object or url

  exchanges: [
    {
      channel: "myapp.send.1",
      name: "myapp.ex.1",
      type: "fanout",
      options: {},
    },
    {
      channel: "myapp.listen.1",
      name: "someOtherApp.ex.1",
      type: "direct",
      options: {},
    },
  ],
  queues: [
    {
      channel: "myapp.listen.1",
      name: "myapp.q.1",
      options: { autoDelete: true },
    },
  ],
  bindings: [
    {
      channel: "myapp.listen.1",
      queue: "myapp.q.1",
      exchange: "someOtherApp.ex.1",
      key: "",
      options: {},
    },
  ],
};

rabbit.connect(conf, (err, conn) => {
  rabbit.setChannelPrefetch("myapp.listen.1", 1);

  rabbit.consume(
    "myapp.listen.1",
    "myapp.q.1",
    (message) => {
      let userId = message.content.userId;
      let access_token = message.content.access_token;
      let some_data = message.content.some_data;

      let transformed_data = do_something_with_some_data(
        userId,
        access_token,
        some_data
      );

      let transformed_data_message = {
        userId: userId,
        access_token: access_token,
        some_data: transformed_data,
      };

      rabbit.publish(
        "myapp.send.1",
        "myapp.ex.1",
        "",
        transformed_data_message
      );
    },
    { noAck: true }
  );
});
```

---

# Classes

## Zero Rabbit Msg:

The _msg_ object that pops out of rabbit.consume(_..._) is a special little object called a ZeroRabbitMsg.

Within a ZeroRabbitMsg there exists two properties:

**msg**: Contains the entire msg object as given by amqplib, encoded contents and all.

- The full RabbitMQ (amqplib) message can be obtained with msg.getMsg() or msg.msg.

**content**: A JSON deserialized version of the content portion of the message

- The original message object can be obtained with msg.getJsonMsg() or msg.content.

---

# Methods:

For reference these are mostly wrappers to <a href="https://www.squaremobius.net/amqp.node/channel_api.html" target="_blank">https://www.squaremobius.net/amqp.node/channel_api.html</a>.

**IMPORTANT:** The first argument of **_ALL_** zero-rabbit functions (_with the exception of rabbit.connect(_..._)_) is **_ALWAYS_** the channel name (a string) on which to perform the specified action. Again if the channel is not already created via the config object or via a function call, a new channel will be created. See important notes at the top for information detailing how channels are created and destroyed.

**Connect**

```javascript
rabbit.connect(conf, function(err, conn))
```

**Publish**

```javascript
rabbit.publish(channel, exchange, routingKey, message, options);
```

_exchange_ is the name of the exchange to send to

_routingKey_ is the routingKey

_message_ is any JSON compatible Object. The message payload is expected to be a plain JS object. The internals of ZeroRabbit will stringify, turn into a Buffer, and then publish/send the message over the wire for you.

_options_ is optional

**Send to Queue**

```javascript
rabbit.sendToQueue(channel, queue, message, options);
```

_queue_ is the name of the queue

_message_ is any JSON compatible Object (see rabbit.publish above)

_options_ are optional

**Consume**

```javascript
rabbit.consume(channel, queue, function(message), options)
```

_message_ is a ZeroRabbitMsg (see above for explanation). The JSON decoded msg can be obtained with message.content or message.getJsonMsg(), the full RabbitMQ msg can be obtained with message.msg or message.getMsg()

_options_ are optional

**Set Channel Prefetch**

```javascript
rabbit.setChannelPrefetch(channel, prefetch);
```

_prefetch_ is the number of messages to prefetch from a queue

**Ack**

```javascript
rabbit.ack(channel, message, allUpTo);
```

_channel_ is the name you gave the channel that the msg came from (i.e. the same channel that the message was delivered on). The channel that you ack the message on needs to be the same as the channel
that the message was consumed from.

_message_ is a ZeroRabbitMsg (see above for explanation).

_allUpTo_ is a boolean that is optional and defaults to false. If allUpTo is true, all outstanding messages prior to and including the given message shall be considered acknowledged. If false, or omitted, only the message supplied is acknowledged.

It’s an error to supply a message that either doesn’t require acknowledgement, or has already been acknowledged. Doing so will errorise the channel. If you want to acknowledge all the messages and you don’t have a specific message around, use #ackAll.

**Ack All**

```javascript
rabbit.ackAll(channel);
```

_channel_ is the name you gave to the channel, read rabbit.ack() above for more info.

Acknowledge all outstanding messages on the channel. This is a “safe” operation, in that it won’t result in an error even if there are no such messages.

**Nack**

```javascript
rabbit.nack(channel, message, allUpTo, requeue);
```

Be careful with nack, the default _requeue_ is true and could cause your app to go into a loop.

nack is primarily to be used with dead letter exchanges, as in assertQueue dead letter exchange options <a href="https://www.squaremobius.net/amqp.node/channel_api.html#channel_assertQueue" target="_blank">https://www.squaremobius.net/amqp.node/channel_api.html#channel_assertQueue</a> In general it is better to just ack bad messages and log the error. Advanced setups can use nack to deal with errors that are of a temporary nature, such as http connection errors.

nack() rejects a message. This instructs the server to either requeue the message or throw it away (which may result in it being dead-lettered).

_channel_ is the name you gave to the channel, read rabbit.ack() above for more info.

_message_ is a ZeroRabbitMsg (see above for explanation).

_allUpTo_ is an optional boolean that defaults to false. If allUpTo is truthy, all outstanding messages prior to and including the given message are rejected. As with #ack, it’s a channel-ganking error to use a message that is not outstanding. Defaults to false.

_requeue_ is an optional boolean that defaults to true. If requeue is truthy, the server will try to put the message or messages back on the queue or queues from which they came. Defaults to true if not given, so if you want to make sure messages are dead-lettered or discarded, supply false here.

**Nack All**

```javascript
rabbit.nackAll(channel, requeue);
```

Be careful with nackAll() in the same way you need to be careful with nack(), both are really for much more advanced use cases that most people will not have.

nackAll() rejects all messages outstanding on this channel.

_channel_ is the name you gave to the channel, read rabbit.ack() above for more info.

_requeue_ is an optional boolean that defaults to true. If requeue is truthy, or omitted, the server will try to re-enqueue the messages.

**Assert Exchange**

```javascript
rabbit.assertExchange(channel, exchange, type, options, function(err, ex))
```

function(err, ex) can be omitted as can options, but if you are asserting an exchange you probably want to make sure it has succeeded before proceeding. If you include function(err, q) you need to also include options.

**Assert Queue**

```javascript
rabbit.assertQueue(channel, queue, options, function(err, q))
```

function(err, q) can be omitted as can options, but if you are asserting a queue you probably want to make sure it has succeeded before proceeding. If you include function(err, q) you need to also include options.

**Bind Queue**

```javascript
rabbit.bindQueue(channel, queue, exchange, key, options, function(err, ok))
```

function(err, ok) can be omitted as can options, but if you are binding a queue you probably want to make sure it has succeeded before proceeding. If you include function(err, q) you need to also include options and key.

_key_ is optional and will default to ' '. For basic use cases key === routingKey. More advance use cases key === pattern. Check official docs to understand what key is.
[https://www.rabbitmq.com/tutorials/tutorial-five-javascript.html](https://www.rabbitmq.com/tutorials/tutorial-five-javascript.html)

**Delete Queue**

```javascript
rabbit.deleteQueue(channel, queue, options, function(err, ok))
```

_options_ and _function(err, ok)_ can be omitted

**Cancel Channel**

```javascript
rabbit.cancelChannel(channel);
```

This will stop the rabbit.consume() loop that the channel was declared in. It will _not_ delete the channel from memory.

**Close Channel**

```javascript
rabbit.closeChannel(channel);
```

This will close the channel. It will also delete the channel object from memory.

I'm still trying to figure out cancel vs. close and right now in my own code I'm using cancelChannel() followed by closeChannel().

**Get Channel**

```javascript
rabbit.getChannel(channel, function(err, ch))
```

_This will not be needed for most use cases. It is provided for convenience, in case you want to do something over a channel that amqplib supports and Zero Rabbit does not yet do. Requests for additions to make Zero Rabbit handle some of the extra amqplib features are welcome_

_channel_ is the name of the channel

_ch_ is the actual channel object as found in amqplib (this will be a confirm channel), the same one that can be found here <a href="https://www.squaremobius.net/amqp.node/channel_api.html#confirmchannel" target="_blank">https://www.squaremobius.net/amqp.node/channel_api.html#confirmchannel</a>

_getChannel()_ will retrieve the channel object from memory. If the channel has
not been created previously (via config or another rabbit function call) it will
create a new channel, store it in memory, and then give you back the channel
object.

---

# Tests

To run the tests you need to have a rabbitmq server running locally on port 5627.

Easiest way to do this is with docker. After pulling the rabbitmq docker image
run

```bash
docker run --rm -it --hostname my-rabbit -p 15672:15672 -p 5672:5672 rabbitmq:3-management
```

Then run the tests in another terminal

```bash
npm run test
```

Don't forget to run `npm i` to install the packages locally before running `npm run test`

_Note: Some of the tests that test an error should get thrown with a bad
connection config may fail due to time out, they will pass if tried a couple of times_

---

In my own code I have utilized Zero Rabbit to dynamically create queues for batch jobs submitted by users such that each user gets their own queue until the batch job is completed (and then their queue is deleted). This has allowed for a single running instance of my app to handle multiple jobs from different users at the same time without holdup. So if a user submits a job that takes 2 minutes and then another user submits a job that takes 5 seconds a single instance of my app can process the 5 second job at the same time as the 2 minute job and not hold up users who have shorter jobs.
