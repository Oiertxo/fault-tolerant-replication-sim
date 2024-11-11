"use strict"

const zmq = require('zeromq');

// Direcciones para los sockets de los clientes
const routerIp = "tcp://127.0.0.1:1112";

// Inicialización del router
const router = zmq.socket('router');
router.bind(routerIp, function (err) {
    if (err) throw err;
    console.log(`Central node bound to ${routerIp}`);
});

// Set hardcodeado con los clientes
const KNOWN_CLIENTS = new Set(["c1", "c2", "c3", "c4"]);

// Función de callback para el router frontend
router.on('message', function (...args) {
    const [id, , messageBuffer] = args;
    
    try {
        const message = JSON.parse(messageBuffer.toString());
        // Broadcast de un cliente
        if (message.type === "broadcast"){
            for (let idCliente of KNOWN_CLIENTS.values()){
                router.send([idCliente, "", JSON.stringify(message)]);
            }
        }
        else{
            console.error("Mensaje de tipo desconocido: ", message.type);
        }
        
    } catch (err) {
        console.error('Failed to parse JSON from client:', err);
    }
});

// Manejo de la señal de interrupción para cerrar los sockets correctamente
process.on('SIGINT', function() {
    console.log('Shutting down central node...');
    router.close();
});

process.on('SIGTERM', function() {
    console.log('Shutting down central node...');
    router.close();
});
