"use strict";
const { read } = require('fs');

// strict mode, does not allow undeclared variables
if (process.argv.length < 3) {
    console.error("ERROR: Por favor, ejecutame con un primer argumento que especifique el fichero de logs con el que quieres trabajar.");
    return;
}

// Creates a stream for processing and outputing the read values 
const lineReader = require('readline').createInterface({
    input: require('fs').createReadStream(process.argv[2]),
    output: process.stdout,
    terminal: false
});

let reads = new Set();       // The set of pending reads
let reads_sTime = new Map(); // The start time of the read
let writes = {};             // Writes is an object, not a set.
let zones = {};              // Zones is an object, not a set.
let alphas = {};             // Alphas is an object, not a set.

// Function for every read line
lineReader.on('line', function (line) {
    // Initialize variables
    let event = JSON.parse(line);
    let result = "good";
    let id = event.id + "_" + event.n;

    // Enters on put (write) operation's invocation
    if (event.op == "put" && event.tipo_e == "inv") {
        // Create variables for value
        writes[event.valor] = []
        zones[event.valor] = []

        // Assing inital and finish times to write
        writes[event.valor].s = event.t;
        writes[event.valor].f = Infinity;

        // Assing endpoints to zone
        zones[event.valor].s = event.t;
        zones[event.valor].f = Infinity;

        // Assing nil to alpha
        alphas[event.valor] = null;
    }
    // Enters on put (write) operation's response
    else if (event.op == "put" && event.tipo_e == "res") {
        // Assing finish time for event
        writes[event.valor].f = event.t;

        // Assing finish time for zone
        zones[event.valor].f = Math.min(zones[event.valor].f, writes[event.valor].f)

        // Deletes every written value that is previous to the current written value
        for (let key in writes) {
            if (writes[key].f < writes[event.valor].s && alphas[key] == null) {
                alphas[key] = new Set([...reads].map(id => id));
                if (alphas[key].size == 0) {
                    delete writes[key];
                    delete zones[key];
                    delete alphas[key];
                }
            }
        }
    }
    // Enters on get (read) operation's invocation
    else if (event.op == "get" && event.tipo_e == "inv") {
        // Adds read to pending reads
        reads.add(id);

        // Assing start time for read
        reads_sTime.set(id, event.t);
    }
    // Enters on get (read) operation's response
    else if (event.op == "get" && event.tipo_e == "res") {
        // Checks if the value has been the last written one
        if (writes[event.valor] == undefined)
            result = "bad, there is no dictating write";
        // If not
        else {
            let zoneS = zones[event.valor].s;
            let zoneF = zones[event.valor].f;

            zones[event.valor].s = Math.max(zoneS, reads_sTime.get(id));
            zones[event.valor].f = Math.min(zoneF, event.t);

            reads_sTime.delete(id);

            for (let key in zones) {
                if (zones[key].f != Infinity && zones_conflict(event.valor)) {
                    result = "bad, zones conflict";
                    zones[event.valor].s = zoneS;
                    zones[event.valor].f = zoneF;
                }
            }
        }

        // Delete read from pending reads
        reads.delete(id);

        // Deletes every read that belongs to the alphas set
        for (let key in alphas) {
            if (alphas[key] != null && alphas[key].has(id)) {
                alphas[key].delete(id);
                if (alphas[key].size == 0) {
                    delete writes[key];
                    delete zones[key];
                    delete alphas[key];
                }
            }
        }

        console.log('‣ RESULT FOR EVENT', id, 'is', result);
    }
});

// Función para verificar conflictos entre zonas
function zones_conflict(valor) {
    let z1forward = zones[valor].f < zones[valor].s; // Verifica si la zona 1 es forward

    for (let key in zones) {
        if (key == valor)
            continue;

        if (zones[key].f != Infinity) {
            let z2forward = zones[key].f < zones[key].s; // Verifica si la zona 2 es forward

            if (z1forward && z2forward) {
                if (zones[valor].s > zones[key].f && zones[key].s > zones[valor].f) {
                    console.log('• Two forward zones overlap [Z1-' + key + '][Z1.f=' + zones[key].f + ', Z1.s=' + zones[key].s + '] and [Z2-' + valor + '][Z1.f=' + zones[valor].f + ', Z1.s=' + zones[valor].s + ']');
                    return true; // Hay conflictos entre las zonas
                }
                if (zones[key].s > zones[valor].f && zones[valor].s > zones[key].f) {
                    console.log('• Two forward zones overlap [Z1-' + valor + '][Z1.f=' + zones[valor].f + ', Z1.s=' + zones[valor].s + '] and [Z2-' + key + '][Z1.f=' + zones[key].f + ', Z1.s=' + zones[key].s + ']');
                    return true; // Hay conflictos entre las zonas
                }
            } else if (z1forward && !z2forward) {
                if (zones[valor].s > zones[key].f && zones[key].s > zones[valor].f ||
                    zones[key].s > zones[valor].f && zones[valor].s > zones[key].f) {
                    console.log('• A backward zone [Z1-' + key + '][Z1.f=' + zones[key].f + ', Z1.s=' + zones[key].s + '] is contained inside a forward zone [Z2-' + valor + '][Z1.f=' + zones[valor].f + ', Z1.s=' + zones[valor].s + ']')
                    return true; // Hay conflictos entre las zonas
                }
            } else if (!z1forward && z2forward) {
                if (zones[key].s > zones[valor].f && zones[valor].s > zones[key].f ||
                    zones[valor].s > zones[key].f && zones[key].s > zones[valor].f) {
                    console.log('• A backward zone [Z1-' + valor + '][Z1.f=' + zones[valor].f + ', Z1.s=' + zones[valor].s + '] is contained inside a forward zone [Z1-' + key + '][Z1.f=' + zones[key].f + ', Z1.s=' + zones[key].s + ']')
                    return true; // Hay conflictos entre las zonas
                }
            }
        }
    }
    return false; // No hay conflictos entre las zonas
}