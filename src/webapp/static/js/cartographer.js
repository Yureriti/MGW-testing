import {
    assetFactory,
    ASSET_CHAR_NAMES,
    ASSET_METADATA,
} from "./utils/assets.js";
import { DEFAULT_CELL_SIZE, fileDownload } from "./utils/generic.js";
import { ws } from "./utils/ws.js";

Konva.autoDrawEnabled = true; // false;
// var scene = $("#scene");
// var stage = new Konva.Stage({ container: "scene" });
var scene;
var stage;

print = console.log;

const allyAssetType = ASSET_METADATA.Ally.name;
const emptyAssetType = ASSET_METADATA.Empty.name;
const hostileAssetType = ASSET_METADATA.Hostile.name;
const goalAssetType = ASSET_METADATA.Goal.name;
const coverAssetType = ASSET_METADATA.Cover.name;

var contextMenuSelectedAsset; // on-canvas, right-click selection
var paletteSelectedAsset = "cover"; // default

var grid, rows, cols, cellSize, width, height;

// TODO: move this websocket to individual class
// const ws = new WebSocket(`ws://${location.host}/ws`);

var layers = {
    empty: new Konva.Layer(),
    ally: new Konva.Layer(),
    goal: new Konva.Layer(),
    hostile: new Konva.Layer(),
    cover: new Konva.Layer(),
};

/* NOTE: these may not be needed */
var assets = {
    empty: [],
    ally: [],
    hostile: [],
    goal: [],
    cover: [],
};

$(".asset-selector").on("click", function (event) {
    let selectedAsset = $(event.target);
    let prevSelectedAsset = $(".asset-selector-wrapper[selectedasset=true]")[0];
    $(prevSelectedAsset).attr("selectedasset", "false");
    let parent = $(selectedAsset)[0].parentElement;
    $(parent).attr("selectedasset", "true");
    paletteSelectedAsset = $(event.target).data("asset-type");
});

var menuNode = $("#context-menu")[0];

function setupDataGrid(data) {
    [rows, cols, cellSize, width, height] = getCanvasDims(data);

    setupSceneWrapperHtml(cols, rows);

    initCanvas(width, height);
    setupEmptyGrid(width, height, cellSize, cols, rows);

    for (let row = 0; row < data.length; row++) {
        for (let col = 0; col < data[0].length; col++) {
            let c = data[row][col].toLowerCase();
            if (c != ".") {
                paletteSelectedAsset = ASSET_CHAR_NAMES[c];
                grid[row][col].shape.fire("click");
            }
        }
    }

    // set palette defaults
    paletteSelectedAsset = "cover";
    $(".asset-selector[data-asset-type='cover']").click();
}

// TODO: move to utils/generic.js
$("#scene-upload").on("change", function () {
    let fileReader = new FileReader();
    fileReader.onload = function () {
        let data = fileReader.result.split("\n");
        if (data.at(-1) == "") {
            data = data.slice(0, -1);
        }

        data.forEach((_, index) => (data[index] = data[index].trim()));

        clearCanvas();
        setupDataGrid(data);
    };
    fileReader.readAsText($("#scene-upload").prop("files")[0]);
});

// ws.addEventListener("message", function (event) {
//     let message = JSON.parse(event.data); // receive from python server
//     if ("auto-scene" in message) {
//         let data = message["auto-scene"]["data"];
//         setupDataGrid(data);
//     }
// });

ws.on("message", function (event) {
    let message = JSON.parse(event.data); // receive from python server
    if ("auto-scene" in message) {
        let data = message["auto-scene"]["data"].split("\n");
        if (data.at(-1) == "") {
            data = data.slice(0, -1);
        }
        setupDataGrid(data);
    }
});

$("#autogenerate-scene").click(function () {
    $("#scene-upload").val("");
    clearCanvas();
    let sceneData = {};
    $("#auto-scene-config")
        .find("input")
        .each(function (idx, elem) {
            let key = elem.id.split("-")[0];
            sceneData[key] = $(elem).val();
        });

    sceneData["ncols"] = parseInt($("#canvas-cols").val());
    sceneData["nrows"] = parseInt($("#canvas-rows").val());
    sceneData["cell_size"] = parseInt($("#canvas-cell-size").val());
    ws.send({ "auto-scene": sceneData }); // send to python server
});

