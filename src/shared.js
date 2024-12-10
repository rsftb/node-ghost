'use strict';

const pathModule = require('path');

class Dir {
    constructor(absolutePath) {
        this.basename = pathModule.basename(absolutePath);
        this.path = absolutePath;
        this.children = [];
    }

    add_child(child) {
        this.children.push(child);
    }

    get_children() {
        return this.children;
    }
}

class File {
    constructor(absolutePath) {
        this.basename = pathModule.basename(absolutePath);
        this.path = absolutePath;
    }
}

module.exports = { Dir, File };