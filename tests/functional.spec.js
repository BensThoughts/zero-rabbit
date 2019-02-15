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
            channel: "threads.listen.1",
            name: "user.ids.ex.1",
            type: "fanout",
            options: {}
        },
        {
            channel: "threads.send.1",
            name: "user.threadIds.topic.ex.1",
            type: "topic",
            options: {}
        }
    ],
    queues: [
        {
            channel: "threads.listen.2",
            name: "threads.user.id.q.1",
            options: { "autoDelete": false }
        }
    ],
    bindings: [
        {
            channel: "threads.listen.3",
            queue: "threads.user.id.q.1",
            exchange: "user.ids.ex.1",
            key: "",
            options: {}
        }
    ]
}




rabbit.connect(conf, (err, conn) => {

})