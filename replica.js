/**
 * EJECUCION
 * node objeto.js nombre_objeto nombre_bbdd
 */
"use strict"

const zmq = require('zeromq');
const { Level } = require('level');

// Configuración e inicialización del socket y la base de datos
const sock = zmq.socket('dealer');

// El segundo primer argumento es el nombre del objeto
sock.identity = process.argv[2];

// El segundo argumento es el nombre de la base de datos del objeto
const db = new Level(`./BBDD/${process.argv[3]}`);

sock.connect("tcp://127.0.0.1:2221");

// Función para manejar mensajes recibidos
sock.on('message', function (...args) {
    const message = JSON.parse(args[1].toString());

    if (!message) {
        console.error("Invalid message format.");
        return;
    }

    console.log(message.dest,
        `\x1b[32m: Solicitud recibida de\x1b[0m ${message.source}\x1b[32m. Ejecutando en base de datos\x1b[0m`);

    // Preparar el mensaje de respuesta
    const resp_message = {
        ...message,
        tag: "REPLY",
        source: sock.identity,
        dest: message.source
    };


    // Manejar operación 'get'
    if (message.cmd.op.name === 'get') {
        db.get(message.cmd.op.args, (err, value) => {
            resp_message.res = err ? `error: ${err.message}` : value;
            sock.send(['', JSON.stringify(resp_message)]);
        });
    }
    // Manejar operación 'put'
    else if (message.cmd.op.name === 'put') {
        const [key, value] = message.cmd.op.args.split(" ");
        db.put(key, value, (err) => {
            resp_message.res = err ? `error: ${err.message}` : 'OK';
            sock.send(['', JSON.stringify(resp_message)]);
        });
    } else {
        resp_message.res = `error: unsupported operation ${message.cmd.op.name}`;
        sock.send(['', JSON.stringify(resp_message)]);
    }
});

// Cierra el socket correctamente al recibir una señal de interrupción
process.on('SIGINT', function () {
    console.log('Shutting down server...');
    sock.close();
});

process.on('SIGTERM', function () {
    console.log('Shutting down server...');
    sock.close();
});
