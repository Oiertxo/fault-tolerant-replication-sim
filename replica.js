/**
 * EJECUCION
 * node replica.js nombre_objeto nombre_bbdd
 */
"use strict"

const zmq = require('zeromq');
const { Level } = require('level');

// Lectura de la configuración
const config = require('./config.json');

// Configuración e inicialización del socket y la base de datos
const sock = zmq.socket('dealer');

// El segundo primer argumento es el nombre del objeto
sock.identity = process.argv[2];

// El segundo argumento es el nombre de la base de datos del objeto
const db = new Level(`./bbdd/${process.argv[3]}`);

// Conectar con el proxy
sock.connect("tcp://127.0.0.1:" + config.puerto_proxyMR_R);

// Variables para objetos replicados
let toexecute = []; // a vector of pairs (rhid, cmd). The first index is 1. Initially, ∀i : toexecute[i] = null;
let executed = [];  // a vector of pairs (cmd, res). The first index is 1. Initially, ∀i : executed[i] = null;
let expectseq = 1;  // a positive integer. It indicates the first null position in toexecute. Initially, expectseq = 1

// Función para manejar mensajes recibidos
sock.on('message', function (...args) {
    const message = JSON.parse(args[1].toString());

    // Comprobar formato del mensaje
    if (!message) {
        console.error("[Replica] Invalid message format.");
        return;
    }

    // Descartar mensajes no dirigidos a este objeto o con secuencia incorrecta
    if (message.dest !== process.argv[2] || message.tag !== "TOREQUEST" || message.seq <= 0) {
        console.error("[Replica] The message is discarded.");
        return;
    }

    // Comprobar si el mensaje es el esperado
    if (message.seq === expectseq) {
        toexecute[expectseq] = { source: message.source, cmd: message.cmd };

        // Ejecutar los comandos pendientes
        while (toexecute[expectseq] !== null) {
            // Obtener el comando a ejecutar
            let { rhid, cmd } = toexecute[expectseq];

            // Ejecutar el comando
            let res = Execute(cmd);

            // Añadir comando a executed
            executed[expectseq] = { cmd: cmd, res: resp_message.res };

            // Preparar el mensaje de respuesta
            const resp_message = {
                source: process.argv[2],
                dest: rhid,
                tag: "TOREPLY",
                seq: expectseq,
                cmd: cmd,
                res: res,
            };

            // Enviar la respuesta
            sock.send(['', JSON.stringify(resp_message)]);

            // Actualizar expectseq
            expectseq++;
        }
    }

    // Si el mensaje es para ejecutar en el futuro
    else if (expectseq < message.seq) {
        // Almacenar el mensaje para ejecutarlo más tarde
        toexecute[message.seq] = { source: message.source, cmd: message.cmd };
    }

    // Si el mensaje ya fue ejecutado
    else {
        // Obtener el comando ejecutado
        let { cmd, res } = executed[message.seq];

        // Preparar el mensaje de respuesta
        let msgres = {
            'source': process.argv[2],
            'dest': message.source,
            'tag': "TOREPLY",
            'seq': message.seq,
            'cmd': cmd,
            'res': res
        };

        // Enviar la respuesta
        sock.send(['', JSON.stringify(msgres)]);
    }
});

// Función para ejecutar comandos
function Execute(cmd) {
    let res = null;

    switch (cmd.op.name) {
        case "put":
            const [key, value] = cmd.op.args.split(" ");
            db.put(key, value, (err) => {
                res = err ? `Error: ${err.message}` : 'OK';
            });
            break;
        case "get":
            db.get(cmd.op.args, (err, value) => {
                res = err ? `Error: ${err.message}` : value;
            });
            break;
        default:
            res = `Error: unsupported operation: ${cmd.op.name}`;
            break;
    }

    return res;
}

// Cierra el socket correctamente al recibir una señal de interrupción
process.on('SIGINT', function () {
    console.log('Shutting down server...');
    sock.close();
});

process.on('SIGTERM', function () {
    console.log('Shutting down server...');
    sock.close();
});