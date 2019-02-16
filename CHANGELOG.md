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