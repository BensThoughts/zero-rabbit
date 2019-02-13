# Zero Rabbit

Zero Rabbit is a libaray that I threw together to provide an abstraction
over libamqplib. It is simple and still a work in progress.

I will be placing instructions on how to use it up here a little later today.

The feature it implements that I have not seen in any other RabbitMQ client
library is the ability to control which channel you publish/consume on.
This is very important for applications that need to listen to more than
one queue at a time.

It works very well for me so I would like to share this library with everyone
who may need such functionality or simply want control over the channels that
their app publishes and subscribes on.  Such that your app is publishing and
listening to queues over dedicated channels to each activity. Or listening to
more then one queue at the same time.

Specifically for my use case I am able to listen to a queue of userIds and then
dynamically create queues for each user for a specific batch job that needs to
be done for each user followed by deleting the queue after the job is completed.

This way a single instance of my app can process multiple users at the same time
and if a user happens to have a batch that takes 2 minutes it will not hold
up users that have batches which may only take a few seconds because they are each in
their own queue and the app listens to each users queue on a different chanel after
seeing that a userId has come down the pipeline in the userIds queue.