// TODO: move to utils/generic.js
function clearCanvas() {
    // clear the current canvas, grid, and asset objects
    if (!(stage === undefined || stage === null)) {
        stage.destroyChildren();
    }
    $("#scene-upload").val("");
    $("#wrapper-table").empty();
    $(".asset-palette")[0].style.display = "none";
    grid = null;
    Object.keys(assets).forEach((key) => {
        assets[key] = [];
    });
    Object.keys(layers).forEach((key) => {
        layers[key] = new Konva.Layer();
    });
}

$("#canvas-clear").on("click", function () {
    clearCanvas();
});

$("#canvas-save").on("click", function () {
    if (grid === null || grid === undefined) return;
    let gridStr = "";
    for (let iy = 0; iy < grid.length; iy++) {
        for (let ix = 0; ix < grid[0].length; ix++) {
            gridStr += Object.values(grid[iy][ix].repr)[0];
        }
        gridStr += "\n";
    }
    fileDownload(gridStr, "scene.txt");
});

// TODO: move to utils/generic.js
function createSelectedAsset(assetType, uid, x, y, cellSize) {
    let data = { x: x, y: y, size: cellSize };
    let newAsset = assetFactory.create(assetType, uid, data);

    return newAsset;
}

// TODO: move to utils/generic.js
function setupEmptyGrid(width, height, cellSize, cols, rows) {
    grid = new Array(rows).fill(null).map(() => new Array(cols).fill(null));
    // let emptyAsset;
    let numEmpty = assets[emptyAssetType].length;
    for (let iy = 0; iy < height / cellSize; iy++) {
        for (let ix = 0; ix < width / cellSize; ix++) {
            let emptyAsset = createSelectedAsset(
                emptyAssetType,
                numEmpty,
                ix,
                iy,
                cellSize
            );
            emptyAsset.shape.on("click", function (event) {
                menuNode.style.display = "None";

                // ignore click if asset is already in selected cell
                if (grid[iy][ix].type != "empty") return;

                let asset = createSelectedAsset(
                    paletteSelectedAsset,
                    assets[paletteSelectedAsset].length,
                    ix,
                    iy,
                    cellSize
                );

                grid[iy][ix] = asset;

                assets[paletteSelectedAsset].push(asset);
                layers[paletteSelectedAsset].add(asset.shape);
            });

            grid[iy][ix] = emptyAsset;
            assets[emptyAssetType].push(emptyAsset);
            layers[emptyAssetType].add(emptyAsset.shape);
        }
    }

    for (let layer of Object.values(layers)) stage.add(layer);
}

function setCanvasDims(cols, rows, cellSize) {
    $("#canvas-cols").val(cols);
    $("#canvas-rows").val(rows);
    $("#canvas-cell-size").val(cellSize);
}

function getCanvasDims(data) {
    if (data === undefined || data === null) {
        cols = parseInt($("#canvas-cols").val());
        rows = parseInt($("#canvas-rows").val());
        cellSize = parseInt($("#canvas-cell-size").val());
        width = cols * cellSize;
        height = rows * cellSize;
    } else {
        rows = data.length;
        cols = data[0].length;
        cellSize = parseInt($("#canvas-cell-size").val()); // DEFAULT_CELL_SIZE;
        width = cellSize * cols;
        height = cellSize * rows;
        setCanvasDims(cols, rows, cellSize);
    }
    return [rows, cols, cellSize, width, height];
}

