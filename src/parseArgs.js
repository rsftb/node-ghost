'use strict';

const fs = require('node:fs');
const commandLineUsage = require('command-line-usage');
const commandLineArgs  = require('command-line-args');


const optionDefinitions = [
    {
        name: 'help',
        alias: 'h',
        type: Boolean,
        description: 'Shows this help menu.',
        group: 'unique'
    },
    {
        name: 'version',
        alias: 'v',
        type: Boolean,
        description: 'Prints the version number.',
        group: 'unique'
    },
    {
        name: 'verbose',
        alias: 'V',
        type: Boolean,
        description: 'Prints additional information.',
        group: 'main',
        //defaultValue: false
    },
    {
        name: 'port',
        type: Number,
        description: 'Port to run the server on (default: 3550).',
        group: 'ip_addr_separate',
    },
    {
        name: 'ip',
        type: String,
        description: 'IP used to host the server on (default: localhost).',
        group: 'ip_addr_separate',
    },
    {
        name: 'addr',
        type: String,
        description: 'Alternate way of passing an address (default: localhost:3550).',
        group: 'ip_addr_combined'
    },
    {
        name: 'paths',
        type: String,
        multiple: true,
        defaultOption: true,
        description: 'Paths to folders and files to host.',
        group: 'main'
    }
];


const helpMenuSections = [
    {
        header: 'ghost',
        content: 'a simple to use file server. host locally and publically with ease.'
    },
    {
        header: 'Options',
        optionList: optionDefinitions,
    },
    {
        header: 'Usage',
        content: {
            data: [
                { colA: 'The simplest way to run ghost is via `ghost [directories...]`. By default, this will use `localhost:3550` as the IP address.', colB: 'Alternatively, either run `ghost --addr <ip>:<port> [directories ...]` or run `ghost --ip <ip> --port <port> [directories ...]`.'},
                { colA: 'Hosted content is downloadable through command line tools such as curl, wget, HTTPie, etc.', colB: 'Entering the host address into a browser opens a website where you can view and download your data.' },
            ],
            options: {
                columns: [
                    { name: 'data', noWrap: true},
                ]
            }
        }
    }
]


// Parse command line arguments for options and errors
function parseArgs()
{
    const options = commandLineArgs(optionDefinitions);
    const help_menu = commandLineUsage(helpMenuSections);

    if (options.main.verbose)
        console.log('[ghost/verbose] Parsing command line arguments...');

    if (process.argv.length === 2)
    {
        console.log('Usage: ghost <directory>, ...\nTry \'ghost --help\' for more information.');
        process.exit(0);
    }

    else if (Object.keys(options.unique).length > 0)
    {
        if (options.main ? Object.keys(options.main).length : 0)
        {
            console.error('[ghost/error] Please refrain from passing help options and program options at the same time.');
            process.exit(1);
        }

        if (options.unique.help)
            console.log(help_menu);
        if (options.unique.version)
            console.log('ghost v1.0.1');

        process.exit(0);
    }

    // (options.main)

    if (Object.hasOwn(options.main, "paths") === false)
    {
        console.error('[ghost/error] No paths were passed.');
        process.exit(1);
    }

    for (const dir of options.main.paths) // check for duplicated paths
    {
        if (!fs.existsSync(dir))
        {
            console.error(`[ghost/error] Couldn't find path '${dir}'.`);
            process.exit(1);
        }
    }

    // Default
    let ip = "localhost";
    let port = 3550;

    if (Object.keys(options.ip_addr_separate).length > 0 && Object.keys(options.ip_addr_combined).length === 1)
    {
        console.error('[ghost/error] Either set both [--ip, --port] or use [--addr].');
        process.exit(1);
    }
    else if (Object.keys(options.ip_addr_separate).length > 0)
    {
        if (typeof options.ip_addr_separate.ip !== "string" || typeof options.ip_addr_separate.port !== "number")
        {
            console.error('[ghost/error] Please pass both `--ip` and `--port`.');
            process.exit(1);
        }

        ip = options.ip_addr_separate.ip;
        port = options.ip_addr_separate.port;
    }
    else if (Object.keys(options.ip_addr_combined).length > 0)
    {
        [ip, port] = options.ip_addr_combined.addr.split(':');
    }

    if (options.main.verbose)
    {
        console.log(`[ghost/succes] Well formed input!\n`);
        console.log(`   ip: ${ip}`);
        console.log(`   port: ${port}`);
        console.log(`   paths: ${options.main.paths}\n`);
    }

    return {
        "paths": options.main.paths,
        "ip": ip,
        "port": port,
        "verbose": options.main.verbose
    };
}


module.exports = { parseArgs };
