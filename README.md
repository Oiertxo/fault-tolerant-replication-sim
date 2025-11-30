# Fault-Tolerant Active Replication System

A robust simulation of a distributed system implementing **Active Replication** to guarantee **Atomic Consistency** (Linearizability) across replicated state machines. The system is designed to withstand node failures (fail-stop model) without data loss or inconsistency.

> **Research Scope:** Implementation of a Sequencer-based Total Order Broadcast (TO-URB) protocol to orchestrate write operations across a distributed cluster.

## 🚀 Key Engineering Features

* **Total Order Multicast (Sequencer):** Implemented a central sequencer pattern to assign a global unique order to all client requests, ensuring that every replica processes state changes in the exact same sequence.
* **Fault Tolerance:** The architecture is resilient to the crash of **Handlers** (Front-end) and **Replicas** (Back-end). Clients automatically failover to healthy nodes upon timeout using a custom retry logic.
* **Atomic Consistency Verification:** Includes an automated audit tool that merges distributed logs to formally verify that the history of operations is linearizable.
* **Chaos Engineering:** The simulation script injects random failures (process kills) during execution to validate system recovery and stability under stress.

## 🏗️ System Architecture

The system follows a multi-tier distributed architecture:

1. **Clients:** Issue requests via a Round-Robin or Random proxy.
2. **Handlers (Front-end):** Receive requests and forward them to the Sequencer. They manage the reliable delivery guarantee.
3. **Sequencer:** Assigns a monotonically increasing sequence number to requests and broadcasts them.
4. **Replicas (Back-end):** Apply the logic (state machine) only when requests arrive in the correct order, backed by **LevelDB** for persistence.

## 🛠️ Tech Stack

* **Runtime:** Node.js (Simulating nodes as independent processes).
* **Messaging:** **ZeroMQ (v5)** for high-performance asynchronous message passing (Request/Reply and Router/Dealer patterns).
* **Persistence:** **LevelDB** for local storage in replicas.
* **Automation:** Bash scripting for cluster orchestration and chaos testing.

## 📂 Project Structure

```text
.
├── src/                 # Source code for nodes (Client, Replica, Sequencer...)
├── config/              # Cluster configuration (ports, number of nodes)
├── scripts/             # Orchestration and chaos testing scripts
├── tests/               # Generated logs and consistency reports
├── docs/                # Technical report (PDF)
└── package.json         # Dependencies and run scripts
```

## 🚦 How to Run the Simulation

This project includes an automated script that spins up the cluster, runs traffic, injects failures, and validates consistency.

### 1\. Prerequisites

* Node.js (v14+)
* npm

### 2\. Installation

Install dependencies (specifically `zeromq@5` and `level`):

```bash
npm install
```

### 3\. Run the Full Simulation

Execute the integration test suite. This will start Proxies, Sequencer, Handlers, Replicas, and Clients, then simulate crashes:

```bash
npm run simulate
```

### 4\. Verify Results

Check the output for the consistency report. You can also inspect detailed logs in:

* `tests/logs/unified_logs.log` (Merged timeline)
* `tests/logs/atomicity.log` (Verification result)

## 📄 Documentation

For a deep dive into the performance benchmarks (throughput vs. latency) and the theoretical correctness of the implementation, please refer to the **[Technical Report (PDF)](docs/Informe.pdf)**.

## 👥 Authors

* **Oier Alduncin**
* **Oier Layana**
* **Mihail Cojocaru**
