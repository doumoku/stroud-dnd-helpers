import { sdndConstants } from "./constants.js";
import { dialog } from "./dialog/dialog.js";

export let tokens = {
    "manageTokens": async function _manageTokens() {
        if (!game.user.isGM) {
            ui.notifications.notify(`Can only be run by the gamemaster!`);
            return;
        }
        let options = [
            { label: "Show Token Art", value: "showTokenArt" },
            { label: "Toggle Npc Name", value: "toggleNpcName" },
            { label: "Push Prototype Changes", value: "pushTokenPrototype" }
        ];
        let option = await dialog.createButtonDialog("Manage Tokens", options);
        if (!option) {
            return;
        }
        let tokenFunction = tokens[option];
        await tokenFunction();
    },
    "releaseInvalidTokens": function _releaseInvalidTokens(allowInCombat) {
        function shouldRelease(token, allowInCombat) {
            const excludedFolders = [sdndConstants.FOLDERS.ACTOR.LOOT, sdndConstants.FOLDERS.ACTOR.TEMP, sdndConstants.FOLDERS.ACTOR.TRAPS];
            if (!allowInCombat && token.inCombat) {
                return true;
            }
            var folderName = token?.actor?.folder?.name ?? "root";
            if (excludedFolders.includes(folderName)) {
                return true;
            }
            if (token.actor.effects.filter(e => e.label == "Dead").length > 0) {
                return true;
            }

            return false;
        }
        let tokensToRelease = canvas.tokens.controlled.filter(t => shouldRelease(t, allowInCombat));
        tokensToRelease.forEach(t => {
            t.release();
        });
    },
    "showTokenArt": async function _showTokenArt() {
        if (!game.user.isGM) {
            ui.notifications.notify(`Can only be run by the gamemaster!`);
            return;
        }
        let actor = canvas.tokens.controlled[0]?.actor;
        if (!actor) {
            ui.notifications.notify('No token selected!');
            return;
        }
        let ip = new ImagePopout(actor.img, { uuid: actor.uuid });
        ip.render(true); // Display for self
        ip.shareImage(); // Display to all other players
    },
    "toggleNpcName": async function _toggleNpcName() {
        if (!game.user.isGM) {
            ui.notifications.notify(`Can only be run by the gamemaster!`);
            return;
        }
        if (canvas.tokens.controlled.length == 0) {
            ui.notifications.notify('No selected token');
            return;
        }

        const CUB_SCOPE = "combat-utility-belt";
        const CUB_HIDENAMES = "enableHideName";

        var currentToken = canvas.tokens.controlled[0];
        let strVal = "";
        // maybe exit if it is a player character
        if (currentToken.document.displayName == CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER) {
            currentToken.document.update({ "displayName": CONST.TOKEN_DISPLAY_MODES.HOVER });
            currentToken.actor.setFlag(CUB_SCOPE, CUB_HIDENAMES, false);
            strVal = "Hover Anyone";
            ChatMessage.create({
                content: `You will now recognize ${currentToken.name}.`,
                type: CONST.CHAT_MESSAGE_TYPES.OOC
            });
        }
        else if (currentToken.document.displayName == CONST.TOKEN_DISPLAY_MODES.HOVER) {
            currentToken.document.update({ "displayName": CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER });
            currentToken.actor.setFlag(CUB_SCOPE, CUB_HIDENAMES, true);
            strVal = "Hover Owner";
        }

        if (strVal.length > 0) {
            ChatMessage.create({
                content: `${currentToken.name} has been set to ${strVal}`,
                whisper: ChatMessage.getWhisperRecipients('GM'),
            });
        }
        else {
            ChatMessage.create({
                content: `Nothing changed...`,
                whisper: ChatMessage.getWhisperRecipients('GM'),
            });
        }
    },
    "pushTokenPrototype": pushTokenPrototype
};

async function pushTokenPrototype(actor) {
    if (!game.user.isGM) {
        ui.notifications.notify(`Can only be run by the gamemaster!`);
        return;
    }
    if (!actor) {
        ui.notifications.notify('No token selected!');
        return;
    }
    let tokens = actor.getActiveTokens();

    let updates = tokens.map(t => {
        let token = duplicate(t.document);
        return mergeObject(token, actor.token ?? actor.prototypeToken);
    });

    if (!updates || updates.length == 0){
        return;
    }

    canvas.scene.updateEmbeddedDocuments("Token", updates);
}