/**
 * node secuenciador.js "Conjunto de manejadores separados por espacios"
 */
"use strict"

const zmq = require('zeromq'),
    conf = require("./config.json");

// Direcciones para los sockets de los clientes
const routerIp = `tcp://127.0.0.1:${conf.puerto_secuenciador}`;

// Inicialización del router
const router = zmq.socket('router');
router.bind(routerIp, function (err) {
    if (err) throw err;
    console.log(`Secuenciador bound to ${routerIp}`);
});

// Manejadores
const RHids = process.argv[2].split(" ");

router.on('message', function (...args) {
    const [id, , messageBuffer] = args;

    try {
        const message = JSON.parse(messageBuffer.toString());
        // Broadcast de un cliente
        if (message.type === "broadcast") {
            for (let idCliente of RHids) {
                router.send([idCliente, "", JSON.stringify(message)]);
            }
        }
        else {
            console.error("[Secuenciador] Mensaje de tipo desconocido: ", message.type);
        }

    } catch (err) {
        console.error('[Secuenciador] Failed to parse JSON from client:', err);
    }
});

// Manejo de la señal de interrupción para cerrar los sockets correctamente
process.on('SIGINT', function () {
    console.log('Shutting down secuenciador...');
    router.close();
});

process.on('SIGTERM', function () {
    console.log('Shutting down secuenciador...');
    router.close();
});
