# Zero Rabbit

Zero Rabbit is a library that I threw together to provide an abstraction over amqplib. It is simple and still a work in progress.

The feature it implements that I have not seen in any other RabbitMQ client library is the ability to control which channel you publish/consume on. This is very important for applications that need to listen to more than one queue at a time.

# Config

    const conf = {

        "connection": {
            "protocol": "amqp",
            "hostname": "rabbitmq",
            "port": 5672,
            "username": "guest",
            "password": "guest",
            "locale": "en_US",
            "frameMax": 0,
            "heartbeat": 60,
            "vhost": "/"
        },
        "exchanges" : [
            {
                "channel": "batch.listen.1",
                "name": "user.ids.ex.1",
                "type": "fanout",
                "options": {}
            },
            {
                "channel": "batch.listen.1",
                "name": "threadIds.topic.ex.1",
                "type": "topic",
                "options": {}
            }
        ],
        "queues": [
            {
                "channel": "batch.listen.1",
                "name": "batch.user.id.q.1",
                "options": { "autoDelete": false }
            }
        ],
        "bindings": [
            {
                "channel": "batch.listen.1",
                "queue": "batch.user.id.q.1",
                "exchange": "user.ids.ex.1",
                "key": "",
                "options": {}
            }
        ]
    }

*options* and *key* are not optional as of right now, just use {} and "" respectively if you want
to omit those things.

**Note:** You MUST declare a channel for all queues, exchanges, and bindings...This is actually a benefit as you will see (It allows you to consume off of multiple queues at the same time).

**IMPORTANT:** channels are created idempotently and automatically within all function calls and config object declarations, with the *exception* of rabbit.ack(*channel*, *msg*), rabbit.closeChannel(*channel*) and rabbit.cancelChannel(*channel*).  This means that if you misspell a channel name somewhere later on in your code it will result in the creation of a new channel as well as possibly unexpected behavior.

***Channels are created automatically*** either by declaration in a config object or dynamically via functions such as rabbit.assertQueue().

***Channels can be deleted*** (in other words closed/cancelled) with rabbit.closeChannel() and rabbit.cancelChannel() (see below).

**IMPORTANT:** The first argument of ***ALL*** zero-rabbit functions (i.e. rabbit.consume() as below) is ***ALWAYS*** the channel on which to perform the specified action.  Again if the channel is not already created via the config object or via a function call, a new channel will be created.

To avoid channels accumulating or unexpected behavior try to stick with using as few as you possibly can throughout your app and reuse the same channel where appropriate (i.e. use the same channel to publish on as you used to create the exchange and use the same channel to consume on as the one you used to create and bind a queue that it reads from).

If your app only consumes from a single queue you can actually just use one channel for everything (publishing and consuming).


# Zero Rabbit Msg:
The msg object that pops out of rabbit.consume is a special little object called a ZeroRabbitMsg.  

Within a ZeroRabbitMsg there exists two properties:

**msg**: Contains the entire msg object as given by amqplib, encoded contents and all.
* The full RabbitMQ (amqplib) message can be obtained with msg.getMsg() or msg.msg.

**content**: A JSON deserialized version of the content portion of the message
* The original message object can be obtained with msg.getJsonMsg() or msg.content.

*So yes, Zero Rabbit is only really good for sending and receiving JSON messages as of right now.*

# Examples:

