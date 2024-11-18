/**
 * node proxyMR.js
 */

"use strict"

const zmq = require('zeromq'),
    conf = require("./config.json");

const ip_manejadores = `tcp://127.0.0.1:${conf.puerto_proxyMR_M}`,
    ip_replicas = `tcp://127.0.0.1:${conf.puerto_proxyMR_R}`;

const replcaRouter = zmq.socket('router');
replcaRouter.bind(ip_replicas, function (err) {
    if (err) throw err;
    console.log(`[ProxyMR] Replica router bound to ${ip_replicas}`);
});

const handlerRouter = zmq.socket('router');
handlerRouter.bind(ip_manejadores, function (err) {
    if (err) throw err;
    console.log(`[ProxyMR] Handler router bound to ${ip_manejadores}`);
});

replcaRouter.on('message', function (...args) {
    const [, , messageBuffer] = args;
    try {
        const message = JSON.parse(messageBuffer);
        handlerRouter.send([message.dest, '', messageBuffer]);
    } catch (err) {
        console.error('[ProxyMR] Failed to parse JSON from replica:', err);
    }
});

handlerRouter.on('message', function (...args) {
    const [, , messageBuffer] = args;
    try {
        const message = JSON.parse(messageBuffer);
        replcaRouter.send([message.dest, '', messageBuffer]);
    } catch (err) {
        console.error('[ProxyMR] Failed to parse JSON from handler:', err);
    }
});

process.on('SIGINT', function () {
    console.log('[ProxyMR] Shutting down...');
    replcaRouter.close();
    handlerRouter.close();
});

process.on('SIGTERM', function () {
    console.log('[ProxyMR] Shutting down...');
    replcaRouter.close();
    handlerRouter.close();
});
