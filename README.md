# Zero Rabbit

Zero Rabbit is a RabbitMQ client library.  At it's core it provides a simple abstraction over amqplib. It is fairly well developed however if you find any issues with it please open them up on the github page.  I am actively maintaining this and would like to make it as resilient as possible.

The feature that Zero Rabbit implements that I have not seen in any other RabbitMQ client library is the ability to control which channel you publish/consume on. This is very important for applications that need to listen to more than one queue at a time.

# Official 1.0.4 release:

**Consume is now:** 
```javascript
rabbit.consume(channel, queue, function(message), options)
```
***options*** has been moved to the last argument so that it is now optional. This also means that all methods have the identical order to the official amqplib method calls. This will now be forever and always.

**Publish is now:**
```javascript
rabbit.publish(channel, exchange, routingKey, message, options)
```
***routingKey*** is now not optional.  It is now the third arg and ***message*** is now the fourth. Again to be perfectly inline with the official amqplib which does not allow routingKey to be optional.  You must declare it as '' if you don't care about it.

**New Functions:**
```javascript
rabbit.sendToQueue(channel, queue, message, options)

rabbit.ackAll(channel)

rabbit.nack(channel, message, allUpTo, requeue)

rabbit.nackAll(channel, requeue)

```

**Also:**

JSDoc is now implemented, so code completion should be very very friendly to use.

...and pretty print the README


# Config

```javascript
    const conf = {

        connection: {
            protocol: 'amqp',
            hostname: 'rabbitmq',
            port: 5672,
            username: 'guest',
            password: 'guest',
            locale: 'en_US',
            frameMax: 0,
            heartbeat: 60,
            vhost: '/'
        },
        exchanges : [
            {
                channel: 'batch.listen.1',
                name: 'user.ids.ex.1',
                type: 'fanout',
                options: {}
            },
            {
                channel: 'batch.listen.1',
                name: 'threadIds.topic.ex.1',
                type: 'topic',
                options: {}
            }
        ],
        queues: [
            {
                channel: 'batch.listen.1',
                name: 'batch.user.id.q.1',
                options: { 'autoDelete': false }
            }
        ],
        bindings: [
            {
                channel: 'batch.listen.1',
                queue: 'batch.user.id.q.1',
                exchange: 'user.ids.ex.1',
                key: '',
                options: {}
            }
        ]
    }
```

*options* and *key* are now optional, but if you are experiencing any issues try including them as {} and '' respectively.

Optionally you can include a url parameter instead of the connection object above, like so:
```javascript
    let conf = {
        url: 'amqp://localhost:5672'
    }
```
Technically a url string or connection object is the only required parameter of a conf object.


**Note:** You MUST declare a channel for all queues, exchanges, and bindings...This is actually a benefit as you will see (It allows you to consume off of multiple queues at the same time).

**IMPORTANT:** channels are created idempotently and automatically within all function calls and config object declarations, with the *exception* of rabbit.ack(*...*), rabbit.ackAll(*...*), rabbit.nack(*...*), rabbit.nackAll(*...*), rabbit.closeChannel(*...*), and rabbit.cancelChannel(*...*).  This means that if you misspell a channel name somewhere later on in your code it will result in the creation of a new channel as well as possibly unexpected behavior.

***Channels are created automatically*** either by declaration in a config object or dynamically via functions such as rabbit.assertQueue().

***Channels can be deleted*** (in other words closed/cancelled) with rabbit.closeChannel() and rabbit.cancelChannel() (see below).

To avoid channels accumulating or unexpected behavior try to stick with using as few as you possibly can throughout your app and reuse the same channel where appropriate (i.e. use the same channel to publish on as you used to create the exchange and use the same channel to consume on as the one you used to create and bind a queue that it reads from).

If your app only consumes from a single queue you can actually just use one channel for everything (publishing and consuming).


# Zero Rabbit Msg:
The msg object that pops out of rabbit.consume is a special little object called a ZeroRabbitMsg.  

Within a ZeroRabbitMsg there exists two properties:

**msg**: Contains the entire msg object as given by amqplib, encoded contents and all.
* The full RabbitMQ (amqplib) message can be obtained with msg.getMsg() or msg.msg.

**content**: A JSON deserialized version of the content portion of the message
* The original message object can be obtained with msg.getJsonMsg() or msg.content.

*So yes, Zero Rabbit is really only good for sending and receiving JSON messages as of right now.*

