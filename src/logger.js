const { parentPort , workerData } = require('worker_threads');


class Logger
{
    constructor()
    {
        this.logs = [];
    }

    addLog(log)
    {
        console.log(log);
        this.logs.push(log);
    }

    getLogs()
    {
        return this.logs;
    }

    sortLogs()
    {
        this.logs.sort((a, b) => a.ts - b.ts);
    }

    printLogs()
    {
        this.sortLogs();

        this.logs.forEach(log => {
            if (log.type === "log")
                console.log(log.msg);
            else if (log.type === "warn")
                console.warn(log.msg);
            else if (log.type === "error")
                console.error(log.msg);
            else
                throw new Error(`Unknown log type: ${log.type}`);
        });
    }
}

const logger = new Logger();

parentPort.on('message', (pkg) => {
    //console.log("parentPort.on('message', (pkg) => {");
    if (pkg === 'flush')
        logger.printLogs();
    else
        logger.addLog(pkg);
});

workerData.workerPorts.forEach(port => {
    port.on('message', (buffer) => {
        //console.log("workerData.workerPorts.forEach(port => {");
        logger.addLog(buffer);
    });
});
