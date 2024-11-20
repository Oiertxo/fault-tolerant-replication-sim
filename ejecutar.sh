## Para ejecutar el sistema: ## bash ejecutar.sh

# Limpiar logs y bases de datos
rm logs/ -r;

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
numManejadores=$(jq -r '.manejadores' config.json)

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
numReplicas=$(jq -r '.replicas' config.json)

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
numClientes=$(jq -r '.clientes' config.json)

# Crear un array para almacenar los PIDs de cada cliente
declare -a clientes

for i in $(seq 1 $numClientes)
do
    node cliente.js C$i & > logs/C$i.log
    clientes[$i]=$!
done

# Dar tiempo a que los clientes se inicialicen
sleep .1;