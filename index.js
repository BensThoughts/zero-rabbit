const amqp = require('amqplib/callback_api');
const logger = require('./loggers/log4js');


var util = require('util');


async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}


/**
 * A RabbitMQ client interface to provide abstraction over the amqplib.
 * 
 */
class ZeroRabbit {

  constructor() {
    this.rabbitConn;
    this.channels = new Map();
    this.consumerTags = new Map();
  }
  
  connect(opts, cb) {
    amqp.connect(opts.connection, (err, conn) => {
      let protocol = opts.connection.protocol;
      let hostname = opts.connection.hostname;
      let port = opts.connection.port;
      logger.info('Connected to RabbitMQ: ' + protocol + '://' + hostname + ':' + port);

      this.rabbitConn = conn;

      this.setupTopology(opts).then(() => {
        logger.trace('Chanels opened: ' + this.channels.size);
      
        if (cb) {
          cb(err, conn);
        }

      }).catch((err) => logger.error(err));
 
    });
  };

  /**
   * Sets up the RabbitMQ topology
   * 
   * @param {Options} opts - An Options Object to be parsed for topology info
   *  
   */
  async setupTopology(opts) {

    if (opts.exchanges) {
      await asyncForEach(opts.exchanges, async (exchange) => {
        await this.assertExchange(exchange.channel, exchange.name, exchange.type, exchange.options);
      });
    } 

    if (opts.queues) {
      await asyncForEach(opts.queues, async (queue) => {
        await this.assertQueue(queue.channel, queue.name, queue.options);
      });
    } 
    
    if (opts.bindings) {
      await asyncForEach(opts.bindings, async (binding) => {
        await this.bindQueue(binding.channel, binding.queue, binding.exchange, binding.key, binding.options);
      });
    }  
  
  }

  async assertExchange(channel, exName, type, options, cb) {
    await this.getChannel(channel, (err, ch) => {
      ch.assertExchange(exName, type, options, (err, ex) => {
        if (cb) {
          cb(err,ch)
        } else {
          if (err) return logger.error('Error in RabbitMQ.assertExchange(): ' + err);
          let exInfo = util.inspect(ex);
          logger.info('assertExchange on channel ' + channel + ': ' + exInfo);
        }
      });
    });
  }

  async assertQueue(channel, qName, options, cb) {
    await this.getChannel(channel, (err, ch) => {
      ch.assertQueue(qName, options, (err, q) => {
        if (cb) {
          cb(err, q);
        } else {
          if (err) return logger.error('Error in RabbitMQ.assertQueue(): ' + err);
          let qInfo = util.inspect(q);
          logger.info('assertQueue on channel ' + channel + ': ' + qInfo);
        }
      });
    });
  }

  async bindQueue(channel, qName, exName, key, options, cb) {
    await this.getChannel(channel, (err, ch) => {
      ch.bindQueue(qName, exName, key, options, (err, ok) => {
        if (cb) {
          cb(err, ok);
        } else {
          if (err) return logger.error('Error in RabbitMQ.bindQueue(): ' + err);
          logger.info('bind Queue ' + qName + ' to ' + exName + ' on channel ' + channel);
        }
      });
    });
  }

  async deleteQueue(channel, qName, options, cb) {
    await this.getChannel(channel, (err, ch) => {
      ch.deleteQueue(qName, options, (err, ok) => {
        if (err) logger.error(err);
        if (cb) {
          cb(err, ok);
        }
      })
    })
  }

  /**
   * returns a promise that creates a new confirmChannel on the current 
   * connection and stores it in this.channels (a Map) for later retrieval
   * 
   * @param {string} channelName 
   */
  createConfirmChannelPromise(channelName) {
    return new Promise((resolve, reject) => {
      this.rabbitConn.createConfirmChannel((err, ch) => {
        if (err) {
          reject(err);
        }
        this.setChannel(channelName, ch);
        resolve(ch);
      });
    });
  }

  setChannel(channelName, ch) {
    this.channels.set(channelName, ch);
  }

