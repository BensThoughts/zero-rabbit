const log4js = require('log4js');
    log4js.configure({
        appenders: { 
            stdout: { type: 'stdout' },
            stderr: { type: 'stderr' },

            /** Dev Setting */
            _stdout_debug: { type: 'logLevelFilter', appender: 'stdout', level: 'debug', maxLevel: 'info' },
            _stdout_trace: { type: 'logLevelFilter', appender: 'stdout', level: 'trace', maxLevel: 'info' },

            /** Prod Setting */
            _stdout_prod: { type: 'logLevelFilter', appender: 'stdout', level: 'info', maxLevel: 'info' },


            /** Dev Setting */
            _stderr_debug: { type: 'logLevelFilter', appender: 'stderr', level: 'warn', maxLevel: 'fatal' },

            /** Prod Setting */
            _stderr_prod: { type: 'logLevelFilter', appender: 'stderr', level: 'error', maxLevel: 'fatal' },

        },
        categories: { 
            default: { appenders: ['_stdout_prod'], level: 'info' },
            dev: { appenders: [, '_stdout_debug', '_stderr_debug'], level: 'trace' },
            dev_trace: { appenders: ['_stdout_trace', '_stderr_debug'], level: 'trace' },
            prod: { appenders: ['_stdout_prod', '_stderr_prod'], level: 'trace' }
        }
    });

// switch getLogger('prod') for prod
const logger = log4js.getLogger('dev_trace');

module.exports = logger;