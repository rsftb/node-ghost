'use strict';

const { Worker, isMainThread, workerData } = require('worker_threads');
const pathModule = require('path');
const fs = require('fs/promises');
const { createServer } = require('http');
const express = require('express');

const { parseArgs } = require('./src/parseArgs.js');
const { File, Dir } = require('./src/shared.js');
const { getIndexPage } = require('./src/index.js');

const cwd = process.cwd();
const args = parseArgs();

const [index_top, index_bottom, index_script] = getIndexPage(args.paths);

//const host = args.ip;
const port = args.port;
const paths = args.paths;

const app = express();
const server = createServer(app);



class FSWorkers
{
    constructor(nWorkers)
    {
        if (args.verbose)
            console.log(`[ghost/verbose] Setting up worker threads (${nWorkers}).`);

        this.tasks = [];    // TODO: Make a format for tasks
                            /**
                             * this.tasks = [
                             *     'C:/Users/username/Documents',
                             *     'C:/Users/username/Desktop'
                             * ]
                             *
                             * this.roots = {
                             *      'C:/Users/username/Documents': { Dir() },
                             *      'C:/Users/username/Documents/foo': { Dir() },
                             *      'C:/Users/username/Documents/foo/bar': { Dir() },
                             *      'C:/Users/username/Desktop': { Dir() },
                             *      'C:/Users/username/Desktop/foo': { Dir() }
                             * }
                             *
                             */
        this.roots = {};
        this.idle = [];
        this.workers = [];
        this.workersPromises = [];

        this.allPaths = new Set();
        this.pollLocked = false;
        this.nWorkers = nWorkers;
        this.iWorkers = 0;
        this.root;

        if (args.verbose)
        {
            let portsToWorkers = []

            for (let i = 0; i < nWorkers; i++)
            {
                let channel = new MessageChannel();
                portsToWorkers.push(channel.port1);
                this.addWorker(channel.port2);
            }

            this.logger = new Worker('./src/logger.js', { workerData: { workerPorts: portsToWorkers }, transferList: portsToWorkers });
            //this.logger.on('message', (pkg) => {});
        }
        else
        {
            for (let i = 0; i < nWorkers; i++)
                this.addWorker(null);
        }
    }

    addWorker(portToLogger)
    {
        const workerWrapped = new Promise((resolve, reject) => {

            const workerOptions = {
                workerData: { id: this.iWorkers++, verbose: args.verbose, loggerPort: portToLogger }
            };

            if (portToLogger)
                workerOptions.transferList = [portToLogger];

            const worker = new Worker('./src/walker.js', workerOptions);

            worker.on('message', (pkg) =>
            {
                if (args.verbose)
                {
                    let [seconds, nanoseconds] = process.hrtime();
                    this.logger.postMessage({ type: "log", msg: `├(main thread) Message received: ${JSON.stringify(pkg)}`, ts: seconds * 1e9 + nanoseconds });
                }


                let [seconds, nanoseconds] = process.hrtime();
                this.logger.postMessage({ type: "log", msg: `sync`, ts: seconds * 1e9 + nanoseconds });


                this.roots[pkg.parentPath] = new Dir(pkg.parentPath);
                this.roots[pkg.parentPath].add_child(...pkg.files.map((file) => new File(pathModule.resolve(file))));
                this.roots[pkg.parentPath].add_child(...pkg.dirs.map((dir) => new Dir(pathModule.resolve(dir))));
                this.allPaths.add(...pkg.files.map((file) => pathModule.resolve(pkg.parentPath, file)));
                this.allPaths.add(...pkg.dirs.map((dir) => pathModule.resolve(pkg.parentPath, dir)));
                this.tasks.push(...pkg.dirs.map((task) => pathModule.resolve(pkg.parentPath, task)));

                //console.log(this.tasks);

                const newTask = this.tasks.shift();

                if (newTask)
                {
                    worker.postMessage(newTask);
                    this.allPaths.add(newTask);
                }
                else
                    this.idle.push(worker); // swap worker from this.workers to this.idle

                // setImmediate(this.pollIdle.bind(this));

                if (this.idle.length && this.pollLocked === false)
                {
                    this.pollLocked = true;
                    let [seconds, nanoseconds] = process.hrtime();
                    this.logger.postMessage({ type: "log", msg: "🔒 pollIdle sem.", ts: seconds * 1e9 + nanoseconds });
                    setImmediate(() => {
                        this.pollIdle();
                        let [seconds, nanoseconds] = process.hrtime();
                        this.logger.postMessage({ type: "log", msg: "🔓 pollIdle sem.", ts: seconds * 1e9 + nanoseconds });
                        this.pollLocked = false;
                    });
                }

                if (this.idle.length === this.nWorkers)
                    this.idle.forEach((worker) => worker.terminate());

                if (args.verbose)
                {
                    let [seconds, nanoseconds] = process.hrtime();
                    this.logger.postMessage({ type: "log", msg: `unsync`, ts: seconds * 1e9 + nanoseconds });
                }
            });

            worker.on('error', (err) =>
            {
                let [seconds, nanoseconds] = process.hrtime();
                this.logger.postMessage({ type: "log", msg: `[ghost/worker-${workerData.id}/error] ${err}`, ts: seconds * 1e9 + nanoseconds });
                worker.terminate(); // this.addWorker();
            });

            worker.on('exit', (code) => { // console.error(`Worker stopped with exit code ${code}`);
                if (code > 1) // code !== 0?
                    reject(code);
                else
                    resolve(code);
            });

            this.idle.push(worker);
        });

        this.workersPromises.push(workerWrapped);
    }

