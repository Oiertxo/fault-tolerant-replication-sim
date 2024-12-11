let log = document.getElementById("log");
let draggable = document.getElementById("logheader");

let reads = new Set();       // The set of pending reads
let reads_sTime = new Map(); // The start time of the read
let writes = {};             // Writes is an object, not a set.
let zones = {};              // Zones is an object, not a set.
let alphas = {};             // Alphas is an object, not a set.

let lineReader;
let fileInput = document.getElementById("fileInput");

fileInput.addEventListener("change", function (event) {
    draggable.innerHTML = '<h3>Log de los eventos de la historia <span>(arrastrable)</span></h3><br>';
    let file = event.target.files[0];
    let reader = new FileReader();

    reader.onload = function(e) {
        let lines = e.target.result.split('\n');
        lineReader = {
            on: function(event, callback) {
                if (event === 'line') {
                    lines.forEach(callback);
                } else if (event === 'close') {
                    callback();
                }
            }
        };

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

                draggable.innerHTML += '‣ RESULT FOR EVENT ' + id + ' is ' + result + '<br>';
            }
        });
        log.style.left = (window.innerWidth - log.offsetWidth) / 2 + "px";
        log.style.top = (window.innerHeight - log.offsetHeight) + "px";
    };

    reader.readAsText(file);
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
                    draggable.innerHTML += '• Two forward zones overlap [Z1-' + key + '][Z1.f=' + zones[key].f + ', Z1.s=' + zones[key].s + '] and [Z2-' + valor + '][Z1.f=' + zones[valor].f + ', Z1.s=' + zones[valor].s + ']<br>';
                    return true; // Hay conflictos entre las zonas
                }
                if (zones[key].s > zones[valor].f && zones[valor].s > zones[key].f) {
                    draggable.innerHTML += '• Two forward zones overlap [Z1-' + valor + '][Z1.f=' + zones[valor].f + ', Z1.s=' + zones[valor].s + '] and [Z2-' + key + '][Z1.f=' + zones[key].f + ', Z1.s=' + zones[key].s + ']<br>';
                    return true; // Hay conflictos entre las zonas
                }
            } else if (z1forward && !z2forward) {
                if (zones[valor].s > zones[key].f && zones[key].s > zones[valor].f ||
                    zones[key].s > zones[valor].f && zones[valor].s > zones[key].f) {
                    draggable.innerHTML += '• A backward zone [Z1-' + key + '][Z1.f=' + zones[key].f + ', Z1.s=' + zones[key].s + '] is contained inside a forward zone [Z2-' + valor + '][Z1.f=' + zones[valor].f + ', Z1.s=' + zones[valor].s + ']<br>';
                    return true; // Hay conflictos entre las zonas
                }
            } else if (!z1forward && z2forward) {
                if (zones[key].s > zones[valor].f && zones[valor].s > zones[key].f ||
                    zones[valor].s > zones[key].f && zones[key].s > zones[valor].f) {
                    draggable.innerHTML += '• A backward zone [Z1-' + valor + '][Z1.f=' + zones[valor].f + ', Z1.s=' + zones[valor].s + '] is contained inside a forward zone [Z1-' + key + '][Z1.f=' + zones[key].f + ', Z1.s=' + zones[key].s + ']<br>';
                    return true; // Hay conflictos entre las zonas
                }
            }
        }
    }
    return false; // No hay conflictos entre las zonas
}

/******************************************/

dragElement(log);

function dragElement(elmnt) {
    var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    if (document.getElementById(elmnt.id + "header")) {
        // If the header is present, make it the draggable area
        document.getElementById(elmnt.id + "header").onmousedown = dragMouseDown;
    } else {
        elmnt.onmousedown = dragMouseDown; // Otherwise, use the element itself
    }

    function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault();

        // Get the initial mouse cursor position
        pos3 = e.clientX;
        pos4 = e.clientY;

        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();

        // Calculate the new cursor position
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;

        // Calculate the new element position
        let newTop = elmnt.offsetTop - pos2;
        let newLeft = elmnt.offsetLeft - pos1;

        // Set boundaries for the element's movement
        const minLeft = 0;
        const minTop = 0;
        const maxLeft = window.innerWidth - elmnt.offsetWidth - 1;
        const maxTop = window.innerHeight - elmnt.offsetHeight;

        // Apply the clamped values to ensure the element stays within screen bounds
        elmnt.style.top = Math.max(minTop, Math.min(newTop, maxTop)) + "px";
        elmnt.style.left = Math.max(minLeft, Math.min(newLeft, maxLeft)) + "px";
    }

    function closeDragElement() {
        // Remove the event listeners when mouse is released
        document.onmouseup = null;
        document.onmousemove = null;
    }
}