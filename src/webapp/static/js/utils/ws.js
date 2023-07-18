class WSHandler {
    /** Construct as singleton to avoid multiple websocket instances */
    static #instance = null;
    constructor() {
        // prettier-ignore
        if (!(WSHandler.#instance === undefined || WSHandler.#instance === null)) {
            return WSHandler.#instance;
        }
        WSHandler.#instance = this;
        this.ws = new WebSocket(`ws://${location.host}/ws`);
    }

    static getInstance() {
        return WSHandler.#instance;
    }

    send(data) {
        let mssg = JSON.stringify({
            data: data,
            route: $(location).attr("pathname"),
        });
        this.ws.send(mssg);
    }

    on(key, val) {
        /**
         * @todo can handle return values (e.g., [status, resp] = ...)
         * @todo save handlers to avoid repeats
         **/
        return this.ws.addEventListener(key, val);
    }
}

const ws = new WSHandler();

export { ws };