  /**
   * Attempts to retrieve a channel from this.channels and creates
   * a new channel if one is not already stored. This is an async
   * operation that will wait for the new channel to be created
   * so that all other operations after that use the same channel
   * name will find the chanel in the Map object.
   * 
   * @param {string} channelName - the name of the channel
   * @param {function} cb - a callback function 
   */
  async getChannel(channelName, cb) {
    let channel = this.channels.get(channelName);
    if (channel === undefined) {
      await this.createConfirmChannelPromise(channelName).then((ch) => {
        logger.info('Created Confirm Channel: ' + channelName);
        cb(undefined, ch); 
      }).catch(err => {
        logger.error('Error creating channel: ' + err);
        cb(err, undefined);
      });
    } else {
      cb(undefined, channel);
    }
  }

  async setChannelPrefetch(channel, prefetch) {
    await this.getChannel(channel, (err, ch) => {
      ch.prefetch(prefetch);
    });
  }

  async publish(channel, exName, msg, routingKey, options) {
    msg = JSON.stringify(msg);
    await this.getChannel(channel, (err, ch) => {
      ch.publish(exName, routingKey || '', new Buffer(msg), options || {});
    });
  }

  async consume(channel, qName, options, cb) {
    await this.getChannel(channel, (err, ch) => {
      let optionsMsg = util.inspect(options);
      logger.info('Listenting on channel ' + channel + ' to: ' + qName + ' with options: ' + optionsMsg);
      ch.consume(qName, (msg) => {
        let message = new ZeroRabbitMsg(msg);
        cb(message);
      }, options, (err, ok) => {
        if (err) {
          logger.error(err)
        } else {
          let consumerTag = ok.consumerTag;
          this.consumerTags.set(channel, consumerTag);
        };
      })
    });
  }

  // when ack we Don't getChannel() (which is imdepotent) because the channel had
  // better already have been created if we are acking, right?
  ack(channel, msg) {
    try {
    let message = msg.getMsg();
    this.channels.get(channel).ack(message);
    } catch(err) {
      logger.error('Error in RabbitMQ.ack()' + err);
    }
  }

  closeChannel(channel) {
    try {
      let ch = this.channels.get(channel);
      ch.close();
      this.channels.delete(channel);
    } catch(err) {
      logger.error('Error in RabbitMQ.closeChannel()' + err);
    }
  } 
  
  cancelChannel(channel) {
    try {
      let consumerTag = this.consumerTags.get(channel);
      let ch = this.channels.get(channel);
      ch.cancel(consumerTag);
    } catch(err) {
      logger.error('Error in RabbitMQ.cancelChannel()' + err);
    }
  }
  
}

/**
 * A RabbitMsg holds the original full message (metadata and all) and a 
 * JSON deserialized version of it.  This way within the program someone 
 * can get the contents in a JSON format with msg.content and can also 
 * ack the message with rabbit.ack(channel, msg)
 */
class ZeroRabbitMsg {

  constructor(msg) {
    this.content = JSON.parse(msg.content.toString());
    this.msg = msg;
  }

  getJsonMsg() {
    return this.content;
  }

  getMsg() {
    return this.msg;
  }
}

const aRabbit = new ZeroRabbit();

exports.connect = function connect(opts, cb) {
  aRabbit.connect(opts, cb);
}

exports.consume = function consume(channel, qName, options, cb) {
  aRabbit.consume(channel, qName, options, cb);
};


exports.publish = function publish(channel, exName, msg, routingKey, options) {
  aRabbit.publish(channel, exName, msg, routingKey, options);
}

exports.ack = function ack(channel, msg) {
  aRabbit.ack(channel, msg);
}

exports.setChannelPrefetch = function setChannelPrefetch(channel, prefetch) {
  aRabbit.setChannelPrefetch(channel, prefetch);
}

exports.assertQueue = function assertQueue(channel, qName, options, cb) {
  aRabbit.assertQueue(channel, qName, options, cb);
}

exports.deleteQueue = function deleteQueue(channel, qName, options, cb) {
  aRabbit.deleteQueue(channel, qName, options, cb);
}

exports.assertExchange = function assertExchange(channel, exName, type, options, cb) {
  aRabbit.assertExchange(channel, exName, type, options, cb)
}

exports.bindQueue = function bindQueue(channel, qName, exName, key, options, cb) {
  aRabbit.bindQueue(channel, qName, exName, key, options, cb);
}

exports.closeChannel = function closeChannel(channel) {
  aRabbit.closeChannel(channel);
}

exports.cancelChannel = function cancelChannel(channel) {
  aRabbit.cancelChannel(channel);
}