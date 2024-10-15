## Using the Add/Remove Effects Macro

**What is it?** A means to (more) easily add and remove status conditions **and custom buffs** from _actors_. In Foundry, an _actor_ is any entity that exists in a scene, usually represented by a token on the map. Normally, only the GM has permissions to add and remove conditions from tokens, but with my script, we can all do it, _provided a GM is connected to the server_ (required for permissions purposes, and unavoidable). Especially with Spheres, where every character has a dozen features with different effects, triggers, and durations, something like this has already proven to be invaluable – and we've only been using it for 2-3 sessions at this point, and it's been mostly me.

**Do I need a macro?** Yes, this is used with a macro, but one is provided for you. You can find it in the Foundry macro directory, or wherever your GM has placed it, as shown in the instructions below.

### Step 0: Pre-Setup

After setting up the world script and the macro, the GM should also create a folder to hold the custom buffs created by the players. Go to the Items tab in foundry and create a folder. The folder's name must be **exactly** `Custom Conditions`. 

<div style="display: flex; margin-bottom: 1em;">
  <div style="flex: 0 0 auto; margin-right: 1em;">
    <img src="img/cc_0.jpg" style="height: auto;">
  </div>
  <div>

I recommend giving all players ownership of the folder, unless you want to set up all their features yourself. Alternatively, you might want to set up a subfolder per player and only grant players ownership to their respective subfolders.

Any items of type `Buff` placed in this folder will be picked up by the script, and will be usable by everyone (that means all players as well as the GM).

  </div>
</div>



### Locating the Macro

**NB:** This step is mostly directed at my fellow players. In your game, your GM can place the macro anywhere else. And if you're the GM interested in using this module, you should know that the `CustomCondDialog.js` file contains the macro, and `CustomCondManager.js` contains the world script.

On my end, I've placed the macros in a folder at the top of the macros directory. All players have been granted Observer permissions, so they can execute the scripts, but can't otherwise modify them.


<img src="img/cc_1.png" align="left" />

You can find the macro in the **Foundry Macros Directory**, which is accessed in the following way:

* Click on the little folder icon beside your hotbar _(pic related, top)_
* Then open the "CUSTOM CONDITIONS MACROS" folder and see the "Add/Remove Conditions and Effects" macro _(pic related, middle)_. The world script is also there, but we don't need to do anything with it ever.
* Clicking it here will let you open and execute it, but you most likely want to drag the macro icon to your hotbar _(pic rel, bottom)_ for ease of use.

<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
  
### Using the Macro (Applying and Removing Conditions)

When you click on the macro (when you execute it), you'll see the following window. Each option that isn't self-explanatory has a tooltip, so you might want to read those too.

![](img/cc_2.jpg)

#### Select Condition
Lists all conditions defined by the Pathfinder 1e system. Also includes Battered (but I ought to be checking that the Spheres module is actually installed first).

**Any custom buff you place in the Custom Conditions folder will show up in this list.** Defining and using custom conditions is described in the following section.

You can select which condition you want to apply to the targeted tokens, or remove from the targeted tokens. Your choice is remembered, and any changes you make on the "set duration", "if present, increase level", or "only decrease level" fields is remembered _per condition_. For Pathfinder status conditions, the "increase level" and "decrease level" checkboxes are permanently disabled, as these conditions have no levels.

#### Applying and Removing Conditions

The process for using the macro is very simple:

* Select the condition you want to apply to or remove from the token(s) you are currently targeting.
* Click the Apply or Remove button to do so.

That's all. Keep the following in mind however:

* You must have a target to apply/remove the condition to. Targets can be selected using Foundry's built-in [Select Targets](https://foundryvtt.com/article/tokens/) tool.
* If a status condition is present on a targeted token and you choose the Apply option, it will not be reapplied or applied a second time.
* If a status condition is NOT present on a targeted token and you used the Remove option, that token will not be affected.
* On application, a Pathfinder game condition will be applied without a set duration; a custom effect will be applied with its default duration. This can be changed using the tickboxes.


