let canvas = document.getElementById("canvas");
let ctx = canvas.getContext("2d");

// Variables para estilado de canvas
canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;

ctx.font = `20px Verdana`;
ctx.fillStyle = `black`;

let metrics = ctx.measureText('C1');
let fontHeight = metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent;

let timelapseWidth = 60;
let processHeight = 60;
let lineWidth = 3;
let timeTextWidth = timelapseWidth / 10;
let processTextHeight = fontHeight * 2;

let initial_x_timeline = 80;
let initial_x_processes = 20;
let initial_y_timeline = 40;
let initial_y_processes = 80;

let lineReader;
let fileInput = document.getElementById("fileInput");

fileInput.addEventListener("change", function (event) {
    let file = event.target.files[0];
    let reader = new FileReader();

    reader.onload = function (e) {
        let lines = e.target.result.split('\n');
        lineReader = {
            on: function (event, callback) {
                if (event === 'line') {
                    lines.forEach(callback);
                } else if (event === 'close') {
                    callback();
                }
            }
        };

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let events = new Map();

        lineReader.on('line', function (line) {
            let event = JSON.parse(line);
            let id = event.id + "_" + event.n;
            if (events.has(id)) {
                events.get(id).push(event);
            } else {
                events.set(id, [event]);
            }
        });

        lineReader.on('close', function () {
            let maxS = 0;
            let maxF = 0;
            let groupedEvents = new Map();

            events.forEach((value, key) => {
                if (value[0].t > maxS) {
                    maxS = value[0].t;
                }
                if (value[1].t > maxF) {
                    maxF = value[1].t;
                }
                let baseId = value[0].id;
                if (!groupedEvents.has(baseId)) {
                    groupedEvents.set(baseId, []);
                }
                groupedEvents.set(baseId, groupedEvents.get(baseId).concat(value));
            });

            for (let i = 0; i < maxF; i++) {
                ctx.fillStyle = 'black';
                ctx.fillText(i + 1, initial_x_timeline + i * timelapseWidth, initial_y_timeline);
            }

            let nProcess = -1;

            ctx.beginPath();
            ctx.moveTo(initial_x_timeline, initial_y_processes + processHeight * nProcess + processHeight / 2);
            ctx.lineTo(initial_x_timeline + timelapseWidth * (maxF - 1) + 30, initial_y_processes + processHeight * nProcess + processHeight / 2);
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'grey';
            ctx.stroke();

            nProcess++;

            groupedEvents.forEach((value, key) => {
                let current = 0;
                ctx.fillStyle = 'black';
                ctx.fillText(key, initial_x_processes, initial_y_processes + processHeight * nProcess + processHeight / 5);

                ctx.beginPath();
                ctx.moveTo(initial_x_timeline, initial_y_processes + processHeight * nProcess + processHeight / 2);
                ctx.lineTo(initial_x_timeline + timelapseWidth * (maxF - 1) + 30, initial_y_processes + processHeight * nProcess + processHeight / 2);
                ctx.lineWidth = 1;
                ctx.strokeStyle = 'grey';
                ctx.stroke();

                while (current < value.length) {
                    if (current % 2 == 1) {
                        let start = value[current - 1].t;
                        let end = value[current] ? value[current].t : maxF;

                        // Draw the middle line between the two points
                        ctx.beginPath();
                        ctx.moveTo(initial_x_timeline + (start - 1) * timelapseWidth + timeTextWidth, initial_y_timeline + processHeight * nProcess + processTextHeight);
                        ctx.lineTo(initial_x_timeline + (end - 1) * timelapseWidth + timeTextWidth, initial_y_timeline + processHeight * nProcess + processTextHeight);
                        ctx.lineWidth = lineWidth;
                        ctx.strokeStyle = 'black';
                        ctx.stroke();

                        // Draw the value of the event in the middle of the line only if it's a response
                        if (value[current].tipo_e === 'res') {
                            let middleX = (initial_x_timeline + (start - 1) * timelapseWidth + timeTextWidth + initial_x_timeline + (end - 1) * timelapseWidth + timelapseWidth / 10) / 2;
                            let middleY = initial_y_timeline + processHeight * nProcess + processTextHeight - 10;
                            ctx.fillStyle = 'blue';
                            let text = (value[current].op === 'put' ? 'W(' : 'R(') + value[current].valor + ')';
                            let textMetrics = ctx.measureText(text);
                            let textWidth = textMetrics.width / 2;
                            ctx.fillText(text, middleX - textWidth, middleY);
                        }

                        // Draw the start circle
                        ctx.beginPath();
                        ctx.arc(initial_x_timeline + (start - 1) * timelapseWidth + timeTextWidth, initial_y_timeline + processHeight * nProcess + processTextHeight, lineWidth, 0, Math.PI * 2, true);
                        ctx.fillStyle = 'red';
                        ctx.fill();
                        ctx.closePath();

                        // Draw the end circle
                        ctx.beginPath();
                        ctx.arc(initial_x_timeline + (end - 1) * timelapseWidth + timeTextWidth, initial_y_timeline + processHeight * nProcess + processTextHeight, lineWidth, 0, Math.PI * 2, true);
                        ctx.fillStyle = 'red';
                        ctx.fill();
                        ctx.closePath();
                    }

                    current++;
                }
                nProcess++;
            });
        });
    };

    reader.readAsText(file);

});