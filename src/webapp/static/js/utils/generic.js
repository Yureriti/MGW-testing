var DEFAULT_CELL_SIZE = 50;

var Colors = {
    GREEN: {
        // bamboo green
        rgb: (170, 255, 175),
        hex: "#AAFFB0",
    },
    BLUE: {
        // crystal blue
        rgb: (128, 224, 255),
        hex: "#80DFFF",
    },
    DARK_BLUE: {
        // crystal blue
        rgb: (0, 153, 204),
        hex: "#0099CC",
    },
    GREY: {
        // light grey
        rgb: (180, 180, 180),
        hex: "#B4B4B4",
    },
    RED: {
        // bright red
        rgb: (255, 0, 0),
        hex: "#FF0000",
    },
    WHITE: {
        // off white
        rgb: (250, 249, 246),
        hex: "#FAF9F6",
    },
};

const ActionsEnum = Object.freeze({
    left: 4,
    right: 6,
    up: 8,
    down: 2,
    cover: 0,
    uncover: 1,
    hold: 5,
});

var ICONS = {
    // generic
    action: "fa fa-gamepad",
    location: "fa fa-map-marker",
    unreachedGoal: "fa fa-flag-o",
    reachedGoal: "fa fa-flag",
    detected: "fa fa-eye",
    undetected: "fa fa-eye-slash",
    trash: "fa fa-trash",
    history: "fa fa-history",
    // actions
    hold: "fa fa-hand-paper-o",
    up: "fa fa-arrow-up",
    down: "fa fa-arrow-down",
    left: "fa fa-arrow-left",
    right: "fa fa-arrow-right",
    cover: "fa fa-hand-o-down",
    uncover: "fa fa-hand-o-up",
    // buttons
    good: "fa fa-thumbs-o-up",
    bad: "fa fa-thumbs-o-down",
    refresh: "fa fa-refresh",
    record: "fa fa-circle-o fa-align-middle",
    restart: "fa fa-repeat fa-align-middle fa-flip-horizontal",
    backward: "fa fa-step-backward fa-align-middle",
    play: "fa fa-play fa-align-middle",
    forward: "fa fa-step-forward fa-align-middle",
};

var STATE_ICONS = {
    goal: [ICONS.unreachedGoal, ICONS.reachedGoal], // ["fa fa-flag-o", "fa fa-flag"],
    detected: [ICONS.undetected, ICONS.detected], // ["fa fa-eye-slash", "fa fa-eye"],
};

var ACTIONS = {
    // NOTE: magnitudes are relative to Cartesian Quadrant IV because of Array indexing
    left: {
        repr: 4,
        value: -1,
        magnitudes: [-1, 0], // x,y = [col, row]
        axis: "x",
        icon: ICONS.left,
    },
    right: {
        repr: 6,
        value: 1,
        magnitudes: [1, 0],
        axis: "x",
        icon: ICONS.right,
    },
    up: {
        repr: 8,
        value: 1,
        magnitudes: [0, -1],
        axis: "y",
        icon: ICONS.up,
    },
    down: {
        repr: 2,
        value: -1,
        magnitudes: [0, 1],
        axis: "y",
        icon: ICONS.down,
    },
    hold: {
        repr: 5,
        value: 0,
        magnitudes: [0, 0],
        axis: null,
        icon: ICONS.hold,
    },
    cover: {
        repr: 0,
        value: 0,
        magnitudes: [0, 0],
        axis: null,
        icon: ICONS.cover,
    },
    uncover: {
        repr: 1,
        value: 0,
        magnitudes: [0, 0],
        axis: null,
        icon: ICONS.uncover,
    },
};

function notify(mssg, type, notyId = "notyPlaceholder") {
    const noty = $("<div>", {
        html: $("<div>", {
            class: `alert alert-${type} alert-dismissible`,
            role: "alert",
            html: [
                $("<div>", { html: mssg }),
                $("<button>", {
                    id: "dismiss-alert",
                    type: "button",
                    class: "btn-close",
                    "data-bs-dismiss": "alert",
                    "aria-label": "Close",
                }),
            ],
        }),
    });
    $(`#${notyId}`).append(noty);
    let alert = setTimeout(function () {
        $(`#${notyId}`).toggle("slow");
        $("#dismiss-alert").click();
    }, 3000);
}

const assert = function (condition, message) {
    if (!condition) throw Error(`Assert failed: ${message}`);
};

function fileDownload(dataStr, fname) {
    print("--- saving", fname);
    const dataBlob = new Blob([dataStr], {
        type: "text/plain;charset=utf-8",
    });
    const link = URL.createObjectURL(dataBlob);
    const a = $("<a />");
    a.attr("download", fname);
    a.attr("href", link);
    $("body").append(a);
    a[0].click();
    $("body").remove(a);
    URL.revokeObjectURL(link.href);
}

var print = console.log;

export {
    Colors,
    DEFAULT_CELL_SIZE,
    ACTIONS,
    ActionsEnum,
    STATE_ICONS,
    ICONS,
    print,
    notify,
    assert,
    fileDownload,
};