function initCanvas(width, height) {
    scene = $("#scene");
    stage = new Konva.Stage({ container: "scene" });

    scene.width(width);
    scene.height(height);

    stage.width(width);
    stage.height(height);

    $(".asset-palette")[0].style.display = "block"; // show palette

    stage.on("contextmenu", function (e) {
        // prevent default behavior
        e.evt.preventDefault();
        // if we are on empty place of the stage we will do nothing
        if (e.target === stage || e.target.type === "empty") return;

        contextMenuSelectedAsset = e.target;
        // show delete menu
        menuNode.style.display = "initial";
        let containerRect = stage.container().getBoundingClientRect();
        let pointerPos = stage.getPointerPosition();
        menuNode.style.left = containerRect.left + pointerPos.x + 4 + "px";
        menuNode.style.top = containerRect.top + pointerPos.y + 4 + "px";
    });
}
/*** TESTING START */
function numberRange(end, start = 0) {
    return new Array(end - start).fill().map((_, i) => i + start);
}
function getInner(colRange, rowRange) {
    return [
        $("<tr>", {
            html: [
                $("<th>", { class: "wrapper-table-cell", text: "" }),
                ...colRange.map(function (cval) {
                    return $("<th>", {
                        class: "wrapper-table-cell",
                        text: cval,
                    });
                }),
            ],
        }),
        ...rowRange.map(function (rval, idx) {
            if (rval == 0) {
                return $("<tr>", {
                    html: [
                        $("<th>", { class: "wrapper-table-cell", text: rval }),
                        $("<td>", {
                            colspan: colRange.length,
                            rowspan: rowRange.length,
                            html: $("<div>", { id: "scene" }),
                        }),
                    ],
                });
            } else {
                return $("<tr>", {
                    html: $("<th>", {
                        class: "wrapper-table-cell",
                        text: rval,
                    }),
                });
            }
        }),
    ];
}

function setupSceneWrapperHtml(cols, rows) {
    let colRange = numberRange(cols);
    let rowRange = numberRange(rows);

    let table = $("#wrapper-table");

    let inner = getInner(colRange, rowRange);
    let tbody = $("<tbody>").append(inner);
    table.html(tbody);
}

$("#canvas-update").on("click", function () {
    clearCanvas(); // force clear current data

    [rows, cols, cellSize, width, height] = getCanvasDims();
    setupSceneWrapperHtml(cols, rows);
    // let colRange = numberRange(cols);
    // let rowRange = numberRange(rows);

    // let table = $("#wrapper-table");

    // let inner = getInner(colRange, rowRange);
    // // print(inner);
    // let tbody = $("<tbody>").append(inner);
    // table.html(tbody);
    initCanvas(width, height);
    setupEmptyGrid(width, height, cellSize, cols, rows);
});

/** ORIGINAL */
// $("#canvas-update").on("click", function () {
//     $("#scene-upload").val("");
//     [rows, cols, cellSize, width, height] = getCanvasDims();
//     initCanvas(width, height);
//     setupEmptyGrid(width, height, cellSize, cols, rows);
// });

/*** TESTING END */

$(menuNode).on("click", function () {
    if (
        contextMenuSelectedAsset === undefined ||
        contextMenuSelectedAsset === null
    )
        return;

    let ix = contextMenuSelectedAsset.icol;
    let iy = contextMenuSelectedAsset.irow;
    let type = contextMenuSelectedAsset.type;
    let uid = contextMenuSelectedAsset.uid;

    // put matching empty asset back in
    let emptyCell = assets[emptyAssetType].filter(function (cell) {
        return cell.shape.icol == ix && cell.shape.irow == iy;
    });

    grid[iy][ix] = emptyCell[0];

    // remove asset from list of asset matching the asset type's uid
    assets[type] = assets[type].filter(function (_asset) {
        return _asset.uid !== uid;
    });
    contextMenuSelectedAsset.destroy();
});

$(window).on("click", function () {
    // ensure delete menu is hidden after each click
    menuNode.style.display = "None";
});

$("ul.dropdown-menu").on("click", "[data-keepOpenOnClick]", function (event) {
    /* TODO: 
        - min/max values should be calculated off of Canvas width, height, and grid spaces
        - hardcoding into their respective <input> fields for now
    */

    event.stopPropagation(); // prevent popup box from closing
    let target = event.target;
    const [action, object] = target.id.split("-");
    let objectCountId = `${object}-count`;

    let targetObject = $(`#${objectCountId}`)[0];

    let [objMin, objVal, objMax] = [
        targetObject.min,
        targetObject.value,
        targetObject.max,
    ];

    objVal =
        action == "minus"
            ? Math.max(objMin, --objVal)
            : Math.min(objMax, ++objVal);

    $(`#${objectCountId}`).val(objVal);

    // disable/enable buttons based on min/max
    // TODO: triggers event.Propagation(); and closes popup box
    // if (objVal <= objMin || objVal >= objMax) {
    //     $(target).attr("disabled", "disabled");
    // } else {
    //     $(`#minus-${object}`).removeAttr("disabled");
    //     $(`#add-${object}`).removeAttr("disabled");
    // }
});