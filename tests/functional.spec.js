const rabbit = require('../index');


let conf = {
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




rabbit.connect(conf, (err, conn) => {
    let message = {
        test: 'test23'
    }
    rabbit.publish('test.send.1', 'test.ex.1', message, '', {});

    rabbit.consume('test.listen.1', 'test.q.1', { noAck: false }, (msg) => {
        console.log(msg);
        rabbit.ack('test.listen.1', msg, false);
    })
})