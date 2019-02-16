const rabbit = require('zero-rabbit');


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
            options: {}
        },
        {
            channel: "test.send.2",
            name: "test.ex.2",
            type: "topic",
            options: {}
        }
    ],
    queues: [
        {
            channel: "test.listen.1",
            name: "test.q.1",
            options: { "autoDelete": false }
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
    rabbit.getChannel('threads.listen.3', (err, ch) => {
        let message = {
            test: 'test23'
        }
        message = JSON.stringify(message);
        ch.publish('test.ex.1', '', Buffer.from(message))
    });
})