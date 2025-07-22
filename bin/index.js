#!/usr/bin/env node

function main() {
  try {
    const { run } = require('../dist/index');
    run();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main(); 