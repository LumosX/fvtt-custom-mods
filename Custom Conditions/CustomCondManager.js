console.log("Lumos's Custom Conditions Manager | Executing setup script...");

(async function CustomConditionManager() {
    let socket;
    const showUIMessage = "showUIMessage";

    async function init() {
        if (game.modules.get("socketlib")?.active) {
            // Piggybacking off the advanced-macros module which is registered.
            socket = socketlib.modules.get("advanced-macros")

            // Perform pre-init
            preInit_CleanExistingHooks();
            // Patch system functions
            Hooks.on("pf1PostReady", () => onPF1PostReady_ApplyMonkeyPatches());

            game.customConditions = {};

            const bindGMFunc = (name, binding) => {
                socket.functions.delete(name);
                socket.register(name, binding);
                return async (...args) => {
                    await socket.executeAsGM(name, ...args);
                };
            }

            game.customConditions.apply = bindGMFunc("applyCond", apply);
            game.customConditions.remove = bindGMFunc("removeCond", remove);

            socket.functions.delete(showUIMessage);
            socket.register(showUIMessage, (message, _) => ui.notifications.warn(message));

            game.customConditions.hook = Hooks.on("createActiveEffect", onCreateActiveEffect_HandleInitiativeEndDurations);

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


    function preInit_CleanExistingHooks() {
        // Init hook we need to handle special AE durations
        if (game.customConditions?.hook)
            Hooks.off("createActiveEffect", game.customConditions.hook)
    }

    function onPF1PostReady_ApplyMonkeyPatches() {
        // Patch the pf1e effect expiry function. It's busted, and fails to track "initiative"-ended events properly.
        pf1.documents.actor.ActorPF.prototype.expireActiveEffects = patchedFunc_ExpireActiveEffects;
        console.log("Lumos's Custom Condition Manager | Function patch applied.")
    }


    // Called by a hook. Used to properly initialise effects that have been set up with the custom "initiativeEnd" end timing.
    async function onCreateActiveEffect_HandleInitiativeEndDurations(newEffect, options, userId) {
        if (userId !== game.user.id) return;

        const initEndEffectTargetInit = newEffect.flags?.lumos?.initiativeEnd ?? newEffect.parent.flags?.lumos?.initiativeEnd;
        if (!initEndEffectTargetInit) return;

        console.log("create hook triggered", newEffect, initEndEffectTargetInit);
        newEffect.update(getEffectUpdatesForInitEndEffect(initEndEffectTargetInit));
    }


    function getInitiativeForInitEndEffect() {
        return game.combat.turns[game.combat.turn].initiative - 0.001;
    }

    function getEffectUpdatesForInitEndEffect(targetInitiative) {
        return {
            "flags.pf1.duration.end": "initiative",
            "flags.pf1.duration.initiative": targetInitiative,
            "flags.pf1.initiative": targetInitiative,
            "system.initiative": targetInitiative
        }
    }


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
                affectedTokens.push({ token: token, state: AffectedToken.ConditionAdded })
            }
            else {
                const updates = {}
                if (increaseLevel.active) {
                    updates["system.level"] = parseInt(actorCond.system.level, 10) + increaseLevel.value;
                }
                if (setDuration.active) {
                    updates["system.duration"] = newCondToAdd.system.duration;

                    const updateInitEnd = game.combat && setDuration.end === "initiativeEnd";
                    const targetInit = newCondToAdd.flags.lumos?.initiativeEnd;

                    if (updateInitEnd)
                        updates["flags.lumos.initiativeEnd"] = targetInit;

                    const effectUpdates = {
                        "duration": createStatusEffectDuration(setDuration),
                        ...(updateInitEnd && getEffectUpdatesForInitEndEffect(targetInit))
                    };
                    actorCond.effect.update(effectUpdates);
                }
                actorCond.update(updates);
                affectedTokens.push({ token: token, state: AffectedToken.ConditionIncreased })
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
                actorCond.update({ "system.level": levelDecrease });
                affectedTokens.push({ token: token, state: AffectedToken.ConditionDecreased })
            }
            // Otherwise just remove the condition entirely
            else {
                token.actor.deleteEmbeddedDocuments("Item", [actorCond.id]);
                affectedTokens.push({ token: token, state: AffectedToken.ConditionRemoved })
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

        if (!cond.system.tags.includes(itemTag))
            cond.system.tags.push(itemTag);

        // If it doesn't include a "custom condition", add one; this causes the little label to pop up
        if (!cond.system.conditions.custom.includes(cond.name))
            cond.system.conditions.custom.push(cond.name);

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

        // Add data flag for the special initiative adjustment for the embedded active effect
        if (game.combat && setDuration.active && setDuration.end === "initiativeEnd") {
            cond.flags = cond.flags || {};
            cond.flags.lumos = { "initiativeEnd": getInitiativeForInitEndEffect() };
        }


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
            else {
                const updateInitEnd = game.combat && setDuration.end === "initiativeEnd";
                const targetInit = effect.flags.lumos?.initiativeEnd;
                actorEffect.update({
                    "duration": effect.duration,
                    ...(updateInitEnd && getEffectUpdatesForInitEndEffect(targetInit)),
                    ...(updateInitEnd && { "flags.lumos.initiativeEnd": targetInit })
                });
            }
            affectedTokens.push({ token: token, state: AffectedToken.ConditionAdded })
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
            affectedTokens.push({ token: token, state: AffectedToken.ConditionRemoved })
        }

        renderChatMessage(userId, effect.name, effect.texture, true, false, affectedTokens);
    }

    function createStatusEffect(name, icon, statusName, setDuration) {
        const effect = {
            name: name,
            icon: icon,
            statuses: [statusName],
            flags: {
                pf1: {
                    autoDelete: true
                },
            }
        };
        if (setDuration.active) {
            // Not sure why active status effects are always set to a number of seconds even when 
            // you use rounds (when you right-click on a status in the buffs page), but I'm following suit, just to be safe...
            effect.duration = createStatusEffectDuration(setDuration);

            if (game.combat && setDuration.end === "initiativeEnd") {
                effect.duration.end = "initiative";
                effect.flags.lumos = { "initiativeEnd": getInitiativeForInitEndEffect() };
            }
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
        switch (setDuration.units) {
            case "round": return setDuration.value * CONFIG.time.roundTime;
            case "minute": return setDuration.value * 60;
            case "hour": return setDuration.value * 3600;
            default: return setDuration.value;
        }
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
        affectedTokens.forEach(({ token, state }) => {
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
                ? `<div class="card-content">
                        <h4>${stateSectionText}</h4>
                        ${tokens.map(getHtmlForToken).join(" ")}
                    </div>`
                : "")
            .join("");

        const chatMessageContent = `
            <div class="pf1 chat-card">
                <header class="card-header type-color flexrow">
                    <img src="${condIcon}" title="${condName}" width="36" height="36" style="border: 0;${isStatus
                ? `${condName === "Battered" ? "mix-blend-mode: multiply;" : ""}filter: invert(1)` : ""}">
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
            ? { token: userControlledToken.id, actor: userControlledToken.actor?.id, alias: userControlledToken.name }
            : targetUser.character
                ? { actor: targetUser.character.id, alias: targetUser.character.name }
                : { user: userId, alias: targetUser.name };

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


    // Patched version of the original function in ActorPF. Doesn't expire initiative-timed effects on events that don't contain init info.
    async function patchedFunc_ExpireActiveEffects(
        { combat, timeOffset = 0, worldTime = null, event = null, initiative = null } = {},
        context = {}
        ) {
            if (!this.isOwner) throw new Error("Must be owner");

            // Canonical world time.
            // Due to async code in numerous places and no awaiting of time updates, this can go out of sync of actual time.
            worldTime ??= game.time.worldTime;
            worldTime += timeOffset;

            // Effects that have timed out
            const expiredEffects = this._effectsWithDuration.filter((ae) => {
                const { seconds, startTime } = ae.duration;
                const { rounds, startRound } = ae.duration;

                // Calculate remaining duration.
                // AE.duration.remaining is updated by Foundry only in combat and is unreliable.
                let remaining = Infinity;
                // Convert rounds to seconds
                if (Number.isFinite(seconds) && seconds >= 0) {
                    const elapsed = worldTime - (startTime ?? 0);
                    remaining = seconds - elapsed;
                } else if (rounds > 0 && combat) {
                    // BUG: This will ignore which combat the round tracking started for
                    const elapsed = combat.round - (startRound ?? 0);
                    remaining = (rounds - elapsed) * CONFIG.time.roundTime;
                }

                // Time still remaining
                if (remaining > 0) return false;

                const flags = ae.getFlag("pf1", "duration") ?? {};

                switch (flags.end || "turnStart") {
                    // Initiative based ending
                    case "initiative":
                        if (initiative !== null) {
                            return initiative <= flags.initiative;
                        }
                        // Anything not on initiative expires if they have negative time remaining
                        ////////////////// PATCH BEGINS HERE
                        //return remaining < 0;
                        // Do not expire initiative-timed effects if the current event is not initiative-related.
                        // Also note that "event" is null when this is called by CombatPF._processInitiative
                        return false;
                        ////////////////// PATCH ENDS HERE
                    // End on turn start, but we're not there yet
                    case "turnStart":
                        if (remaining === 0 && !["turnStart", "turnEnd"].includes(event)) return false;
                        break;
                    // End on turn end, but we're not quite there yet
                    case "turnEnd":
                        if (remaining === 0 && event !== "turnEnd") return false;
                        break;
                }

                // Otherwise end when time is out
                return remaining <= 0;
            });

            const disableActiveEffects = [],
                deleteActiveEffects = [],
                disableBuffs = [];

            for (const ae of expiredEffects) {
                let item;
                // Use AE parent when available
                if (ae.parent instanceof Item) item = ae.parent;
                // Otherwise support older origin cases
                else item = ae.origin ? fromUuidSync(ae.origin, { relative: this }) : null;

                if (item?.type === "buff") {
                    disableBuffs.push({ _id: item.id, "system.active": false });
                } else {
                    if (ae.getFlag("pf1", "autoDelete")) {
                        deleteActiveEffects.push(ae.id);
                    } else {
                        disableActiveEffects.push({ _id: ae.id, disabled: true });
                    }
                }
            }

            // Add context info for why this update happens to allow modules to understand the cause.
            context.pf1 ??= {};
            context.pf1.reason = "duration";

            if (deleteActiveEffects.length) {
                const deleteAEContext = foundry.utils.mergeObject(
                    { render: !disableBuffs.length && !disableActiveEffects.length },
                    context
                );
                await this.deleteEmbeddedDocuments("ActiveEffect", deleteActiveEffects, deleteAEContext);
            }

            if (disableActiveEffects.length) {
                const disableAEContext = foundry.utils.mergeObject({ render: !disableBuffs.length }, context);
                await this.updateEmbeddedDocuments("ActiveEffect", disableActiveEffects, disableAEContext);
            }

            if (disableBuffs.length) {
                await this.updateEmbeddedDocuments("Item", disableBuffs, context);
            }
        }



    await init();
})();