import {
    assetFactory,
    ASSET_CHAR_NAMES,
    ASSET_METADATA,
} from "./utils/assets.js";
import {
    DEFAULT_CELL_SIZE,
    ACTIONS,
    ActionsEnum,
    STATE_ICONS,
    ICONS,
    Colors,
    print,
    notify,
    assert,
    fileDownload,
} from "./utils/generic.js";

import { calcStatistics } from "./utils/stats.js";
import { ws } from "./utils/ws.js";

/* ***** *
 * TODOS *
 * ***** *
[UI/UX]
* Enable Cover button ONLY when possible

[Implementation]
* Allow/record unallowed moves, but do not move/update statuses

[Questions]
* Allow assets to be in covered state or at goal at beginning?

* ****** */

/* **** *
 * DOCS *
 * **** */
/**
 * @typedef {'ally' | "hostile" | "goal" | "cover" | "empty"} AssetType
 * @typedef {Object.<'Ally'> | Object.<'Hostile'> | Object.<'Goal'> | Object.<'Cover'> | Object.<'Empty'>} Asset
 * @typedef {Array.<Array.<Array>>>} Grid3D
 */

/* ******* *
 * GLOBALS *
 * ******* */
// var grid, rows, cols, cellSize, width, height, table;
var grid3d;
var recording = false;
var maxActionIdx = 0;
var currentIdx = 0;
var T;

Konva.autoDrawEnabled = true; // false;
var scene; // = $("#scene");
var stage; // = new Konva.Stage({ container: "scene" });

// NOTE: this order is preserved when iterating
var layers = {
    empty: new Konva.Layer(),
    cover: new Konva.Layer(),
    goal: new Konva.Layer(),
    ally: new Konva.Layer(),
    hostile: new Konva.Layer(),
    overlay: new Konva.Layer(),
};

/* NOTE: these may not be needed */
var assets = {
    empty: [],
    cover: [],
    goal: [],
    ally: [],
    hostile: [],
};

var ACTIONABLES = ["ally"];
var selectedAsset;

var ACTIONS_METADATA = {
    Cover: "cover",
    Uncover: "uncover",
    Up: "up",
    Right: "right",
    Down: "down",
    Left: "left",
    Hold: "hold",
};

const allyAssetType = ASSET_METADATA.Ally.name;
const emptyAssetType = ASSET_METADATA.Empty.name;
const hostileAssetType = ASSET_METADATA.Hostile.name;
const goalAssetType = ASSET_METADATA.Goal.name;
const coverAssetType = ASSET_METADATA.Cover.name;

/* *************** *
 * CONFIG CONTROLS *
 * *************** */
function clearAll() {
    /** Clear entire canvas/scene and action table
     *
     * @modifies {selectedAsset, recording}
     */
    clearCanvas();
    $(".control-box").hide();
    $("#action-table").html("");
    $("#scene-upload").val("");
    $("#actions-upload").val("");
    $(".kb-btn").prop("disabled", true);
    selectedAsset = null;
    recording = false;
}

function calcSceneDims(data = null) {
    /** Calculate the dimensions of the scene/canvas to be rendered
     *
     * @param {Array.Array<string>} data - map data as read from input file
     *
     * @returns {Array<int>} - the calculated dimensions
     *
     * @todo Add extra config options to specify width/height of scene/canvas (e.g., cartographer)
     */
    let rows, cols, cellSize, width, height;
    if (data === undefined || data === null) {
        // TODO: this is conditional check is for using `calcSceneDims` in generic.js
        // [rows, cols, cellSize, width, height] = getSceneDims();
        return;
    } else {
        rows = data.length;
        cols = data[0].length;
        cellSize = DEFAULT_CELL_SIZE;
        width = cellSize * cols;
        height = cellSize * rows;
    }
    return [rows, cols, cellSize, width, height];
}

function clearCanvas() {
    /** Clear the current canvas, grid, and asset objects
     *
     * @modifies {stage, grid3d, layers, assets}
     */
    if (!(stage === undefined || stage === null)) {
        stage.destroyChildren();
    }
    grid3d = null;
    Object.keys(assets).forEach((key) => {
        assets[key] = [];
    });
    Object.keys(layers).forEach((key) => {
        layers[key] = new Konva.Layer();
    });
}

function initAssetActions() {
    assets[allyAssetType].forEach(function (ally) {
        ally.record(ACTIONS[ACTIONS_METADATA.Hold].repr);
        // for (let asset of assets[allyAssetType]) {
        //     asset.record(ACTIONS[ACTIONS_METADATA.Hold].repr); // TODO: set HOLD = "hold"
        // }
    });
}

function loadSceneFile(event) {
    /** Load a map file
     * @param {FileSystemFileHandle} event - uploaded file event
     *
     * @fires setupDataGrid3D
     * @fires createActionTable
     * @fires showControls
     */
    let fileReader = new FileReader();
    fileReader.onload = function () {
        let data = fileReader.result.split("\n");
        if (data.at(-1) == "") {
            data = data.slice(0, -1);
        }

        data.forEach((_, index) => (data[index] = data[index].trim()));
        clearCanvas();
        setupDataGrid3D(data);
        createActionTable();
        initAssetActions();
        showControls();
        // TODO: maybe move this function elsewhere elsewhere
        $(document).keydown(function (e) {
            if (e.key == "Escape") {
                $("#media-btn-record").click();
                e.preventDefault();
            }
        });
    };
    fileReader.onerror = function () {
        alert("Unable to parse uploaded scene file.");
    };
    fileReader.readAsText(event.target.files[0]);
}

function setupControlRoom(event) {
    loadSceneFile(event);
    // createActionTable();
}

$("#canvas-save").on("click", function () {
    /**  Save map/scene and actions
     *
     */
    console.log("saving TODO");
});

$("#canvas-clear").click(function () {
    /**  Clear canvas when "Clear" button clicked
     *
     * @fires clearAll
     */
    clearAll();
});

$("#scene-upload").on("change", function (event) {
    setupControlRoom(event);
});

function setupControlRoomActions(event) {
    loadActionsFile(event);
}

function initAssetActionsFromSavedState(trajectories) {
    let rActionsEnum = Object.fromEntries(
        Object.entries(ActionsEnum).map(([key, value]) => [value, key])
    );
    trajectories.assets.allies.forEach(function (allyStateData) {
        // Object.entries(trajectories.assets.allies).forEach(([key, vals]))
        // for (const a of Object.entries(trajectories.assets.allies)) {
        let [key, vals] = Object.entries(allyStateData)[0];

        let states = vals.states.slice(1); // initial action is hold

        let matchedAsset = assets[allyAssetType].filter(function (_asset, _) {
            if (_asset.uid == parseInt(key)) return _asset;
        });

        // assert matchedasset.length == 1?
        matchedAsset = matchedAsset[0];

        if (matchedAsset === undefined || matchedAsset === null) {
            // noty?
            print(
                `Note: unable to find matching Ally asset (id=${key}) from uploaded scene and action files`
            );
            return;
        }

        // matchedAsset.click();
        $(`#ally-${key}`).click();
        print(rActionsEnum);

        states.forEach(function (state) {
            print("-- > ", key, " taking action : ", state.action);
            // matchedAsset.record(state.action);
            let actionName = rActionsEnum[state.action];
            $(`#action-btn-${actionName}`).click();
        });
    });
}

function loadActionsFile(event) {
    /** Load a actions/trajectory/state file
     * @param {FileSystemFileHandle} event - uploaded file event
     *
     * @fires initAssetActionsFromSavedState
     */
    let fileReader = new FileReader();

    fileReader.onload = function () {
        let trajectories = JSON.parse(fileReader.result);
        initAssetActionsFromSavedState(trajectories);
    };
    fileReader.onerror = function () {
        alert("Unable to parse uploaded scene file.");
    };

    //     const blob = new Blob([json], {type:"application/json"});
    // fileReader.readAsText(event.target.files[0]);
    fileReader.readAsText(
        new Blob([event.target.files[0]], { type: "application/json" })
    );
}

$("#actions-upload").on("change", function (event) {
    setupControlRoomActions(event);
});

/* **************** *
 * SCENE AND CANVAS *
 * **************** */
