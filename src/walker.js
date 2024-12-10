'use strict';

const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const pathModule = require('path');


function walkDir(path)
{
    let dirs = [];
    let files = [];

    fs.readdirSync(path, {withFileTypes: true}).forEach(entry => {
        if (entry.isDirectory())
            dirs.push(entry.name);
        else if (entry.isFile())
            files.push(entry.name);
        else
        {
            let [seconds, nanoseconds] = process.hrtime();
            workerData.loggerPort.postMessage({ type: "warn", msg: `├[ghost/worker-${workerData.id}/warning] Path '${pathModule.resolve(entry.name)}' is not a file or directory, skipping...`, ts: seconds * 1e9 + nanoseconds });
        }
    });

    return [dirs, files];
}


/**
 * pkg: {
 *    parentPath: string (path),
 *    taskBase:   string (basename)
 * }
*/

parentPort.on('message', (path) => {
    const [dirs, files] = walkDir(pathModule.resolve(path));
    if (workerData.verbose)
    {
        let [seconds, nanoseconds] = process.hrtime();
        workerData.loggerPort.postMessage({ type: "log", msg: `├{worker-${workerData.id}/log} Task complete, '${path}' has ${dirs.length} directories and ${files.length} files.`, ts: seconds * 1e9 + nanoseconds });
    }
    parentPort.postMessage({ parentPath: path, dirs: dirs, files: files });
});
