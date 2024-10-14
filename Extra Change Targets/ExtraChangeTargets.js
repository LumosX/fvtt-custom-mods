Hooks.once("pf1PostReady", () => {
    console.log("Lumos's Extra Change Targets | Initialising...");

    const category = "lumos";
    CONFIG.PF1.buffTargetCategories[category] = {
        label: "Lumos's Extra Targets",
        filters: { actor: { exclude: ["haunt", "vehicle", "trap"] } }
    };

    const manoeuvres = {
        bull_rush: "Bull Rush",
        dirty_trick: "Dirty Trick",
        disarm: "Disarm",
        drag: "Drag",
        grapple: "Grapple",
        hamstring: "Hamstring",
        overrun: "Overrun",
        reposition: "Reposition",
        steal: "Steal",
        sunder: "Sunder",
        trip: "Trip"
    };
    CONFIG.PF1.lumos = {};
    CONFIG.PF1.lumos.manoeuvres = manoeuvres;

    const newTargets = {
        bonus_feint: { label: "Bonus to Feint", category: category },
        bonus_vs_feint: { label: "Bonus vs Feint", category: category },
        size_bonus_damage: { label: "Size Increase (for damage only)", category: category },
        size_bonus_reach: { label: "Size Increase (for reach only)", category: category }
    };
    
    for (const [id, name] of Object.entries(manoeuvres)) {
        newTargets[`cmb_${id}`] = { label: `CMB for ${name}`, category: category };
        newTargets[`cmd_${id}`] = { label: `CMD vs ${name}`, category: category };
    }

    // Add the new targets to the configuration
    CONFIG.PF1.lumos.changeTargets = [];
    Object.entries(newTargets).forEach(([key, value]) => {
        CONFIG.PF1.buffTargets[key] = value;
        CONFIG.PF1.lumos.changeTargets.push(key);
    });
});

Hooks.on("pf1GetChangeFlat", (result, target, modifierType, value, actor) => {
    if (CONFIG.PF1.lumos.changeTargets.includes(target)) {
        result.push(`system.lumos.${target}`);
    }
});

Hooks.on("pf1PrepareBaseActorData", (actor, data) => {
    if (actor.type === "basic") return;

    actor.system.lumos = actor.system.lumos || {}
    CONFIG.PF1.lumos.changeTargets.forEach(field => actor.system.lumos[field] = 0);
});

// This is needed to actually persist the custom data structure.
Hooks.on("preUpdateActor", (actor, updateData, options, userId) => {
    if (actor.type === "basic") return;
    if (!updateData.system) return;

    if (!updateData.system.lumos) updateData.system.lumos = {};
    updateData.system.lumos = mergeObject(actor.system.lumos || {}, updateData.system.lumos);
});
