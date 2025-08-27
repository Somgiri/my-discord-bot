class Logger {
    constructor() {
        this.logLevel = process.env.LOG_LEVEL || 'info';
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };
    }
    
    shouldLog(level) {
        return this.levels[level] <= this.levels[this.logLevel];
    }
    
    formatMessage(level, message, ...args) {
        const timestamp = new Date().toISOString();
        const levelStr = level.toUpperCase().padEnd(5);
        const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
        
        let formatted = `[${timestamp}] ${levelStr} ${messageStr}`;
        
        if (args.length > 0) {
            const argsStr = args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ');
            formatted += ` ${argsStr}`;
        }
        
        return formatted;
    }
    
    error(message, ...args) {
        if (this.shouldLog('error')) {
            console.error(this.formatMessage('error', message, ...args));
        }
    }
    
    warn(message, ...args) {
        if (this.shouldLog('warn')) {
            console.warn(this.formatMessage('warn', message, ...args));
        }
    }
    
    info(message, ...args) {
        if (this.shouldLog('info')) {
            console.log(this.formatMessage('info', message, ...args));
        }
    }
    
    debug(message, ...args) {
        if (this.shouldLog('debug')) {
            console.log(this.formatMessage('debug', message, ...args));
        }
    }
    
    // Log Discord API rate limits and errors
    rateLimit(data) {
        this.warn('Discord Rate Limit:', {
            timeout: data.timeout,
            limit: data.limit,
            method: data.method,
            path: data.path,
            route: data.route
        });
    }
    
    // Log command usage
    commandUsed(commandName, user, guild) {
        this.info(`Command used: /${commandName}`, {
            user: user.tag,
            userId: user.id,
            guild: guild?.name || 'DM',
            guildId: guild?.id || null
        });
    }
    
    // Log API calls
    apiCall(service, endpoint, success = true, responseTime = null) {
        const data = {
            service,
            endpoint,
            success,
            responseTime: responseTime ? `${responseTime}ms` : null
        };
        
        if (success) {
            this.info(`API call successful: ${service}/${endpoint}`, data);
        } else {
            this.error(`API call failed: ${service}/${endpoint}`, data);
        }
    }
    
    // Log bot events
    botEvent(event, data = {}) {
        this.info(`Bot event: ${event}`, data);
    }
}

module.exports = new Logger();
