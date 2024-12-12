/**
 * node proxyCM.js
*/

"use strict"

const zmq = require('zeromq'),
    conf = require("./config.json");

const ip_clientes = `tcp://127.0.0.1:${conf.puerto_proxyCM_C}`,
    ip_manejadores = `tcp://127.0.0.1:${conf.puerto_proxyCM_M}`;

const clientRouter = zmq.socket('router');
clientRouter.bind(ip_manejadores, function (err) {
    if (err) throw err;
    console.log(`[ProxyCM] Client router bound to ${ip_clientes}`);
});

const handlerRouter = zmq.socket('router');
handlerRouter.bind(ip_clientes, function (err) {
    if (err) throw err;
    console.log(`[ProxyCM] Handler router bound to ${ip_manejadores}`);
});

let START_TIME = process.hrtime();

clientRouter.on('message', function (...args) {
    const [, , messageBuffer] = args;
    try {
        const message = JSON.parse(messageBuffer);
        let tiempo = process.hrtime(START_TIME);
        message.tiempo_inicio = tiempo[0] * 1e9 + tiempo[1];
        handlerRouter.send([message.dest, '', messageBuffer]);
    } catch (err) {
        console.error(`[ProxyCM] Failed to parse JSON from backend: `, err);
    }
});

handlerRouter.on('message', function (...args) {
    const [, , messageBuffer] = args;
    try {
        const message = JSON.parse(messageBuffer);
        let tiempo = process.hrtime(START_TIME);
        message.tiempo_final = tiempo[0] * 1e9 + tiempo[1];
        clientRouter.send([message.dest, '', messageBuffer]);
    } catch (err) {
        console.error('[ProxyCM] Failed to parse JSON from handler:', err);
    }
});

process.on('SIGINT', function () {
    console.log('[ProxyCM] Shutting down...');
    clientRouter.close();
    handlerRouter.close();
});

process.on('SIGTERM', function () {
    console.log('[ProxyCM] Shutting down...');
    clientRouter.close();
    handlerRouter.close();
});