function initCanvas(width, height) {
    /** Initialize the Konva.js canvas
     *
     * Set the dimensions of the `scene` div and Konva.js `stage` canvas.
     * Clears the current canvas loaded.
     *
     * @param {int} width - pixel width for Konva.js canvas
     * @param {int} height - pixel width for Konva.js canvas
     *
     * @fires clearCanvas
     *
     * @modifies {scene, stage, recording, selectedAssdet}
     */

    scene = $("#scene");
    stage = new Konva.Stage({ container: "scene" });

    $("#action-table").html("");
    $(".kb-btn").prop("disabled", true);

    recording = false;
    selectedAsset = null;

    scene.width(width);
    scene.height(height);

    stage.width(width);
    stage.height(height);
}

function createAsset(assetType, uid, x, y, cellSize) {
    /** Create a Control Room Asset (e.g., Ally, Hostile, Goal, Cover objects)
     *
     * @param {AssetType} assetType - string specify the type of asset to create
     * @param {int} uid - unique identifier of the asset
     * @param {int} x - column index the asset will be drawn in
     * @param {int} y - row index the asset will be drawn in
     * @param {int} cellSize - total height and width the asset
     *
     * @returns {Asset} newAsset - newly created Asset
     *
     * @fires AssetFactory.create
     *
     * @note {x,y} corresponds to {col, row}
     */
    let data = { x: x, y: y, size: cellSize };
    let newAsset = assetFactory.create(assetType, uid, data);
    return newAsset;
}

