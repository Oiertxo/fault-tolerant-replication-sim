/**
 * node manejador.js id_manejador "conjunto de ids de replicas separados por espacios"
 */
"use strict"
const conf = require("./config.json"),
    zmq = require('zeromq'),
    config = require('./config.json');

const RHid = process.argv[2];
const ORids = process.argv[3].split(" ");


// Crear, configurar y conectar el socket con el proxy hacia clientes
const sockCliente = zmq.socket('dealer');
sockCliente.identity = RHid;
sockCliente.connect(`tcp://127.0.0.1:${config.puerto_proxyCM_M}`);

// Crear, configurar y conectar el socket con el proxy hacia replicas
const sockReplica = zmq.socket('dealer');
sockReplica.identity = RHid;
sockReplica.connect(`tcp://127.0.0.1:${conf.puerto_proxyMR_M}`);

// Crear, configurar y conectar el socket con el secuenciador
const sockSecuenciador = zmq.socket('dealer');
sockSecuenciador.identity = RHid;
sockSecuenciador.connect(`tcp://127.0.0.1:${conf.puerto_secuenciador}`);

// STATE variables
const sequenced = [],
    myCommands = new Set(),
    myReplies = new Set();
let localSeq = 1,
    lastServedSeq = 0;

//ACTIONS
sockCliente.on("message", (...args) => {
    if (args[1]) {
        try {
            const msg = JSON.parse(args[1]);
            if (msg.dest === RHid && msg.tag === "REQUEST") {
                let seq = sequenced.indexOf(msg.cmd);
                if (seq === -1) {       // El comando no está secuenciado:
                    TOBroadcast({ RHid: RHid, cmd: msg.cmd });      // Secuenciar
                    myCommands.add(msg.cmd);
                } else { //El comando ya está secuenciado
                    TransmitToReplicas(seq, msg.cmd, lastServedSeq);
                    myReplies.add(seq);
                    lastServedSeq = Math.max(lastServedSeq, seq);
                }
            }
        } catch (e) {
            console.log(`[Manejador] Falied parsing message from client: ${e}`);
        }
    } else {
        console.error("[Manejador] Unexpected message format from client: ", args);
    }
});

sockSecuenciador.on("message", (...args) => {
    if (args[1]) {
        try {
            const m = JSON.parse(args[1]);  // m = {m.rhid, m.cmd}
            let seq = sequenced.indexOf(m.cmd);
            if (seq === -1) {       // No estaba secuenciado aun
                sequenced[localSeq] = m.cmd;
                seq = localSeq;
                localSeq++;
            }

            if (myCommands.has(m.cmd)) {        // Si lo ha emitido este manejador
                TransmitToReplicas(seq, m.cmd, lastServedSeq);
                myCommands.delete(m.cmd);
                myReplies.add(m.cmd);
                lastServedSeq = Math.max(seq, lastServedSeq);
            }

        } catch (e) {
            console.log(`[Manejador] Falied parsing message from sequencer: ${e}`);
        }
    } else {
        console.error("[Manejador] Unexpected message format from sequencer: ", args);
    }
});

sockReplica.on("message", (...args) => {
    if (args[1]) {
        try {
            const m = JSON.parse(args[1]);
            if (m.dest === RHid && m.tag === "TOREPLY" && myReplies.has(m.seq)) {
                const new_m = {
                    ...m,
                    source: RHid,
                    dest: m.cmd.cltid,
                    tag: "REPLY"
                };
                sockCliente.send(['', JSON.stringify(new_m)]);
                myReplies.delete(m.seq);
            }
        } catch (e) {
            console.log(`[Manejador] Falied parsing message from replica: ${e}`);

        }
    } else {
        console.error("[Manejador] Unexpected message format from replica: ", args);
    }
});

function TransmitToReplicas(seq, cmd, lastServedSeq) {
    for (let j = lastServedSeq; j < seq; j++) {
        let cmd_j = sequenced[j];
        ORids.forEach(ORid => {
            const msg = {
                source: RHid,
                dest: ORid,
                tag: "TOREQUEST",
                seq: j,
                cmd: cmd_j,
                res: null
            };
            sockReplica.send(['', JSON.stringify(msg)]);
        });
    }
    ORids.forEach(ORid => {
        const msg = {
            source: RHid,
            dest: ORid,
            tag: "TOREQUEST",
            seq: seq,
            cmd: cmd,
            res: null
        }
        sockReplica.send(['', JSON.stringify(msg)]);
    });
}

function TOBroadcast(cmd) {
    sockSecuenciador.send(['', JSON.stringify(cmd)]);
}

// Cierra el socket correctamente al recibir una señal de interrupción
process.on('SIGINT', function () {
    console.log('[Manejador] Shutting down...');
    sockCliente.close();
    sockReplica.close();
    sockSecuenciador.close();
});

process.on('SIGTERM', function () {
    console.log('[Manejador] Shutting down...');
    sockCliente.close();
    sockReplica.close();
    sockSecuenciador.close();
});