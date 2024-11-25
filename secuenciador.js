/**
 * node secuenciador.js
 */
"use strict"

const zmq = require('zeromq'),
    conf = require("./config.json");

// Ids de los manejadores
const nRHs = conf.manejadores,
    RHids = [];

for (let i = 1; i <= nRHs; i++) {
    RHids[i - 1] = `M${i}`;
}

// Direcciones para los sockets de los clientes
const routerIp = `tcp://127.0.0.1:${conf.puerto_secuenciador}`;

// Inicialización del router
const router = zmq.socket('router');
router.bind(routerIp, function (err) {
    if (err) throw err;
    console.log(`[Secuenciador] Router bound to ${routerIp}`);
});

let localSeq = 1;

router.on('message', function (...args) {
    const [id, , messageBuffer] = args;

    try {
        const message = JSON.parse(messageBuffer.toString());
        message.seq = localSeq;

        for (let RHid of RHids) {
            router.send([RHid, "", JSON.stringify(message)]);
        }

        localSeq++;
    } catch (err) {
        console.error('[Secuenciador] Failed to parse JSON from client:', err);
    }
});

// Manejo de la señal de interrupción para cerrar los sockets correctamente
process.on('SIGINT', function () {
    console.log('[Secuenciador] Shutting down secuenciador...');
    router.close();
});

process.on('SIGTERM', function () {
    console.log('[Secuenciador] Shutting down secuenciador...');
    router.close();
});