**Sending (Publishing):**

    const rabbit = require('zero-rabbit');

    let conf = {
        "connection": {
                "protocol": "amqp",
                "hostname": "localhost",
                "port": 5672,
                "username": "guest",
                "password": "guest",
                "locale": "en_US",
                "frameMax": 0,
                "heartbeat": 60,
                "vhost": "/"
        },
        "exchanges" : [
            {
                "channel": "myapp.send.1",
                "name": "myapp.ex.1",
                "type": "direct",
                "options": {}
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
      
      rabbit.publish('myapp.send.1', 'myapp.ex.1', message, '', {
        contentType: 'application/json', 
        type: 'some-data',
        appId: 'my-app',
        timestamp: 1234567,
        encoding: 'encoding',
        persistent: true,
      });
    
    });


You only need to connect once somewhere in your main module. Once you have connected you can publish anywhere in your app.

*const rabbit = require('zero-rabbit')* and then *rabbit.publish()*.

The msg payload that rabbit.publish(*channel*, *exchange*, *msg*, ...) expects is any plain Javascript object. The internals of ZeroRabbit will stringify, turn into a Buffer, and then publish the message over the wire for you.


**Receiving (Subscribing):**

    const rabbit = require('zero-rabbit');

    const conf =  {

        "connection": {
            // ...connection object
        },
        "exchanges" : [
            {
                "channel": "myapp.listen.1",
                "name": "myapp.ex.1",
                "type": "direct",
                "options": {}
            },
        ],
        "queues": [
            {
                "channel": "myapp.listen.1",
                "name": "myapp.q.1",
                "options": { "autoDelete": true }
            }
        ],
        "bindings": [
            {
                "channel": "myapp.listen.1",
                "queue": "myapp.q.1",
                "exchange": "myapp.ex.1",
                "key": "",
                "options": {}
            }
        ]
    }

    rabbit.connect(conf, (err, conn) => {
      rabbit.setChannelPrefetch('myapp.listen.1', 1);
      
      rabbit.consume('myapp.listen.1', 'myapp.q.1', { noAck: false }, (msg) => {
        let userId = msg.content.userId;
        let access_token = msg.content.access_token;
        let some_data = msg.content.some_data;

        rabbit.ack('myapp.listen.1', msg);
        
        do_something_with_some_data(userId, access_token, some_data);
      });

    });


See below for more complicated examples.

# Methods:

**connect**

rabbit.connect(conf, function(err, conn))

**Publish**

rabbit.publish(*channel*, *exchange*, *message*, *routingKey*, *options*)

*routingKey* and *options* are optional

The msg payload is expected to be a JSON object. The internals of ZeroRabbit will stringify, turn into a Buffer, and then publish/send the message over the wire for you.

**Consume**

rabbit.consume(*channel*, *queue*, *options*, *function(msg)*)

*options* are not optional as of right now, just use {} if you do not want to use any options.

*msg* is a ZeroRabbitMsg (see above for explanation). The JSON decoded msg can be obtained with msg.content or msg.getJsonMsg(), the full rabbit msg can be obtained with msg.msg or msg.getMsg()


**Set Channel Prefetch**

rabbit.setChannelPrefetch(*channel*, *prefetch*)

**Ack**

rabbit.ack(*channel*, *msg*)

*msg* is a ZeroRabbitMsg (see above for explanation).

*channel* is the name you gave the channel that the msg came from (i.e. the same channel that the message was delivered on). The channel that you ack the message on needs to be the same as the channel
that the message was consumed from.


**Assert Exchange**

rabbit.assertExchange(*channel*, *exchange*, *type*, *options*, *function(err, ex)*)

function(err, ex) can be omitted as can options, but if you are asserting an exchange you probably want to make sure it has succeeded before proceeding.

**Assert Queue**

rabbit.assertQueue(*channel*, *queue*, *options*, *function(err, q)*)

function(err, q) can be omitted as can options, but if you are asserting a queue you probably want to make sure it has succeeded before proceeding.

**Bind Queue**

rabbit.bindQueue(*channel*, *queue*, *exchange*, *key*, *options*, *function(err, ok)*)

function(err, ok) can be omitted as can options, but if you are binding a queue you probably want to make sure it has succeeded before proceeding.  key must be included but can be set to "" if you don't need it.

Best just to include all arguments and use "" for key and {} for options.

**Delete Queue**

rabbit.deleteQueue(*channel*, *queue*, *options*, *function(err, ok)*)

*options* and *function(err, ok)* can be omitted

**Cancel Channel**

rabbit.cancelChannel(*channel*)

This will stop the rabbit.consume() loop that the channel was declared in.

**Close Channel**

rabbit.closeChannel(*channel*)

This will close the channel (apparently should rarely be needed).  I'm still trying to figure out cancel vs. close and right now in my own code using cancel followed by close.



# Complicated examples:

**Example of Receiving from two queues at the same time**


    const rabbit = require('zero-rabbit');

    const conf =  {

        "connection": {
            // ...connection object
        },
        "exchanges" : [
            {
                "channel": "myapp.listen.1",
                "name": "myapp.ex.1",
                "type": "direct",
                "options": {}
            },
            {
                "channel": "myapp.listen.2",
                "name": "myapp.ex.2",
                "type": "direct",
                "options": {}
            }
        ],
        "queues": [
            {
                "channel": "myapp.listen.1",
                "name": "myapp.q.1",
                "options": { "autoDelete": true }
            },
            {
                "channel": "myapp.listen.2",
                "name": "myapp.q.2",
                "options": { "autoDelete": true }
            },
        ],
        "bindings": [
            {
                "channel": "myapp.listen.1",
                "queue": "myapp.q.1",
                "exchange": "myapp.ex.1",
                "key": "",
                "options": {}
            },
            {
                "channel": "myapp.listen.2",
                "queue": "myapp.q.2",
                "exchange": "myapp.ex.2",
                "key": "",
                "options": {}
            }
        ]
    }

    rabbit.connect(conf, (err, conn) => {

      rabbit.setChannelPrefetch('myapp.listen.1', 1);
      rabbit.consume('myapp.listen.1', 'myapp.q.1', { noAck: false }, (msg) => {
        let JsonContent = msg.content;
        rabbit.ack('myapp.listen.1', msg);
        
        console.log(JsonContent);
      });

      rabbit.setChannelPrefetch('myapp.listen.2', 1);
      rabbit.consume('myapp.listen.2', 'myapp.q.2', { noAck: false }, (msg2) => {
        let JsonContent2 = msg2.getJsonMsg();
        rabbit.ack('batch.listen.2', msg2);
        
        console.log(JsonContent2);
      });

   });

**Example of Receiving from a queue on one channel and publishing on another channel**

    const rabbit = require('zero-rabbit');

    const conf =  {

        "connection": {
            // ...connection object
        },
        "exchanges" : [
            {
                "channel": "myapp.send.1",
                "name": "myapp.ex.1",
                "type": "fanout",
                "options": {}
            },
            {
                "channel": "myapp.listen.1",
                "name": "someOtherApp.ex.1",
                "type": "direct",
                "options": {}
            },
        ],
        "queues": [
            {
                "channel": "myapp.listen.1",
                "name": "myapp.q.1",
                "options": { "autoDelete": true }
            }
        ],
        "bindings": [
            {
                "channel": "myapp.listen.1",
                "queue": "myapp.q.1",
                "exchange": "someOtherApp.ex.1",
                "key": "",
                "options": {}
            }
        ]
    }

    rabbit.connect(conf, (err, conn) => {
      rabbit.setChannelPrefetch('myapp.listen.1', 1);
      
      rabbit.consume('myapp.listen.1', 'myapp.q.1', { noAck: true }, (msg) => {
        let userId = msg.content.userId;
        let access_token = msg.content.access_token;
        let some_data = msg.content.some_data;
        
        let transformed_data = do_something_with_some_data(userId, access_token, some_data);
        
        let transformed_message = {
            userId: userId,
            access_token: access_token,
            some_data: transformed_data
        }

        rabbit.publish('myapp.send.1', 'myapp.ex.1', transformed_message);
      });

    });
