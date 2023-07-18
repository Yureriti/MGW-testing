from quart import Quart, render_template, websocket
import json

from mg.cartographer import autogenerate_scene, stringify_scene
from mg.db import DataStore


class ROUTES:
    CARTOGRAPHER = "/cartographer"
    CONTROL_ROOM = "/control-room"


app = Quart(__name__)


@app.get("/")
async def index():
    return await render_template("index.html")


@app.get("/test")
async def test():
    return await render_template("tests/test-table-scene.html")


@app.get("/synthesis")
async def synthesis():
    # SIGNAL TEMPORAL LOGIC; STL
    # SHOW FORMULA BUILDER
    return await render_template("plan_synthesis/synthesis.html")


@app.get(ROUTES.CARTOGRAPHER)
async def cartographer():
    return await render_template("cartographer/cartographer.html")


@app.get(ROUTES.CONTROL_ROOM)
async def control_room():
    return await render_template("control_room/control_room.html")


class WebSocketHandler:
    async def save(self, data):
        """save to internal db"""
        pass

    async def send(self, resp):
        await websocket.send(json.dumps(resp))

    async def cartographer(self, data):
        if "auto-scene" in data:
            vals = data["auto-scene"]
            vals.update((k, int(v)) for k, v in vals.items())
            int_map = autogenerate_scene(**vals)
            str_map = stringify_scene(int_map)
            print("=== autogenerating scene ===")
            print(vals)
            print(int_map)
            print(str_map)
            resp = {"auto-scene": {"data": str_map}}

            await self.send(resp)

    async def control_room(self, data):
        print(json.dumps(data, indent=4))
        # print(data)
        resp = {
            "status": "success",
            "message": "successfully saved",
        }
        print(resp)
        await self.send(resp)


@app.websocket("/ws")
async def ws():
    handler = WebSocketHandler()
    while True:
        mssg = await websocket.receive()
        mssg = json.loads(mssg)
        print("received: ", mssg)
        origin = mssg.pop("route", None)
        if origin is None:
            continue
        elif origin == ROUTES.CARTOGRAPHER:
            await handler.cartographer(mssg["data"])
        elif origin == ROUTES.CONTROL_ROOM:
            await handler.control_room(mssg["data"])


if __name__ == "__main__":
    # add sprites flag (e.g., --military for soldier sprites)
    app.run(debug=True, port=8000, use_reloader=True)
