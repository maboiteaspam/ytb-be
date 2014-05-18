#!/usr/bin/env node

var exec = require('child_process').exec,
  child;

child = exec('youtube-dl --version',
  function (error, stdout, stderr) {
    if (error !== null) {
      console.error('youtube-dl not found in your system');
      console.info('stdout: ' + stdout);
      console.info('stderr: ' + stderr);
      console.info('exec error: ' + error);
    }
  });