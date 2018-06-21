#!/usr/bin/env bash

mkdir ../testcafe
cd ../testcafe
git clone https://github.com/AlexKamaev/testcafe -b gh-2056

npm install testcafe-hammerhead ../testcafe-hammerhead --save
npm i --loglevel error

export GULP_TASK="test-functional-local-headless"
npm test