# Examples:

**Sending (Publishing):**

```javascript
    const rabbit = require('zero-rabbit');

    let conf = {
        connection: {
                protocol: 'amqp',
                hostname: 'localhost',
                port: 5672,
                username: 'guest',
                password: 'guest',
                locale: 'en_US',
                frameMax: 0,
                heartbeat: 60,
                vhost: '/'
        },
        exchanges : [
            {
                channel: 'myapp.send.1',
                name: 'myapp.ex.1',
                type: 'direct',
                options: {}
            }
        ],
    }

    let userId = 's8sdfl234k';
    let access_token = 'lk3r3jil32';
    let some_data = ['123jrl23', '32432jll23', '234lk3j'];

    let message = {
      userId: userId,
      access_token: access_token,
      some_data: some_data
    }

    rabbit.connect(conf, (err, conn) => {
      
      rabbit.publish('myapp.send.1', 'myapp.ex.1', '', message, {
        contentType: 'application/json', 
        type: 'some-data',
        appId: 'my-app',
        timestamp: 1234567,
        encoding: 'encoding',
        persistent: true,
      });
    
    });
```

You only need to connect once somewhere in your main module. Once you have connected you can publish anywhere in your app.

*const rabbit = require('zero-rabbit')* and then *rabbit.publish()*.

The message payload that rabbit.publish(*channel*, *exchange*, *message*, ...) expects is any plain Javascript object. The internals of ZeroRabbit will stringify, turn it into a Buffer, and then publish the message over the wire for you.


**Receiving (Subscribing):**

```javascript
    const rabbit = require('zero-rabbit');

    const conf =  {

        url: 'amqp://localhost:5672',
        exchanges : [
            {
                channel: 'myapp.listen.1',
                name: 'myapp.ex.1',
                type: 'direct',
                options: {}
            },
        ],
        queues: [
            {
                channel: 'myapp.listen.1',
                name: 'myapp.q.1',
                options: { 'autoDelete': true }
            }
        ],
        bindings: [
            {
                channel: 'myapp.listen.1',
                queue: 'myapp.q.1',
                exchange: 'myapp.ex.1',
                key: '',
                options: {}
            }
        ]

    }

    rabbit.connect(conf, (err, conn) => {
      rabbit.setChannelPrefetch('myapp.listen.1', 1);
      
      rabbit.consume('myapp.listen.1', 'myapp.q.1', (msg) => {
        let userId = msg.content.userId;
        let access_token = msg.content.access_token;
        let some_data = msg.content.some_data;

        rabbit.ack('myapp.listen.1', msg);
        
        do_something_with_some_data(userId, access_token, some_data);
      
      }, { noAck: false });

    });
```

See below for more complicated examples.

# Methods:

