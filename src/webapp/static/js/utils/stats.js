/**
 * Statitistics to calculate for (original) ManeuverGame
 * time
 * time_out_of_cover
 * objectives_reached
 * distance_from_other_friendlies
 * distance_from_hostiles
 * distance_from_objectives
 */

print = console.log;
const allyAssetType = "ally";
const hostileAssetType = "hostile";
const goalAssetType = "goal";

function blockDistance({ x1, y1, x2, y2 }) {
    /**
     * Manhattan distance
     */
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}
function euclideanDistance({ x1, y1, x2, y2 }) {
    /**
     * Euclidean distance
     */
    let magnitude = 3;
    return Math.hypot(x2 - x1, y2 - y1).toFixed(magnitude);
}

function calcDistances(y1, x1, y2, x2) {
    return {
        block: blockDistance({ x1, y1, x2, y2 }),
        euclid: euclideanDistance({ x1, y1, x2, y2 }),
    };
}

function calcDistToAssets(asset, assets) {
    let dists = [];
    for (let [ts1, state] of asset.actions.entries()) {
        for (let asset2 of assets.values()) {
            if (asset.uid == asset2.uid && asset.type == asset2.type) continue;
            let ts = Math.min(ts1, asset2.actions.length - 1);
            let [row1, col1] = state.loc;
            // stationary asset
            let [row2, col2] = asset2.loc;
            if (asset2.type == allyAssetType)
                [row2, col2] = asset2.actions[ts].loc;

            dists.push({ [asset2.uid]: calcDistances(col1, row1, col2, row2) });
        }
    }
    return dists;
}

var calc = {
    timeOutOfCover: function (ally) {
        let cumrate = [];
        let counter = 0;
        for (let state of ally.actions.values()) {
            counter = state.isDetected ? counter + 1 : 0;
            cumrate.push(counter);
        }
        return cumrate;
    },

    goalsReached: function (ally, uniqueGoals = true) {
        /**
         * @note this is not global, but `tsGoalsReached` can be used to calculate it
         *
         * @TODO should this also account for reaching previously reached goals (again)?
         *
         */
        let cumrate = [];
        let goals = [];
        let counter = 0;
        let tsGoalsReached = {};
        for (let [ts, state] of ally.actions.entries()) {
            let gs = state.goalState;
            if (gs.atGoal) {
                if (uniqueGoals && !goals.includes(gs.goalUid)) counter++;
                else if (!uniqueGoals) counter++;
                goals.push(gs.goalUid);
                if (!tsGoalsReached.hasOwnProperty(gs.goalUid))
                    tsGoalsReached[gs.goalUid] = [];
                tsGoalsReached[gs.goalUid].push(ts);
            }
            cumrate.push(counter);
        }
        return cumrate; // , tsGoalsReached;
    },
    goalsReachedGlobally: function (allies, uniqueGoals) {
        /**
         * @todo
         */
    },
    distToAllies: function (ally, allies) {
        return calcDistToAssets(ally, allies);
    },
    distToHostiles: function (ally, hostiles) {
        print(hostiles);
        return calcDistToAssets(ally, hostiles);
    },
    distToGoals: function (ally, goals) {
        return calcDistToAssets(ally, goals);
    },
};

function calcStatistics(assets) {
    /**  Statitistics to calculate for (original) ManeuverGame
     * @note statistics are from an Ally only perspective
     *
     * total_time:                      <scalar>
     * time_out_of_cover:               <scalar> time steps out of cover / total_time
     * objectives_reached:              <scalar> # reached / goals total
     * distance_from_other_friendlies : <list> distance at each time step
     * distance_from_hostiles :         <list> distance at each time step
     * distance_from_objectives :       <list> distance at each time step
     *
     * @TODO is time the same for each asset, or does each asset have their own time
     *          e.g., is time = {overall time | individual time}
     *
     * @todo: if using overall time, account for missing time being in/out of cover
     */

    let results = { assets: { allies: [] } };

    for (const [allyIdx, ally] of assets[allyAssetType].entries()) {
        /**
         * @TODO can refactor this to avoid doubling for-loops in each subsequent function call
         */
        let result = {};
        result[ally.uid] = {
            timesteps: ally.actions.length,
            goalsReached: calc.goalsReached(ally),
            timeOutOfCover: calc.timeOutOfCover(ally),
            distToAllies: calc.distToAllies(ally, assets[allyAssetType]),
            distToHostiles: calc.distToHostiles(ally, assets[hostileAssetType]),
            distToGoals: calc.distToGoals(ally, assets[goalAssetType]),
            states: ally.actions,
        };
        results["assets"]["allies"].push(result);
    }
    return results;
}

export { calcStatistics };
