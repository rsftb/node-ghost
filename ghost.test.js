const { Worker } = require('worker_threads');
const pathModule = require('path');
const { FSWorkers } = require('./ghost'); // Adjust the import based on your actual file structure

// minihost.test.js

jest.mock('worker_threads', () => {
    const mWorker = {
        on: jest.fn(),
        postMessage: jest.fn(),
        terminate: jest.fn(),
    };
    return { Worker: jest.fn(() => mWorker) };
});

describe('FSWorkers', () => {
    let fsWorkers;

    beforeEach(() => {
        fsWorkers = new FSWorkers(4);
    });

    test('should add a new task and process it', () => {
        const task = 'C:/Users/username/Documents';
        fsWorkers.tasks.push(task);
        fsWorkers.pollIdle();

        expect(fsWorkers.idle.length).toBe(3); // One worker should be busy
        expect(fsWorkers.workers.length).toBe(1); // One worker should be working
        expect(fsWorkers.workers[0].postMessage).toHaveBeenCalledWith(task);
    });

    test('should handle new task message from worker', () => {
        const worker = fsWorkers.idle[0];
        const pkg = {
            parentPath: 'C:/Users/username/Documents',
            files: ['file1.txt', 'file2.txt'],
            dirs: ['dir1', 'dir2'],
        };

        worker.on.mock.calls[0][1](pkg); // Simulate message event

        expect(fsWorkers.roots[pkg.parentPath]).toBeDefined();
        expect(fsWorkers.tasks.length).toBe(2); // Two new directories added as tasks
        expect(fsWorkers.allPaths.size).toBe(4); // Two files and two directories
    });

    test('should terminate all workers when all tasks are done', async () => {
        fsWorkers.tasks = [];
        fsWorkers.idle = fsWorkers.workers; // Simulate all workers being idle

        await fsWorkers.populateRoot(['C:/Users/username/Documents']);

        fsWorkers.idle.forEach((worker) => {
            expect(worker.terminate).toHaveBeenCalled();
        });
    });
});