    pollIdle()
    {
        if (this.idle.length === 0)
            return;

        for (let worker__ in this.idle)
        {
            let task = this.tasks.shift();
            if (task)
            {
                const worker = this.idle.shift();
                worker.postMessage(task);
                this.workers.push(worker);
            }
        }
    }

    async populateRoot(paths)
    {
        if (args.verbose)
            console.log(`[ghost/verbose] Populating root filesystem node.`);

        this.root = new Dir('root', 'root');

        for (let index = 0; index < paths.length; index++)
        {
            const path = paths[index];
            const stat = await fs.stat(path);

            if (stat.isFile())
            {
                this.root.add_child(new File(pathModule.basename(path), pathModule.resolve(path))); // ?
                this.allPaths.add(path);
                paths.splice(index, 1); // Remove the file path from the array
                index--; // Decrement index to account for the removed element
            }
            else if (stat.isDirectory())
                paths[index] = pathModule.resolve(path);
            else
                throw new Error(`[ghost/error] Entry '${path}' is not a file or a directory.`);
        }

        for (let path of paths)
        {
            this.tasks.push(path);
            this.allPaths.add(path);
        }

        for (let i = 0; i < this.tasks.length; i++) // modularize task assignment
        {
            let worker = this.idle.shift();

            if (worker)
            {
                let task = this.tasks.shift();
                worker.postMessage(task);
                this.workers.push(worker);
            }
        }

        await Promise.all(this.workersPromises).then((res) => {
            if (args.verbose)
            {
                this.logger.postMessage('flush');
                console.log(`\n[ghost/succes] Finished populating`);
                console.log(`Total paths scanned: ${this.allPaths.size}`);
                console.log(`Total roots: ${Object.keys(this.roots).length}`);
            }
            /*
            console.log(`this.tasks: ${JSON.stringify(this.tasks)}`);
            console.warn(`this.roots:`);
            for (const [key, root] of Object.entries(this.roots))
            {
                console.error(`   root[${key}]: ${root}`);
                console.error(`   root[${key}].children: ${root.get_children()}`);
            }
            console.log(`this.idle: ${[...JSON.stringify(this.idle)]}`);
            console.warn(`this.workers: ${[...JSON.stringify(this.workers)]}`);
            console.log(`this.workersPromises: ${this.workersPromises}`);
            //console.warn(`this.allPaths: ${[...this.allPaths]}`);
            console.log(`this.pollLocked: ${this.pollLocked}`);
            console.warn(`this.nWorkers: ${this.nWorkers}`);
            console.log(`this.root: ${this.root}`);
            */
            return;
        }).catch((err) => {
            console.error(`error: ${err}`);
            process.exit(err);
        });
    }

} // class FSWorkers


async function getIndexExplorerHTML()
{
    const pool = new FSWorkers(4);

    if (args.verbose)
        console.time("Populating root filesystem node");

    await pool.populateRoot(args.paths); // Use await here

    if (args.verbose)
        console.timeEnd("Populating root filesystem node");

    console.log("\npool.populateRoot() resolved");

    const root = pool.root;
    console.log(`root: ${root}`);

    return "succes" //root.toHTML();
}


async function buildIndex() {
    const res = await getIndexExplorerHTML(); // Use await here
    return index_top + res + index_bottom + index_script;
}


async function main()
{
    const index = await buildIndex();
//    console.log(`b: index:\n${index}`);

    app.use((req, res, next) => {
        if (args.verbose)
        {
            console.log(`[ghost/verbose] HTTP Request received\n    │`)
            console.warn(`    ├─Request line: ${res.statusCode} ${req.method} ${req.url}\n    ├─Headers: ${JSON.stringify(req.headers)}\n    └─Body: ${JSON.stringify(req.body)}\n`);
        }
        res.send(index);
    });

    server.listen(port, () => {
        console.log(`[ghost] Server is running on http://localhost:${port}`);
    });

    server.on('connect', (req, res) => {
        console.log(req);
        console.log(res);
    });
}


(async () => {
    try
    {
        await main();
    }
    catch (err)
    {
        console.error(err);
        process.exit(1);
    }
})();


/*
//app.use('/', express.static(path.join(__dirname, 'example')));

const buf = new ArrayBuffer(4028);
const view = new Uint8Array(buf);

//console.log(fs.createReadStream('./example'));
*/