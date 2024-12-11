## Para ejecutar el sistema: ## bash ejecutar.sh

# Limpiar logs y bases de datos
rm logs/ -r;
rm dbs/ -r;

# Crear directorios
mkdir logs;

##### Ejecutar sistema #####

# Ejecutar proxys
node proxyCM.js &
proxyCM=$!

node proxyMR.js &
proxyMR=$!

# Dar tiempo a que los proxys se inicialicen
sleep .1;

# Ejecutar secuenciador
node secuenciador.js &
secuenciador=$!

# Dar tiempo a que el secuenciador se inicialice
sleep .1;

# Ejecutar manejadores
numManejadores=$(grep '"manejadores"' config.json | awk -F': ' '{print $2}' | tr -d ', ')


# Crear un array para almacenar los PIDs de cada manejador
declare -a manejadores

for i in $(seq 1 $numManejadores)
do
    node manejador.js M$i &
    manejadores[$i]=$!
done

# Dar tiempo a que los manejadores se inicialicen
sleep .1;

# Ejecutar replicas
numReplicas=$(grep '"replicas"' config.json | awk -F': ' '{print $2}' | tr -d ', ')


# Crear un array para almacenar los PIDs de cada replica
declare -a replicas

for i in $(seq 1 $numReplicas)
do
    node replica.js R$i db$i &
    replicas[$i]=$!
done

# Dar tiempo a que las replicas se inicialicen
sleep .1;

# Ejecutar clientes
numClientes=$(grep '"clientes"' config.json | awk -F': ' '{print $2}' | tr -d ', ')


# Crear un array para almacenar los PIDs de cada cliente
declare -a clientes

for i in $(seq 1 $numClientes)
do
    node cliente.js C$i > logs/C$i.log &  
    clientes[$i]=$!
done

# Esperar a que se entreguen varios mensajes
sleep .15;

# Matar procesos
kill $proxyCM;
kill $proxyMR;
kill $secuenciador;

for i in $(seq 1 $numManejadores)
do
    kill ${manejadores[$i]};
done;
sleep .1;

for i in $(seq 1 $numReplicas)
do
    kill ${replicas[$i]};
done;
sleep .1;

for i in $(seq 1 $numClientes)
do
    kill ${clientes[$i]};
done;
sleep .1;

echo "Finalizado";

node unify_logs.js > logs/unified_logs.log;

sleep .1;

node atomicity.js logs/unified_logs.log > logs/atomicity.log;