const amqp = require('amqplib/callback_api');
const debug = require('debug')('zero-rabbit');


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
  
  connect(opts, callback) {
    let connection;
    if (opts.connection && opts.url) {
      throw new Error('Config must include one of "connection" or "url", but not both!');
    }
    if (opts.connection) {
      connection = opts.connection;
    } else if (opts.url) {
      connection = opts.url
    } else {
      throw new Error('"connection" or "url" not found in configuration: please include one!');
    }

    amqp.connect(connection, (err, conn) => {
      if (err) {
        if (cb) {
          cb(err, undefined);
        } else {
          throw new Error('Error creating connection: ' + err);
        }
      } else {
        if (opts.connection) {
          let protocol = opts.connection.protocol;
          let hostname = opts.connection.hostname;
          let port = opts.connection.port;
          debug('Connected to RabbitMQ: ' + protocol + '://' + hostname + ':' + port);
        } else {
          debug('Connected to RabbitMQ: ' + opts.url)
        }
        
        this.rabbitConn = conn;

        this.setupTopology(opts).then(() => {
          debug('Channels opened: ' + this.channels.size);
      
          if (callback) {
            callback(err, conn);
          }

        });
      }
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

  async assertExchange(channelName, exName, type, options, callback) {
    let ch = await this.getChannel(channelName);
    ch.assertExchange(exName, type, options, (err, ex) => {
      if (callback) {
        callback(err,ex)
      } else {
        if (err) throw new Error('Error in assertExchange(): ' + err);
        let exInfo = util.inspect(ex);
        debug('assertExchange on channel ' + channelName + ': ' + exInfo);
      }
    });
  }

  async assertQueue(channelName, qName, options, callback) {
    let ch = await this.getChannel(channelName);
    ch.assertQueue(qName, options, (err, q) => {
      if (callback) {
        callback(err, q);
      } else {
        if (err) throw new Error('Error in ZeroRabbit.assertQueue(): ' + err);
        let qInfo = util.inspect(q);
        debug('assertQueue on channel ' + channelName + ': ' + qInfo);
      }
    });
  }

  async bindQueue(channelName, qName, exName, key, options, callback) {
    let ch = await this.getChannel(channelName);
    ch.bindQueue(qName, exName, key, options, (err, ok) => {
      if (callback) {
        callback(err, ok);
      } else {
        if (err) throw new Error('Error in RabbitMQ.bindQueue(): ' + err);
        debug('Bind queue: ' + qName + ' to ' + exName + ' on channel ' + channelName);
        debug('Bound ' + qName + ' with key: ' + key);
        debug('Bound ' + qName + ' with options: ' + options)
      }
    });
  }

  async deleteQueue(channelName, qName, options, callback) {
    let ch = await this.getChannel(channelName);
    ch.deleteQueue(qName, options, (err, ok) => {
      if (callback) {
        callback(err, ok);
      } else {
        if (err) throw new Error('Error deleting queue: ' + err);
        debug('Deleted queue ' + qName + ' on channel ' + channelName);
        debug('Deleted queue with options ' + options);
      }
    });
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
   * name will find the channel in the Map object.
   * 
   * If this is called externally it will pass (err, ch) to the callback
   * for handling. Internally this is used without callback and so will 
   * just throw a new error if the channel fails to be created.
   * 
   * @param {string} channelName - the name of the channel
   * @param {function} callback - a callback function 
   */
  async getChannel(channelName, callback) {
    let ch = this.channels.get(channelName);
    if (ch === undefined) {
      ch = await this.createConfirmChannelPromise(channelName).catch(err => {
        if (callback) {
          callback(err, undefined);
        } else {
          throw new Error('Error creating channel: ' + err);
        }
      });
      if (callback) {
        callback(undefined, ch)
      } else {
        debug('Created confirm channel: ' + channelName);
        return ch;
      }
    } else if(callback) {
      callback(undefined, ch);
    } else {
      debug('Retrieved confirm channel from this.channels');
      return ch;
    }
  }

  async setChannelPrefetch(channelName, prefetch) {
    let ch = await this.getChannel(channelName);
    ch.prefetch(prefetch);
  }

  async publish(channelName, exName, msg, routingKey, options) {
    msg = JSON.stringify(msg);
    let ch = await this.getChannel(channelName);
    ch.publish(exName, routingKey || '', new Buffer(msg), options || {});
  }

  async consume(channelName, qName, options, callback) {
    let ch = await this.getChannel(channelName);
    let optionsMsg = util.inspect(options);
    debug('Listenting on channel ' + channelName + ' to: ' + qName + ' with options: ' + optionsMsg);
    ch.consume(qName, (msg) => {
        let message = new ZeroRabbitMsg(msg);
        callback(message);
      }, options, (err, ok) => {
        if (err) {
          throw new Error(err)
        } else {
          let consumerTag = ok.consumerTag;
          this.consumerTags.set(channelName, consumerTag);
        };
      });
  }

  // when ack we Don't getChannel() (which is imdepotent) because the channel had
  // better already have been created if we are acking, right?
  ack(channelName, msg) {
    let message = msg.getMsg();
    let ch = this.channels.get(channelName)
    ch.ack(message);
  }

  closeChannel(channelName) {
    let ch = this.channels.get(channelName);
    ch.close();
    this.channels.delete(channelName);
  } 
  
  cancelChannel(channelName) {
    let consumerTag = this.consumerTags.get(channelName);
    let ch = this.channels.get(channelName);
    ch.cancel(consumerTag);
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

const zeroRabbit = new ZeroRabbit();

exports.connect = function connect(opts, callback) {
  zeroRabbit.connect(opts, callback);
}

exports.consume = function consume(channelName, qName, options, callback) {
  zeroRabbit.consume(channelName, qName, options, callback);
};


exports.publish = function publish(channelName, exName, msg, routingKey, options) {
  zeroRabbit.publish(channelName, exName, msg, routingKey, options);
}

exports.ack = function ack(channelName, msg) {
  zeroRabbit.ack(channelName, msg);
}

exports.setChannelPrefetch = function setChannelPrefetch(channelName, prefetch) {
  zeroRabbit.setChannelPrefetch(channelName, prefetch);
}

exports.assertQueue = function assertQueue(channelName, qName, options, callback) {
  zeroRabbit.assertQueue(channelName, qName, options, callback);
}

exports.deleteQueue = function deleteQueue(channelName, qName, options, callback) {
  zeroRabbit.deleteQueue(channelName, qName, options, callback);
}

exports.assertExchange = function assertExchange(channelName, exName, type, options, callback) {
  zeroRabbit.assertExchange(channelName, exName, type, options, callback)
}

exports.bindQueue = function bindQueue(channelName, qName, exName, key, options, callback) {
  zeroRabbit.bindQueue(channelName, qName, exName, key, options, callback);
}

exports.closeChannel = function closeChannel(channelName) {
  zeroRabbit.closeChannel(channelName);
}

exports.cancelChannel = function cancelChannel(channelName) {
  zeroRabbit.cancelChannel(channelName);
}

exports.getChannel = function getChannel(channelName, callback) {
  zeroRabbit.getChannel(channelName, callback);
}