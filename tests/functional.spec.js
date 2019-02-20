const expect = require('chai').expect

const rabbit = require('zero-rabbit');

const confWithOptions = {
    connection: {
        hostname: 'localhost',
        port: 5672,
        frameMax: 0,
        heartbeat: 60,
        vhost: '/',
        username: 'guest',
        password: 'guest',
        protocol: 'amqp'
    },
    exchanges : [
        {
            channel: "test.send.1",
            name: "test.ex.1",
            type: "fanout",
            options: { "autoDelete": true }
        },
        {
            channel: "test.send.2",
            name: "test.ex.2",
            type: "topic",
            options: { "autoDelete": true }
        }
    ],
    queues: [
        {
            channel: "test.listen.1",
            name: "test.q.1",
            options: { "autoDelete": true, "durable": false }
        }
    ],
    bindings: [
        {
            channel: "test.send.1",
            queue: "test.q.1",
            exchange: "test.ex.1",
            key: "",
            options: {}
        }
    ]
}

const confWithoutOptions = {
    connection: {
        hostname: 'localhost',
        port: 5672,
        frameMax: 0,
        heartbeat: 60,
        vhost: '/',
        username: 'guest',
        password: 'guest',
        protocol: 'amqp'
    },
    exchanges : [
        {
            channel: "test.send.1",
            name: "test.without.options.ex.1",
            type: "fanout",
        },
        {
            channel: "test.send.2",
            name: "test.without.options.ex.2",
            type: "topic",
        }
    ],
    queues: [
        {
            channel: "test.listen.1",
            name: "test.without.options.q.1",
        }
    ],
    bindings: [
        {
            channel: "test.send.1",
            queue: "test.without.options.q.1",
            exchange: "test.without.options.ex.1",
        }
    ]
}

const confConnectionOnly = {
    connection: {
        hostname: 'localhost',
        port: 5672,
        frameMax: 0,
        heartbeat: 60,
        vhost: '/',
        username: 'guest',
        password: 'guest',
        protocol: 'amqp'
    }
}

describe('Zero Rabbit: ', () => {
    describe('Functional Connection Tests: ', () => {
        afterEach(() => {
            rabbit.disconnect((err) => {
                if (err) console.log(err);
            });
        });
        it('should connect with a connection object without options', (done) => {
            rabbit.connect(confConnectionOnly, (err, conn) => {
                expect(err).to.be.null;
                done();
            });
        });
        it('should connect with a url string without options', (done) => {
            rabbit.connect({ url: 'amqp://localhost' }, (err, conn) => {
                expect(err).to.be.null;
                done();
            });
        });
        it('should assert Queues, Exchanges, and Bind Queues, without options', (done) => {
            rabbit.connect(confWithoutOptions, (err, conn) => {
                expect(err).to.be.null;
                done();
            });
        });
        it('should assert Queues, Exchanges, and Bind Queues, with options', (done) => {
            rabbit.connect(confWithOptions, (err, conn) => {
                expect(err).to.be.null;
                done();
            });
        });
    });
    describe('Function Connection Error Tests: ', () => {
        it('should throw an error if both url and connection object are used', () => {
            let badConnect = function() {
                return rabbit.connect({ url: 'amqp://localhost', ...conf });
            }
            expect(badConnect).to.throw(Error);
        });
        it('should throw an error if no connection/url is given, without callback', () => {
            let badConnect = function() {
                return rabbit.connect({});
            }
            expect(badConnect).to.throw(Error);
            expect(badConnect).to.throw('"connection" or "url" not found in configuration');
        });
        it('should throw an error if no connection/url is given, with callback', () => {
            let badConnect = function() {
                return rabbit.connect({}, (err, conn) => {

                });
            }
            expect(badConnect).to.throw(Error);
            expect(badConnect).to.throw('"connection" or "url" not found in configuration');
        });
        it('should throw an error if bad connection string with callback', (done) => {
            let badConnect = function(callback) {
                return rabbit.connect({ url: 'amqp://bad' }, (err, conn) => {
                    callback(err,conn);
                })
            }
            badConnect((err, conn) => {
                expect(err.errno).to.exist;
                expect(err.errno).to.eql('ENOTFOUND');
                done();
            });
        });
    });
    describe('Method Tests: ', () => {
        afterEach(() => {
            rabbit.disconnect((err) => {
                if (err) console.log(err);
            });
        });
        describe('Publishing: ', () => {
            it('should publish to a queue', (done) => {
                rabbit.connect(confWithoutOptions, async (err, conn) => {
                    let message = {
                        'userId': 'userId',
                        'token': 'token',
                        'some_data': ['data1', 'data2', 'data3']
                    }
                    rabbit.publish('test.send.1', 'test.without.options.ex.1', '', message, {}, (err, ok) => {
                        expect(err).to.be.null;
                        done();
                    });
                });
            });
        });
        describe('Consuming: ', () => {
            it('should consume from a queue', (done) => {
                rabbit.connect(confWithoutOptions, async (err, conn) => {
                    let message = {
                        'userId': 'userId',
                        'token': 'token',
                        'some_data': ['data1', 'data2', 'data3']
                    }
                    rabbit.consume('test.listen.1', 'test.without.options.q.1', (msg) => {
                        if (msg) {
                            expect(msg.content).to.eql(message)
                            done();
                        }
                    }, { noAck: true });
                });
            });
        });
    });
});