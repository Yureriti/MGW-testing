import { Colors } from "./generic.js";

var ASSET_UIDS = {
    ally: 0,
    goal: 0,
    hostile: 0,
    cover: 0,
};

var ASSET_CHAR_NAMES = {
    ".": "empty",
    c: "cover",
    a: "ally",
    g: "goal",
    h: "hostile",
};

var ASSET_NUM_NAMES = {
    0: "empty",
    1: "ally",
    2: "goal",
    3: "cover",
    4: "hostile",
};

// TODO: use this to fill in Asset<*> constructors
// prettier-ignore
var ASSET_METADATA = {
    "Empty": { "char": ".", "name": "empty", "num": 0 },
    "Cover": { "char": "C", "name": "cover", "num": 3 },
    "Ally": { "char": "A", "name": "ally", "num": 1 },
    "Goal": { "char": "G", "name": "goal", "num": 2 },
    "Hostile": { "char": "H", "name": "hostile", "num": 4 },
};

function rotateAroundCenter(node, rotation) {
    // https://konvajs.org/docs/posts/Position_vs_Offset.html#page-title
    // will work for shapes with top-left origin, like rectangle
    // current rotation origin (0, 0) relative to desired origin - center (node.width()/2, node.height()/2)
    const rotatePoint = ({ x, y }, rad) => {
        const rcos = Math.cos(rad);
        const rsin = Math.sin(rad);
        return { x: x * rcos - y * rsin, y: y * rcos + x * rsin };
    };
    const topLeft = { x: -node.width() / 2, y: -node.height() / 2 };
    const current = rotatePoint(topLeft, Konva.getAngle(node.rotation()));
    const rotated = rotatePoint(topLeft, Konva.getAngle(rotation));
    const dx = rotated.x - current.x;
    const dy = rotated.y - current.y;

    node.rotation(rotation);
    node.x(node.x() + dx);
    node.y(node.y() + dy);
}
/*
// keeping for demo purposes
Konva.Image.fromURL("./static/images/sprites/walking.png", function (soldier) {
    soldier.setAttrs({
        x: box.x + 2.5,
        y: box.y + 5,
        width: target.width(),
        height: target.height(),
        scaleX: 0.95,
        scaleY: 0.95,
    });
    soldier.on("contextmenu", (e) => {
        e.evt.preventDefault();
        // e.target.remove();
        e.target.destroy();
    });
    layer.add(soldier);
});
*/
class BaseAsset {
    fillColor; // shape color
    strokeColor; // shape outline color
    char; // single-character representation of the Asset type
    str; // string representation of the Asset Type
    num; // numeric representation of the Asset Type
    repr; // dictionary containing all representation of the Asset Type (e.g., char, num, str)
    shape; // Konva.js Shape
    label; // Konva.js Text to act as label
    loc;
    // origin; // origin of the shape inside a cell block
    actions = []; // action history of each Asset
    constructor(type, uid, size, x, y) {
        this.type = type;
        this.uid = uid;
        this.size = size;
        this.icol = x;
        this.irow = y;
        this.loc = [this.irow, this.icol];
    }

    updateInitShape() {
        this.shape.type = this.type;
        this.shape.uid = this.uid;
        this.shape.icol = this.icol;
        this.shape.irow = this.irow;
    }

    copy(deep = false) {
        if (deep) {
            // Object.assign(
            //     Object.create(
            //         Object.getPrototypeOf(asset.shape),
            //         Object.getOwnPropertyDescriptors(asset.shape)
            //     )
            // );
            alert("Error: Function is unimplemented");
        }
        return Object.create(
            Object.getPrototypeOf(this),
            Object.getOwnPropertyDescriptors(this)
        );
    }
    state(kwargs) {
        return {};
    }
    getLabelMetadata() {
        return {};
    }
    updateLabel() {}

    repr2(type = null) {
        let r = { num: this.num, char: this.char, str: this.str };
        if (type !== undefined || type !== null)
            // & type is valid
            return r[type];
        return r;
    }
}

