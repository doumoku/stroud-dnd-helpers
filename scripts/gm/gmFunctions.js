import { socket } from "../module.js";
import { identifyItem } from "../identification/identification.js";
import { moneyInternal } from "../money/money.js";

const RUN_MODES = {
    RUN_LOCAL: "RUN_LOCAL",
    RUN_REMOTE: "RUN_REMOTE",
    NO_RUN: "NO_RUN"
}
function areActiveGms() {
    return !!game.users.find(u => u.isGM && u.active);
}

async function getRunMode() {
    if (!areActiveGms()){
        ui.notifications.error("No Active GMs!");
        return RUN_MODES.NO_RUN;
    }
    if (!game.user.isGM){
        return RUN_MODES.RUN_REMOTE;
    }
    return RUN_MODES.RUN_LOCAL;
}

async function run(local, remote){
    let runMode = await getRunMode();
    switch(runMode) {
        case RUN_MODES.RUN_LOCAL:
            return await local();
        case RUN_MODES.RUN_REMOTE:
            return await remote();
    }
}

async function getTokenOrActor(uuid){
    let tokenOrActor = await fromUuid(uuid);
    return tokenOrActor.actor ? tokenOrActor.actor : tokenOrActor;
}

const INTERNAL_FUNCTIONS = new Set(["run", "getTokenOrActor", "registerFunctions"]);
export let gmFunctions = {
    "run": run,
    "getTokenOrActor": getTokenOrActor,
    "registerFunctions": async function _registerFunctions(socket) {
        for (let func in gmFunctions) {
            if (INTERNAL_FUNCTIONS.has(func)) {
                continue;
            }
            socket.register(func, this[func]);
        }
    },
    "createEffects": async function _createEffects(actorUuid, effectData /* [effectData] */) {
        let actor = await gmFunctions.getTokenOrActor(actorUuid);
        if (!actor) {
            ui.notifications.error($`Cannot find actor with uuid: ${actorUuid}`);
            return;
        }
        run(
            async () => actor.createEmbeddedDocuments("ActiveEffect", effectData),
            async () => socket.executeAsGM("createEffects", actorUuid, effectData) 
        );
    },
    "dismissTokens": async function _removeTokens(arrayOfTokenIds /* [tokenUuid] */) {
        if (!arrayOfTokenIds) {
            return;
        }
        if (!areActiveGms()) {
            ui.notifications.error("No Active GMs!");
            return;
        }
        run(
            async () => {
                arrayOfTokenIds.forEach(tokenId => {
                    let token = canvas.tokens.get(tokenId);
                    if (token) {
                        warpgate.dismiss(token)
                    }
                });
            },
            async () => socket.executeAsGM("dismissTokens", arrayOfTokenIds) 
        );
    },
    "deleteTokens": async function _deleteTokens(arrayOfTokenIds /* [tokenUuid] */) {
        if (!arrayOfTokenIds || arrayOfTokenIds.length == 0) {
            return;
        }
        run(
            async () => canvas.scene.deleteEmbeddedDocuments("Token", arrayOfTokenIds),
            async () => socket.executeAsGM("deleteTokens", arrayOfTokenIds) 
        ); 
    },
    "giveCurrency": async function _giveCurrency(actorUuids, totalPP, totalGP, totalEP, totalSP, totalCP){
        run(
            async () => moneyInternal.giveCurrency(actorUuids, totalPP, totalGP, totalEP, totalSP, totalCP),
            async () => socket.executeAsGM("giveCurrency", actorUuids, totalPP, totalGP, totalEP, totalSP, totalCP)
        );
    },
    "identifyItem": async function _identifyItem(alias, token, itemID){
        run(
            async () => identifyItem(alias, token, itemID),
            async () => socket.executeAsGM("identifyItem", alias, token, itemID)
        );
    },
    "removeEffects": async function _removeEffects(effectIDs) {
        if (!effectIDs || effectIDs.length == 0) {
            return;
        }
        run(
            async () => {
                for (const effectID of effectIDs) {
                    const effect = await fromUuid(effectID);
                    effect.delete();
                }
            },
            async () => socket.executeAsGM("removeEffects", effectIDs)
        );
    }
};