function handleAssetClicked(event, asset) {
    /** Handle an Asset when it is clicked on Canvas
     *
     * @param {MouseEvent} event - clicked event
     * @param {Asset} asset - the Asset that was clicked
     *
     * @note change color of asset stroke (e.g., border) to gold
     * @note currently, only `Ally` asset's are handled
     *
     * @event MouseEvent - clicks asset
     *
     * @todo define `Asset.toggleClicked()` in `assets.js` to avoid hard-coding for Ally specifically
     */
    try {
        asset = asset.children[0];
    } catch {}

    let x = "#ally-" + asset.uid;

    $("#ally-" + asset.uid).click();

    asset.stroke("gold");
    // print("GRID? ");
    // gotoTimestep(null, Math.max(0, idx - 1));
    //  when anything else clicked, stroke("black"); ?
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
function numberRange2(end, start = 0) {
    return new Array(end - start).fill().map((_, i) => i + start);
}
function setupSceneWrapperHtml(cols, rows) {
    let colRange = numberRange2(cols);
    let rowRange = numberRange2(rows);

    let table = $("#wrapper-table");

    let inner = getInner(colRange, rowRange);
    let tbody = $("<tbody>").append(inner);
    table.html(tbody);
}

function setupDataGrid3D(data) {
    /** Setup the 3D grid and render everything on Konva.js Canvas
     *
     * @param {Array.Array<string>} data - map data as read from input file
     *
     * @fires createAsset
     *
     * @modifies {grid3d, layers, assets}
     *
     * @todo must change functionality to first create empty grid of empty assets while
     *       enumerating all of the assets and asset types;
     *       *then*, go through and create all additional assets ?
     */

    // NOTE: Missing Action Data if uploaded
    let [rows, cols, cellSize, width, height] = calcSceneDims(data);

    setupSceneWrapperHtml(cols, rows);

    initCanvas(width, height);
    grid3d = empty3DGrid(rows, cols);
    // return;
    // TODO: make these into global variables in generic.js

    // let allyAssetType = ASSET_METADATA.Ally.name;

    for (let row = 0; row < data.length; row++) {
        for (let col = 0; col < data[0].length; col++) {
            if (data[row][col] == "\r") {
                /** TODO: may not be needed */
                print("xxxxxxxx here");
                print(data[row]);
                print(data[row][col]);
                continue;
            }

            // set empty assets first
            let numEmpty = assets[emptyAssetType].length;
            // prettier-ignore
            let emptyAsset = createAsset(emptyAssetType, numEmpty, col, row, cellSize);

            grid3d[row][col].push(emptyAsset);

            assets[emptyAssetType].push(emptyAsset);
            layers[emptyAssetType].add(emptyAsset.shape);

            // read in character from file
            let char = data[row][col].toLowerCase();
            let assetType = ASSET_CHAR_NAMES[char];

            // ignore empty assets since those are made by default
            if (assetType == emptyAssetType) continue;

            // set non-empty assets
            let assetGroup = new Konva.Group();

            let numAsset = assets[assetType].length;
            let asset = createAsset(assetType, numAsset, col, row, cellSize);

            if (assetType == allyAssetType) {
                // assetGroup.on("xChange yChange", (evt, self) => {
                asset.shape.on("xChange yChange", (evt, self) => {
                    // TODO: add this logic here or onMoveActions ?
                    //      if not asset.inCover ? // should never be here since cannot move X, Y while in cover

                    let target = evt.currentTarget;
                    var oldVal = evt.oldVal;
                    var newVal = evt.newVal;
                });

                assetGroup.on("click", function (event) {
                    // asset.shape.on("click", function (event) {
                    // TODO: pass in this.children[0] ?
                    handleAssetClicked(event, this);
                });
                asset.actions.push = function () {
                    let newLen = Array.prototype.push.apply(this, arguments);
                    assetActionsPushListener(numAsset, newLen, arguments[0]);
                };
                asset.actions.splice = function () {
                    // prettier-ignore
                    let removedElems = Array.prototype.splice.apply(this, arguments);
                    // prettier-ignore
                    assetActionsSpliceListener(numAsset, removedElems, arguments[0]);
                };
            } else if (assetType == hostileAssetType) {
                asset.shape.on("xChange yChange", (evt, self) => {
                    // for each ally update Konva.js Line Connector
                });
            }

            // TODO: check if .push needs to be .slice in-between arrays if
            //       elements are overlapping in uploaded map (e.g., if {empty, goal, ally}
            //       was provided, we should push in that order)
            grid3d[row][col].push(asset);

            assetGroup.add(asset.shape);
            if (!(asset.label === undefined || asset.label === null)) {
                assetGroup.add(asset.label);
            }

            assets[assetType].push(asset);
            layers[assetType].add(assetGroup);
        }
    }

    assets[allyAssetType].forEach(function (ally) {
        assets[hostileAssetType].forEach(function (hostile) {
            // TODO: add it to hostiles also ?
            // add LOS regardless of inCover & isDetected; modify state later
            let [destX, destY] = hostile.origin();
            ally.setLineOfSight(destX, destY);
        });
        if (ally.linesOfSight.length != 0) {
            layers["overlay"].add(...ally.linesOfSight);
        }
    });

    for (let layer of Object.values(layers)) stage.add(layer);
}

/* ************** *
 * ASSET CONTROLS *
 * ************** */

function getBtnKbMap(event, elem) {
    /** Get the clicked Asset Control button's ID
     *
     * @param {MouseEvent} event - mouse clicked event
     *
     * @param {HTMLElement} elem - button being cliecked
     *
     * @note `elem` is a wrapped jQuery element
     */
    return $(elem).attr("id");
}

function toggleCoverButton() {
    /** Toggle the Icon and Text of the Cover button
     */
    const btnCls = "toggle-action-btn-cover";
    $(`.${btnCls} i`).toggleClass(`${ICONS.cover} ${ICONS.uncover}`);
    $.trim($(`.${btnCls} span`).text()) == "Cover"
        ? (() => {
              $(`.${btnCls} span`).text("Uncover");
              $(`.${btnCls}`).prop("id", "action-btn-uncover");
          })()
        : (() => {
              $(`.${btnCls} span`).text("Cover");
              $(`.${btnCls}`).prop("id", "action-btn-cover");
          })();
}

$(".kb-btn").click(function (event) {
    let key = getBtnKbMap(event, this);
    let action = key.split("-").pop();
    handleAssetAction(action, selectedAsset);
    // moveOnGrid
    // updateAssetXY
    // moveOnCanvas
});

function handleKeyAction(e) {
    /** Handle an action when key is pressed
     *
     * @param {KeyboardEvent} e - keystroke pressed event
     *
     * @fires (asset-control-buttons).click()
     *
     * @note requires an Asset to be selected AND `recording` to be on
     *
     * @todo `.keyCode` is being deprecated, switch to `.key`
     *       https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/keyCode
     */

    // maybe move to container.addEventListener ?
    switch (e.keyCode) {
        case 37:
        case 100:
            // left-arrow | numpad-4
            $("#action-btn-left").click();
            e.preventDefault();
            break;
        case 38:
        case 104:
            // up-arrow | numpad-8
            e.preventDefault();
            $("#action-btn-up").click();
            break;
        case 39:
        case 102:
            // right-arrow | numpad-6
            e.preventDefault();
            $("#action-btn-right").click();
            break;
        case 40:
        case 98:
            // down-arrow | numpad-2
            e.preventDefault();
            $("#action-btn-down").click();
            break;
        case 32:
        case 96:
            // spacebar | numpad-0
            e.preventDefault();
            // note the element is selected by class since ID changes when toggling action
            $(".toggle-action-btn-cover").click();
            break;
        case 53:
        case 101:
            // numrow-5 | numpad-5
            e.preventDefault();
            $("#action-btn-hold").click();
            break;
        case 9:
            // tab key; cycle through table
            e.preventDefault();
            if (selectedAsset == null || selectedAsset == undefined) {
                // sanity check; condition shouldn't be met
                return;
            }
            let nextAlly = (selectedAsset.uid + 1) % assets["ally"].length;
            $("#ally-" + nextAlly).click();
            break;
    }
}

function findAdjacentCells(x, y) {
    /** Get all adjacent (col, row) indices for the given (col, row) index
     *
     * @param {int} x - column index of the selected asset's current position
     * @param {int} y - row index of the selected asset's current position
     *
     * @returns {Array.Array.<int>} - array of [col, row] indicies that are adjacent to input (col, row) index within canvas bounds
     *
     * @todo make rows/cols parameters and move to generic.js
     */
    let rows = grid3d.length;
    let cols = grid3d[0].length;
    // prettier-ignore
    let directions = [[-1, 0],[1, 0],[0, -1],[0, 1],]; // all the possible directions
    return directions
        .map(([xd, yd]) => [x + xd, y + yd]) // adjust the starting point
        .filter(([x, y]) => x >= 0 && x < cols && y >= 0 && y < rows); // filter out those out of bounds
}

function coverActionValid(asset) {
    /** Check that Cover action is valid
     *
     * @note Cover is valid if an asset (ally) is directly adjacent to a Cover object .
     *
     * @param {Asset} asset - asset selected to perform action
     *
     * @fires findAdjacentCells
     *
     * @returns {boolean} - True if Cover action is valid else False
     */

    let adjCells = findAdjacentCells(asset.icol, asset.irow);
    let allChecks = adjCells.some(([ax, ay]) => {
        let assetAtAdjacentTargetLoc = grid3d[ay][ax].slice(-1)[0];
        if (assetAtAdjacentTargetLoc.type == coverAssetType) {
            return true;
        }
    });
    return allChecks;
}

function handleAssetActionCover(actionStr, asset) {
    /** Toggle an Asset's Cover mode.
     *
     * @param {string} actionStr - action being executed ("cover")
     * @param {Asset} asset - asset selected to perform action
     *
     * @modifies {asset.actions}
     *
     * @todo still need to check if cover ACTION actually results in COVER (i.e., line of sight from hostile)
     */
    try {
        // deal with Konva.Group
        asset = asset.children[0];
    } catch {}

    if (!coverActionValid(asset)) {
        notify("No-Op: unable to take cover", "warning");
        return;
    }

    testLOS(asset);

    asset.toggleCover();
    // asset.inCoverMode = !asset.inCoverMode;
    asset.record(ACTIONS[actionStr].repr);
    toggleCoverButton();
}

function handleAssetActionUnCover(actionStr, asset) {
    try {
        // deal with Konva.Group
        asset = asset.children[0];
    } catch {}
    if (!asset.inCoverMode) {
        // should never be here
        notify("Error: should only be able to uncover while in cover");
    }
    asset.toggleCover();
    asset.isDetected = true;

    asset.record(ACTIONS[actionStr].repr);

    toggleCoverButton();
}

function moveActionValid(actionStr, asset, newRow, newCol, grid) {
    /** Verify an action is valid against constraints (e.g., detect if off grid | asset exists at target location)
     *
     * @param {string} actionStr - action being executed
     * @param {Asset} asset - asset selected to perform action
     * @param {int} newRow - new row index (y-axis) of `selectedAsset`'s target position
     * @param {int} newCol - new column index (x-axis) of `selectedAsset`'s target position
     * @param {Grid3D} grid
     *
     * @returns {bool} - `false` if action is valid else `true`
     *
     * @todo check if calculation might be redundant in calling function; return new ix, iy instead
     * @todo additional checks needed ? is recording, asset selected, asset covered/uncovered
     */
    let [curRow, curCol] = [asset.irow, asset.icol];
    let assetAtTargetLoc;
    // let goalAssetType = ASSET_METADATA.Goal.name;

    function notifyOutOfBounds() {
        notify("No-Op: out of bounds", "warning");
    }
    function notifyExistingAssetAtTargetLoc() {
        notify("No-Op: existing asset at target location", "warning");
    }

    if (actionStr == ACTIONS_METADATA.Left) {
        if (curCol == 0) {
            notifyOutOfBounds();
            return false;
        }
        assetAtTargetLoc = grid[curRow][newCol];
        if (
            assetAtTargetLoc.length != 1 &&
            assetAtTargetLoc[1].type != goalAssetType
        ) {
            notifyExistingAssetAtTargetLoc();
            return false;
        }
    } else if (actionStr == ACTIONS_METADATA.Right) {
        if (newCol == grid[0].length) {
            notifyOutOfBounds();
            return false;
        }
        assetAtTargetLoc = grid[curRow][newCol];
        if (
            assetAtTargetLoc.length != 1 &&
            assetAtTargetLoc[1].type != goalAssetType
        ) {
            notifyExistingAssetAtTargetLoc();
            return false;
        }
    } else if (actionStr == ACTIONS_METADATA.Up) {
        if (curRow == 0) {
            notifyOutOfBounds();
            return false;
        }
        assetAtTargetLoc = grid[newRow][curCol];
        if (
            assetAtTargetLoc.length != 1 &&
            assetAtTargetLoc[1].type != goalAssetType
        ) {
            notifyExistingAssetAtTargetLoc();
            return false;
        }
    } else if (actionStr == ACTIONS_METADATA.Down) {
        if (newRow == grid.length) {
            notifyOutOfBounds();
            return false;
        }
        assetAtTargetLoc = grid[newRow][curCol];
        if (
            assetAtTargetLoc.length != 1 &&
            assetAtTargetLoc[1].type != goalAssetType
        ) {
            notifyExistingAssetAtTargetLoc();
            return false;
        }
    }
    // IF not in cover mode AND not next to cover asset ==> NOOP
    return true;
}

function moveAssetAndUpdateGrid(actionStr, asset, newRow, newCol, grid) {
    /** Change the `asset`'s location to the new row and column indices, record its action, and update the 3D Grid
     *
     * @param {string} actionStr - action being executed
     * @param {Asset} asset - asset selected to perform action
     * @param {int} newRow
     * @param {int} newCol
     * @param {Grid3D} grid
     *
     * @modifies {asset.actions, asset.irow, asset.icol}
     *
     * @returns {Grid3d} grid - modified grid
     */
    let gridAsset = grid[asset.irow][asset.icol].pop();
    // assert gridAsset === asset
    grid[newRow][newCol].push(gridAsset);
    asset.moveTo(newRow, newCol);

    let cell = grid3d[asset.irow][asset.icol];

    asset.goalState =
        cell.length > 2 &&
        cell[1].type == goalAssetType &&
        cell[cell.length - 1] == asset
            ? {
                  atGoal: true,
                  goalUid: cell[1].uid,
                  timestep: asset.actions.length,
              }
            : {
                  atGoal: false,
                  goalUid: null,
              };

    // asset.updateLabel();
    // asset.updateLineOfSight();
    asset.record(ACTIONS[actionStr].repr);
    return grid;
}

function syncAssetsAndGrid(allAssetLocs, grid) {
    /** Wrapper for syncing between Grid and Asset location
     *
     * @param {Array} allAssetLocs
     * @param {Grid3D} grid
     *
     * @todo check if either of these returns a value and if so, should it overwrite
     */
    grid = syncGridFromAssetLocs(allAssetLocs, grid);

    // Replace below with: ACTIONABLES.forEach()
    let assetType = ASSET_METADATA.Ally.name;
    syncAssetLocsFromGrid(assetType, grid);

    return grid;
}

function syncAssetLocsFromGrid(assetType, grid) {
    /** Update each Actionable Asset's location (irow, icol) to match its respective location in `grid`
     *
     * @param {str} assetType
     * @param {Grid3d} grid
     *
     * @modifies {asset.irow, asset.icol}
     *
     * @note only Ally's are currently actionable, therefore, syncable
     * @note only `Ally` as `.moveTo`
     *
     * @todo improve nested, triple for-loop
     * @todo check if we should match an asset's state here?
     */
    for (let [irow, row] of grid.entries()) {
        for (let [icol, col] of row.entries()) {
            for (let _asset of col) {
                if (_asset.type != assetType) continue;
                // @TODO: show that asset is in the past by dashing it's outline
                // _asset.shape.dash([5, 5]);
                _asset.moveTo(irow, icol);
                // update state ? e.g., if _asset was in cover at time T ?
            }
        }
    }
}

function syncGridFromAssetLocs(allAssetLocs, grid) {
    /** Update `grid` to match each Actionable Asset's location (irow, icol)
     *
     * @param {Grid3D} grid
     * @param {Array} allAssetLocs
     *
     * @returns {Grid3D} grid
     *
     * @todo `allAssetLocs` params may not be Array, rather an Object
     */
    Object.entries(allAssetLocs).forEach(([assetType, assetList]) => {
        Object.values(assetList).forEach((asset) => {
            // NOTE: key can either be index or asset UID
            let [key, [irow, icol]] = Object.entries(asset)[0];
            // assets[assetType].filter(function (_a) {
            //     if (_asset.uid == uid) _grid[iy][ix].push(_a); // assetType[0] // for Asset char repr
            // });
            // if key == index
            grid[irow][icol].push(assets[assetType][key]);
            // _grid[iy][ix].push(_a); // assetType[0] // for Asset char repr
        });
    });
    return grid;
}

function moveAssetAtPreviousTime(
    actionStr,
    asset,
    prevActionIdx,
    newRow,
    newCol,
    grid
) {
    /** Move an Asset at a past time (`prevActionIdx`) that is not the latest time
     *
     * @note an Asset can be moved only if it's possible to do so at the current time
     *
     * @param {string} actionStr - action being executed
     * @param {Asset} asset - asset selected to perform action
     * @param {int} prevActionIdx
     * @param {int} newRow
     * @param {int} newCol
     * @param {Grid3D} grid
     *
     * @fires syncGridFromAssetLocs
     * @fires syncAssetLocsFromGrid
     * @fires moveAssetAndUpdateGrid
     *
     * @returns {Grid3D} grid
     *
     * @todo sync Asset states (e.g., if in Cover in previous time, set it)
     * @todo make Past Assets transparent at location
     * @todo record the action, regardless if it failed
     * @todo notify UI of failure?
     */
    let [nrows, ncols] = [grid.length, grid[0].length];

    let _grid = empty3DGrid(nrows, ncols);

    let allAssetLocs = getAllAssetLocs(prevActionIdx);

    _grid = syncGridFromAssetLocs(allAssetLocs, _grid);

    if (!moveActionValid(actionStr, asset, newRow, newCol, _grid)) {
        console.log("Error: Invalid move action 2");
        return grid3d;
    }

    grid = _grid;

    syncAssetLocsFromGrid(asset.type, grid);

    grid = moveAssetAndUpdateGrid(actionStr, asset, newRow, newCol, grid);

    // printGrid(grid)
    updateAssetStateProperties(prevActionIdx);

    return grid;
}

function moveAssetAtLatestTime(actionStr, asset, newRow, newCol, grid) {
    /** Move an Asset at the latest time
     *
     * @note an Asset can be moved only if it's possible to do so at the current time
     *
     * @param {string} actionStr - action being executed
     * @param {Asset} asset - asset selected to perform action
     * @param {int} newRow
     * @param {int} newCol
     * @param {Grid3D} grid
     *
     * @fires moveAssetAndUpdateGrid
     *
     * @returns {Grid3D} grid
     *
     * @todo record the action, regardless if it failed
     * @todo notify UI of failure?
     */
    if (!moveActionValid(actionStr, asset, newRow, newCol, grid)) {
        console.log("Error: Invalid move action 1");
        // asset.record(action)

        return grid;
    }

    grid = moveAssetAndUpdateGrid(actionStr, asset, newRow, newCol, grid);

    // updateAssetStateProperties(asset.actions.length-1)

    return grid;
}

function handleAssetActionMove(actionStr, asset) {
    /** Handler for any Asset Action
     *
     * @param {string} actionStr - action being executed
     * @param {Asset} asset - asset selected to perform action
     *
     * @fires moveAssetAtLatestTime
     * @fires moveAssetAtPreviousTime
     *
     * @modifies {grid3d}
     *
     * @todo currently only Ally's are Actionable (e.g., can move)
     */
    if (asset.inCoverMode && actionStr != ACTIONS_METADATA.Hold) {
        // no other action available; must be a move action
        // asset.record(ACTIONS[actionStr].repr)
        notify("No-Op: unable to move while in cover", "warning");
        return;
    }

    let curActionIdx = asset.actions.length;
    let [colMag, rowMag] = ACTIONS[actionStr].magnitudes;
    let [newRow, newCol] = [asset.irow + rowMag, asset.icol + colMag];

    if (curActionIdx >= maxActionIdx) {
        // let result = handleAssetActionMove(actionStr, asset, grid3dCopy);
        // if (result === undefined || result === null) {
        //     console.log("invalid move at time T");
        //     return;
        // }

        // prettier-ignore
        grid3d = moveAssetAtLatestTime(actionStr, asset, newRow, newCol, grid3d);
    } else {
        // prettier-ignore
        grid3d = moveAssetAtPreviousTime(actionStr, asset, curActionIdx, newRow, newCol, grid3d);
    }
}

function handleAssetAction(actionStr, asset) {
    /** Handle an Asset's action
     *
     * @param {string} actionStr - action being executed
     * @param {Asset} asset - asset selected to perform action
     *
     * @fires handleAssetActionCover
     * @fires handleAssetActionUncover
     * @fires handleAssetActionMove
     *
     * @modifies {grid3d}
     */

    try {
        // deal with Konva.Group
        asset = asset.children[0];
    } catch {}

    print(`>> Ally ${asset.uid} action: ${actionStr}`);

    if (actionStr == ACTIONS_METADATA.Cover) {
        return handleAssetActionCover(actionStr, asset);
    } else if (actionStr == ACTIONS_METADATA.Uncover) {
        return handleAssetActionUnCover(actionStr, asset);
    }
    // elif actionStr == 'HOLD'

    handleAssetActionMove(actionStr, asset);
    // print("===> ", asset.actions);
}

function getAssetLocsAtTimeIdx(actionIdx, assetList, useIndexAsKey = true) {
    /** Get all Asset locations at the `actionIdx` timestep
     *
     * @param {int} actionIdx - the psuedo time index
     * @param {Array} assetList - list of all the Assets
     * @param {bool} useIndexAsKey - use an Asset's index in the `assetList` or their unique identifier (`Asset.uid`) as the key in the returned object
     *
     * @returns {Array<Object>.<int, Array>>} - list of objects containing every asset and their location at the given `actionIdx`
     *
     * @todo should return `asset.actions[actionIdx].state` instead for completeness/robustness?
     */
    return [
        ...assetList.map(function (asset, idx) {
            let key = useIndexAsKey ? idx : asset.uid;
            if (actionIdx < asset.actions.length) {
                // TODO: return whole state
                // TODO: THIS IS WHERE WE DECIDE IF ASSETS SHOULD BE DASHED ?
                return { [key]: asset.actions[actionIdx].loc };
                // return { [key]: asset.actions[actionIdx].state.loc };
            } else {
                return { [key]: [asset.irow, asset.icol] };
            }
        }),
    ];
}

function getAllAssetLocs(idx = -1, useIndexAsKey = true) {
    /** Get all Asset locations at the given `idx` timestep categorized by Asset Type
     *
     * @note use `idx=-1` to get the latest action of each Asset
     *
     * @param {int} idx - the psuedo time/action index
     * @param {bool} useIndexAsKey - use an Asset's index in the `assetList` or their unique identifier (`Asset.uid`) as the key in the returned object
     *
     * @returns {Array<Object>.<str, Array>>} - list of objects containing every asset and their location at the given `idx` categorized by Asset Type
     *
     * @todo should return `asset.actions[actionIdx].state` instead for completeness/robustness?
     */
    let locs = {};
    Object.entries(assets).forEach(([assetType, assetList]) => {
        locs[assetType] = getAssetLocsAtTimeIdx(idx, assetList, useIndexAsKey);
    });
    return locs;
}

/* ************** *
 * MEDIA CONTROLS *
 * ************** */

$("#media-btn-record").click(function (event) {
    /** Handles the click of a media button
     *
     * @param {MouseEvent} event - a media button clicked event
     *
     * @todo is `event` parameter needed
     */
    recording = !recording;
    console.log("recording: ", recording);
    // check if stage undefined
    let container = stage.container();
    if (recording) {
        container.tabIndex = 1;
        container.focus();
        $(container).keydown(function (e) {
            handleKeyAction(e);
        });

        $(this).addClass("pulse");

        // TODO: append to action table
        if (selectedAsset != undefined || selectedAsset != null) {
            $(".kb-btn").prop("disabled", false);
        }
    } else {
        // stop recording
        $(container).off("keydown"); // ignore keystrokes
        $(".kb-btn").prop("disabled", true);
        $(this).removeClass("pulse");
    }
});

$("#media-btn-restart").on("click", function (evt) {
    currentIdx = 0;
    gotoTimestep(evt, currentIdx);
    // currentIdx++;
});

$("#media-btn-back").on("click", function (evt) {
    currentIdx = Math.max(0, --currentIdx);
    gotoTimestep(evt, currentIdx);
    // currentIdx--;
});

$("#media-btn-play").on("click", function (evt) {
    /**
     * @todo toggle pause/play buttons ?
     * @todo dislabe record button
     */

    handleMediaBtnForwardClick(evt);

    let canceled = false;

    let playInterval = setInterval(playHistory, 2000);
    function playHistory() {
        print("idx = " + currentIdx, " | canceled = " + canceled);
        $(window).on("click", function () {
            canceled = true;
            $(window).off("click");
        });

        if (currentIdx == maxActionIdx || canceled) {
            // if toggle == pause
            clearInterval(playInterval);
        }
        handleMediaBtnForwardClick(evt);
    }
});

function handleMediaBtnForwardClick(evt) {
    currentIdx = Math.min(maxActionIdx, ++currentIdx);
    gotoTimestep(evt, currentIdx);
}

$("#media-btn-forward").on("click", function (evt) {
    handleMediaBtnForwardClick(evt);
    // currentIdx = Math.min(maxActionIdx, ++currentIdx);
    // gotoTimestep(evt, currentIdx);
    // currentIdx++;
});

function updateMediaProgressBar(maxActionIdx, newLen) {
    /** Set current value and max limit of media player progress bar
     *
     * @todo divide current TD cell value / max length of actions (i.e., last TD cell value)
     *
     */
    let bar = $("#progress-bar")[0];
    let valeur = Math.floor((newLen / maxActionIdx) * 100);
    $(".progress-bar")
        .css("width", valeur + "%")
        .attr("aria-valuenow", valeur)
        .html(valeur + "%");
}

/* ************* *
 * DEMO CONTROLS *
 * ************* */
$("#good-demo, #bad-demo").on("click", function (event) {
    let results = calcStatistics(assets);
    results["label"] = event.target.id.includes("good") ? 1 : 0;
    // TODO: use websocket if we want backend database saving
    // ws.send(results);

    // TODO: move below to a generic.js function
    const resultsStr = JSON.stringify(results);
    fileDownload(resultsStr, "trajectory.json");
});

$("#clear-demo").on("click", function () {
    // TODO
});

/* ************ *
 * ACTION TABLE *
 * ************ */

function assetActionsPopListener(assetUid, actionsIdx) {
    /* 
    TODO: is this needed?
    functionality: 
        * pop action at action index from asset's action list
        * delete everything after index
        * update action table
    */
}

function updateActionTableDelete(targetAssetID, removedElems, args) {
    /**
     *  1. let `L1` <- length of current asset's history (prior to removing)
     *  2. if `L1` = `maxActionIdx` (largest), then
     *      2.1. let `L2[...]` <- length of all other assets's history
     *      2.2. if `max(L2)` < `maxActionIdx`
     *          2.2.1. `maxActionIdx` <- `max(L2)`
     *          2.2.2. `truncateLength(ActionTable)`
     *  3. remove current asset's ActionTable progress
     *  4. update current asset's media progress bar
     *
     * @TODO: SYNC GRID BACK UP TO LATEST POINT
     */
    let numRemoved = removedElems.length; // Math.abs(removedElems.length - args) + 1; // + args? // abs(numRemoved - args)

    // print(`xxx args: ${args} | len(rmv): ${removedElems.length} | calc(rmv): ${numRemoved} | max: ${maxActionIdx}`);

    let ncols = $("#action-table thead th").length;
    if (numRemoved + args == maxActionIdx) {
        // args == 1 ||
        /** This asset's history was one of the longest */
        let remainingActionLengths = [
            ...assets["ally"].map(function (ally) {
                return ally.actions.length;
            }),
        ];

        let _maxActionIdx = Math.max(...remainingActionLengths);

        if (_maxActionIdx < maxActionIdx) {
            /** the longest remaining history is shorter than the one being removed
             *  ==> truncate table and delete current asset's remaining history
             */
            let start = _maxActionIdx + 1; // index to start deleting from
            let totalDeletions = ncols - _maxActionIdx;
            let delCounter = 1;
            while (delCounter < totalDeletions) {
                $("#action-table colgroup").each(function () {
                    $(this).find(`col:eq(${start})`).remove();
                });
                $("#action-table thead tr").each(function () {
                    $(this).find(`th:eq(${start})`).remove();
                });
                $("#action-table tbody tr").each(function () {
                    // -1 because first cell of row is th, not td
                    $(this)
                        .find(`td:eq(${start - 1})`)
                        .remove();
                });
                delCounter++;
            }

            maxActionIdx = _maxActionIdx;
        }
    }

    let delIdxs = numberRange(Math.max(args, 1), args + numRemoved);
    print("deleting: ", delIdxs);
    for (let idx of delIdxs) {
        $(`#ally-${targetAssetID}`)
            .find(`td:eq(${idx})`) //  - 1
            .html("");
    }
}

function stateCellHtml(actionStr, actionVals, newLoc, goalState, isDetected) {
    /** This popoulates the ally state metadata for each time step (i.e., cell) in the action table
     *
     */
    return [
        $("<p>", {
            class: "action-table-cell",
            html: [
                $("<span>", {
                    class: "dummy",
                    html: [
                        $("<i>", { class: ICONS.action }),
                        $("<span>", {
                            class: "dummy px-2",
                            text: "Last Move:",
                        }),
                    ],
                }),
                $("<span>", {
                    class: "dummy",
                    html: [
                        $("<span>", {
                            class: "pe-2",
                            text: actionStr,
                        }),
                        $("<i>", {
                            class: actionVals.icon,
                            title: actionStr,
                        }),
                    ],
                }),
            ],
        }),
        $("<p>", {
            class: "action-table-cell",
            html: [
                $("<span>", {
                    class: "dummy",
                    html: [
                        $("<i>", { class: ICONS.location }),
                        $("<span>", {
                            class: "dummy px-2",
                            text: " Location (row,col):",
                        }),
                    ],
                }),
                $("<span>", {
                    class: "dummy",
                    text: `(${newLoc})`,
                }),
            ],
        }),
        $("<p>", {
            class: "action-table-cell",
            html: [
                $("<span>", {
                    class: "dummy",
                    html: [
                        $("<i>", {
                            class: goalState.atGoal
                                ? ICONS.reachedGoal
                                : ICONS.unreachedGoal,
                        }),
                        $("<span>", {
                            class: "dummy px-2",
                            text: "At Goal:",
                        }),
                    ],
                }),
                $("<span>", {
                    class: "dummy",
                    text: `${goalState.atGoal}`,
                }),
            ],
        }),
        $("<p>", {
            class: "action-table-cell",
            html: [
                $("<span>", {
                    class: "dummy",
                    html: [
                        $("<i>", {
                            class: isDetected
                                ? ICONS.detected
                                : ICONS.undetected,
                        }),
                        $("<span>", {
                            class: "dummy px-2",
                            text: "Is Detected: ",
                        }),
                    ],
                }),
                $("<span>", {
                    class: "dummy",
                    text: isDetected ? isDetected : `${isDetected}`,
                }),
            ],
        }),
    ];
}

function updateActionTableAppend(targetAssetID, newLen, newVal) {
    /** Update the Action Table with the new data
     *
     * @param {int} targetAssetID - ID of Asset who's action is being appended to
     * @param {int} newLen - length of the Asset's action array after args were pushed
     * @param {any} newVal - new value being pushed into the Asset's action array
     *
     * @todo highlight header of appended columns
     */
    let idxOfNew = newLen - 1;
    let curTD = $("#ally-" + targetAssetID).find("#t-" + idxOfNew);

    let newAction = newVal["action"];
    let newLoc = newVal["loc"];
    let goalState = newVal["goalState"];

    let isDetected = newVal["isDetected"];

    // print("==> UPDATE ACTION TABLE [NEW VALS]: ", newVal);

    /** TODO: might be easier to just append the Action itself rather than the integer repr */
    let [actionStr, actionVals] = Object.entries(ACTIONS).filter(
        ([key, value]) => value.repr === newAction
    )[0];

    if (curTD.length == 0) {
        // append new table header cell
        $("#actions-thead").append(createTimestepTableHeaders(idxOfNew));
        $("#col-group").append($("<col>", { id: `entire-col-${idxOfNew}` }));
        $("tr[id^='ally-']").each(function (assetIdx, assetRow) {
            // append new table data cells to each table row
            let [assetType, assetID] = $(assetRow).attr("id").split("-");
            $(assetRow).append(
                $("<td>", {
                    id: `t-${idxOfNew}`,
                    // text: assetID == targetAssetID ? newVal : "",
                    html:
                        assetID == targetAssetID
                            ? [
                                  $("<div>", {
                                      class: "row",
                                      html: [
                                          $("<div>", {
                                              class: "col-10",
                                              html: stateCellHtml(
                                                  actionStr,
                                                  actionVals,
                                                  newLoc,
                                                  goalState,
                                                  isDetected
                                              ),
                                          }),
                                          $("<div>", {
                                              class: "col-2 text-end",
                                              html: $("<button>", {
                                                  type: "button",
                                                  class: "btn btn-sm btn-outline-secondary delete-asset-history",
                                                  html: $("<i>", {
                                                      class: ICONS.trash,
                                                  }),
                                                  click: function (evt) {
                                                      evt.stopPropagation(); // prevent asset from being highlighted
                                                      deleteAssetAction(
                                                          evt,
                                                          assetID,
                                                          idxOfNew
                                                      );
                                                  },
                                                  title: "Delete the history of this asset from this timestep onward",
                                                  disabled:
                                                      idxOfNew == 0
                                                          ? true
                                                          : false,
                                              }),
                                          }),
                                      ],
                                  }),
                              ]
                            : "",
                })
            );
        });
    } else if (curTD.length == 1) {
        // overwrite existing cell
        $(curTD[0]).html([
            $("<div>", {
                class: "row",
                html: [
                    $("<div>", {
                        class: "col-10",
                        html: stateCellHtml(
                            actionStr,
                            actionVals,
                            newLoc,
                            goalState,
                            isDetected
                        ),
                    }),
                    ,
                    $("<div>", {
                        class: "col-2 text-end",
                        html: $("<button>", {
                            type: "button",
                            class: "btn btn-sm btn-outline-secondary delete-asset-history",
                            html: $("<i>", { class: ICONS.trash }),
                            click: function (evt) {
                                evt.stopPropagation(); // prevent asset from being highlighted
                                deleteAssetAction(evt, targetAssetID, idxOfNew);
                            },
                            title: "Delete the history of this asset from this timestep onward",
                            disabled: idxOfNew == 0 ? true : false,
                        }),
                    }),
                ],
            }),
        ]);
    } else {
        // should never get here
        console.log("Error appending actions to Action Table");
    }
}

function assetActionsSpliceListener(targetAssetID, removedElems, args) {
    updateActionTableDelete(targetAssetID, removedElems, args);
    // highlightAndFocusTimestepColumn(args);
    // updateMediaProgressBar(maxActionIdx, args);
}

function assetActionsPushListener(targetAssetID, newLen, args) {
    /** Wrapper function that listens for push/append changes to any asset's action array
     *
     * @param {int} assetUid - unique identifier of `selectedAsset`
     * @param {int} actionsIdx - index of last action in the asset's action list
     *
     * @modifies {maxActionIdx}
     *
     */
    maxActionIdx = Math.max(maxActionIdx, newLen);
    updateActionTableAppend(targetAssetID, newLen, args);
    highlightAndFocusTimestepColumn(newLen - 1);
    updateMediaProgressBar(maxActionIdx, newLen);
    // TODO: other functions
}

function highlightAndFocusTimestepColumn(idx) {
    $(`#entire-col-${idx}`)
        .toggleClass("selected")
        .siblings(".selected")
        .removeClass("selected");
    // this gets hidden by sticky row header =/
    $(`#t-${idx}-col`)[0].scrollIntoView();
}

function gotoTimestep(evt, idx) {
    /** Move Grid, assets, and Konva Scene to a specific timestep
     *
     * @todo may need time 0 == Hold at initial idx for all assets
     * @todo highlight clicked timestep header
     */
    print("go to timestep: ", idx);
    currentIdx = idx;
    let allAssetLocs = getAllAssetLocs(idx);
    let [nrows, ncols] = [grid3d.length, grid3d[0].length];
    let grid = empty3DGrid(nrows, ncols);
    grid3d = syncAssetsAndGrid(allAssetLocs, grid);

    updateAssetStateProperties(idx);

    // @TODO: should we be modifying DOM?
    updateMediaProgressBar(maxActionIdx, idx);
    highlightAndFocusTimestepColumn(idx);
}

function deleteTimestep(evt, colID) {
    // prettier-ignore
    assert(!(colID <= 0),`unable to delete from timestep 0 (received: ${colID})`);
    // prettier-ignore
    if (confirm(`Are you sure you want to delete each asset's action history from timestep=${colID} and onward?`)) {
        print("delete timestep: ", colID);
   }

    if (maxActionIdx == 1) return; // notify?
    assets[allyAssetType].forEach(function (asset) {
        asset.actions.splice(Math.max(1, colID));
    });
}

function createTimestepTableHeaders(colID) {
    return $("<th>", {
        id: `t-${colID}-col`,
        class: `time-header`,
        scope: `col`,
        html: $("<div>", {
            class: `d-flex flex-row justify-content-between`,
            html: [
                $("<div>", { html: `T<sub>${colID}</sub>` }),
                $("<div>", {
                    html: $("<span>", {
                        html: [
                            $("<button>", {
                                // id: "goto-ts-1",
                                type: "button",
                                class: "btn btn-sm btn-outline-secondary goto-timestep",
                                style: "margin-right: 5px;",
                                html: $("<i>", { class: ICONS.history }),
                                click: function (evt) {
                                    gotoTimestep(evt, colID);
                                },
                                title: "Go to this timestep",
                            }),
                            $("<button>", {
                                type: "button",
                                class: "btn btn-sm btn-outline-secondary delete-timestep",
                                html: $("<i>", { class: ICONS.trash }),
                                click: function (evt) {
                                    deleteTimestep(evt, colID);
                                },
                                title: "Delete this timestep and everything after it",
                                // hidden: colID == 0 ? true : false,
                                disabled: colID == 0 ? true : false,
                            }),
                        ],
                    }),
                }),
            ],
        }),
    });
}

function deleteAssetAction(evt, uid, idx) {
    print("received: ", idx);
    if (maxActionIdx == 1) return; // notify?
    // let allyAssetType = ASSET_METADATA.Ally.name;
    let asset = assets[allyAssetType].filter(function (_asset, _) {
        if (_asset.uid == parseInt(uid)) return _asset;
    });

    // assert.length != 0
    asset = asset[0];

    asset.actions.splice(Math.max(1, idx));
    // TODO: updateAssetState

    // gotoTimestep(null, Math.max(0, idx - 1));
    $(`#ally-${uid}`).click();
    // click the time button

    // $("#media-btn-restart").click();
    // print("POST: ", asset.actions.length);
}

function createActionTable() {
    /** Create an empty action table consisting
     *
     * @note Currently only handles Ally assets
     */
    let tableElem = $("#action-table");

    /** TODO: only works for allies at the moment... */
    /** for actionableAsset in ACTIONABLES */
    let actions = [
        ...assets["ally"].map(function (ally) {
            return { [ally.uid]: ally.actions };
        }),
    ];

    let maxLen = getMaxLen(actions); // TODO: make this global var edited by push listener?
    let emptyArr = Array(Math.max(1, maxLen)).fill();

    let colGroup = $("<colgroup>", { id: "col-group" });
    $.each(Array(actions.length), function (idx, row) {
        colGroup.append($(`<col id=entire-col-${idx - 1}>`));
    });
    let headers = $("<thead>", { class: "table-light" }).append([
        $("<tr>", { id: "actions-thead" }).append([
            $("<th>", {
                id: "id-col",
                scope: "col",
                text: "Asset ID",
            }),
            ...emptyArr.map(function (_, colID) {
                return createTimestepTableHeaders(colID);
            }),
        ]),
    ]);

    let body = $("<tbody>");
    $.each(actions, function (idx, rows) {
        let newRow = $("<tr>");
        $.each(rows, function (assetID, cols) {
            newRow.attr("id", `ally-${assetID}`);
            newRow.append([
                $("<th>", {
                    id: `asset-row-header-${assetID}`,
                    class: "table-light",
                    html: $("<div>", {
                        class: "container",
                        html: $("<div>", {
                            class: "row",
                            html: [
                                /*

                                    $("<div>", {
                                      class: "row",
                                      html: [
                                          $("<div>", {
                                              html: [
                                                  $("<i>", {
                                                      class: actionVals.icon,
                                                      title: actionStr,
                                                  }),
                                                  $("<p>", {
                                                      text: `(${newLoc})`,
                                                  }),
                                              ],
                                          }),
                                          $("<div>", {
                                              class: "col text-end",
                                              html: $("<button>", {
                                                  type: "button",
                                                  class: "btn btn-sm btn-outline-secondary delete-asset-history",
                                                  html: `<i class="fa fa-trash" aria-hidden="true"></i>`,
                                                  click: function (evt) {
                                                      evt.stopPropagation(); // prevent asset from being highlighted
                                                      deleteAssetAction(
                                                          evt,
                                                          assetID
                                                      );
                                                  },
                                                  title: "Delete the history of this asset from this timestep onward",
                                              }),
                                          }),
                                      ],
                                  }),


                                */
                                $("<div>", {
                                    class: "col",
                                    text: `A${assetID}`,
                                }),
                                $("<div>", {
                                    class: "col text-end",
                                    html: $("<button>", {
                                        type: "button",
                                        class: "btn btn-sm btn-outline-secondary delete-asset-history",
                                        html: $("<i>", { class: ICONS.trash }),
                                        click: function (evt) {
                                            evt.stopPropagation(); // prevent asset from being highlighted
                                            // deleteAssetAction(evt, assetID);
                                            deleteAssetAction(
                                                evt,
                                                assetID,
                                                idx
                                            );
                                        },
                                        title: "Delete the entire history of this asset",
                                    }),
                                }),
                            ],
                        }),
                    }),
                }),
                ...emptyArr.map(function (_, colID) {
                    return $("<td>", {
                        id: `t-${colID}`,
                        text: colID < cols.length ? cols[colID] : "",
                    });
                }),
            ]);
        });
        body.append(newRow);
    });

    tableElem.append([colGroup, headers, body]);
}
$("#action-table").on("contextmenu", " thead", function (event) {
    // @TODO: not sure this is needed ?
});

$("#action-table").on("contextmenu", "tbody tr th", function (event) {
    // @TODO: not sure this is needed ?
    // event.preventDefault();
    // // actions:
    // //  1. delete all of asset's action history
    // console.log("right clicking action table  header");
    // let x = $(event.target).closest("th"); //.find("td");
    // console.log(x);
});

$("#action-table").on("contextmenu", "tbody", function (event) {
    // @TODO: not sure this is needed ?
    // event.preventDefault();
    // // actions:
    // // 1. overwrite action at selected time T
    // //  - keep remaining
    // //  - delete remaining
    // console.log("right clicking action table");
    // let x = $(event.target).closest("td"); //.find("td");
    // console.log(x);
});

$("#action-table").on("click", "tbody tr", function () {
    /** Handle Mouse clicks on action table rows
     *
     * @modifies {selectedeAsset}
     *
     * @todo Check if this should also modify the <td> that was selected
     * @TODO this needs to move to latest timestep for specific asset
     */

    // if ($(this).hasClass("selected")) {
    //     //  or $(this).attr("id")) {
    //     // ignore click if asset is already selected
    //     return;
    // }

    // highlight table
    if (!$(this).hasClass("selected")) {
        $(this)
            .toggleClass("selected")
            .siblings(".selected")
            .removeClass("selected");
    }

    let allyRowId = $(this).attr("id");
    let [type, uid] = allyRowId.split("-");

    assets[type].filter(function (_asset, _) {
        // add/remove border stroke from assets where appropriate
        if (_asset.uid == uid) {
            selectedAsset = _asset;
            // TODO: can try pulsting instead of gold
            selectedAsset.shape.stroke("gold");
            selectedAsset.shape.strokeWidth(3);
        } else {
            _asset.shape.stroke("black");
            _asset.shape.strokeWidth(1);
        }
    });
    gotoTimestep(null, Math.max(selectedAsset.actions.length - 1, 0));
    // toggle cover/uncover appropriately
    let coverOption = $(".toggle-action-btn-cover").prop("id").split("-").pop();

    if (selectedAsset.inCoverMode && coverOption == "cover") {
        toggleCoverButton();
    } else if (!selectedAsset.inCoverMode && coverOption == "uncover") {
        toggleCoverButton();
    }
});

$("#action-table").on("click", "tbody tr td", function (event) {
    /** Handle when specific action is clicked in Action Table
     *
     * @note it may be more computationally efficient to have a global variable tracking
     *       current action selection from Action Table since this will iterate through all
     *       `<td>` tags in the Action Table to remove the highlighted class.
     *
     * @todo combine this function with `$("#action-table").on("click", "tbody tr"` handler
     *       since this function can grab it as a parent
     *
     * @todo set selected action index and asset for overwriting
     */
    // let [_, timestep] = event.target.id.split("-");

    // currentTime = timestep
    return;

    if ($(this).hasClass("selected")) {
        // ignore click if asset is already selected
        return;
    }

    // highlight table
    $("#action-table tbody tr td").removeClass("selected");

    $(this)
        .toggleClass("selected")
        .siblings(".selected")
        .removeClass("selected");
});

/* ******* *
 * GENERIC *
 * ******* */
function updateAssetStateProperties(actionIdx) {
    /***
     * set detected, goal, cover
     * toggle cover
     */
    // Object.entries(assets).forEach(([assetType, assetList]) => {
    $.each(assets[allyAssetType], function (idx, asset) {
        // t(actionIdx, assetList);
        // print(idx, asset);
        if (actionIdx < asset.actions.length) {
            let state = { ...asset.actions[actionIdx] };
            // delete state["loc"] // delete any unnecessary keys

            asset.state(state);
            if (asset.isDetected) {
                // asset.toggleLineOfSightOn();
                asset.updateLineOfSight();
            } else {
                asset.toggleLineOfSightOff();
            }
            // print("AT PREV TIME, ASSET WAS DETECTED? ", asset.isDetected);
        } else {
            // TODO?
            // print("2 ===> ", asset.state());
            // asset.updateAssetStateProperties(state)
        }
    });
}

function showControls() {
    /** Show/hide the Asset, Media, and Demo controls */
    // $(".control-box").show(); // toggle();
    $(".control-box").attr("style", "display: flex;");
}

function getAssetConnectorRenderingMetadata() {
    return;
}

function printGrid(grid) {
    /** Displays the character-formatted grid to the console.
     *
     * @note only top-level assets in the 3rd dimension will be displayed
     *
     * @param {Grid3D} grid - 3D grid to be printed
     */
    let _grid = [];
    for (let row of grid) {
        let tmp = [];
        for (let col of row) {
            if (col.length == 0) continue;
            let a = Object.values(col[col.length - 1].repr)[0];
            tmp.push(a);
        }
        _grid.push(tmp);
    }
    print(_grid);
}

function getKeyByValue(object, value) {
    /** Reverse lookup a key by it's value */
    return Object.keys(object).find((key) => object[key] === value);
}

function getMaxLen(actions) {
    /** Calculate the maximum length of current actions
     *
     * @param {Array.<Object>.<int, Array.<int>>} actions - list of actions for each asset
     */
    return Math.max(
        ...actions.map(function (obj) {
            return Object.values(obj)[0].length;
        })
    );
}

function empty3DGrid(nrows, ncols) {
    /** Create an empty 3-dimensional grid of size [nrows x ncols x 1]
     *
     * @param {int} nrows - number of rows (y)
     * @param {int} ncols - number of columns (x)
     *
     * @returns {Grid3D}
     *
     * @todo should move this to generic.js
     */
    // prettier-ignore
    return new Array(nrows).fill(null)
                .map(() =>  new Array(ncols).fill(null)
                .map(() => new Array(0).fill([])));
}

function makeAlert() {
    // Alert container
    let cont = document.querySelector("#test-alert");
    // button.addEventListener("click", () => {
    cont.innerHTML = `<div class="alert alert-primary alert-dismissible fade show" role="alert">
      Primary alert with custom close button
      <button type="button" class="btn-close" data-dismiss="alert" aria-label="Close"></button>
      </div>`;
    // });
}

// $(window).click(function (evt) {
//     // Click away from canvas or table; disable selectedAsset
//     evt.stopPropagation();
//     if (evt.target.id == "scene" || evt.target.id == "action-table") {
//         return;
//     }
//     for (let asset of assets["ally"]) {
//         asset.shape.stroke("black");
//     }
//     selectedAsset = null;
// });

/* **** *
 * MATH *
 * **** */

function testLOS(asset) {
    /** NOTE: can't guarantee that LOS == no guarantee that asset doesn't start in LOS (i.e., isDetected = false)
     *
     */
    // print("=== LOS ===");
    // print(asset);
    // print(assets[hostileAssetType]);
    // printGrid(grid3d);
    let [ay, ax] = [asset.irow, asset.icol];

    let outOfSightCounter = 0;
    assets[hostileAssetType].forEach(function (hostile) {
        let [hy, hx] = [hostile.irow, hostile.icol];
        // print(ay, ax, hy, hx);
        let intbetweenPoints = getPointsOnLine2([ax, ay], [hx, hy]);
        $.each(intbetweenPoints, function (_, [icol, irow]) {
            let cell = grid3d[irow][icol];
            if (cell.length >= 2 && cell[1].type == coverAssetType) {
                outOfSightCounter++;
                // toggle this single LOS?
                return false;
            }
        });
        // ally.setLineOfSight(destX, destY);
    });
    let outOfSight = outOfSightCounter == assets[hostileAssetType].length;
    asset.isDetected = !outOfSight;
    asset.updateLineOfSight();

    // NOTE: modify `layers["overlay"]`?
}
function calculateLineIntersection(x1, y1, x2, y2) {
    /**
     * Calculates the line that intersects two given coordinates.
     *
     * @param {number} x1 - The x-coordinate of the first coordinate.
     * @param {number} y1 - The y-coordinate of the first coordinate.
     * @param {number} x2 - The x-coordinate of the second coordinate.
     * @param {number} y2 - The y-coordinate of the second coordinate.
     * @returns {{m: number, b: number}} - An object with two properties representing the slope (m) and y-intercept (b) of the line.
     */
    const m = (y2 - y1) / (x2 - x1); // slope of the line
    const b = y1 - m * x1; // y-intercept of the line

    return { m, b };
}

function getPointsOnLine(m, b, startX, endX) {
    /** Calculates all the coordinates that lie on a line defined by two points
     *
     * @param {int} m - slope of the line
     * @param {int} b - y intercept
     * @param {int} startX - X coordinate of the starting point of the line
     * @param {int} endX - X coordinate of the ending point of the line
     *
     * @note Implementation of Bresenham's Line Generation Algorithm: https://en.wikipedia.org/wiki/Bresenham%27s_line_algorithm
     */
    const points = [];
    let x = startX;
    let y = Math.round(m * x + b);
    const dx = Math.abs(endX - startX);
    const dy = Math.abs(y - Math.round(m * (x + 1) + b));
    const yIncrement = y < Math.round(m * (x + 1) + b) ? 1 : -1;
    let error = dy - dx / 2;

    while (x <= endX) {
        points.push([x, y]);
        if (error >= 0) {
            y += yIncrement;
            error -= dx;
        }
        x++;
        error += dy;
    }

    return points;
}

function getPointsOnLine2(point1, point2) {
    /**
     * Calculates all the points on a line between two given points using the midpoint formula.
     *
     * @param {number[]} point1 - An array containing the x and y coordinates of the first point.
     * @param {number[]} point2 - An array containing the x and y coordinates of the second point.
     *
     * @returns {number[][]} - A list of all the points on the line between the two given points.
     *
     * @note alternative to getPointsOnLine using mid-point formula instead of y-intercept formula
     */
    const [x1, y1] = point1;
    const [x2, y2] = point2;
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;
    let x = x1;
    let y = y1;
    const points = [[x, y]];
    while (x !== x2 || y !== y2) {
        const e2 = err * 2;
        if (e2 > -dy) {
            err -= dy;
            x += sx;
        }
        if (e2 < dx) {
            err += dx;
            y += sy;
        }
        points.push([x, y]);
    }
    return points;
}

function numberRange(start, end) {
    return new Array(end - start).fill().map((_, i) => i + start);
}

function getMatchingCoordinates(m, b, startX, endX, coordinates) {
    /**
     * Calculates all the coordinates that lie on a line defined by two points and finds
     * the matching elements of the input `coordinates` array.
     *
     * @param {int} m - slope of the line
     * @param {int} b - y intercept
     * @param {int} startX - X coordinate of the starting point of the line
     * @param {int} endX - X coordinate of the ending point of the line
     * @param {number[][]} - array of [X,Y] coordinate pairs to compare against the line
     *
     * @returns {number[][]} - array of matching [X,Y] coordinate pairs
     *
     * @note Implementation of Bresenham's Line Generation Algorithm: https://en.wikipedia.org/wiki/Bresenham%27s_line_algorithm
     * @note ChatGPT says this method has a computational complexity of `O(n*dx)`, where `dx` is the
     *       difference between the x-coordinates of the two given points, however, in practice,
     *       the number of matching coordinates is likely to be much smaller than the size of the input list,
     *       therefore, the overall complexity is considered to just be `O(dx)` (Bresenham's algorithm).
     * @note alternative to `isOnLine`
     */
    const matchingCoordinates = [];
    const dx = Math.abs(endX - startX);
    const dy = Math.abs(
        Math.round(m * (startX + 1) + b) - Math.round(m * startX + b)
    );
    const yIncrement =
        Math.round(m * (startX + 1) + b) > Math.round(m * startX + b) ? 1 : -1;
    let error = dy - dx / 2;
    let x = startX;
    let y = Math.round(m * startX + b);

    for (let i = 0; i < coordinates.length; i++) {
        const [coordX, coordY] = coordinates[i];
        if (coordX === x && coordY === y) {
            matchingCoordinates.push([coordX, coordY]);
        }
    }

    while (x < endX) {
        if (error >= 0) {
            y += yIncrement;
            error -= dx;
        }
        x++;
        error += dy;

        for (let i = 0; i < coordinates.length; i++) {
            const [coordX, coordY] = coordinates[i];
            if (coordX === x && coordY === y) {
                matchingCoordinates.push([coordX, coordY]);
            }
        }
    }

    return matchingCoordinates;
}

function isOnLine(L, m, b) {
    /**
     * Checks if a given coordinate lies on a line defined by the equation y = mx + b.
     *
     * @param {number[]} coordinate - An array containing the x and y coordinates of the point to check.
     * @param {number} m - The slope of the line.
     * @param {number} b - The y-intercept of the line.
     * @returns {boolean} - Returns true if the coordinate lies on the line, false otherwise.
     *      *
     * @note alternative to getMatchingCoordinates
     *
     * @todo requires additional tweaks (e.g., don't return)
     */
    for (let i = 0; i < L.length; i++) {
        const x = L[i][0];
        const y = L[i][1];
        if (y === m * x + b) {
            return true;
        }
    }
    return false;
}

ws.on("message", function (event) {
    let resp = JSON.parse(event.data);
    let status = resp["status"];
    let message = resp["message"];
    notify(message, status);
});

/**

@TODO: refactor to interfaces

let ActionTable = {
    _appendData: function(a,b,c){
        ...
    }
    _deleteData: function(a,b){

    }
    _other: function(...){
        ...
    }
    append : (a,b,c) => {
        _appendData(a,b,c)
    }
    delete : (a,b) => {
        _deleteData(a,b)
    }
    other : _other
 }
 
 
 */