class Empty extends BaseAsset {
    fillColor = Colors.WHITE;
    strokeColor = Colors.GREY;
    str = "empty";
    char = ASSET_METADATA.Empty.char;
    num = ASSET_METADATA.Empty.num;
    repr = { [this.num]: this.char }; // -1: .
    // box;

    constructor(type, uid, { size, x, y, ...kwargs }) {
        super(type, uid, size, x, y);
        this.shape = new Konva.Rect({
            x: x * size,
            y: y * size,
            width: size - 1,
            height: size - 1,
            fill: this.fillColor.hex,
            stroke: this.strokeColor.hex,
        });

        // this.box = this.shape.getClientRect(); // needed?
        // this.shape.on("click", handleClickEvent);
    }
    handleClickEvent({ evt, pointerId, target, currentTarget, type }) {
        // TODO: this function may not be needed at all
        // console.log(evt, pointerId, target, currentTarget, type);
        if (evt === undefined || evt === null || evt.button === 2) {
            // ignore left-clicks and self-fire events (e.g., simulated click)
            return;
        }
        // TODO: this may need to change for each asset; this works only for circles right now
        const box = target.getClientRect();
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        const w = target.width() / 2;

        return [x, y, w];
    }
}

class Ally extends BaseAsset {
    // Konva aesthetics
    fillColor = Colors.BLUE;
    strokeColor = Colors.BLUE;
    fillColorCover = Colors.DARK_BLUE;
    strokeColorCover = Colors.DARK_BLUE;
    shrinkMagnitudeCover = 0.65;
    radius;
    linesOfSight = [];

    // MGW base representation
    str = "ally";
    char = "A";
    num = 1;
    repr = { [this.num]: this.char }; // 1: F

    // MGW logic info
    inCoverMode = false; // assumes asset is never in cover at start
    isDetected = true; // inverse of `inCoverMode`
    atGoal = false; // assumes asset is never at the goal at start
    goalState = { atGoal: false, goalUid: null };

    constructor(type, uid, { size, x, y, ...kwargs }) {
        super(type, uid, size, x, y);
        this.radius = size / 2;
        this.shape = new Konva.Circle(this.Konva_ShapeMetadata());
        this.label = new Konva.Text(this.Konva_LabelMetadata());
    }

    state(kwargs) {
        /** Get or set state attributes
         *
         */
        if (kwargs === undefined || kwargs === null) {
            return {
                inCoverMode: this.inCoverMode,
                isDetected: this.isDetected,
                atGoal: this.atGoal,
                goalState: this.goalState,
                loc: [this.irow, this.icol],
            };
        }
        let _inCoverMode = this.inCoverMode;
        let _isDetected = this.isDetected;
        // console.log("pre | cover: ", _inCoverMode, "| detected", _isDetected);
        Object.assign(this, kwargs);
        // console.log(
        //     "post | cover: ",
        //     _inCoverMode,
        //     " == ",
        //     this.inCoverMode,
        //     " ||| detected",
        //     _isDetected
        // );
        if (_inCoverMode && !this.inCoverMode) {
            this.toggleCoverOff();
        } else if (!_inCoverMode && this.inCoverMode) {
            this.toggleCoverOn();
        }
        // if (this.inCoverMode != _inCoverMode) {
        //     // if there was a mismatch, toggle
        //     this.toggleCover();
        // }
        // if(!(this.isDetected && kwargs["isDetected"])){
        //     this.updateLineOfSight
        // }
        // console.log("cover: ", _inCoverMode, "| detected", _isDetected)
    }

    moveTo(newRow, newCol) {
        // update properties
        this.icol = newCol;
        this.irow = newRow;
        this.shape.x(newCol * this.size + this.radius);
        this.shape.y(newRow * this.size + this.radius);
        this.shape.icol = newCol;
        this.shape.irow = newRow;
        // update renderings
        this.updateLineOfSight();
        this.updateLabel();
    }
    record(action) {
        this.actions.push({
            ...this.state(),
            action: action,
        });
    }

