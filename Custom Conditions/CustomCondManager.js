console.log("Lumos's Custom Conditions Manager | Executing setup script...");

(async function CustomConditionManager() {
    let socket;
    const showUIMessage = "showUIMessage";

    async function init() {
        if (game.modules.get("socketlib")?.active) {
            // Piggybacking off the advanced-macros module which is registered.
            socket = socketlib.modules.get("advanced-macros")

            game.customConditions = {};
            //game.customConditions.forceInit = Init;

            const bindGMFunc = (name, binding) => {
                socket.functions.delete(name);
                socket.register(name, binding);
                return async (...args) => {
                    await socket.executeAsGM(name, ...args);
                };
            }

            game.customConditions.apply = bindGMFunc("applyCond", apply);
            game.customConditions.remove = bindGMFunc("removeCond", remove);

            // Set up a simple "execute function" binding, used 
            socket.functions.delete(showUIMessage);
            socket.register(showUIMessage, (message, _) => ui.notifications.warn(message));

            console.log("Lumos's Custom Condition Manager | SUCCESSFULLY initialised");
        }
        else {
            console.error("Lumos's Custom Condition Manager | ERROR: socketlib is not available");
        }
    }

    async function showMessageForUser(userId, message, state) {
        await socket.executeAsUser(showUIMessage, userId, message, state);
    }

    function checkRunningAsGM(userId) {
        if (!game.user.isGM) {
            showMessageForUser(userId, "Only the GM can call this directly.");
            return false;
        }
        return true;
    }

    function getUserTargets(userId) {
        const targets = game.users.get(userId).targets || [];
        if (targets.size === 0) {
            showMessageForUser(userId, "No tokens targeted.");
            return null;
        }
        return targets;
    }
    
    apply = async (userId, parameters) => await trigger(userId, parameters, true);
    remove = async (userId, parameters) => await trigger(userId, parameters, false);

    async function trigger(userId, parameters, isCreating) {
        if (!checkRunningAsGM(userId)) return;

        const targets = getUserTargets(userId);
        if (!targets) return;

        if (parameters.isStatus) 
            await (isCreating ? applyStatusEffect : removeStatusEffect)(userId, parameters, targets);
        else
            await (isCreating ? applyCustomCondition : removeCustomCondition)(userId, parameters, targets);
    }

    const AffectedToken = {
        ConditionAdded: 0,
        ConditionIncreased: 1,
        ConditionRemoved: 2,
        ConditionDecreased: 3,
    }

    async function applyCustomCondition(userId, parameters, targets) {
        const { conditionId, _, increaseLevel, setDuration } = parameters;

        const [cond, condIdentifier] = getCustomConditionItem(conditionId);

        // On actors who don't have this condition yet, we'll add a new item.
        const newCondToAdd = createCustomConditionItem(cond, condIdentifier, setDuration);
        let affectedTokens = [];
        for (let token of targets) {
            const actorCond = getCustomBuffOnActor(token.actor, condIdentifier);

            if (actorCond && !increaseLevel.active && !setDuration.active) continue;

            if (!actorCond) {
                token.actor.createEmbeddedDocuments("Item", [newCondToAdd]);
                affectedTokens.push({token: token, state: AffectedToken.ConditionAdded})
            }
            else {
                const updates = {}
                if (increaseLevel.active) {
                    updates["system.level"] = parseInt(actorCond.system.level, 10) + increaseLevel.value;
                }
                if (setDuration.active) {
                    updates["system.duration"] = newCondToAdd.system.duration;

                    const embeddedActiveEffect = actorCond.effects.find(x => x.name === cond.name);
                    embeddedActiveEffect.update({"duration": createStatusEffectDuration(setDuration)})
                }
                actorCond.update(updates);
                affectedTokens.push({token: token, state: AffectedToken.ConditionIncreased})
            }
        }

        renderChatMessage(userId, cond.name, cond.img, false, true, affectedTokens);
    }

    async function removeCustomCondition(userId, parameters, targets) {
        const { conditionId, _, decreaseLevel } = parameters;

        const [cond, condIdentifier] = getCustomConditionItem(conditionId);

        let affectedTokens = [];
        for (let token of targets) {
            const actorCond = getCustomBuffOnActor(token.actor, condIdentifier);
            if (!actorCond) continue;

            // If the current level is greater than zero but won't be removed by the decrease, do it
            const levelDecrease = parseInt(actorCond.system.level, 10) - decreaseLevel.value;
            if (decreaseLevel.active && actorCond.system.level > 0 && levelDecrease > 0) {
                actorCond.update({"system.level": levelDecrease});
                affectedTokens.push({token: token, state: AffectedToken.ConditionDecreased})
            } 
            // Otherwise just remove the condition entirely
            else {
                token.actor.deleteEmbeddedDocuments("Item", [actorCond.id]);
                affectedTokens.push({token: token, state: AffectedToken.ConditionRemoved})
            }
        }

        renderChatMessage(userId, cond.name, cond.img, false, false, affectedTokens);
    }
    


    const itemTag = "appliedCustomCondition";
    const itemPrefix = itemTag + "_";
    getCustomBuffTag = (identifier) => itemPrefix + identifier;
    getCustomBuffOnActor = (actor, identifier) => actor.items
        .find(x => x.system.tag == identifier && x.type === "buff" && x.system.tags.includes(itemTag));

    function getCustomConditionItem(itemId) {
        const item = game.items.get(itemId);
        return [item.toObject(), getCustomBuffTag(item.system.tag)];
    }

    function createCustomConditionItem(cond, newIdentifier, setDuration) {
        cond.system.active = true;
        cond.system.subType = "misc";
        cond.system.tag = newIdentifier;

        // Duration override
        if (setDuration.active && setDuration.value > 0) {
            const durSecs = getTotalSecondsOfCustomDuration(setDuration);
            cond.system.duration.units = "round"; // Seconds not supported here
            cond.system.duration.value = (durSecs / CONFIG.time.roundTime).toLocaleString();
            cond.system.duration.totalSeconds = durSecs;

            cond.system.duration.start = game.time.worldTime;
            // End timing type. Override our custom one with one the system can understand.
            cond.system.duration.end = setDuration.end === "initiativeEnd" 
                ? "initiative" 
                : setDuration.end;
        }

        // If it doesn't include a "custom condition", add one; this gets converted into an embedded active effect
        if (!cond.system.conditions.custom.includes(cond.name)) 
            cond.system.conditions.custom.push(cond.name);

        if (!cond.system.tags.includes(itemTag)) 
            cond.system.tags.push(itemTag);

        const autoDelCallName = itemPrefix + "Autodelete";
        if (!cond.system.scriptCalls) cond.system.scriptCalls = [];
        if (!cond.system.scriptCalls.find(x => x.name === autoDelCallName)) {
            cond.system.scriptCalls.push({
                "_id": autoDelCallName,
                "name": autoDelCallName,
                "img": "icons/svg/dice-target.svg",
                "type": "script",
                "value": "if (!state && actor.items.get(item.id)) actor.deleteEmbeddedDocuments(\"Item\", [ item.id ])",
                "category": "toggle",
                "hidden": true
            });
        }
        return cond;
    }




    async function applyStatusEffect(userId, parameters, targets) {
        const { conditionId, _, __, setDuration } = parameters;

        const statusCond = pf1.registry.conditions.get(conditionId);
        const effect = createStatusEffect(statusCond.name, statusCond.texture, conditionId, setDuration);

        let affectedTokens = [];
        for (let token of targets) {
            const actorEffect = token.actor.effects.find(x => x.name === statusCond.name);
             // Status effects are never stackable (but their durations may be updated)    
            if (actorEffect && !setDuration.active) continue;

            if (!actorEffect)
                token.actor.createEmbeddedDocuments("ActiveEffect", [effect]);
            else
                actorEffect.update({"duration": effect.duration});
            affectedTokens.push({token: token, state: AffectedToken.ConditionAdded})
        }

        renderChatMessage(userId, effect.name, effect.icon, true, true, affectedTokens);
    }

    async function removeStatusEffect(userId, parameters, targets) {
        const { conditionId, _, __ } = parameters;

        const effect = pf1.registry.conditions.get(conditionId);

        let affectedTokens = [];
        for (let token of targets) {
            const actorEffect = token.actor.effects.find(x => x.name === effect.name);
            if (!actorEffect) continue;
    
            token.actor.deleteEmbeddedDocuments("ActiveEffect", [actorEffect._id]);
            affectedTokens.push({token: token, state: AffectedToken.ConditionRemoved})
        }

        renderChatMessage(userId, effect.name, effect.texture, true, false, affectedTokens);
    }

    function createStatusEffect(name, icon, statusName, setDuration) {
        const effect = {
            name: name,
            icon: icon,
            statuses: [ statusName ],
            flags: { 
                pf1: {
                    autoDelete: true
                }
            }
        };
        if (game.combat) {
            effect.flags.pf1.initiative = game.combat.turns[game.combat.turn].initiative;
        }
        if (setDuration.active) {
            // Not sure why active status effects are always set to a number of seconds even when 
            // you use rounds (when you right-click on a status in the buffs page), but I'm following suit, 
            // just to be safe... and also to exploit the way active effect expiry works
            effect.duration = createStatusEffectDuration(setDuration);
        }
        return effect;
    }

    function createStatusEffectDuration(setDuration) {
        console.log("status effect");
        const durationSecs = getTotalSecondsOfCustomDuration(setDuration);
        return {
            "startTime": game.time.worldTime,
            "duration": durationSecs,
            "seconds": durationSecs,
            "rounds": null,
            "turns": null,
            "startRound": game.combat ? game.combat.round : null,
            "startTurn": game.combat ? game.combat.turn : null,
            "type": "seconds",
        }
    }

    function getTotalSecondsOfCustomDuration(setDuration) {
        let secs = (() => { switch (setDuration.units) {
            case "round": return setDuration.value * CONFIG.time.roundTime;
            case "minute": return setDuration.value * 60;
            case "hour": return setDuration.value * 3600;
            default: return setDuration.value;
        }})();
        // Dirty hack to support our custom "initiative-end" timing.
        if (setDuration.end === "initiativeEnd") {
            secs++;
        }
        return secs;
    }


    
    async function renderChatMessage(userId, condName, condIcon, isStatus, eventWasCreation, affectedTokens) {
        if (affectedTokens.length === 0) {
            showMessageForUser(userId, eventWasCreation
                ? "All selected targets already had the chosen condition. Nothing happened."
                : "No selected targets had the chosen condition. Nothing happened.");
            return;
        }

        const tokenStateMap = {
            [AffectedToken.ConditionAdded]: ["Applied to:", []],
            [AffectedToken.ConditionIncreased]: ["Increased on:", []],
            [AffectedToken.ConditionRemoved]: ["Removed from:", []],
            [AffectedToken.ConditionDecreased]: ["Decreased on:", []],
        };
        affectedTokens.forEach(({token, state}) => {
            tokenStateMap[state][1].push(token);
        });

        const getHtmlForToken = token => `
            <div style="display: inline-flex; align-items: center; margin-right: 5px">
                <img src="${token.document.texture.src}" width="36" height="36" style="border: none; margin-right: 5px;">
                <a class="focus-token content-link" data-token-id="${token.id}">${token.name}</a>
            </div>
        `;

        const sectionHtml = Object.values(tokenStateMap)
            .map(([stateSectionText, tokens]) => tokens.length 
                ?  `<div class="card-content">
                        <h4>${stateSectionText}</h4>
                        ${tokens.map(getHtmlForToken).join(" ")}
                    </div>` 
                : "")
            .join("");

        const chatMessageContent = `
            <div class="pf1 chat-card">
                <header class="card-header type-color flexrow">
                    <img src="${condIcon}" title="${condName}" width="36" height="36" style="border: 0;${isStatus 
                        ? `${condName === "Battered" ? "mix-blend-mode: multiply;" : ""}filter: invert(1)`: ""}">
                    <h3 class="item-name">${condName}</h3>
                </header>
                ${sectionHtml}
            </div>
        `;

        const targetUser = game.users.get(userId);
        const userControlledToken = targetUser.character?.getActiveTokens()[0] || 
            canvas.tokens.controlled.find(t => t.actor?.id === targetUser.character?.id) ||
            canvas.tokens.controlled[0];
        const speaker = userControlledToken
            ? {token: userControlledToken.id, actor: userControlledToken.actor?.id, alias: userControlledToken.name}
            : targetUser.character
                ? {actor: targetUser.character.id, alias: targetUser.character.name}
                : {user: userId, alias: targetUser.name};

        const messageId = foundry.utils.randomID();
        let chatMessage = ChatMessage.create({ // this is a promise
            user: userId,
            speaker: speaker,
            content: chatMessageContent,
            type: CONST.CHAT_MESSAGE_TYPES.OTHER,
            flags: { "CustomCondMessage": messageId }
        });
        // Add click event listener to the links
        Hooks.once('renderChatMessage', (message, [html]) => {
            if (message.flags["CustomCondMessage"] == messageId) {
                html.querySelectorAll('.focus-token').forEach(link => {
                    link.addEventListener('click', (event) => {
                        event.preventDefault();
                        const tokenId = event.currentTarget.dataset.tokenId;
                        const token = canvas.tokens.get(tokenId);
                        if (token) {
                            canvas.animatePan({ x: token.x, y: token.y });
                        }
                    });
                });
            }
        });
        await chatMessage;
    }


    await init();
})();