### Using the Tickboxes
The tool provides certain options to expand your control over what is done to the targets. The following explains all available options in greater detail.

#### Set Duration
This option is available for all features, including Pathfinder status conditions. Only has an effect when you Apply a condition, and not when you remove it. Your choice for this option is remembered per selected condition.

If _NOT_ set, the condition will use its default duration. A Pathfinder status condition will be applied infinitely (until removed) without a duration; a custom buff will use its default duration as defined in its item entry.

If set, the duration of the applied condition will be set to the chosen value, both for Pathfinder status conditions as well as custom ones. Note that the "End Timing" property of a custom condition (Turn Start/Turn End/Initiative) remains in force: only the actual duration, in rounds, is overridden.

The default value of this option is the default duration of the chosen condition (always infinite for Pathfinder status conditions).


#### Increase Level
This option is only available for custom conditions. Only has an effect when you Apply a condition, and not when you remove it. Your choice for this option is remembered per selected condition.

If _NOT_ set, the condition will be applied with its default level. The level of a condition is set in the little box under its title bar (this is described in the next section), and is the variable available within the item as `@item.level`. A buff-type item normally doesn't use this for anything, and normally has a level of 0. Using the level of an effect is very handy on features that stack with multiple applications of themselves, such as Hindering Projectiles from Spheres of Might.

If set, and the condition is not present on a target, the condition will be added to that target and its level will be set to the chosen value. If the condition is already present on a target, the condition's level on that target will be _incremented_ by the chosen value.

The default value of this option is the default level of the chosen condition.


#### Decrease Level
This option is only available for custom conditions. Only has an effect when you Remove a condition, and not when you apply it. Your choice for this option is remembered per selected condition.

If _NOT_ set, the condition will be removed from a target token if present on it, regardless of the condition's level.

If set, the condition on a target will be _decremented_ by the chosen value. If this sets the condition's level to 0 or lower, the condition will be fully removed. To use Hindering Projectiles from Spheres of Might as our example once again, a creature afflicted by this talent can either remove one stack of it as a move action, or remove all stacks of it as a full-round action. In the former case, you can tick this box and set its value to "1", and in the latter case, you can leave the box unticked to remove the condition completely.

The default value of this option is the default level of the chosen condition.


#### Global Options: Condition Filtering and Keep Open
These options are always available, and do not vary based on the selected condition.

**Show Only Items I Own, or with Tag:** This applies only to custom condition items. If every player, as well as the GM, creates a dozen custom features to use with this tool, you probably don't want all of them to show up in your list of conditions to apply; not always, at least. If _NOT_ set, you'll see all custom conditions defined in the Custom Conditions folder. If set, you'll only see items that you own, as well as items that have the _tag_ that you specify in the respective textbox (if not left empty).

**Keep Window Open:** If this box is _NOT_ ticked, the window will close itself automatically when you apply or remove a condition. If set, it will remain open, and you can close it manually when you're done. Isn't that self-explanatory?



### Creating Custom Conditions
To add your own custom conditions for use with this tool:

1. Go to the Custom Conditions folder in the Items tab and create a new item. Make sure it's of type `Buff`. It's recommended to choose the `Miscellaneous` sub-type as well (if you don't, the script will override this for you).

![](img/cc_3.jpg)

2. This is enough for the condition to show up in the list when the macro is used. You can change the name and the icon to whatever you like, and add a description or any other content to this item. By default, the condition will have no duration (i.e. it will have an infinite duration) and no level, and will make no changes to the token it's applied to.

If you're using this for a feature that you just want to tag a token with, such as the Slayer's Studied Target, or something like the Scout sphere from Spheres of Might, you're done, and needn't do anything else. The condition can be selected, applied to, and removed from targeted tokens. 

![](img/cc_4.jpg)

I have now changed the name and the icon of my condition to Studied Target.

![](img/cc_5.jpg)