    toggleCoverOff() {
        // switch out of cover
        let radius = this.shape.radius();
        this.shape.radius(radius / this.shrinkMagnitudeCover);
        this.shape.fill(this.fillColor.hex);
        this.label.fontSize(this.label.fontSize() / this.shrinkMagnitudeCover);
    }
    toggleCoverOn() {
        let radius = this.shape.radius();

        this.shape.radius(radius * this.shrinkMagnitudeCover);
        this.shape.fill(this.fillColorCover.hex);
        this.label.fontSize(this.label.fontSize() * this.shrinkMagnitudeCover);
    }

    toggleCover() {
        // let radius = this.shape.radius();
        if (this.inCoverMode) {
            // switch out of cover
            this.toggleCoverOff();
            this.inCoverMode = false;
            this.updateLineOfSight();
        } else if (!this.inCoverMode) {
            // switch to cover mode
            this.toggleCoverOn();
            this.inCoverMode = true;
            this.updateLineOfSight();
        }
    }

    Konva_ShapeMetadata() {
        return {
            x: this.icol * this.size + this.size / 2,
            y: this.irow * this.size + this.size / 2,
            radius: this.radius,
            fill: this.fillColor.hex,
            strokeWidth: 1,
            stroke: "black",
            shadowForStrokeEnabled: false,
        };
    }
    Konva_LabelMetadata() {
        const widthScale = 0.3;
        const heightScale = 0.2;
        const fontScale = 0.5;
        const labelFont = "black";
        return {
            text: `${this.char}${this.uid}`,
            fontSize: this.size * fontScale,
            x: this.icol * this.size + this.radius - this.size * widthScale,
            y: this.irow * this.size + this.radius - this.size * heightScale,
            fill: labelFont,
        };
    }

    Konva_LineOfSightMetadata() {
        return {
            // points: points,
            fill: "red",
            stroke: "red",
            strokeWidth: 2,
            opacity: 0.25,
            hitStrokeWidth: 0,
        };
    }

    setLineOfSight(destX, destY) {
        let los = new Konva.Line({
            points: [this.shape.x(), this.shape.y(), destX, destY],
            ...this.Konva_LineOfSightMetadata(),
        });
        this.linesOfSight.push(los);
    }

    toggleLineOfSightOn() {
        for (let los of this.linesOfSight) {
            los.visible(true);
        }
    }
    toggleLineOfSightOff() {
        for (let los of this.linesOfSight) {
            los.visible(false);
        }
    }

    updateLineOfSight(destX = -1, destY = -1) {
        let updateDest = !(destX == -1 && destY == -1);
        for (let los of this.linesOfSight) {
            if (this.inCoverMode && !this.isDetected) {
                // this.isDetected
                los.visible(false);
            } else {
                if (!updateDest) {
                    let points = los.points();
                    [destX, destY] = [points[2], points[3]];
                }
                los.points([this.shape.x(), this.shape.y(), destX, destY]);
                los.visible(true);
            }
        }
    }
    updateLabel() {
        this.label.position({
            x: this.icol * this.size + this.radius - this.size * 0.3,
            y: this.irow * this.size + this.radius - this.size * 0.2,
        });
    }

    repr3(type = null) {
        let r = { num: this.num, char: this.char, str: this.str };
        if (type != undefined || type != null) {
            // & type is valid
            return r[type];
        }
        return r;
    }
}

class Goal extends BaseAsset {
    fillColor = Colors.GREEN;
    str = "goal";
    char = "G";
    num = 2;
    repr = { [this.num]: this.char }; // 3: O (objective)
    // shape;
    constructor(type, uid, { size, x, y, ...kwargs }) {
        super(type, uid, size, x, y);

        this.shape = new Konva.RegularPolygon({
            x: x * size + size / 2,
            y: y * size + size / 2,
            sides: 3,
            radius: size * 0.57,
            fill: this.fillColor.hex,
            strokeWidth: 1,
            stroke: "black",
            shadowForStrokeEnabled: false,
        });
        // this.label = new Konva.Text(this.Konva_LabelMetadata());

        // this.shape.setZIndex(0);
        // this.shape.zIndex(0);
        this.label = new Konva.Text(this.Konva_LabelMetadata());

        rotateAroundCenter(this.shape, 90);
        // this.label = new Konva.Text(this.Konva_LabelMetadata());

        let scaleX = 1.32;
        this.shape.x(this.shape.x() - size * scaleX);
    }

