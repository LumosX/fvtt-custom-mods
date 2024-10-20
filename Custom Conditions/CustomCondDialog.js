class CustomCondDialog extends Dialog {
    constructor(dialogData = {}, options = {}) {
        super(dialogData, options);
        this.options.classes = ["dialog", "custom-conditions"];
        this.preventClose = false;
        this.loading = false;
    }

    static FLAG_KEY = "customConditionDialogState";

    saveState() {
        if (this.loading) return;

        const html = $(this.element);
        const conditionId = this.selectedCondition?.id || "default";

        const currentState = this.loadState();
        currentState[conditionId] = {
            name: this.selectedCondition?.name || "default",
            increaseLevel: this.toParamObject(html, "increase-level", false),
            decreaseLevel: this.toParamObject(html, "decrease-level", false),
            setDuration: {
                ...this.toParamObject(html, "set-duration", false),
                type: html.find("#duration-type").val(),
                end: html.find("#duration-end").val()
            },
        };
        
        // Global settings (not condition-specific)
        currentState.global = {
            selectedCondition: this.selectedCondition,
            filterItems: this.toParamObject(html, "filter-items", false),
            keepOpen: html.find("#keep-open").is(":checked")
        };
        
        game.user.setFlag("world", CustomCondDialog.FLAG_KEY, currentState);
    }

    loadState() {
        return game.user.getFlag("world", CustomCondDialog.FLAG_KEY) || {};
    }

    close() {
        // Hijack the closing mechanism to prevent closing without having to throw fake errors.
        if (this.preventClose) {
            this.preventClose = false;
            return;
        }
        super.close();
    }

    static getBuffItems() {
        let folder = game.folders.find(x => x.name === "Custom Conditions" && x.type === "Item");
        if (!folder) {
            ui.notifications.error("Could not retrieve the custom conditions folder. Ensure it's not been tampered with.");
            return [];
        }
        const getBuffs = dir => dir.contents.filter(x => x.type === "buff");
        return [folder, ...folder.getSubfolders(true)].flatMap(getBuffs);
    }

    static async create() {
        // All of this is very medieval, but I can't be arsed to do it better        
        const makeOptionButton = (id, name, img, isStatus = false) => `
            <div class="custom-option-container">
                <label class="custom-option">
                    <input type="radio" name="condition" value="${id}" ${isStatus ? "data-is-status='true'" : ""}>
                    <img src="${img}" alt="${name}" class="option-icon" ${isStatus 
                        ? `style="${name === "Battered" ? "mix-blend-mode: multiply;" : ""}filter: invert(1)"`: ""}>
                    <span>${name}</span>
                </label>
            </div>`;
            
        const conditions = CustomCondDialog.getBuffItems();

        const customConditionOptions = conditions.map(x => makeOptionButton(x.id, x.name, x.img)).join("");
        const statusOptions = Array.from(pf1.registry.conditions)
            .toSorted((a, b) => a.name.localeCompare(b.name))
            .map(x => makeOptionButton(x._id, x.name, x.texture, true))
            .join("");

        const optionCss = `
            .custom-select {
                position: relative;
                width: 100%;
            }
            .select-selected {
                min-height: 28px;
                background: rgba(0, 0, 0, 0.05);
                border-radius: 3px;
                border: 1px solid var(--color-border-light-tertiary);
                cursor: pointer;
                display: flex;
                align-items: center;
            }
            .select-selected::after {
                content: "\\f107";
                font-family: var(--font-awesome);
                font-weight: 900;
                position: absolute;
                right: 10px;
                top: 50%;
                transform: translateY(-50%);
            }
            .select-items {
                display: none;
                position: absolute;
                background-color: var(--pf1-faint);
                top: 100%;
                left: 0;
                right: 0;
                z-index: 99;
                max-height: 200px;
                overflow-y: auto;
                border: 1px solid #ccc;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            }
            .select-items label {
                padding: 0;
                display: flex;
                align-items: center;
                cursor: pointer;
            }
            .select-items label:hover {
                background-color: var(--color-bg-option);
            }
            .option-icon {
                width: 26px;
                height: 26px;
                margin-right: 5px;
                border: none;
            }
            .custom-option {
                display: flex;
            }
            .custom-option.hidden {
                visibility: collapse;
            }
            .custom-option input[type="radio"], .select-selected input[type="radio"] {
                display: none;
            }
            .custom-select, .select-selected, .select-items, .custom-option {
                pointer-events: auto;
            }
        `;
        
        const checkboxSectionCss = `
            .section-mini-title { font-weight: bold; margin-top: 5px; margin-bottom: 5px; }
            .inline-textbox { width: 40px !important; margin: 0 5px !important; }
            .inline-textbox-wide { width: auto !important; flex: 1 !important; margin: 0 5px !important; }
            .inline-textbox::placeholder { opacity:0.5 !important; }
            .inline-textbox-wide::placeholder { opacity:0.5 !important; }
            .tooltip { position: relative; display: inline-block; }
            .tooltip:hover .tooltip-text { visibility: visible; opacity: 1; }
            .tooltip .tooltip-text { 
                visibility: hidden;
                background-color: #555; 
                color: #fff; 
                text-align: center; 
                border-radius: 3px; 
                padding: 5px; 
                position: absolute; 
                z-index: 1; 
                top: 125%;
                opacity: 0; 
                transition: opacity 0.3s;
            }
            .form-group.disabled-group > *:not(.tooltip-text) {
                opacity: 0.5;
            }
            .form-group select {
                height: 26px;
                color: var(--color-text-dark-primary);
            }
            .form-group label {
                display: flex !important;
                align-items: center;
                white-space: nowrap;
                overflow: hidden;
            }
            
            .duration-end-wrapper label::before {
                content: '';
                display: inline-block;
                width: 25px;
                flex-shrink: 0;
            }
        `;
        
        const makeCheckbox = (id, label, inlineTextboxPlaceholder = null, {
            inlineTextboxClass = "inline-textbox",
            suffix = "",
            tooltipText = null,
        } = {}) => `<div class="form-group centred-tickbox tooltip">
                <input type="checkbox" id="${id}" name="${id}">
                <label for="${id}">
                    ${label}
                    ${inlineTextboxPlaceholder != null
                    ? `<input type="text" class="${inlineTextboxClass}"
                        id="${id}-value" name="${id}-value" placeholder="${inlineTextboxPlaceholder ?? ""}">` 
                    : ""}
                    ${suffix}
                </label>
                ${tooltipText ? `<span class="tooltip-text" id="${id}-tooltip" name="${id}-tooltip">${tooltipText}</span>` : ""}
            </div>`;
        
        const content = `
            <style>
                ${checkboxSectionCss}
                ${optionCss}
            </style>
            <form>
                <div class="form-group">
                    <label for="condition-select">Select Condition:</label>
                    <div class="custom-select">
                        <div class="select-selected">&nbsp;&nbsp;Select a condition</div>
                        <div class="select-items">
                            ${customConditionOptions}
                            ${statusOptions}
                        </div>
                    </div>
                </div>
                <hr>
                <div class="section-mini-title">On applying condition:</div>
                ${makeCheckbox("set-duration", "Set duration to", "1", {
                    suffix: `
                        <select id="duration-type">
                            <option value="round">rounds</option>
                            <option value="minute">minutes</option>
                            <option value="hour">hours</option>
                        </select>`,
                    tooltipText: "If checked and the effect has a duration, the duration of the effect on a target will be set (or reset, if already present) to " + 
                        "the specified duration (rounds/minutes/hours) and ending time condition."
                })}
                <div class="form-group tooltip duration-end-wrapper" style="margin: 0 5px">
                    <label for="duration-end">Ending at:</label>
                    <select id="duration-end">
                        <option value="turnStart">Start of target's turn</option>
                        <option value="turnEnd">End of target's turn</option>
                        <option value="initiative">This initiative count</option>
                        <option value="initiativeEnd">After this initiative count</option>
                    </select>
                    <span class="tooltip-text" id="duration-end-tooltip" name="duration-end-tooltip">
                        The effect will end on the respective round:<br>
                        <em>"Start/end of target's turn":</em> When <strong>the target's</strong> turn begins/ends.<br>
                        <em>"(After) This initiative count":</em> When this initiative count is reached/when the turn at this initiative count ends.
                    </span>
                </div>
                ${makeCheckbox("increase-level", "If present, increase level by", "1", {
                    tooltipText: "Increases the level of the effect (if any) on a target that already has it. An effect without a level will never be added if already present."
                })}
                <hr>
                <div class="section-mini-title">On removing condition:</div>
                ${makeCheckbox("decrease-level", "Only decrease level by", "1", {
                    tooltipText: "Decreases the level of the effect (if any) instead of removing it fully. An effect without a level will always be completely removed."
                })}
                <hr>
                ${makeCheckbox("filter-items", "Show only items I own, or with tag", "", { 
                    inlineTextboxClass: "inline-textbox-wide",
                    tooltipText: "\"Own\" means your user is set as an \"owner\" of the item in Foundry. If you specify a tag, comparison is not case-sensitive." 
                })}
                ${makeCheckbox("keep-open", "Keep window open after applying/removing effect")}
            </form>
        `;

        const dialog = new this({
            title: "Custom Conditions",
            content: content,
            buttons: {
                apply: {
                    icon: "<i class='fas fa-check'></i>",
                    label: "Apply",
                    callback: (html) => {
                        dialog.applyCondition(html);
                        if (html.find("#keep-open").is(":checked")) 
                            dialog.preventClose = true;
                    }
                },
                remove: {
                    icon: "<i class='fas fa-times'></i>",
                    label: "Remove",
                    callback: (html) => {
                        dialog.removeCondition(html);
                        if (html.find("#keep-open").is(":checked")) 
                            dialog.preventClose = true;
                    }
                }
            },
            default: "apply",
        });
        dialog.render(true);
    }

    // Instance methods
    activateListeners(html) {
        this.loading = true;
        super.activateListeners(html);
        this.addSelectorListeners(html);
        this.addDataChangeListeners(html);

        this.loadAndApplyState();
        this.loading = false;
        
        this.saveState();
    }


    addSelectorListeners(html) {
        const customSelect = html.find(".custom-select");
        const selectSelected = customSelect.find(".select-selected");
        const selectItems = customSelect.find(".select-items");

        selectSelected.on("click", event => {            
            selectItems.toggle();
            event.stopPropagation();
        });

        this.addItemSelectorListeners(html, selectItems, selectSelected);
        this.addItemFilteringListeners(html, selectItems);
        
        // Handler for the entire dialog, to close the "dropdown" if you click outside it
        $(this.element).on("click", event => {
            if (!customSelect.is(event.target) && customSelect.has(event.target).length === 0) {
                selectItems.hide();
            }
        });
    }

    addItemSelectorListeners(html, selectItems, selectSelected) {
        selectItems.find("input[type='radio']").on("click", async event => {
            const selectedOption = $(event.target).closest("label");
            selectSelected.html(selectedOption.html());
            selectItems.hide();
            this.selectedCondition = {
                id: event.target.value,
                name: selectedOption.find("span").text(),
                img: selectedOption.find("img").attr("src"),
                isStatus: event.target.dataset.isStatus === "true"
            };

            this.updateUIForSelectedCondition(html);

            // Set textbox placeholders based on the current condition's data
            let levelPlaceholder = 0, durationPlaceholder = 0;
            let durationTypePlaceholder = "round", durationEndPlaceholder = "turnStart";
            if (!this.selectedCondition.isStatus) {
                const condItem = game.items.get(this.selectedCondition.id);
                levelPlaceholder = condItem.system.level;
                
                durationTypePlaceholder = condItem.system.duration.units;
                if (!["round", "minute", "hour"].includes(durationTypePlaceholder))
                    durationTypePlaceholder = "round";
                const durSecs = await condItem.getDuration();
                durationPlaceholder = (() => {
                    switch (durationTypePlaceholder) {
                        case "round": return durSecs / CONFIG.time.roundTime;
                        case "minute": return durSecs / 60;
                        case "hour": return durSecs / 3600;
                    }
                })();

                durationEndPlaceholder = condItem.system.duration.end;
                if (!["turnStart", "turnEnd", "initiative"].includes(durationEndPlaceholder))
                    durationEndPlaceholder = "turnStart";
            }
            console.log(durationPlaceholder, durationTypePlaceholder, durationEndPlaceholder);
            html.find("#increase-level-value").attr("placeholder", levelPlaceholder);
            html.find("#decrease-level-value").attr("placeholder", levelPlaceholder);
            html.find("#set-duration-value").attr("placeholder", durationPlaceholder);
            html.find("#duration-type").val(durationTypePlaceholder);
            html.find("#duration-end").val(durationEndPlaceholder);

            // Disable level tickboxes for status conds
            const disableTicks = this.selectedCondition.isStatus;
            html.find("#increase-level, #decrease-level").prop("disabled", disableTicks);
            html.find("#increase-level-value, #decrease-level-value").prop("disabled", disableTicks);
            html.find("#increase-level, #decrease-level").closest(".form-group").toggleClass("disabled-group", disableTicks);

            this.saveState();
            event.stopPropagation();
        });
    }

    addItemFilteringListeners(html, selectItems) {
        // Change the currently selected object if it's hidden
        const ensureCurrentSelectionNotHidden = () => {
            const currentSelected = selectItems.find(`input[value="${this.selectedCondition?.id}"]`);
            if (currentSelected.length === 0 || currentSelected.closest("label").css("display") === "none")
                selectItems
                    .find("label")
                    .filter((_, x) => x.style.display !== "none")
                    .first()
                    .find("input[type='radio']:first")
                    .prop("checked", true)
                    .trigger("change");
        }

        const filterCustomItemOptions = () => {
            const doFilter = html.find("#filter-items").is(":checked")
            if (!doFilter) {
                // Show all items if filter is not checked
                selectItems.find("label").show();
                return;
            }

            const filterVal = html.find("#filter-items-value").val().trim().toLowerCase();
            selectItems.find("label").each((_, label) => {
                const $label = $(label);
                const itemId = $label.find("input").val();
                const item = game.items.get(itemId);

                if (!item) { // status effect
                    $label.show();
                    return;
                }
                if (item.ownership[game.user.id] === 3 
                    || item.system.tags?.map(x => x.toLowerCase()).includes(filterVal)) $label.show();
                else $label.hide();
            });
            ensureCurrentSelectionNotHidden();
        }

        html.find("#filter-items").on("input", filterCustomItemOptions); //where is rxJs when you need it
        html.find("#filter-items-value").on("input", filterCustomItemOptions);
        ensureCurrentSelectionNotHidden();
    }


    addDataChangeListeners(html) {
        // Ensure textbox input is always numbers, or an empty string:
        const sanitiseNumericInputs = event => {
            let value = (event.target.value || "").replace(/[^0-9]/g, "");
            if (value !== "")
                value = Math.min(Math.max(parseInt(value, 10), 0), 9999);
            event.target.value = value;
        }
        html.find("#increase-level-value, #decrease-level-value, #set-duration-value")
            .on("input", event => { sanitiseNumericInputs(event); this.saveState(); });

        html.find("#duration-type, #duration-end")
            .on("change", () => this.saveState());
        
        // Save state on ticking; wipe textboxes EXCEPT filtering tags when the respective tick is unticked
        html.find("#increase-level, #decrease-level, #set-duration").on("change", event => {
            const valTb = html.find(`#${event.target.id}-value`);
            valTb.css("opacity", event.target.checked ? 1 : 0.5);
            if (!event.target.checked) valTb?.val('')

            if (event.target.id === "set-duration") {
                html.find("#duration-type, #duration-end").css("opacity", event.target.checked ? 1 : 0.5);
            }

            this.saveState();
        });

        html.find("#filter-items").on("change", () => this.saveState());
        html.find("#filter-items-value").on("input", () => this.saveState());
    }

    loadAndApplyState() {
        const state = this.loadState();
        const html = $(this.element);
    
        // Apply global settings
        if (state.global) {
            this.selectedCondition = state.global.selectedCondition;
            this.setFromParamObject(html, "filter-items", state.global.filterItems);
            html.find("#keep-open").prop("checked", state.global.keepOpen ?? false);
        }
        // Apply condition-specific settings if a known condition is selected
        this.updateUIForSelectedCondition(html);
    
        // Trigger the filter function to force item reselection if necessary
        html.find("#filter-items").trigger("input");
    }

    updateUIForSelectedCondition(html) {
        const state = this.loadState();
        if (this.selectedCondition) {
            const condState = state[this.selectedCondition.id];
            if (condState) {
                this.setFromParamObject(html, "increase-level", condState.increaseLevel);
                this.setFromParamObject(html, "decrease-level", condState.decreaseLevel);
                this.setFromParamObject(html, "set-duration", condState.setDuration);
                if (condState.setDuration) {
                    html.find("#duration-type")
                        .val(condState.setDuration.type || "round")
                        .css("opacity", condState.setDuration.active ? 1 : 0.5);
                    html.find("#duration-end")
                        .val(condState.setDuration.end || "turnStart")
                        .css("opacity", condState.setDuration.active ? 1 : 0.5);
                }
            }

            // Update the select element to show the current condition
            const selectSelected = html.find(".select-selected");
            const selectedOption = html.find(`input[value="${this.selectedCondition.id}"]`).closest("label");
            selectSelected.html(selectedOption.html());
        }
    }


    parseTextboxNumber(textbox) {
        const stringVal = textbox.val().trim() === "" 
            ? textbox.attr("placeholder") 
            : textbox.val();
        return Number(stringVal) || 0;
    }

    toParamObject(html, name, numberInputOnly = true) {
        const valElem = html.find(`#${name}-value`)
        return {
            active: html.find(`#${name}`).is(":checked"),
            value: numberInputOnly ? this.parseTextboxNumber(valElem) : valElem.val()
        };
    }

    setFromParamObject(html, paramName, paramObject) {
        if (!paramObject) return;
        html.find(`#${paramName}`).prop("checked", paramObject.active);
        html.find(`#${paramName}-value`).val(paramObject.value);
    }

    async applyCondition(html) {
        if (game.user.targets.size === 0) {
            ui.notifications.warn("No tokens targeted.");
            return;
        }
        await game.customConditions.apply(game.user.id, {
            conditionId: this.selectedCondition.id,
            isStatus: this.selectedCondition.isStatus,
            increaseLevel: this.toParamObject(html, "increase-level"),
            setDuration: {
                ...this.toParamObject(html, "set-duration"),
                type: html.find("#duration-type").val(),
                end: html.find("#duration-end").val()
            },
        });
    }
    
    async removeCondition(html) {
        console.log("User", game.user, "targets", game.user.targets, "size", game.user.targets.size);
        if (game.user.targets.size === 0) {
            ui.notifications.warn("No tokens targeted.");
            return;
        }
        await game.customConditions.remove(game.user.id, {
            conditionId: this.selectedCondition.id,
            isStatus: this.selectedCondition.isStatus,
            decreaseLevel: this.toParamObject(html, "decrease-level"),
        });
    }
}

await CustomCondDialog.create();