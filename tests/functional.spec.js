const rabbit = require('../index');


let conf = {
    url: 'amqp://localhost:5672'
}

let conf2 = {
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
    queues: [
        {
            channel: 'test.ch.1',
            queue: 'example.test',
            options: {}
        }
    ]
}

let conf3 = {
    url: 'amqp://localhosdst'
}


rabbit.connect(conf2, (err, conn) => {

})