    Konva_LabelMetadata() {
        const widthScale = 0.35;
        const heightScale = 0.3;
        const fontScale = 0.4;
        const labelFont = "black";
        return {
            text: `${this.char}${this.uid}`,
            fontSize: this.size * fontScale,
            x: this.icol * (3 * this.size) * widthScale,
            y:
                Math.max(heightScale, this.irow) *
                (3.75 * this.size) *
                heightScale,
            fill: labelFont,
        };
    }
}

class Cover extends BaseAsset {
    fillColor = Colors.GREY;
    str = "cover";
    char = "C";
    num = 3;
    repr = { [this.num]: this.char }; // 0: C
    constructor(type, uid, { size, x, y, ...kwargs }) {
        super(type, uid, size, x, y);
        this.shape = new Konva.Rect({
            x: x * size,
            y: y * size,
            width: size - 1,
            height: size - 1,
            fill: this.fillColor.hex,
            shadowForStrokeEnabled: false,

            // strokeWidth: 1,
            // stroke: "black",
        });
    }
}

class Hostile extends BaseAsset {
    fillColor = Colors.RED;
    str = "hostile";
    char = "H";
    num = 4;
    repr = { [this.num]: this.char }; // 2: H
    constructor(type, uid, { size, x, y, ...kwargs }) {
        super(type, uid, size, x, y);
        this.shape = new Konva.Rect({
            x: x * size,
            y: y * size,
            width: size,
            height: size,
            fill: this.fillColor.hex,
            strokeWidth: 1,
            stroke: "black",
            shadowForStrokeEnabled: false,
        });

        rotateAroundCenter(this.shape, 45);
        let scaleShape = 1.5;
        let scaleY = 0.25;
        this.shape.width(this.shape.width() / scaleShape);
        this.shape.height(this.shape.height() / scaleShape);
        this.shape.y(this.shape.y() + size * scaleY);

        this.label = new Konva.Text(this.Konva_LabelMetadata());
    }
    origin() {
        // this.size / 2
        return [this.shape.x(), this.shape.y() + this.size / 2];
    }
    Konva_LabelMetadata() {
        const widthScale = -0.2;
        const heightScale = -0.3;
        const fontScale = 0.5;
        const labelFont = "black";
        return {
            text: `${this.char}${this.uid}`,
            fontSize: this.size * fontScale,
            x: this.icol * this.size - this.size * widthScale,
            y: this.irow * this.size - this.size * heightScale,
            fill: labelFont,
        };
    }
}

class AssetFactory {
    constructor() {
        this.create = function (type, uid, ...kwargs) {
            var asset;
            kwargs = kwargs[0];
            switch (type) {
                case ASSET_METADATA.Ally.name:
                    asset = new Ally(type, uid, kwargs);
                    break;
                case ASSET_METADATA.Goal.name:
                    asset = new Goal(type, uid, kwargs);
                    break;
                case ASSET_METADATA.Cover.name:
                    asset = new Cover(type, uid, kwargs);
                    break;
                case ASSET_METADATA.Hostile.name:
                    asset = new Hostile(type, uid, kwargs);
                    break;
                case ASSET_METADATA.Empty.name:
                    asset = new Empty(type, uid, kwargs);
                    break;
            }

            asset.updateInitShape();

            return asset;
        };
    }
}

var assetFactory = new AssetFactory();

export { assetFactory, ASSET_CHAR_NAMES, ASSET_METADATA, ASSET_NUM_NAMES };
