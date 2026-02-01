let scramjet;

async function initScramjet() {
    try {
        const ScramjetController = window.$scramjetLoadController ? window.$scramjetLoadController().ScramjetController : null;
        
        if (!ScramjetController) {
            console.warn("Scramjet not loaded yet, waiting...");
            return null;
        }

        scramjet = new ScramjetController({
            files: {
                wasm: "/scram/scramjet.wasm.wasm",
                all: "/scram/scramjet.all.js",
                sync: "/scram/scramjet.sync.js",
            },
        });

        if (navigator.serviceWorker) {
            await scramjet.init();
            await navigator.serviceWorker.register("./sw.js");
        }
        
        window.scramjet = scramjet;
        console.log("Scramjet initialized successfully");
        return scramjet;
    } catch (e) {
        console.error("Scramjet Init Error:", e);
        return null;
    }
}

const connection = new BareMux.BareMuxConnection("/baremux/worker.js");
const wispUrl = (location.protocol === "https:" ? "wss" : "ws") + "://" + location.host + "/wisp/";

async function setTransport(transportsel) {
    try {
        if (transportsel === "epoxy") {
            await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
        } else if (transportsel === "libcurl") {
            await connection.setTransport("/libcurl/index.mjs", [{ websocket: wispUrl }]);
        }
        console.log(`Transport set to: ${transportsel}`);
    } catch (e) {
        console.error("Transport setup error:", e);
    }
}

window.updateTransport = async (choice) => {
    await setTransport(choice);
    console.log(`Transport updated to: ${choice}`);
};

window.addEventListener('load', async () => {
    await initScramjet();
    await setTransport('epoxy');
});