For reference these are mostly wrappers to [https://www.squaremobius.net/amqp.node/channel_api.html](https://www.squaremobius.net/amqp.node/channel_api.html). 


**IMPORTANT:** The first argument of ***ALL*** zero-rabbit functions (*with the exception of rabbit.connect(*...*)*) is ***ALWAYS*** the channel name (a string) on which to perform the specified action.  Again if the channel is not already created via the config object or via a function call, a new channel will be created. See important notes at the top for information detailing how channels are created and destroyed.

**Connect**
```javascript
rabbit.connect(conf, function(err, conn))
```
**Publish**
```javascript
rabbit.publish(channel, exchange, routingKey, message, options)
```
*exchange* is the name of the exchange to send to

*routingKey* is the routingKey

*message* is any JSON compatible Object. The message payload is expected to be a JSON compatible object. The internals of ZeroRabbit will stringify, turn into a Buffer, and then publish/send the message over the wire for you.

*options* is optional


**Send to Queue**
```javascript
rabbit.sendToQueue(channel, queue, message, options)
```
*queue* is the name of the queue

*message* is any JSON compatible Object (see rabbit.publish above)

*options* are optional


**Consume**
```javascript
rabbit.consume(channel, queue, function(message), options)
```

*message* is a ZeroRabbitMsg (see above for explanation). The JSON decoded msg can be obtained with msg.content or msg.getJsonMsg(), the full rabbit msg can be obtained with msg.msg or msg.getMsg()

*options* are optional


**Set Channel Prefetch**
```javascript
rabbit.setChannelPrefetch(channel, prefetch)
```
*prefetch* is the number of messages to prefetch from a queue

**Ack**
```javascript
rabbit.ack(channel, message, allUpTo)
```

*channel* is the name you gave the channel that the msg came from (i.e. the same channel that the message was delivered on). The channel that you ack the message on needs to be the same as the channel
that the message was consumed from.

*message* is a ZeroRabbitMsg (see above for explanation).

*allUpTo* is a boolean that is optional and defaults to false. If allUpTo is true, all outstanding messages prior to and including the given message shall be considered acknowledged. If false, or omitted, only the message supplied is acknowledged.

It’s an error to supply a message that either doesn’t require acknowledgement, or has already been acknowledged. Doing so will errorise the channel. If you want to acknowledge all the messages and you don’t have a specific message around, use #ackAll.

**Ack All**
```javascript
rabbit.ackAll(channel)
```
*channel* is the name you gave to the channel, read rabbit.ack() above for more info.

Acknowledge all outstanding messages on the channel. This is a “safe” operation, in that it won’t result in an error even if there are no such messages.

**Nack**
```javascript
rabbit.nack(channel, message, allUpTo, requeue)
```

Be careful with nack, the default *requeue* is true and will cause your app to go into a loop if there is only one instance of it consuming from the queue, even if you do have multiple apps this may cause a nasty looping effect.

nack is primarily to be used with dead letter exchanges, as in assertQueue dead letter exchange options [https://www.squaremobius.net/amqp.node/channel_api.html#channel_assertQueue](https://www.squaremobius.net/amqp.node/channel_api.html#channel_assertQueue). In general it is better to just ack bad messages. Advanced setups can use nack to deal with errors that are of a temporary nature, such as http connection errors.

Reject a message. This instructs the server to either requeue the message or throw it away (which may result in it being dead-lettered).

*channel* is the name you gave to the channel, read rabbit.ack() above for more info.

*message* is a ZeroRabbitMsg (see above for explanation).

*allUpTo* is an optional boolean that defaults to false. If allUpTo is truthy, all outstanding messages prior to and including the given message are rejected. As with #ack, it’s a channel-ganking error to use a message that is not outstanding. Defaults to false.

*requeue* is an optional boolean that defaults to true. If requeue is truthy, the server will try to put the message or messages back on the queue or queues from which they came. Defaults to true if not given, so if you want to make sure messages are dead-lettered or discarded, supply false here.

**Nack All**
```javascript
rabbit.nackAll(channel, requeue)
```
Be careful with nackAll() in the same way you need to be careful with nack(), both are really for much more advanced use cases that most people will not have.

Reject all messages outstanding on this channel.

*channel* is the name you gave to the channel, read rabbit.ack() above for more info.

*requeue* is an optional boolean that defaults to true. If requeue is truthy, or omitted, the server will try to re-enqueue the messages.


**Assert Exchange**
```javascript
rabbit.assertExchange(channel, exchange, type, options, function(err, ex))
```
function(err, ex) can be omitted as can options, but if you are asserting an exchange you probably want to make sure it has succeeded before proceeding. Also if you include function(err, q) you need to also include options.

**Assert Queue**
```javascript
rabbit.assertQueue(channel, queue, options, function(err, q))
```
function(err, q) can be omitted as can options, but if you are asserting a queue you probably want to make sure it has succeeded before proceeding. Also if you include function(err, q) you need to also include options.

**Bind Queue**
```javascript
rabbit.bindQueue(channel, queue, exchange, key, options, function(err, ok))
```
function(err, ok) can be omitted as can options, but if you are binding a queue you probably want to make sure it has succeeded before proceeding. Also if you include function(err, q) you need to also include options.

*key* is optional and will default to ''. For basic use cases key === routingKey. More advance use cases key === pattern. Check official docs to understand what key is


**Delete Queue**
```javascript
rabbit.deleteQueue(channel, queue, options, function(err, ok))
```
*options* and *function(err, ok)* can be omitted

**Cancel Channel**
```javascript
rabbit.cancelChannel(channel)
```
This will stop the rabbit.consume() loop that the channel was declared in. It will *not* delete the channel from memory.

**Close Channel**
```javascript
rabbit.closeChannel(channel)
```
This will close the channel. It will also delete the channel object from memory.

I'm still trying to figure out cancel vs. close and right now in my own code I'm using cancelChannel() followed by closeChannel().

**Get Channel**
```javascript
rabbit.getChannel(channel, function(err, ch))
```
*This will not be needed for most use cases.  It is provided for convenience, in case you want to do something over a channel that amqplib supports and Zero Rabbit does not yet do. Requests for additions to make Zero Rabbit handle some of the extra amqplib features are welcome*

*channel* is the name of the channel

*ch* is the actual channel object as found in amqplib (this will be a confirm channel), the same one that can be found here [https://www.squaremobius.net/amqp.node/channel_api.html#confirmchannel](https://www.squaremobius.net/amqp.node/channel_api.html#confirmchannel)

*getChannel()* will retrieve the channel object from memory.  If the channel has not been created previously (via config or another rabbit function call) it will create a new channel, store it in memory, and then give you back the channel object.


# Complicated examples:

**Example of Receiving from two queues at the same time**

```javascript
    const rabbit = require('zero-rabbit');

    const conf =  {

        // ...connection object or url

        exchanges : [
            {
                channel: 'myapp.listen.1',
                name: 'myapp.ex.1',
                type: 'direct',
                options: {}
            },
            {
                channel: 'myapp.listen.2',
                name: 'myapp.ex.2',
                type: 'direct',
                options: {}
            }
        ],
        queues: [
            {
                channel: 'myapp.listen.1',
                name: 'myapp.q.1',
                options: { 'autoDelete': true }
            },
            {
                channel: 'myapp.listen.2',
                name: 'myapp.q.2',
                options: { 'autoDelete': true }
            },
        ],
        bindings: [
            {
                channel: 'myapp.listen.1',
                queue: 'myapp.q.1',
                exchange: 'myapp.ex.1',
                key: '',
                options: {}
            },
            {
                channel: 'myapp.listen.2',
                queue: 'myapp.q.2',
                exchange: 'myapp.ex.2',
                key: '',
                options: {}
            }
        ]
    }

    rabbit.connect(conf, (err, conn) => {

      rabbit.setChannelPrefetch('myapp.listen.1', 1);
      rabbit.consume('myapp.listen.1', 'myapp.q.1', (msg) => {
        let JsonContent = msg.content;
        rabbit.ack('myapp.listen.1', msg);
        
        console.log(JsonContent);
      }, { noAck: false });

      rabbit.setChannelPrefetch('myapp.listen.2', 1);
      rabbit.consume('myapp.listen.2', 'myapp.q.2', (msg2) => {
        let JsonContent2 = msg2.getJsonMsg();
        rabbit.ack('batch.listen.2', msg2);
        
        console.log(JsonContent2);
      }, { noAck: false });

    });
```

**Example of Receiving from a queue on one channel and publishing on another channel**

```javascript
    const rabbit = require('zero-rabbit');

    const conf =  {

        // ...connection object or url
        
        exchanges : [
            {
                channel: 'myapp.send.1',
                name: 'myapp.ex.1',
                type: 'fanout',
                options: {}
            },
            {
                channel: 'myapp.listen.1',
                name: 'someOtherApp.ex.1',
                type: 'direct',
                options: {}
            },
        ],
        queues: [
            {
                channel: 'myapp.listen.1',
                name: 'myapp.q.1',
                options: { 'autoDelete': true }
            }
        ],
        bindings: [
            {
                channel: 'myapp.listen.1',
                queue: 'myapp.q.1',
                exchange: 'someOtherApp.ex.1',
                key: '',
                options: {}
            }
        ]
    }

    rabbit.connect(conf, (err, conn) => {

      rabbit.setChannelPrefetch('myapp.listen.1', 1);
      
      rabbit.consume('myapp.listen.1', 'myapp.q.1', (msg) => {
        let userId = msg.content.userId;
        let access_token = msg.content.access_token;
        let some_data = msg.content.some_data;
        
        let transformed_data = do_something_with_some_data(userId, access_token, some_data);
        
        let transformed_message = {
            userId: userId,
            access_token: access_token,
            some_data: transformed_data
        }

        rabbit.publish('myapp.send.1', 'myapp.ex.1', '', transformed_message);

      }, { noAck: true });

    });
```

In my own code I have utilized Zero Rabbit to dynamically create queues for batch jobs submitted by users such that each user gets their own queue until the batch job is completed (and then their queue is deleted). This has allowed for a single running instance of my app to handle multiple jobs from different users at the same time without holdup. So if a user submits a job that takes 2 minutes and then another user submits a job that takes 5 seconds a single instance of my app can process the 5 second job at the same time as the 2 minute job and not hold up users who have shorter jobs.
